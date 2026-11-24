const healthService = require("../services/health.service");

const checkDatabase = async (req, res, next) => {
  try {
    const result = await healthService.getDatabaseHealth();

    return res.status(200).json({
      success: true,
      message: "Koneksi PostgreSQL berhasil!",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  checkDatabase,
};