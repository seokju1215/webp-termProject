function errorHandler(err, req, res, next) {
  console.error(err);
  const status = err.status || 500;
  res.status(status).json({
    error: err.code || 'SERVER_ERROR',
    message: err.message || '서버 오류가 발생했습니다.',
  });
}

module.exports = { errorHandler };
