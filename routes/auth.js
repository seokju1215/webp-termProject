const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  try {
    const r = await db.query('SELECT id, email, name FROM users WHERE id = $1', [id]);
    done(null, r.rows[0] || false);
  } catch (err) { done(err); }
});

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL || '/api/auth/google/callback'
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      const email = profile.emails?.[0]?.value;
      if (!email) return done(new Error('이메일 정보를 가져올 수 없습니다.'));

      let result = await db.query('SELECT * FROM users WHERE google_id = $1', [profile.id]);
      if (result.rows[0]) return done(null, result.rows[0]);

      result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
      if (result.rows[0]) {
        await db.query('UPDATE users SET google_id = $1 WHERE id = $2', [profile.id, result.rows[0].id]);
        return done(null, result.rows[0]);
      }

      const name = profile.displayName || email.split('@')[0];
      const newUser = await db.query(
        'INSERT INTO users (email, name, google_id) VALUES ($1, $2, $3) RETURNING *',
        [email, name, profile.id]
      );
      return done(null, newUser.rows[0]);
    } catch (err) { return done(err); }
  }));
}

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// POST /api/auth/signup
router.post('/signup', async (req, res, next) => {
  try {
    const { email, name, password } = req.body;
    if (!email || !name || !password) {
      return res.status(400).json({ error: 'MISSING_FIELDS', message: '이메일, 이름, 비밀번호를 모두 입력해주세요.' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'INVALID_EMAIL', message: '올바른 이메일 형식이 아닙니다.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'WEAK_PASSWORD', message: '비밀번호는 6자 이상이어야 합니다.' });
    }

    const existing = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'EMAIL_EXISTS', message: '이미 사용 중인 이메일입니다.' });
    }

    const hash = await bcrypt.hash(password, 10);
    const result = await db.query(
      'INSERT INTO users (email, name, password) VALUES ($1, $2, $3) RETURNING id, email, name, created_at',
      [email, name, hash]
    );
    const user = result.rows[0];
    const token = signToken(user);

    res.status(201).json({ data: { token, user: { id: user.id, email: user.email, name: user.name } } });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'MISSING_FIELDS', message: '이메일과 비밀번호를 입력해주세요.' });
    }

    const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];
    if (!user || !user.password) {
      return res.status(401).json({ error: 'INVALID_CREDENTIALS', message: '이메일 또는 비밀번호가 올바르지 않습니다.' });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ error: 'INVALID_CREDENTIALS', message: '이메일 또는 비밀번호가 올바르지 않습니다.' });
    }

    const token = signToken(user);
    res.json({ data: { token, user: { id: user.id, email: user.email, name: user.name } } });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const result = await db.query(
      'SELECT id, email, name, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    if (!result.rows[0]) {
      return res.status(404).json({ error: 'NOT_FOUND', message: '사용자를 찾을 수 없습니다.' });
    }
    res.json({ data: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// PUT /api/auth/me
router.put('/me', requireAuth, async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'MISSING_FIELDS', message: '이름을 입력해주세요.' });
    }
    const result = await db.query(
      'UPDATE users SET name = $1 WHERE id = $2 RETURNING id, email, name, created_at',
      [name.trim(), req.user.id]
    );
    res.json({ data: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/google
router.get('/google', (req, res, next) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.redirect('/?error=' + encodeURIComponent('Google OAuth가 설정되지 않았습니다. .env에 GOOGLE_CLIENT_ID를 입력하세요.'));
  }
  passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
});

// GET /api/auth/google/callback
router.get('/google/callback',
  (req, res, next) => {
    passport.authenticate('google', { session: false, failureRedirect: '/?error=oauth_failed' })(req, res, next);
  },
  (req, res) => {
    const token = signToken(req.user);
    const { id, name, email } = req.user;
    res.redirect(`/?oauth_token=${token}&oauth_id=${id}&oauth_name=${encodeURIComponent(name)}&oauth_email=${encodeURIComponent(email)}`);
  }
);

// GET /api/auth/activity
router.get('/activity', requireAuth, async (req, res, next) => {
  try {
    const [tcRes, cmtRes] = await Promise.all([
      db.query(`
        SELECT tc.id, tc.title, tc.status, tc.created_at,
               p.id AS project_id, p.name AS project_name, p.team_id
        FROM test_cases tc
        JOIN projects p ON tc.project_id = p.id
        WHERE tc.created_by_id = $1
        ORDER BY tc.created_at DESC LIMIT 8
      `, [req.user.id]),
      db.query(`
        SELECT c.id, LEFT(c.content, 80) AS content, c.status, c.created_at,
               p.id AS project_id, p.name AS project_name, p.team_id
        FROM comments c
        JOIN projects p ON c.project_id = p.id
        WHERE c.created_by_id = $1
        ORDER BY c.created_at DESC LIMIT 8
      `, [req.user.id])
    ]);
    res.json({ data: { testcases: tcRes.rows, comments: cmtRes.rows } });
  } catch (err) { next(err); }
});

module.exports = router;
