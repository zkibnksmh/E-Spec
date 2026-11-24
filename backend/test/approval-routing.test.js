const assert = require("node:assert/strict");
const test = require("node:test");
const { ROLES } = require("../src/auth/constants/roles");
const {
  normalizeApprovalRules,
  getDevelopmentApprovalRules,
} = require("../src/workflow/approval/approval-pattern.provider");
const {
  buildApprovalRoute,
} = require("../src/workflow/approval/approval-routing.service");
const {
  approverAssignmentService,
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

const bearingSpecification = Object.freeze({
  ...specification,
  specificationTypeId: 7101,
  materialCategoryId: 7501,
});

const requestorUserId = "DEV-REQ-001";

test("SERVICE development route contains exactly one Manager step", () => {
  const rules = getDevelopmentApprovalRules("SERVICE", enabledEnvironment);

  assert.deepEqual(rules, [
    { stepNo: 1, approverRole: ROLES.MANAGER, isRequired: true },
  ]);
});

test("SERVICEPM development route contains Manager then HeadEngineering", () => {
  const rules = getDevelopmentApprovalRules("SERVICEPM", enabledEnvironment);

  assert.deepEqual(rules, [
    { stepNo: 1, approverRole: ROLES.MANAGER, isRequired: true },
    { stepNo: 2, approverRole: ROLES.HEAD_ENGINEERING, isRequired: true },
  ]);
});

test("BEARING development simulation resolves Manager then HeadEngineering for tested Barang combination", () => {
  const rules = getDevelopmentApprovalRules(
    "BEARING",
    enabledEnvironment,
    bearingSpecification
  );

  assert.deepEqual(rules, [
    { stepNo: 1, approverRole: ROLES.MANAGER, isRequired: true },
    { stepNo: 2, approverRole: ROLES.HEAD_ENGINEERING, isRequired: true },
  ]);
});

test("approval rules are ordered numerically regardless of input order", () => {
  const rules = normalizeApprovalRules([
    { stepNo: 2, approverRole: ROLES.HEAD_ENGINEERING, isRequired: true },
    { stepNo: 1, approverRole: ROLES.MANAGER, isRequired: true },
  ]);

  assert.deepEqual(rules.map((rule) => rule.stepNo), [1, 2]);
});

test("duplicate step numbers are rejected", () => {
  assert.throws(
    () => normalizeApprovalRules([
      { stepNo: 1, approverRole: ROLES.MANAGER, isRequired: true },
      { stepNo: 1, approverRole: ROLES.HEAD_ENGINEERING, isRequired: true },
    ]),
    /Step number duplikat/
  );
});

test("invalid step numbers are rejected", () => {
  for (const stepNo of [0, -1, "abc", "1.5", undefined]) {
    assert.throws(
      () => normalizeApprovalRules([
        { stepNo, approverRole: ROLES.MANAGER, isRequired: true },
      ]),
      /Step number/
    );
  }
});

test("unknown approval roles are rejected", () => {
  assert.throws(
    () => normalizeApprovalRules([
      { stepNo: 1, approverRole: "Supervisor", isRequired: true },
    ]),
    /Approver role tidak didukung/
  );
});

test("Requestor cannot be configured as an approval role", () => {
  assert.throws(
    () => normalizeApprovalRules([
      { stepNo: 1, approverRole: ROLES.REQUESTOR, isRequired: true },
    ]),
    /Requestor tidak dapat menjadi approver/
  );
});

test("empty routes are rejected", () => {
  assert.throws(() => normalizeApprovalRules([]), /tidak boleh kosong/);
  assert.throws(() => normalizeApprovalRules(undefined), /tidak boleh kosong/);
});

test("routes with a non-required step are rejected", () => {
  assert.throws(
    () => normalizeApprovalRules([
      { stepNo: 1, approverRole: ROLES.MANAGER, isRequired: false },
    ]),
    /harus ditandai required/
  );
});

test("routes with skipped required steps are rejected", () => {
  assert.throws(
    () => normalizeApprovalRules([
      { stepNo: 1, approverRole: ROLES.MANAGER, isRequired: true },
      { stepNo: 3, approverRole: ROLES.HEAD_ENGINEERING, isRequired: true },
    ]),
    /tidak boleh melewati step/
  );
});

test("unsupported material group codes are rejected", () => {
  assert.throws(
    () => getDevelopmentApprovalRules("SERVICEPMX", enabledEnvironment),
    /tidak memiliki development approval route/
  );
  assert.throws(
    () => getDevelopmentApprovalRules("", enabledEnvironment),
    /Material group code wajib diisi/
  );
});

test("BEARING fails closed outside the tested Barang combination", () => {
  assert.throws(
    () => getDevelopmentApprovalRules("BEARING", enabledEnvironment),
    /tidak memiliki development approval route/
  );
  assert.throws(
    () => getDevelopmentApprovalRules("BEARING", enabledEnvironment, {
      ...bearingSpecification,
      specificationTypeId: 7102,
    }),
    /tidak memiliki development approval route/
  );
  assert.throws(
    () => getDevelopmentApprovalRules("BEARING", enabledEnvironment, {
      ...bearingSpecification,
      materialCategoryId: 9999,
    }),
    /tidak memiliki development approval route/
  );
});

test("development routing fails closed outside development and test", () => {
  assert.throws(
    () => getDevelopmentApprovalRules("SERVICE", {
      ...enabledEnvironment,
      E_SPEC_ENABLE_DEV_IDENTITY: "false",
    }),
    { statusCode: 403 }
  );
  assert.throws(
    () => getDevelopmentApprovalRules("SERVICE", {
      ...enabledEnvironment,
      NODE_ENV: "production",
    }),
    { statusCode: 403 }
  );
});

test("SERVICE builds a fully resolved Manager route", async () => {
  const route = await buildApprovalRoute({
    materialGroupCode: "SERVICE",
    specification,
    requestorUserId,
    environment: enabledEnvironment,
  });

  assert.equal(route.materialGroupCode, "SERVICE");
  assert.equal(route.plantId, 7201);
  assert.equal(route.departmentId, 7301);
  assert.equal(route.steps.length, 1);
  assert.deepEqual(route.steps[0], {
    stepNo: 1,
    approverRole: ROLES.MANAGER,
    assignedApproverUserId: "DEV-MGR-001",
    assignedApproverEmployeeId: "DEV-EMP-MGR-001",
    assignedApproverDisplayName: "Development Manager",
    assignedApproverEmail: "dev.manager@example.test",
    plantId: 7201,
    departmentId: 7301,
    identitySource: "development",
  });
});

test("SERVICEPM builds a fully resolved Manager then HeadEngineering route", async () => {
  const route = await buildApprovalRoute({
    materialGroupCode: "SERVICEPM",
    specification,
    requestorUserId,
    environment: enabledEnvironment,
  });

  assert.equal(route.steps.length, 2);
  assert.deepEqual(
    route.steps.map((step) => [step.stepNo, step.approverRole, step.assignedApproverUserId]),
    [
      [1, ROLES.MANAGER, "DEV-MGR-001"],
      [2, ROLES.HEAD_ENGINEERING, "DEV-HE-001"],
    ]
  );
});

test("BEARING builds a fully resolved Manager then HeadEngineering route", async () => {
  const route = await buildApprovalRoute({
    materialGroupCode: "BEARING",
    specification: bearingSpecification,
    requestorUserId,
    environment: enabledEnvironment,
  });

  assert.equal(route.materialGroupCode, "BEARING");
  assert.deepEqual(
    route.steps.map((step) => [step.stepNo, step.approverRole, step.assignedApproverUserId]),
    [
      [1, ROLES.MANAGER, "DEV-MGR-001"],
      [2, ROLES.HEAD_ENGINEERING, "DEV-HE-001"],
    ]
  );
});

test("routing is deterministic and does not mutate shared definitions", async () => {
  const first = await buildApprovalRoute({
    materialGroupCode: "SERVICEPM",
    specification,
    requestorUserId,
    environment: enabledEnvironment,
  });
  const second = await buildApprovalRoute({
    materialGroupCode: "servicEpm",
    specification,
    requestorUserId,
    environment: enabledEnvironment,
  });

  assert.deepEqual(first, second);
});

test("unsupported Plant prevents route generation", async () => {
  await assert.rejects(
    buildApprovalRoute({
      materialGroupCode: "SERVICE",
      specification: { ...specification, plantId: 9999 },
      requestorUserId,
      environment: enabledEnvironment,
    }),
    { statusCode: 403 }
  );
});

test("unsupported Department prevents route generation", async () => {
  await assert.rejects(
    buildApprovalRoute({
      materialGroupCode: "SERVICE",
      specification: { ...specification, departmentId: 9999 },
      requestorUserId,
      environment: enabledEnvironment,
    }),
    { statusCode: 403 }
  );
});

test("a Requestor cannot approve its own document", async () => {
  await assert.rejects(
    buildApprovalRoute({
      materialGroupCode: "SERVICE",
      specification,
      requestorUserId: "DEV-MGR-001",
      environment: enabledEnvironment,
    }),
    { statusCode: 409 }
  );
});

test("a Requestor cannot approve their own BEARING document", async () => {
  await assert.rejects(
    buildApprovalRoute({
      materialGroupCode: "BEARING",
      specification: bearingSpecification,
      requestorUserId: "DEV-MGR-001",
      environment: enabledEnvironment,
    }),
    { statusCode: 409 }
  );
});

test("BEARING route cannot be generated outside the supported organizational scope", async () => {
  await assert.rejects(
    buildApprovalRoute({
      materialGroupCode: "BEARING",
      specification: { ...bearingSpecification, plantId: 9999 },
      requestorUserId,
      environment: enabledEnvironment,
    }),
    { statusCode: 403 }
  );
  await assert.rejects(
    buildApprovalRoute({
      materialGroupCode: "BEARING",
      specification: { ...bearingSpecification, departmentId: 9999 },
      requestorUserId,
      environment: enabledEnvironment,
    }),
    { statusCode: 403 }
  );
});

test("one failed assignment rejects the entire route without a partial result", async () => {
  const failingAssignmentService = {
    resolveApproverAssignment: (input) => {
      if (input.rule.stepNo === 2) {
        const error = new Error("HeadEngineering assignment unavailable.");
        error.statusCode = 403;
        throw error;
      }

      return approverAssignmentService.resolveApproverAssignment(input);
    },
  };

  await assert.rejects(
    buildApprovalRoute({
      materialGroupCode: "SERVICEPM",
      specification,
      requestorUserId,
      environment: enabledEnvironment,
      assignmentService: failingAssignmentService,
    }),
    /HeadEngineering assignment unavailable/
  );
});

test("malformed pattern provider output fails closed", async () => {
  const malformedPatterns = [
    { name: "empty", rules: [] },
    {
      name: "duplicate",
      rules: [
        { stepNo: 1, approverRole: ROLES.MANAGER, isRequired: true },
        { stepNo: 1, approverRole: ROLES.HEAD_ENGINEERING, isRequired: true },
      ],
    },
    {
      name: "skipped",
      rules: [
        { stepNo: 1, approverRole: ROLES.MANAGER, isRequired: true },
        { stepNo: 3, approverRole: ROLES.HEAD_ENGINEERING, isRequired: true },
      ],
    },
    {
      name: "not required",
      rules: [
        { stepNo: 1, approverRole: ROLES.MANAGER, isRequired: false },
      ],
    },
  ];

  for (const { name, rules } of malformedPatterns) {
    await assert.rejects(
      buildApprovalRoute({
        materialGroupCode: "SERVICEPM",
        specification,
        requestorUserId,
        environment: enabledEnvironment,
        patternProvider: {
          getApprovalRules: () => rules,
        },
      }),
      undefined,
      `${name} pattern should be rejected`
    );
  }
});
