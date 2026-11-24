const assert = require("node:assert/strict");
const test = require("node:test");
const { ROLES } = require("../src/auth/constants/roles");
const { requireAuthenticated } = require("../src/auth/middlewares/authentication.middleware");
const {
  requireRoles,
  requirePlantAccess,
  requireDepartmentAccess,
} = require("../src/auth/middlewares/authorization.middleware");
const {
  hasPlantAccess,
  hasDepartmentAccess,
} = require("../src/auth/policies/authorization.policy");

const users = {
  requestor: {
    userId: "DEV-REQ-001",
    roles: [ROLES.REQUESTOR],
    plantIds: [7201],
    departmentIds: [7301],
  },
  manager: {
    userId: "DEV-MGR-001",
    roles: [ROLES.MANAGER],
    plantIds: [7201],
    departmentIds: [7301],
  },
  headEngineering: {
    userId: "DEV-HE-001",
    roles: [ROLES.HEAD_ENGINEERING],
    plantIds: [7201],
    departmentIds: [7301],
  },
};

const runMiddleware = (middleware, req = {}) => new Promise((resolve) => {
  middleware(req, {}, (error) => resolve(error || null));
});

test("requireAuthenticated rejects missing and invalid principals", async () => {
  const missing = await runMiddleware(requireAuthenticated, {});
  const invalid = await runMiddleware(requireAuthenticated, { user: { userId: "DEV-REQ-001" } });

  assert.equal(missing.statusCode, 401);
  assert.equal(invalid.statusCode, 401);
});

test("requireAuthenticated accepts a normalized principal", async () => {
  assert.equal(await runMiddleware(requireAuthenticated, { user: users.requestor }), null);
});

for (const [name, user, role] of [
  ["Requestor", users.requestor, ROLES.REQUESTOR],
  ["Manager", users.manager, ROLES.MANAGER],
  ["HeadEngineering", users.headEngineering, ROLES.HEAD_ENGINEERING],
]) {
  test(`${name} passes its exact role policy`, async () => {
    assert.equal(await runMiddleware(requireRoles([role]), { user }), null);
  });
}

test("roles do not imply another role", async () => {
  const requestor = await runMiddleware(requireRoles([ROLES.MANAGER]), { user: users.requestor });
  const manager = await runMiddleware(requireRoles([ROLES.HEAD_ENGINEERING]), { user: users.manager });

  assert.equal(requestor.statusCode, 403);
  assert.equal(manager.statusCode, 403);
});

test("plant access is exact, validated, and cannot use client identity scope", async () => {
  assert.equal(hasPlantAccess(users.requestor, "7201"), true);
  assert.equal(hasPlantAccess(users.requestor, "7202"), false);
  assert.equal(hasPlantAccess(users.requestor, "invalid"), false);
  const allowed = await runMiddleware(requirePlantAccess((req) => req.body.plant), {
    user: users.requestor,
    body: { plant: "7201", plantIds: [9999], userId: "attacker" },
  });
  const denied = await runMiddleware(requirePlantAccess(() => undefined), { user: users.requestor });

  assert.equal(allowed, null);
  assert.equal(denied.statusCode, 403);
});

test("department access is exact and rejects missing or invalid targets", async () => {
  assert.equal(hasDepartmentAccess(users.manager, 7301), true);
  assert.equal(hasDepartmentAccess(users.manager, 7302), false);
  assert.equal(hasDepartmentAccess(users.manager, ""), false);
  const allowed = await runMiddleware(requireDepartmentAccess((req) => req.params.departmentId), {
    user: users.manager,
    params: { departmentId: "7301" },
  });
  const denied = await runMiddleware(requireDepartmentAccess(() => "invalid"), { user: users.manager });

  assert.equal(allowed, null);
  assert.equal(denied.statusCode, 403);
});

test("composed policies stop before later middleware on authorization failure", async () => {
  let controllerCalled = false;
  const middlewares = [
    requireAuthenticated,
    requireRoles([ROLES.REQUESTOR]),
    requirePlantAccess(() => "7201"),
    requireDepartmentAccess(() => "9999"),
  ];
  const req = { user: users.requestor };

  for (const middleware of middlewares) {
    const error = await runMiddleware(middleware, req);
    if (error) {
      assert.equal(error.statusCode, 403);
      assert.equal(controllerCalled, false);
      return;
    }
  }

  controllerCalled = true;
  assert.fail("Expected department authorization to stop the controller.");
});
