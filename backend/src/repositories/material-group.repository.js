const pool = require("../config/database");

// Mengambil seluruh material group
const findAll = async () => {
  const query = `
    SELECT
      mg.id,
      mg.materialcategoryid,
      mc.categoryname,
      mg.groupno,
      mg.sapgroupcode,
      mg.dashboardgroupname,
      mg.eprgroupname,
      mg.description,
      mg.slaallplant2025,
      mg.approvalpatternno,
      mg.isactive,
      mg.createdby,
      mg.createddate,
      mg.updatedby,
      mg.updateddate
    FROM material_groups mg
    INNER JOIN material_categories mc
      ON mc.id = mg.materialcategoryid
    ORDER BY mg.sapgroupcode ASC
  `;

  const result = await pool.query(query);

  return result.rows;
};

// Mengambil material group berdasarkan ID
const findById = async (id) => {
  const query = `
    SELECT
      mg.id,
      mg.materialcategoryid,
      mc.categoryname,
      mg.groupno,
      mg.sapgroupcode,
      mg.dashboardgroupname,
      mg.eprgroupname,
      mg.description,
      mg.slaallplant2025,
      mg.approvalpatternno,
      mg.isactive,
      mg.createdby,
      mg.createddate,
      mg.updatedby,
      mg.updateddate
    FROM material_groups mg
    INNER JOIN material_categories mc
      ON mc.id = mg.materialcategoryid
    WHERE mg.id = $1
  `;

  const result = await pool.query(query, [id]);

  return result.rows[0] || null;
};

// Mengambil material group berdasarkan category ID
const findByCategoryId = async (categoryId) => {
  const query = `
    SELECT
      mg.id,
      mg.materialcategoryid,
      mc.categoryname,
      mg.groupno,
      mg.sapgroupcode,
      mg.dashboardgroupname,
      mg.eprgroupname,
      mg.description,
      mg.slaallplant2025,
      mg.approvalpatternno,
      mg.isactive,
      mg.createdby,
      mg.createddate,
      mg.updatedby,
      mg.updateddate
    FROM material_groups mg
    INNER JOIN material_categories mc
      ON mc.id = mg.materialcategoryid
    WHERE mg.materialcategoryid = $1
      AND mg.isactive = TRUE
      AND mc.isactive = TRUE
    ORDER BY mg.sapgroupcode ASC
  `;

  const result = await pool.query(query, [categoryId]);

  return result.rows;
};

module.exports = {
  findAll,
  findById,
  findByCategoryId,
};