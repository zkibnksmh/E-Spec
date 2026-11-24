const pool = require("../config/database");

const checkDatabaseConnection = async () => {
  const result = await pool.query(`
    SELECT
      current_database() AS database,
      NOW() AS server_time
  `);

  return result.rows[0];
};

module.exports = {
  checkDatabaseConnection,
};