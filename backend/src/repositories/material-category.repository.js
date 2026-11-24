
const pool = require("../config/database");

// Mengambil seluruh kategori material yang aktif
const findAll = async () => {
  const query = `
    SELECT
      id,
      categoryname,
      specificationtypeid,
      description,
      isactive,
      createdby,
      createddate,
      updatedby,
      updateddate
    FROM material_categories
    WHERE isactive = TRUE
    ORDER BY categoryname ASC
  `;

  const result = await pool.query(query);

  return result.rows;
};

// Mengambil kategori berdasarkan ID
const findById = async (id) => {
  const query = `
    SELECT
      id,
      categoryname,
      specificationtypeid,
      description,
      isactive,
      createdby,
      createddate,
      updatedby,
      updateddate
    FROM material_categories
    WHERE id = $1
  `;

  const result = await pool.query(query, [id]);

  return result.rows[0] || null;
};

module.exports = {
  findAll,
  findById,
};
