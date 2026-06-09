const express = require('express');
const path = require('path');
const multer = require('multer');
const { query } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router({ mergeParams: true });

const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `project-${Date.now()}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('이미지 파일만 업로드할 수 있습니다.'));
    }
    cb(null, true);
  },
});

async function checkMember(teamId, userId) {
  const { rows } = await query(
    'SELECT 1 FROM team_members WHERE team_id = $1 AND user_id = $2',
    [teamId, userId]
  );
  return rows.length > 0;
}

// GET /api/teams/:teamId/projects — 프로젝트 목록 (검색/정렬/페이지네이션)
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { teamId } = req.params;
    const { q, sort = 'created_at', order = 'desc', page = '1', limit = '20' } = req.query;

    if (!(await checkMember(teamId, req.user.id))) {
      return res.status(403).json({ error: 'FORBIDDEN', message: '팀 멤버만 접근할 수 있습니다.' });
    }

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, parseInt(limit) || 20);
    const offset = (pageNum - 1) * limitNum;
    const sortCol = ['created_at', 'name'].includes(sort) ? sort : 'created_at';
    const orderDir = order === 'asc' ? 'ASC' : 'DESC';

    const params = [teamId, req.user.id];
    let filter = '';

    if (q) {
      params.push(`%${q}%`);
      filter = `AND p.name ILIKE $${params.length}`;
    }

    params.push(limitNum, offset);
    const limitIdx = params.length - 1;
    const offsetIdx = params.length;

    const { rows } = await query(
      `SELECT p.*,
         (SELECT COUNT(*) FROM test_cases tc WHERE tc.project_id = p.id) AS testcase_count,
         (SELECT COUNT(*) FROM comments c WHERE c.project_id = p.id) AS comment_count,
         EXISTS(SELECT 1 FROM bookmarks b WHERE b.project_id = p.id AND b.user_id = $2) AS bookmarked
       FROM projects p
       WHERE p.team_id = $1 ${filter}
       ORDER BY p.${sortCol} ${orderDir}
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      params
    );

    const countParams = [teamId];
    let countFilter = '';
    if (q) {
      countParams.push(`%${q}%`);
      countFilter = `AND name ILIKE $${countParams.length}`;
    }
    const { rows: countRows } = await query(
      `SELECT COUNT(*) FROM projects WHERE team_id = $1 ${countFilter}`,
      countParams
    );

    const total = parseInt(countRows[0].count);
    res.json({
      data: rows,
      meta: { total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/teams/:teamId/projects — 프로젝트 생성 (multipart/form-data)
router.post('/', requireAuth, upload.single('image'), async (req, res, next) => {
  try {
    const { teamId } = req.params;
    const { name, url } = req.body;

    if (!(await checkMember(teamId, req.user.id))) {
      return res.status(403).json({ error: 'FORBIDDEN', message: '팀 멤버만 프로젝트를 생성할 수 있습니다.' });
    }

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'VALIDATION', message: '프로젝트 이름을 입력해주세요.' });
    }
    if (!url || !url.trim()) {
      return res.status(400).json({ error: 'VALIDATION', message: 'URL을 입력해주세요.' });
    }

    const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

    const { rows } = await query(
      'INSERT INTO projects (team_id, name, url, image_url) VALUES ($1, $2, $3, $4) RETURNING *',
      [teamId, name.trim(), url.trim(), imageUrl]
    );

    res.status(201).json({ data: rows[0] });
  } catch (err) {
    next(err);
  }
});

// GET /api/teams/:teamId/projects/:projectId — 프로젝트 상세
router.get('/:projectId', requireAuth, async (req, res, next) => {
  try {
    const { teamId, projectId } = req.params;

    if (!(await checkMember(teamId, req.user.id))) {
      return res.status(403).json({ error: 'FORBIDDEN', message: '팀 멤버만 접근할 수 있습니다.' });
    }

    const { rows } = await query(
      `SELECT p.*,
         (SELECT COUNT(*) FROM test_cases tc WHERE tc.project_id = p.id) AS testcase_count,
         (SELECT COUNT(*) FROM comments c WHERE c.project_id = p.id) AS comment_count,
         EXISTS(SELECT 1 FROM bookmarks b WHERE b.project_id = p.id AND b.user_id = $2) AS bookmarked
       FROM projects p
       WHERE p.id = $1 AND p.team_id = $3`,
      [projectId, req.user.id, teamId]
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'NOT_FOUND', message: '프로젝트를 찾을 수 없습니다.' });
    }

    res.json({ data: rows[0] });
  } catch (err) {
    next(err);
  }
});

// PUT /api/teams/:teamId/projects/:projectId — 프로젝트 수정 (multipart/form-data)
router.put('/:projectId', requireAuth, upload.single('image'), async (req, res, next) => {
  try {
    const { teamId, projectId } = req.params;
    const { name, url } = req.body;

    if (!(await checkMember(teamId, req.user.id))) {
      return res.status(403).json({ error: 'FORBIDDEN', message: '팀 멤버만 수정할 수 있습니다.' });
    }

    const existing = await query(
      'SELECT * FROM projects WHERE id = $1 AND team_id = $2',
      [projectId, teamId]
    );
    if (!existing.rows.length) {
      return res.status(404).json({ error: 'NOT_FOUND', message: '프로젝트를 찾을 수 없습니다.' });
    }

    const updates = {};
    if (name !== undefined) updates.name = name.trim();
    if (url !== undefined) updates.url = url.trim();
    if (req.file) updates.image_url = `/uploads/${req.file.filename}`;

    if (!Object.keys(updates).length) {
      return res.status(400).json({ error: 'VALIDATION', message: '수정할 내용을 입력해주세요.' });
    }

    const setClauses = Object.keys(updates).map((k, i) => `${k} = $${i + 2}`);
    const values = [projectId, ...Object.values(updates)];

    const { rows } = await query(
      `UPDATE projects SET ${setClauses.join(', ')} WHERE id = $1 RETURNING *`,
      values
    );

    res.json({ data: rows[0] });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/teams/:teamId/projects/:projectId — 프로젝트 삭제
router.delete('/:projectId', requireAuth, async (req, res, next) => {
  try {
    const { teamId, projectId } = req.params;

    if (!(await checkMember(teamId, req.user.id))) {
      return res.status(403).json({ error: 'FORBIDDEN', message: '팀 멤버만 삭제할 수 있습니다.' });
    }

    const existing = await query(
      'SELECT * FROM projects WHERE id = $1 AND team_id = $2',
      [projectId, teamId]
    );
    if (!existing.rows.length) {
      return res.status(404).json({ error: 'NOT_FOUND', message: '프로젝트를 찾을 수 없습니다.' });
    }

    await query('DELETE FROM projects WHERE id = $1', [projectId]);
    res.json({ message: '프로젝트가 삭제되었습니다.' });
  } catch (err) {
    next(err);
  }
});

// POST /api/teams/:teamId/projects/:projectId/bookmark — 북마크 토글
router.post('/:projectId/bookmark', requireAuth, async (req, res, next) => {
  try {
    const { teamId, projectId } = req.params;

    if (!(await checkMember(teamId, req.user.id))) {
      return res.status(403).json({ error: 'FORBIDDEN', message: '팀 멤버만 북마크할 수 있습니다.' });
    }

    const existing = await query(
      'SELECT * FROM bookmarks WHERE user_id = $1 AND project_id = $2',
      [req.user.id, projectId]
    );

    if (existing.rows.length) {
      await query('DELETE FROM bookmarks WHERE user_id = $1 AND project_id = $2', [req.user.id, projectId]);
      res.json({ data: { bookmarked: false }, message: '북마크가 해제되었습니다.' });
    } else {
      await query('INSERT INTO bookmarks (user_id, project_id) VALUES ($1, $2)', [req.user.id, projectId]);
      res.json({ data: { bookmarked: true }, message: '북마크에 추가되었습니다.' });
    }
  } catch (err) {
    next(err);
  }
});

module.exports = router;
