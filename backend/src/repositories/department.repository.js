const pool = require("../config/database");

// Mengambil seluruh department
const findAll = async () => {
  const query = `
    SELECT
      id,
      departmentname,
      managername,
      groupingname,
      isactive,
      createdby,
      createddate,
      updatedby,
      updateddate
    FROM departments
    ORDER BY departmentname ASC
  `;

  const result = await pool.query(query);

  return result.rows;
};

// Mengambil department berdasarkan ID
const findById = async (id) => {
  const query = `
    SELECT
      id,
      departmentname,
      managername,
      groupingname,
      isactive,
      createdby,
      createddate,
      updatedby,
      updateddate
    FROM departments
    WHERE id = $1
  `;

  const result = await pool.query(query, [id]);

  return result.rows[0] || null;
};

// Mengambil department berdasarkan Plant ID
const findByPlantId = async (plantId) => {
  const query = `
    SELECT
      d.id,
      d.departmentname,
      d.managername,
      d.groupingname,
      d.isactive,
      d.createdby,
      d.createddate,
      d.updatedby,
      d.updateddate
    FROM departments d
    INNER JOIN idxplantsdepartments ip
      ON ip.departmentid = d.id
    INNER JOIN plants p
      ON p.id = ip.plantid
    WHERE p.id = $1
      AND d.isactive = TRUE
    ORDER BY d.departmentname ASC
  `;

  const result = await pool.query(query, [plantId]);

  return result.rows;
};

module.exports = {
  findAll,
  findById,
  findByPlantId,
};