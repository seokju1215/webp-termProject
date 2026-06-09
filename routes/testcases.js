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

// GET /api/projects/:projectId/testcases — 목록 (검색/필터/정렬/페이지네이션)
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { q, status, sort = 'created_at', order = 'desc', page = '1', limit = '20' } = req.query;

    if (!(await checkProjectAccess(projectId, req.user.id))) {
      return res.status(403).json({ error: 'FORBIDDEN', message: '접근 권한이 없습니다.' });
    }

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, parseInt(limit) || 20);
    const offset = (pageNum - 1) * limitNum;
    const sortCol = ['created_at', 'title', 'status'].includes(sort) ? sort : 'created_at';
    const orderDir = order === 'asc' ? 'ASC' : 'DESC';

    const params = [projectId];
    const filters = [];

    if (q) {
      params.push(`%${q}%`);
      filters.push(`(tc.title ILIKE $${params.length} OR tc.description ILIKE $${params.length})`);
    }
    if (status && ['IN_PROGRESS', 'DONE', 'FAILED'].includes(status)) {
      params.push(status);
      filters.push(`tc.status = $${params.length}`);
    }

    const whereExtra = filters.length ? 'AND ' + filters.join(' AND ') : '';
    params.push(limitNum, offset);
    const limitIdx = params.length - 1;
    const offsetIdx = params.length;

    const { rows } = await query(
      `SELECT tc.*, u.name AS created_by_name,
         (SELECT COUNT(*) FROM comments c WHERE c.test_case_id = tc.id) AS comment_count
       FROM test_cases tc
       JOIN users u ON u.id = tc.created_by_id
       WHERE tc.project_id = $1 ${whereExtra}
       ORDER BY tc.${sortCol} ${orderDir}
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      params
    );

    // 카운트 쿼리 (meta용)
    const countParams = [projectId];
    const countFilters = [];
    if (q) {
      countParams.push(`%${q}%`);
      countFilters.push(`(title ILIKE $${countParams.length} OR description ILIKE $${countParams.length})`);
    }
    if (status && ['IN_PROGRESS', 'DONE', 'FAILED'].includes(status)) {
      countParams.push(status);
      countFilters.push(`status = $${countParams.length}`);
    }
    const countWhere = countFilters.length ? 'AND ' + countFilters.join(' AND ') : '';
    const { rows: countRows } = await query(
      `SELECT COUNT(*) FROM test_cases WHERE project_id = $1 ${countWhere}`,
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

// POST /api/projects/:projectId/testcases — 생성
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { title, description } = req.body;

    if (!(await checkProjectAccess(projectId, req.user.id))) {
      return res.status(403).json({ error: 'FORBIDDEN', message: '접근 권한이 없습니다.' });
    }

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'VALIDATION', message: '제목을 입력해주세요.' });
    }

    const { rows } = await query(
      'INSERT INTO test_cases (project_id, created_by_id, title, description) VALUES ($1, $2, $3, $4) RETURNING *',
      [projectId, req.user.id, title.trim(), description || null]
    );

    res.status(201).json({ data: rows[0] });
  } catch (err) {
    next(err);
  }
});

// GET /api/projects/:projectId/testcases/:testcaseId — 상세
router.get('/:testcaseId', requireAuth, async (req, res, next) => {
  try {
    const { projectId, testcaseId } = req.params;

    if (!(await checkProjectAccess(projectId, req.user.id))) {
      return res.status(403).json({ error: 'FORBIDDEN', message: '접근 권한이 없습니다.' });
    }

    const { rows } = await query(
      `SELECT tc.*, u.name AS created_by_name
       FROM test_cases tc
       JOIN users u ON u.id = tc.created_by_id
       WHERE tc.id = $1 AND tc.project_id = $2`,
      [testcaseId, projectId]
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'NOT_FOUND', message: '테스트케이스를 찾을 수 없습니다.' });
    }

    res.json({ data: rows[0] });
  } catch (err) {
    next(err);
  }
});

// PUT /api/projects/:projectId/testcases/:testcaseId — 수정 (생성자만)
router.put('/:testcaseId', requireAuth, async (req, res, next) => {
  try {
    const { projectId, testcaseId } = req.params;
    const { title, description, status } = req.body;

    if (!(await checkProjectAccess(projectId, req.user.id))) {
      return res.status(403).json({ error: 'FORBIDDEN', message: '접근 권한이 없습니다.' });
    }

    const existing = await query(
      'SELECT * FROM test_cases WHERE id = $1 AND project_id = $2',
      [testcaseId, projectId]
    );
    if (!existing.rows.length) {
      return res.status(404).json({ error: 'NOT_FOUND', message: '테스트케이스를 찾을 수 없습니다.' });
    }
    if (existing.rows[0].created_by_id !== req.user.id) {
      return res.status(403).json({ error: 'FORBIDDEN', message: '본인이 작성한 테스트케이스만 수정할 수 있습니다.' });
    }

    if (status !== undefined && !['IN_PROGRESS', 'DONE', 'FAILED'].includes(status)) {
      return res.status(400).json({ error: 'VALIDATION', message: '올바른 상태값이 아닙니다.' });
    }

    const updates = {};
    if (title !== undefined) updates.title = title.trim();
    if (description !== undefined) updates.description = description;
    if (status !== undefined) updates.status = status;

    if (!Object.keys(updates).length) {
      return res.status(400).json({ error: 'VALIDATION', message: '수정할 내용을 입력해주세요.' });
    }

    const setClauses = Object.keys(updates).map((k, i) => `${k} = $${i + 2}`);
    const values = [testcaseId, ...Object.values(updates)];

    const { rows } = await query(
      `UPDATE test_cases SET ${setClauses.join(', ')} WHERE id = $1 RETURNING *`,
      values
    );

    res.json({ data: rows[0] });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/projects/:projectId/testcases/:testcaseId — 삭제 (생성자만)
router.delete('/:testcaseId', requireAuth, async (req, res, next) => {
  try {
    const { projectId, testcaseId } = req.params;

    if (!(await checkProjectAccess(projectId, req.user.id))) {
      return res.status(403).json({ error: 'FORBIDDEN', message: '접근 권한이 없습니다.' });
    }

    const existing = await query(
      'SELECT * FROM test_cases WHERE id = $1 AND project_id = $2',
      [testcaseId, projectId]
    );
    if (!existing.rows.length) {
      return res.status(404).json({ error: 'NOT_FOUND', message: '테스트케이스를 찾을 수 없습니다.' });
    }
    if (existing.rows[0].created_by_id !== req.user.id) {
      return res.status(403).json({ error: 'FORBIDDEN', message: '본인이 작성한 테스트케이스만 삭제할 수 있습니다.' });
    }

    await query('DELETE FROM test_cases WHERE id = $1', [testcaseId]);
    res.json({ message: '테스트케이스가 삭제되었습니다.' });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/projects/:projectId/testcases/:testcaseId/status — 상태 변경 (팀 멤버 누구나)
router.patch('/:testcaseId/status', requireAuth, async (req, res, next) => {
  try {
    const { projectId, testcaseId } = req.params;
    const { status } = req.body;

    if (!['IN_PROGRESS', 'DONE', 'FAILED'].includes(status)) {
      return res.status(400).json({ error: 'VALIDATION', message: '올바른 상태값이 아닙니다. (IN_PROGRESS | DONE | FAILED)' });
    }

    if (!(await checkProjectAccess(projectId, req.user.id))) {
      return res.status(403).json({ error: 'FORBIDDEN', message: '접근 권한이 없습니다.' });
    }

    const existing = await query(
      'SELECT * FROM test_cases WHERE id = $1 AND project_id = $2',
      [testcaseId, projectId]
    );
    if (!existing.rows.length) {
      return res.status(404).json({ error: 'NOT_FOUND', message: '테스트케이스를 찾을 수 없습니다.' });
    }

    const { rows } = await query(
      'UPDATE test_cases SET status = $1 WHERE id = $2 RETURNING *',
      [status, testcaseId]
    );

    res.json({ data: rows[0] });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
