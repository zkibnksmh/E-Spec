
const pool = require("../config/database");

// Mengambil seluruh reason to procure yang aktif
const findAll = async () => {
  const query = `
    SELECT
      id,
      specificationtypeid,
      optionname,
      description,
      allowscustomtext,
      sortorder,
      isactive,
      createdby,
      createddate,
      updatedby,
      updateddate
    FROM reason_to_procure_options
    WHERE isactive = TRUE
    ORDER BY specificationtypeid ASC, sortorder ASC
  `;

  const result = await pool.query(query);

  return result.rows;
};

// Mengambil detail reason to procure berdasarkan ID
const findById = async (id) => {
  const query = `
    SELECT
      id,
      specificationtypeid,
      optionname,
      description,
      allowscustomtext,
      sortorder,
      isactive,
      createdby,
      createddate,
      updatedby,
      updateddate
    FROM reason_to_procure_options
    WHERE id = $1
      AND isactive = TRUE
  `;

  const result = await pool.query(query, [id]);

  return result.rows[0] || null;
};

// Mengambil reason to procure berdasarkan tipe spesifikasi
const findBySpecificationTypeId = async (specificationTypeId) => {
  const query = `
    SELECT
      id,
      specificationtypeid,
      optionname,
      description,
      allowscustomtext,
      sortorder,
      isactive,
      createdby,
      createddate,
      updatedby,
      updateddate
    FROM reason_to_procure_options
    WHERE specificationtypeid = $1
      AND isactive = TRUE
    ORDER BY sortorder ASC
  `;

  const result = await pool.query(query, [specificationTypeId]);

  return result.rows;
};

module.exports = {
  findAll,
  findById,
  findBySpecificationTypeId,
};
