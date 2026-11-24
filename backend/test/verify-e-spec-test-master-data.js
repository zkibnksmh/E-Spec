process.env.E_SPEC_ENV = "test";

const expectedHost = "ep-winter-haze-a1s0o446-pooler.ap-southeast-1.aws.neon.tech";
const expectedDatabase = "neondb";
const expectedUser = "neondb_owner";
const env = require("../src/config/env");
const pool = require("../src/config/database");

const query = (client, text, values) => client.query(text, values);

const run = async () => {
  if (process.env.E_SPEC_ENV !== "test" || env.DB_HOST !== expectedHost) {
    throw new Error("Safety gate failed: test environment or approved host mismatch.");
  }

  const client = await pool.connect();

  try {
    const identity = await query(
      client,
      "SELECT current_database() AS database_name, current_user AS user_name"
    );
    const { database_name: databaseName, user_name: userName } = identity.rows[0];

    if (databaseName !== expectedDatabase || userName !== expectedUser) {
      throw new Error("Safety gate failed: database identity mismatch.");
    }

    const types = await query(client, "SELECT id, typecode, typename, isactive FROM specification_types WHERE id IN (7101, 7102) ORDER BY id");
    const plants = await query(client, "SELECT id, plantid, plantname FROM plants WHERE id = 7201");
    const departments = await query(client, "SELECT id, departmentname, isactive FROM departments WHERE id = 7301");
    const mappings = await query(client, "SELECT id, plantid, departmentid FROM idxplantsdepartments WHERE id = 7401");
    const categories = await query(client, "SELECT id, categoryname, specificationtypeid, isactive FROM material_categories WHERE id IN (7501, 7502) ORDER BY id");
    const groups = await query(client, "SELECT id, materialcategoryid, sapgroupcode, isactive FROM material_groups WHERE id IN (7601, 7602) ORDER BY id");
    const reasons = await query(client, "SELECT id, specificationtypeid, optionname, isactive FROM reason_to_procure_options WHERE id IN (7701, 7702) ORDER BY id");
    const sections = await query(client, "SELECT id, specificationtypeid, sectioncode, sectionname, isactive FROM specification_sections WHERE id IN (7801, 7802) ORDER BY id");
    const attributes = await query(client, "SELECT id, sectionid, attributecode, attributename, isactive FROM specification_attributes WHERE id BETWEEN 7810 AND 7835 ORDER BY id");
    const specifications = await query(client, "SELECT count(*)::integer AS specification_count FROM specifications WHERE id BETWEEN 7101 AND 7835");
    const payload = {
      identity: { databaseName, userName, host: env.DB_HOST },
      specificationTypes: types.rows,
      plants: plants.rows,
      departments: departments.rows,
      plantDepartments: mappings.rows,
      materialCategories: categories.rows,
      materialGroups: groups.rows,
      reasonsToProcure: reasons.rows,
      sections: sections.rows,
      attributes: attributes.rows,
      specificationCount: specifications.rows[0].specification_count,
    };

    console.log(JSON.stringify(payload));
  } finally {
    client.release();
    await pool.end();
  }
};

run().catch((error) => {
  console.error(`Verification failed: ${error.message}`);
  process.exitCode = 1;
});
