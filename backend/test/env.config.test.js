const assert = require("node:assert/strict");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");

const envModulePath = require.resolve("../src/config/env");
const dotenvModulePath = require.resolve("dotenv");
const originalEnvironment = process.env.E_SPEC_ENV;

const loadEnvironment = ({ environment, configResult = {} }) => {
  const originalLoad = Module._load;
  const calls = [];

  if (environment === undefined) {
    delete process.env.E_SPEC_ENV;
  } else {
    process.env.E_SPEC_ENV = environment;
  }

  delete require.cache[envModulePath];
  Module._load = (request, parent, isMain) => {
    if (request === "dotenv") {
      return {
        config: (options) => {
          calls.push(options);
          return configResult;
        },
      };
    }

    return originalLoad(request, parent, isMain);
  };

  try {
    return { env: require(envModulePath), calls };
  } finally {
    Module._load = originalLoad;
    delete require.cache[envModulePath];
    delete require.cache[dotenvModulePath];

    if (originalEnvironment === undefined) {
      delete process.env.E_SPEC_ENV;
    } else {
      process.env.E_SPEC_ENV = originalEnvironment;
    }
  }
};

test("default configuration selects backend/.env", () => {
  const { calls } = loadEnvironment({ environment: undefined });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].path, path.resolve(__dirname, "../.env"));
});

test("test configuration selects backend/.env.test exclusively", () => {
  const { calls } = loadEnvironment({ environment: "test" });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].path, path.resolve(__dirname, "../.env.test"));
  assert.notEqual(calls[0].path, path.resolve(__dirname, "../.env"));
});

test("missing .env.test fails safely without loading .env", () => {
  const missingFile = new Error("ENOENT");

  assert.throws(
    () => loadEnvironment({ environment: "test", configResult: { error: missingFile } }),
    /Gagal membaca file .env.test: ENOENT/
  );
});

test("unsupported environment fails before dotenv is loaded", () => {
  assert.throws(
    () => loadEnvironment({ environment: "production" }),
    /E_SPEC_ENV harus bernilai development, test, atau tidak diatur/
  );
});

test("development configuration remains an explicit supported environment", () => {
  const { calls } = loadEnvironment({ environment: "development" });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].path, path.resolve(__dirname, "../.env"));
});
