const express = require('express');
const crypto = require('crypto');
const { query } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// POST /api/teams — 팀 생성 (생성자 자동 멤버 등록)
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'VALIDATION', message: '팀 이름을 입력해주세요.' });
    }

    const { rows } = await query(
      'INSERT INTO teams (name) VALUES ($1) RETURNING *',
      [name.trim()]
    );
    const team = rows[0];

    await query(
      'INSERT INTO team_members (team_id, user_id) VALUES ($1, $2)',
      [team.id, req.user.id]
    );

    res.status(201).json({ data: team });
  } catch (err) {
    next(err);
  }
});

// GET /api/teams — 내 팀 목록
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT t.*,
         (SELECT COUNT(*) FROM team_members WHERE team_id = t.id) AS member_count,
         (SELECT COUNT(*) FROM projects WHERE team_id = t.id) AS project_count
       FROM teams t
       JOIN team_members tm ON tm.team_id = t.id
       WHERE tm.user_id = $1
       ORDER BY t.created_at DESC`,
      [req.user.id]
    );
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

// POST /api/teams/invitations/:token/accept — 초대 수락
// ※ /:teamId 라우트보다 먼저 등록해야 충돌 방지
router.post('/invitations/:token/accept', requireAuth, async (req, res, next) => {
  try {
    const { token } = req.params;

    const { rows } = await query(
      `SELECT * FROM team_invitations WHERE token = $1 AND status = 'PENDING'`,
      [token]
    );
    if (!rows.length) {
      return res.status(404).json({ error: 'INVALID_TOKEN', message: '유효하지 않은 초대 링크입니다.' });
    }

    const invite = rows[0];
    if (invite.email !== req.user.email) {
      return res.status(403).json({ error: 'EMAIL_MISMATCH', message: '초대된 이메일과 로그인 계정이 다릅니다.' });
    }

    await query(
      'INSERT INTO team_members (team_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [invite.team_id, req.user.id]
    );
    await query(
      `UPDATE team_invitations SET status = 'ACCEPTED' WHERE id = $1`,
      [invite.id]
    );

    res.json({ data: { team_id: invite.team_id }, message: '팀에 참여했습니다.' });
  } catch (err) {
    next(err);
  }
});

// GET /api/teams/:teamId — 팀 상세
router.get('/:teamId', requireAuth, async (req, res, next) => {
  try {
    const { teamId } = req.params;

    const memberCheck = await query(
      'SELECT 1 FROM team_members WHERE team_id = $1 AND user_id = $2',
      [teamId, req.user.id]
    );
    if (!memberCheck.rows.length) {
      return res.status(403).json({ error: 'FORBIDDEN', message: '팀 멤버만 접근할 수 있습니다.' });
    }

    const { rows } = await query('SELECT * FROM teams WHERE id = $1', [teamId]);
    if (!rows.length) {
      return res.status(404).json({ error: 'NOT_FOUND', message: '팀을 찾을 수 없습니다.' });
    }

    res.json({ data: rows[0] });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/teams/:teamId — 팀 삭제 (멤버만)
router.delete('/:teamId', requireAuth, async (req, res, next) => {
  try {
    const { teamId } = req.params;

    const memberCheck = await query(
      'SELECT 1 FROM team_members WHERE team_id = $1 AND user_id = $2',
      [teamId, req.user.id]
    );
    if (!memberCheck.rows.length) {
      return res.status(403).json({ error: 'FORBIDDEN', message: '팀 멤버만 삭제할 수 있습니다.' });
    }

    await query('DELETE FROM teams WHERE id = $1', [teamId]);
    res.json({ message: '팀이 삭제되었습니다.' });
  } catch (err) {
    next(err);
  }
});

// POST /api/teams/:teamId/invite — 이메일 초대
router.post('/:teamId/invite', requireAuth, async (req, res, next) => {
  try {
    const { teamId } = req.params;
    const { email } = req.body;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'VALIDATION', message: '올바른 이메일을 입력해주세요.' });
    }

    const memberCheck = await query(
      'SELECT 1 FROM team_members WHERE team_id = $1 AND user_id = $2',
      [teamId, req.user.id]
    );
    if (!memberCheck.rows.length) {
      return res.status(403).json({ error: 'FORBIDDEN', message: '팀 멤버만 초대할 수 있습니다.' });
    }

    const alreadyMember = await query(
      `SELECT 1 FROM team_members tm
       JOIN users u ON u.id = tm.user_id
       WHERE tm.team_id = $1 AND u.email = $2`,
      [teamId, email]
    );
    if (alreadyMember.rows.length) {
      return res.status(409).json({ error: 'ALREADY_MEMBER', message: '이미 팀 멤버입니다.' });
    }

    // 기존 PENDING 초대 만료 처리
    await query(
      `UPDATE team_invitations SET status = 'EXPIRED'
       WHERE team_id = $1 AND email = $2 AND status = 'PENDING'`,
      [teamId, email]
    );

    const token = crypto.randomBytes(32).toString('hex');
    const { rows } = await query(
      'INSERT INTO team_invitations (team_id, email, token) VALUES ($1, $2, $3) RETURNING *',
      [teamId, email, token]
    );

    res.status(201).json({ data: rows[0], message: '초대가 생성되었습니다.' });
  } catch (err) {
    next(err);
  }
});

// GET /api/teams/:teamId/members — 멤버 목록
router.get('/:teamId/members', requireAuth, async (req, res, next) => {
  try {
    const { teamId } = req.params;

    const memberCheck = await query(
      'SELECT 1 FROM team_members WHERE team_id = $1 AND user_id = $2',
      [teamId, req.user.id]
    );
    if (!memberCheck.rows.length) {
      return res.status(403).json({ error: 'FORBIDDEN', message: '팀 멤버만 접근할 수 있습니다.' });
    }

    const { rows } = await query(
      `SELECT u.id, u.name, u.email, u.created_at, tm.created_at AS joined_at
       FROM users u
       JOIN team_members tm ON tm.user_id = u.id
       WHERE tm.team_id = $1
       ORDER BY tm.created_at ASC`,
      [teamId]
    );

    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

// GET /api/teams/:teamId/invitations — PENDING 초대 목록
router.get('/:teamId/invitations', requireAuth, async (req, res, next) => {
  try {
    const { teamId } = req.params;

    const memberCheck = await query(
      'SELECT 1 FROM team_members WHERE team_id = $1 AND user_id = $2',
      [teamId, req.user.id]
    );
    if (!memberCheck.rows.length) {
      return res.status(403).json({ error: 'FORBIDDEN', message: '팀 멤버만 접근할 수 있습니다.' });
    }

    const { rows } = await query(
      `SELECT * FROM team_invitations
       WHERE team_id = $1 AND status = 'PENDING'
       ORDER BY created_at DESC`,
      [teamId]
    );

    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/teams/:teamId/members/:userId — 멤버 제거 (본인 탈퇴 또는 멤버 제거)
router.delete('/:teamId/members/:userId', requireAuth, async (req, res, next) => {
  try {
    const { teamId, userId } = req.params;

    const memberCheck = await query(
      'SELECT 1 FROM team_members WHERE team_id = $1 AND user_id = $2',
      [teamId, req.user.id]
    );
    if (!memberCheck.rows.length) {
      return res.status(403).json({ error: 'FORBIDDEN', message: '팀 멤버만 접근할 수 있습니다.' });
    }

    await query(
      'DELETE FROM team_members WHERE team_id = $1 AND user_id = $2',
      [teamId, userId]
    );

    res.json({ message: '멤버가 제거되었습니다.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
