const pool = require("../config/database");

const findAll = async () => {
  const result = await pool.query(`
    SELECT
      id,
      typecode,
      typename
    FROM specification_types
    WHERE isactive = TRUE
    ORDER BY id ASC
  `);

  return result.rows;
};

module.exports = {
  findAll,
};
