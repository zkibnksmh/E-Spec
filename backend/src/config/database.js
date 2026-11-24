const { Pool } = require("pg");
const env = require("./env");

const pool = new Pool({
  ...(env.DATABASE_URL
    ? {
        connectionString: env.DATABASE_URL,
        ssl: {
          rejectUnauthorized: false,
        },
      }
    : {
        host: env.DB_HOST,
        port: env.DB_PORT,
        database: env.DB_NAME,
        user: env.DB_USER,
        password: env.DB_PASSWORD,
        ssl: env.DB_SSL
          ? { rejectUnauthorized: true }
          : false,
      }),

  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on("error", (error) => {
  console.error("Unexpected database error:", error.message);
});

module.exports = pool;