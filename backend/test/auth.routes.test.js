const assert = require("node:assert/strict");
const http = require("node:http");
const test = require("node:test");
const express = require("express");
const authRoutes = require("../src/routes/auth.routes");
const errorMiddleware = require("../src/middlewares/error.middleware");

const withEnvironment = async (environment, run) => {
  const original = {
    E_SPEC_ENV: process.env.E_SPEC_ENV,
    E_SPEC_ENABLE_DEV_IDENTITY: process.env.E_SPEC_ENABLE_DEV_IDENTITY,
    NODE_ENV: process.env.NODE_ENV,
  };

  Object.assign(process.env, environment);

  try {
    await run();
  } finally {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
};

const request = (server, headers = {}) => new Promise((resolve, reject) => {
  const address = server.address();
  const client = http.request({
    hostname: "127.0.0.1",
    port: address.port,
    path: "/api/auth/me",
    headers,
  }, (response) => {
    let body = "";
    response.setEncoding("utf8");
    response.on("data", (chunk) => { body += chunk; });
    response.on("end", () => resolve({ status: response.statusCode, body: JSON.parse(body) }));
  });

  client.on("error", reject);
  client.end();
});

test("GET /api/auth/me returns canonical identity and rejects missing or unknown aliases", async () => {
  await withEnvironment({
    E_SPEC_ENV: "test",
    E_SPEC_ENABLE_DEV_IDENTITY: "true",
    NODE_ENV: "test",
  }, async () => {
    const app = express();
    app.use("/api/auth", authRoutes);
    app.use(errorMiddleware);
    const server = await new Promise((resolve) => {
      const instance = app.listen(0, () => resolve(instance));
    });

    try {
      const requestor = await request(server, { "X-ESpec-Dev-Identity": "requestor" });
      const missing = await request(server);
      const unknown = await request(server, { "X-ESpec-Dev-Identity": "unknown" });

      assert.equal(requestor.status, 200);
      assert.deepEqual(requestor.body.data.roles, ["Requestor"]);
      assert.equal(missing.status, 401);
      assert.equal(unknown.status, 400);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
});

test("GET /api/auth/me fails closed when development identity is disabled", async () => {
  await withEnvironment({
    E_SPEC_ENV: "test",
    E_SPEC_ENABLE_DEV_IDENTITY: "false",
    NODE_ENV: "test",
  }, async () => {
    const app = express();
    app.use("/api/auth", authRoutes);
    app.use(errorMiddleware);
    const server = await new Promise((resolve) => {
      const instance = app.listen(0, () => resolve(instance));
    });

    try {
      const response = await request(server, { "X-ESpec-Dev-Identity": "requestor" });
      assert.equal(response.status, 403);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
});
