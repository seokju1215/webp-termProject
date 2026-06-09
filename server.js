require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');
const passport = require('passport');

const authRouter = require('./routes/auth');
const teamsRouter = require('./routes/teams');
const projectsRouter = require('./routes/projects');
const testcasesRouter = require('./routes/testcases');
const commentsRouter = require('./routes/comments');
const webhooksRouter = require('./routes/webhooks');
const { errorHandler } = require('./middleware/error');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS — webhook 엔드포인트는 외부 서비스(Agentation)에서 호출
app.use('/api/webhooks', (req, res, next) => {
  res.set({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-webhook-secret, Authorization',
  });
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'qaflow-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 7 * 24 * 60 * 60 * 1000 }
}));
app.use(passport.initialize());
app.use(passport.session());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, 'public')));

// API 라우터
app.use('/api/auth', authRouter);
app.use('/api/teams', teamsRouter);
app.use('/api/teams/:teamId/projects', projectsRouter);
app.use('/api/projects/:projectId/testcases', testcasesRouter);
app.use('/api/projects/:projectId/comments', commentsRouter);
app.use('/api/webhooks', webhooksRouter);

// SPA 폴백 — /api 이외의 GET 요청은 index.html로
app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
