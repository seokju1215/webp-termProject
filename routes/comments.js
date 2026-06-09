const express = require('express');
const { query } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router({ mergeParams: true });

async function checkProjectAccess(projectId, userId) {
  const { rows } = await query(
    `SELECT p.id FROM projects p
     JOIN team_members tm ON tm.team_id = p.team_id
     WHERE p.id = $1 AND tm.user_id = $2`,
    [projectId, userId]
  );
  return rows.length > 0;
}

// GET /api/projects/:projectId/comments — 목록 (검색/필터/정렬/페이지네이션)
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { q, status, assignee, sort = 'created_at', order = 'desc', page = '1', limit = '20' } = req.query;

    if (!(await checkProjectAccess(projectId, req.user.id))) {
      return res.status(403).json({ error: 'FORBIDDEN', message: '접근 권한이 없습니다.' });
    }

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, parseInt(limit) || 20);
    const offset = (pageNum - 1) * limitNum;
    const sortCol = ['created_at', 'status'].includes(sort) ? sort : 'created_at';
    const orderDir = order === 'asc' ? 'ASC' : 'DESC';

    const params = [projectId];
    const filters = [];

    if (q) {
      params.push(`%${q}%`);
      filters.push(`(c.content ILIKE $${params.length} OR c.selector ILIKE $${params.length} OR c.tag_name ILIKE $${params.length})`);
    }
    if (status && ['IN_PROGRESS', 'DONE', 'FAILED'].includes(status)) {
      params.push(status);
      filters.push(`c.status = $${params.length}`);
    }
    if (assignee) {
      params.push(assignee);
      filters.push(`c.assignee_id = $${params.length}`);
    }

    const whereExtra = filters.length ? 'AND ' + filters.join(' AND ') : '';
    params.push(limitNum, offset);
    const limitIdx = params.length - 1;
    const offsetIdx = params.length;

    const { rows } = await query(
      `SELECT c.*,
         u.name AS created_by_name,
         a.name AS assignee_name, a.email AS assignee_email
       FROM comments c
       LEFT JOIN users u ON u.id = c.created_by_id
       LEFT JOIN users a ON a.id = c.assignee_id
       WHERE c.project_id = $1 ${whereExtra}
       ORDER BY c.${sortCol} ${orderDir}
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      params
    );

    const countParams = [projectId];
    const countFilters = [];
    if (q) {
      countParams.push(`%${q}%`);
      countFilters.push(`(content ILIKE $${countParams.length} OR selector ILIKE $${countParams.length} OR tag_name ILIKE $${countParams.length})`);
    }
    if (status && ['IN_PROGRESS', 'DONE', 'FAILED'].includes(status)) {
      countParams.push(status);
      countFilters.push(`status = $${countParams.length}`);
    }
    if (assignee) {
      countParams.push(assignee);
      countFilters.push(`assignee_id = $${countParams.length}`);
    }
    const countWhere = countFilters.length ? 'AND ' + countFilters.join(' AND ') : '';
    const { rows: countRows } = await query(
      `SELECT COUNT(*) FROM comments WHERE project_id = $1 ${countWhere}`,
      countParams
    );

    const total = parseInt(countRows[0].count);
    res.json({
      data: rows,
      meta: { total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) }
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/projects/:projectId/comments/:commentId/status — 상태 변경 (팀 멤버)
router.patch('/:commentId/status', requireAuth, async (req, res, next) => {
  try {
    const { projectId, commentId } = req.params;
    const { status } = req.body;

    if (!['IN_PROGRESS', 'DONE', 'FAILED'].includes(status)) {
      return res.status(400).json({ error: 'VALIDATION', message: '올바른 상태값이 아닙니다. (IN_PROGRESS | DONE | FAILED)' });
    }

    if (!(await checkProjectAccess(projectId, req.user.id))) {
      return res.status(403).json({ error: 'FORBIDDEN', message: '접근 권한이 없습니다.' });
    }

    const existing = await query(
      'SELECT id FROM comments WHERE id = $1 AND project_id = $2',
      [commentId, projectId]
    );
    if (!existing.rows.length) {
      return res.status(404).json({ error: 'NOT_FOUND', message: '댓글을 찾을 수 없습니다.' });
    }

    const { rows } = await query(
      'UPDATE comments SET status = $1 WHERE id = $2 RETURNING *',
      [status, commentId]
    );

    res.json({ data: rows[0] });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/projects/:projectId/comments/:commentId/assignee — 담당자 할당 (팀 멤버)
router.patch('/:commentId/assignee', requireAuth, async (req, res, next) => {
  try {
    const { projectId, commentId } = req.params;
    const { assigneeId } = req.body;

    if (!(await checkProjectAccess(projectId, req.user.id))) {
      return res.status(403).json({ error: 'FORBIDDEN', message: '접근 권한이 없습니다.' });
    }

    const existing = await query(
      'SELECT id FROM comments WHERE id = $1 AND project_id = $2',
      [commentId, projectId]
    );
    if (!existing.rows.length) {
      return res.status(404).json({ error: 'NOT_FOUND', message: '댓글을 찾을 수 없습니다.' });
    }

    // assigneeId가 팀 멤버인지 확인 (null 허용 — 담당자 해제)
    if (assigneeId) {
      const memberCheck = await query(
        `SELECT 1 FROM team_members tm
         JOIN projects p ON p.team_id = tm.team_id
         WHERE p.id = $1 AND tm.user_id = $2`,
        [projectId, assigneeId]
      );
      if (!memberCheck.rows.length) {
        return res.status(400).json({ error: 'VALIDATION', message: '팀 멤버만 담당자로 지정할 수 있습니다.' });
      }
    }

    const { rows } = await query(
      `UPDATE comments SET assignee_id = $1 WHERE id = $2
       RETURNING *, (SELECT name FROM users WHERE id = $1) AS assignee_name`,
      [assigneeId || null, commentId]
    );

    res.json({ data: rows[0] });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/projects/:projectId/comments/:commentId — 삭제 (작성자 또는 팀 멤버)
router.delete('/:commentId', requireAuth, async (req, res, next) => {
  try {
    const { projectId, commentId } = req.params;

    if (!(await checkProjectAccess(projectId, req.user.id))) {
      return res.status(403).json({ error: 'FORBIDDEN', message: '접근 권한이 없습니다.' });
    }

    const existing = await query(
      'SELECT * FROM comments WHERE id = $1 AND project_id = $2',
      [commentId, projectId]
    );
    if (!existing.rows.length) {
      return res.status(404).json({ error: 'NOT_FOUND', message: '댓글을 찾을 수 없습니다.' });
    }

    const comment = existing.rows[0];
    if (comment.created_by_id && comment.created_by_id !== req.user.id) {
      return res.status(403).json({ error: 'FORBIDDEN', message: '본인이 작성한 댓글만 삭제할 수 있습니다.' });
    }

    await query('DELETE FROM comments WHERE id = $1', [commentId]);
    res.json({ message: '댓글이 삭제되었습니다.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
