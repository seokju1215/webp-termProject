const express = require('express');
const { query } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/webhooks/secret — 로그인한 사용자에게 webhook secret 반환
router.get('/secret', requireAuth, (req, res) => {
  res.json({ data: { secret: process.env.WEBHOOK_SECRET || '' } });
});

// CORS preflight for agentation webhook
router.options('/agentation', (req, res) => {
  res.set({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-webhook-secret',
  }).sendStatus(204);
});

// POST /api/webhooks/agentation?projectId=<uuid>
router.post('/agentation', async (req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
  try {
    const { projectId } = req.query;
    if (!projectId) {
      return res.status(400).json({ error: 'VALIDATION', message: 'projectId가 필요합니다.' });
    }

    const projectCheck = await query('SELECT id FROM projects WHERE id = $1', [projectId]);
    if (!projectCheck.rows.length) {
      return res.status(404).json({ error: 'NOT_FOUND', message: '프로젝트를 찾을 수 없습니다.' });
    }

    const {
      content,
      selector,
      bounding_rect,
      tag_name,
      text_content,
      page_url,
      user,
    } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'VALIDATION', message: 'content가 필요합니다.' });
    }

    // Agentation 유저 이메일로 우리 DB 유저 매핑 시도
    let createdById = null;
    if (user?.email) {
      const userRow = await query('SELECT id FROM users WHERE email = $1', [user.email]);
      if (userRow.rows.length) createdById = userRow.rows[0].id;
    }

    const { rows } = await query(
      `INSERT INTO comments
         (project_id, created_by_id, content, selector, bounding_rect, tag_name, text_content, page_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        projectId,
        createdById,
        content,
        selector || null,
        bounding_rect ? JSON.stringify(bounding_rect) : null,
        tag_name || null,
        text_content || null,
        page_url || null,
      ]
    );

    res.status(201).json({ data: rows[0] });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
