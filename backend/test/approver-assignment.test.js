const assert = require("node:assert/strict");
const test = require("node:test");
const { ROLES } = require("../src/auth/constants/roles");
const {
  resolveDevelopmentApproverAssignment,
} = require("../src/workflow/approval/approver-assignment.provider");
const {
  resolveApproverAssignment,
} = require("../src/workflow/approval/approver-assignment.service");

const enabledEnvironment = Object.freeze({
  E_SPEC_ENV: "test",
  E_SPEC_ENABLE_DEV_IDENTITY: "true",
  NODE_ENV: "test",
});

const specification = Object.freeze({
  id: 2,
  plantId: 7201,
  departmentId: 7301,
});

test("Manager resolves to the predefined development principal", () => {
  const assignment = resolveDevelopmentApproverAssignment({
    approverRole: ROLES.MANAGER,
    plantId: 7201,
    departmentId: 7301,
    environment: enabledEnvironment,
  });

  assert.deepEqual(assignment, {
    assignedApproverUserId: "DEV-MGR-001",
    assignedApproverEmployeeId: "DEV-EMP-MGR-001",
    assignedApproverDisplayName: "Development Manager",
    assignedApproverEmail: "dev.manager@example.test",
    assignedApproverRole: ROLES.MANAGER,
    plantId: 7201,
    departmentId: 7301,
    identitySource: "development",
  });
});

test("HeadEngineering resolves to the predefined development principal", () => {
  const assignment = resolveDevelopmentApproverAssignment({
    approverRole: ROLES.HEAD_ENGINEERING,
    plantId: 7201,
    departmentId: 7301,
    environment: enabledEnvironment,
  });

  assert.equal(assignment.assignedApproverUserId, "DEV-HE-001");
  assert.equal(assignment.assignedApproverEmployeeId, "DEV-EMP-HE-001");
  assert.equal(assignment.assignedApproverRole, ROLES.HEAD_ENGINEERING);
});

test("Requestor is rejected as an approver", () => {
  assert.throws(
    () => resolveDevelopmentApproverAssignment({
      approverRole: ROLES.REQUESTOR,
      plantId: 7201,
      departmentId: 7301,
      environment: enabledEnvironment,
    }),
    /Requestor tidak dapat menjadi approver/
  );
});

test("unknown approver roles are rejected", () => {
  assert.throws(
    () => resolveDevelopmentApproverAssignment({
      approverRole: "Supervisor",
      plantId: 7201,
      departmentId: 7301,
      environment: enabledEnvironment,
    }),
    /Approver role tidak didukung/
  );
});

test("Manager with an unsupported Plant is rejected", () => {
  assert.throws(
    () => resolveDevelopmentApproverAssignment({
      approverRole: ROLES.MANAGER,
      plantId: 9999,
      departmentId: 7301,
      environment: enabledEnvironment,
    }),
    { statusCode: 403 }
  );
});

test("Manager with an unsupported Department is rejected", () => {
  assert.throws(
    () => resolveDevelopmentApproverAssignment({
      approverRole: ROLES.MANAGER,
      plantId: 7201,
      departmentId: 9999,
      environment: enabledEnvironment,
    }),
    { statusCode: 403 }
  );
});

test("HeadEngineering with unsupported organizational scope is rejected", () => {
  assert.throws(
    () => resolveDevelopmentApproverAssignment({
      approverRole: ROLES.HEAD_ENGINEERING,
      plantId: 9999,
      departmentId: 7301,
      environment: enabledEnvironment,
    }),
    { statusCode: 403 }
  );
  assert.throws(
    () => resolveDevelopmentApproverAssignment({
      approverRole: ROLES.HEAD_ENGINEERING,
      plantId: 7201,
      departmentId: 9999,
      environment: enabledEnvironment,
    }),
    { statusCode: 403 }
  );
});

test("missing Plant and Department are rejected", () => {
  assert.throws(
    () => resolveDevelopmentApproverAssignment({
      approverRole: ROLES.MANAGER,
      departmentId: 7301,
      environment: enabledEnvironment,
    }),
    /Plant ID wajib diisi/
  );
  assert.throws(
    () => resolveDevelopmentApproverAssignment({
      approverRole: ROLES.MANAGER,
      plantId: 7201,
      environment: enabledEnvironment,
    }),
    /Department ID wajib diisi/
  );
});

test("invalid Plant and Department identifiers are rejected", () => {
  for (const value of ["abc", 0, -1, "1.5"]) {
    assert.throws(
      () => resolveDevelopmentApproverAssignment({
        approverRole: ROLES.MANAGER,
        plantId: value,
        departmentId: 7301,
        environment: enabledEnvironment,
      }),
      /Plant ID harus berupa ID angka positif/
    );
    assert.throws(
      () => resolveDevelopmentApproverAssignment({
        approverRole: ROLES.MANAGER,
        plantId: 7201,
        departmentId: value,
        environment: enabledEnvironment,
      }),
      /Department ID harus berupa ID angka positif/
    );
  }
});

test("client-supplied user identity cannot override the configured approver", () => {
  const assignment = resolveDevelopmentApproverAssignment({
    approverRole: ROLES.MANAGER,
    plantId: 7201,
    departmentId: 7301,
    environment: enabledEnvironment,
    userId: "CLIENT-USER",
    assignedApproverUserId: "CLIENT-USER",
    userIdentity: { userId: "CLIENT-USER" },
  });

  assert.equal(assignment.assignedApproverUserId, "DEV-MGR-001");
});

test("client-supplied role cannot override the resolved approver role", () => {
  const assignment = resolveDevelopmentApproverAssignment({
    approverRole: ROLES.MANAGER,
    plantId: 7201,
    departmentId: 7301,
    environment: enabledEnvironment,
    role: ROLES.HEAD_ENGINEERING,
  });

  assert.equal(assignment.assignedApproverRole, ROLES.MANAGER);
  assert.equal(assignment.assignedApproverUserId, "DEV-MGR-001");
});

test("client-supplied plantIds and departmentIds cannot broaden scope", () => {
  const assignment = resolveDevelopmentApproverAssignment({
    approverRole: ROLES.MANAGER,
    plantId: 7201,
    departmentId: 7301,
    environment: enabledEnvironment,
    plantIds: [9999],
    departmentIds: [9999],
  });

  assert.equal(assignment.plantId, 7201);
  assert.equal(assignment.departmentId, 7301);

  assert.throws(
    () => resolveDevelopmentApproverAssignment({
      approverRole: ROLES.MANAGER,
      plantId: 9999,
      departmentId: 7301,
      environment: enabledEnvironment,
      plantIds: [7201],
    }),
    { statusCode: 403 }
  );
});

test("development assignment fails closed when the feature flag is disabled", () => {
  assert.throws(
    () => resolveDevelopmentApproverAssignment({
      approverRole: ROLES.MANAGER,
      plantId: 7201,
      departmentId: 7301,
      environment: { ...enabledEnvironment, E_SPEC_ENABLE_DEV_IDENTITY: "false" },
    }),
    { statusCode: 403 }
  );
});

test("development assignment fails closed outside development and test", () => {
  assert.throws(
    () => resolveDevelopmentApproverAssignment({
      approverRole: ROLES.MANAGER,
      plantId: 7201,
      departmentId: 7301,
      environment: { ...enabledEnvironment, E_SPEC_ENV: "production" },
    }),
    { statusCode: 403 }
  );
});

test("development assignment fails closed in production NODE_ENV", () => {
  assert.throws(
    () => resolveDevelopmentApproverAssignment({
      approverRole: ROLES.MANAGER,
      plantId: 7201,
      departmentId: 7301,
      environment: { ...enabledEnvironment, NODE_ENV: "production" },
    }),
    { statusCode: 403 }
  );
});

test("missing development configuration fails closed", () => {
  assert.throws(
    () => resolveDevelopmentApproverAssignment({
      approverRole: ROLES.MANAGER,
      plantId: 7201,
      departmentId: 7301,
      environment: {},
    }),
    { statusCode: 403 }
  );
});

test("assignment service preserves step number and returns a normalized assignment", () => {
  const result = resolveApproverAssignment({
    rule: { stepNo: 1, approverRole: ROLES.MANAGER },
    specification,
    requestorUserId: "DEV-REQ-001",
    environment: enabledEnvironment,
  });

  assert.equal(result.stepNo, 1);
  assert.equal(result.approverRole, ROLES.MANAGER);
  assert.equal(result.assignedApproverUserId, "DEV-MGR-001");
  assert.equal(result.assignedApproverEmployeeId, "DEV-EMP-MGR-001");
  assert.equal(result.assignedApproverDisplayName, "Development Manager");
  assert.equal(result.plantId, 7201);
  assert.equal(result.departmentId, 7301);
  assert.equal(result.identitySource, "development");
});

test("assignment service rejects invalid step numbers", () => {
  for (const stepNo of [undefined, null, 0, -1, "abc", "1.5"]) {
    assert.throws(
      () => resolveApproverAssignment({
        rule: { stepNo, approverRole: ROLES.MANAGER },
        specification,
        requestorUserId: "DEV-REQ-001",
        environment: enabledEnvironment,
      }),
      /Step number/
    );
  }
});

test("assignment service rejects missing rule, specification, or requestor", () => {
  assert.throws(
    () => resolveApproverAssignment({
      specification,
      requestorUserId: "DEV-REQ-001",
      environment: enabledEnvironment,
    }),
    /Approval rule tidak valid/
  );
  assert.throws(
    () => resolveApproverAssignment({
      rule: { stepNo: 1, approverRole: ROLES.MANAGER },
      requestorUserId: "DEV-REQ-001",
      environment: enabledEnvironment,
    }),
    /Konteks specification tidak valid/
  );
  assert.throws(
    () => resolveApproverAssignment({
      rule: { stepNo: 1, approverRole: ROLES.MANAGER },
      specification,
      environment: enabledEnvironment,
    }),
    /Requestor user ID wajib diisi/
  );
});

test("assignment service enforces separation of duties", () => {
  assert.throws(
    () => resolveApproverAssignment({
      rule: { stepNo: 1, approverRole: ROLES.MANAGER },
      specification,
      requestorUserId: "DEV-MGR-001",
      environment: enabledEnvironment,
    }),
    { statusCode: 409 }
  );
});

test("assignment service ignores client-supplied assignment fields in the rule", () => {
  const result = resolveApproverAssignment({
    rule: {
      stepNo: 1,
      approverRole: ROLES.MANAGER,
      assignedApproverUserId: "CLIENT-USER",
      assignedApproverRole: ROLES.HEAD_ENGINEERING,
    },
    specification,
    requestorUserId: "DEV-REQ-001",
    environment: enabledEnvironment,
  });

  assert.equal(result.assignedApproverUserId, "DEV-MGR-001");
  assert.equal(result.approverRole, ROLES.MANAGER);
});

test("assignment service rejects an incomplete provider assignment", () => {
  assert.throws(
    () => resolveApproverAssignment({
      rule: { stepNo: 1, approverRole: ROLES.MANAGER },
      specification,
      requestorUserId: "DEV-REQ-001",
      environment: enabledEnvironment,
      assignmentProvider: {
        resolveAssignment: () => ({ assignedApproverUserId: "DEV-MGR-001" }),
      },
    }),
    /Assignment approver tidak lengkap/
  );
});

test("assignment service rejects a provider assignment that matches the Requestor", () => {
  assert.throws(
    () => resolveApproverAssignment({
      rule: { stepNo: 1, approverRole: ROLES.MANAGER },
      specification,
      requestorUserId: "DEV-REQ-001",
      environment: enabledEnvironment,
      assignmentProvider: {
        resolveAssignment: () => ({
          assignedApproverUserId: "DEV-REQ-001",
          assignedApproverEmployeeId: "DEV-EMP-REQ-001",
          assignedApproverDisplayName: "Development Requestor",
          assignedApproverEmail: "dev.requestor@example.test",
          assignedApproverRole: ROLES.MANAGER,
          plantId: 7201,
          departmentId: 7301,
          identitySource: "development",
        }),
      },
    }),
    { statusCode: 409 }
  );
});
