function notFoundMiddleware(req, res, next) {
  res.status(404).json({
    success: false,
    message: `Endpoint ${req.originalUrl} tidak ditemukan.`,
  });
}

module.exports = notFoundMiddleware;