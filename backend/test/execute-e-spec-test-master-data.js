const fs = require("node:fs/promises");
const path = require("node:path");

const expectedHost = "ep-winter-haze-a1s0o446-pooler.ap-southeast-1.aws.neon.tech";
const expectedDatabase = "neondb";
const expectedUser = "neondb_owner";
const fixturePath = path.resolve(__dirname, "fixtures/e-spec-test-master-data.execute.sql");

const fail = (message) => {
  throw new Error(message);
};

const run = async () => {
  process.env.E_SPEC_ENV = "test";
  const env = require("../src/config/env");

  if (process.env.E_SPEC_ENV !== "test") {
    fail("Safety gate failed: E_SPEC_ENV must be test.");
  }

  if (env.DB_HOST !== expectedHost) {
    fail("Safety gate failed: DB_HOST is not the approved test host.");
  }

  const productionHost = process.env.E_SPEC_PRODUCTION_DB_HOST;
  if (productionHost && env.DB_HOST === productionHost) {
    fail("Safety gate failed: test and production hosts must differ.");
  }

  const pool = require("../src/config/database");
  const client = await pool.connect();

  try {
    const identity = await client.query(
      "SELECT current_database() AS database_name, current_user AS user_name"
    );
    const { database_name: databaseName, user_name: userName } = identity.rows[0];

    if (databaseName !== expectedDatabase || userName !== expectedUser) {
      fail("Safety gate failed: database identity does not match the approved test target.");
    }

    const conflicts = await client.query(`
      SELECT 'specification_types' AS table_name, id::text AS record_id FROM specification_types WHERE id IN (7101, 7102)
      UNION ALL SELECT 'plants', id::text FROM plants WHERE id = 7201 OR plantid = 7201
      UNION ALL SELECT 'departments', id::text FROM departments WHERE id = 7301 OR departmentname = 'E-Spec Integration Test Department'
      UNION ALL SELECT 'idxplantsdepartments', id::text FROM idxplantsdepartments WHERE id = 7401
      UNION ALL SELECT 'material_categories', id::text FROM material_categories WHERE id IN (7501, 7502) OR categoryname IN ('OPEX - BARANG TEKNIK', 'OPEX - JASA')
      UNION ALL SELECT 'material_groups', id::text FROM material_groups WHERE id IN (7601, 7602) OR sapgroupcode IN ('BEARING', 'SERVICE')
      UNION ALL SELECT 'reason_to_procure_options', id::text FROM reason_to_procure_options WHERE id IN (7701, 7702) OR optionname IN ('E-Spec Test Barang Reason', 'E-Spec Test Jasa Reason')
      UNION ALL SELECT 'specification_sections', id::text FROM specification_sections WHERE id IN (7801, 7802) OR sectioncode IN ('E_SPEC_TEST_BRG', 'E_SPEC_TEST_JASA')
      UNION ALL SELECT 'specification_attributes', id::text FROM specification_attributes WHERE id BETWEEN 7810 AND 7835
      ORDER BY table_name, record_id
    `);

    if (conflicts.rowCount > 0) {
      const conflictSummary = conflicts.rows
        .map(({ table_name: tableName, record_id: recordId }) => `${tableName}:${recordId}`)
        .join(", ");
      fail(`Safety gate failed: target IDs or business keys already exist (${conflictSummary}).`);
    }

    const sqlText = await fs.readFile(fixturePath, "utf8");

    try {
      await client.query(sqlText);
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    }

    console.log("Seed committed to approved test database.");
  } finally {
    client.release();
    await pool.end();
  }
};

run().catch((error) => {
  console.error(`Seed failed: ${error.message}`);
  process.exitCode = 1;
});
