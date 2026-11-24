const pool = require("../config/database");

// Mengambil seluruh data plant
const findAll = async () => {
  const query = `
    SELECT
      id,
      plantid,
      plantname,
      createdby,
      createddate,
      updatedby,
      updateddate
    FROM plants
    ORDER BY plantid ASC
  `;

  const result = await pool.query(query);

  return result.rows;
};

// Mengambil satu plant berdasarkan ID
const findById = async (id) => {
  const query = `
    SELECT
      id,
      plantid,
      plantname,
      createdby,
      createddate,
      updatedby,
      updateddate
    FROM plants
    WHERE id = $1
  `;

  const result = await pool.query(query, [id]);

  return result.rows[0] || null;
};

module.exports = {
  findAll,
  findById,
};