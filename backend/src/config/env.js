const path = require("path");
const dotenv = require("dotenv");

const environment = process.env.E_SPEC_ENV;

if (environment !== undefined && !["development", "test"].includes(environment)) {
  throw new Error("E_SPEC_ENV harus bernilai development, test, atau tidak diatur.");
}

// Resolve from this file so startup is independent of the working directory.
const envFileName = environment === "test" ? ".env.test" : ".env";
const envPath = path.resolve(__dirname, "../..", envFileName);

const result = dotenv.config({
  path: envPath,
  override: true,
});

if (result.error) {
  throw new Error(`Gagal membaca file ${envFileName}: ${result.error.message}`);
}

module.exports = {
  PORT: Number(process.env.PORT) || 3000,

  DB_HOST: process.env.DB_HOST,
  DB_PORT: Number(process.env.DB_PORT) || 5432,
  DB_NAME: process.env.DB_NAME,
  DB_USER: process.env.DB_USER,
  DB_PASSWORD: process.env.DB_PASSWORD,

  DB_SSL: process.env.DB_SSL === "true",

  E_SPEC_ENV: environment,
  NODE_ENV: process.env.NODE_ENV,
  E_SPEC_ENABLE_DEV_IDENTITY: process.env.E_SPEC_ENABLE_DEV_IDENTITY === "true",
};
