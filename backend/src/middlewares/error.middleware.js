function errorMiddleware(error, req, res, next) {
  console.error("Application Error:", error);

  const statusCode = error.statusCode || 500;

  res.status(statusCode).json({
    success: false,
    message:
      statusCode === 500
        ? "Terjadi kesalahan pada server."
        : error.message,
  });
}

module.exports = errorMiddleware;