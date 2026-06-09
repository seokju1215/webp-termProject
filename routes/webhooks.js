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

    // Agentation 페이로드: { event, timestamp, url, annotation: { id, comment, element, elementPath } }
    // submit 이벤트: { event: 'submit', output, annotations: [...] }
    const body = req.body;
    const eventType = body.event;

    // submit 이벤트는 무시 (annotation.add / annotation.update 만 처리)
    if (eventType === 'annotations.clear' || eventType === 'annotation.delete') {
      return res.status(200).json({ data: null });
    }

    const content = body.annotation?.comment || body.output || body.content;
    const selector = body.annotation?.elementPath || body.selector || null;
    const tag_name = body.annotation?.element || body.tag_name || null;
    const page_url = body.url || body.page_url || null;

    if (!content) {
      return res.status(400).json({ error: 'VALIDATION', message: 'content가 필요합니다.' });
    }

    const { rows } = await query(
      `INSERT INTO comments
         (project_id, created_by_id, content, selector, tag_name, page_url)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [projectId, null, content, selector, tag_name, page_url]
    );

    res.status(201).json({ data: rows[0] });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
