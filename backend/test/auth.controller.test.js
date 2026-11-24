const assert = require("node:assert/strict");
const test = require("node:test");
const { getCurrentUser } = require("../src/controllers/auth.controller");

test("auth profile returns the canonical req.user principal", () => {
  const user = {
    userId: "DEV-REQ-001",
    employeeId: "DEV-EMP-REQ-001",
    displayName: "Development Requestor",
    email: "dev.requestor@example.test",
    roles: ["Requestor"],
    plantIds: [7201],
    departmentIds: [7301],
    identitySource: "development",
  };
  const res = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };

  getCurrentUser({ user }, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { success: true, data: user });
});
