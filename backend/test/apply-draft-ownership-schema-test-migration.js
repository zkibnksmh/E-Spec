const fs = require("node:fs/promises");
const path = require("node:path");

const expectedHost = "ep-winter-haze-a1s0o446-pooler.ap-southeast-1.aws.neon.tech";
const expectedDatabase = "neondb";
const expectedUser = "neondb_owner";
const migrationPath = path.resolve(
  __dirname,
  "../migrations/20261122_05i_draft_ownership.sql"
);

const fail = (message) => {
  throw new Error(message);
};

const run = async () => {
  process.env.E_SPEC_ENV = "test";
  const env = require("../src/config/env");

  if (process.env.E_SPEC_ENV !== "test" || env.DB_HOST !== expectedHost) {
    fail("Safety gate failed: test environment or approved host mismatch.");
  }

  if (process.env.E_SPEC_PRODUCTION_DB_HOST === env.DB_HOST) {
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

    const columns = await client.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'specifications'
         AND column_name IN ('createdbyuserid', 'updatedbyuserid')`
    );

    if (columns.rowCount === 2) {
      console.log("Draft ownership migration is already applied to approved test database.");
      return;
    }

    const sqlText = await fs.readFile(migrationPath, "utf8");
    await client.query(sqlText);
    console.log("Draft ownership migration committed to approved test database.");
  } finally {
    client.release();
    await pool.end();
  }
};

run().catch((error) => {
  console.error(`Migration failed: ${error.message}`);
  process.exitCode = 1;
});
