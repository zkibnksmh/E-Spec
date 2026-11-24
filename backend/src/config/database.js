const { Pool } = require("pg");
const env = require("./env");

// Membuat koneksi pool PostgreSQL
const pool = new Pool({
  host: env.DB_HOST,
  port: env.DB_PORT,
  database: env.DB_NAME,
  user: env.DB_USER,
  password: env.DB_PASSWORD,

  ssl: env.DB_SSL
    ? { rejectUnauthorized: true }
    : false,

  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// Menangani error koneksi database
pool.on("error", (error) => {
  console.error("Unexpected database error:", error.message);
});

module.exports = pool;