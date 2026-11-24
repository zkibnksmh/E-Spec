const healthRepository = require("../repositories/health.repository");

const getDatabaseHealth = async () => {
  const databaseInfo =
    await healthRepository.checkDatabaseConnection();

  return {
    status: "connected",
    database: databaseInfo.database,
    serverTime: databaseInfo.server_time,
  };
};

module.exports = {
  getDatabaseHealth,
};