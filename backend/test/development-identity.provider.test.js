const assert = require("node:assert/strict");
const test = require("node:test");
const {
  isDevelopmentIdentityEnabled,
  resolveDevelopmentIdentity,
} = require("../src/auth/identity/development-identity.provider");

const enabledEnvironment = {
  E_SPEC_ENV: "test",
  E_SPEC_ENABLE_DEV_IDENTITY: "true",
  NODE_ENV: "test",
};

test("development identity is disabled by default", () => {
  assert.equal(isDevelopmentIdentityEnabled({}), false);
});

test("development identity requires an explicit true feature flag", () => {
  assert.equal(isDevelopmentIdentityEnabled({ E_SPEC_ENV: "test", NODE_ENV: "test" }), false);
  assert.equal(isDevelopmentIdentityEnabled({ ...enabledEnvironment, E_SPEC_ENABLE_DEV_IDENTITY: "false" }), false);
});

test("development identity fails closed in production environments", () => {
  assert.equal(isDevelopmentIdentityEnabled({ ...enabledEnvironment, E_SPEC_ENV: "production" }), false);
  assert.equal(isDevelopmentIdentityEnabled({ ...enabledEnvironment, NODE_ENV: "production" }), false);
  assert.throws(
    () => resolveDevelopmentIdentity("requestor", { ...enabledEnvironment, NODE_ENV: "production" }),
    { statusCode: 403 }
  );
});

test("development identity requires an explicit development or test environment", () => {
  assert.equal(isDevelopmentIdentityEnabled({ E_SPEC_ENABLE_DEV_IDENTITY: "true", NODE_ENV: "test" }), false);
});

for (const [alias, expected] of [
  ["requestor", "DEV-REQ-001"],
  ["manager", "DEV-MGR-001"],
  ["head-engineering", "DEV-HE-001"],
]) {
  test(`${alias} resolves to its predefined canonical principal`, () => {
    const principal = resolveDevelopmentIdentity(alias, enabledEnvironment);

    assert.equal(principal.userId, expected);
    assert.equal(principal.identitySource, "development");
    assert.deepEqual(principal.plantIds, [7201]);
    assert.deepEqual(principal.departmentIds, [7301]);
  });
}

test("missing and unknown aliases are rejected without accepting client identity data", () => {
  assert.throws(() => resolveDevelopmentIdentity(undefined, enabledEnvironment), { statusCode: 401 });
  assert.throws(() => resolveDevelopmentIdentity("unknown", enabledEnvironment), { statusCode: 400 });
  const principal = resolveDevelopmentIdentity("requestor", enabledEnvironment);

  assert.equal(principal.userId, "DEV-REQ-001");
  assert.deepEqual(principal.roles, ["Requestor"]);
});
