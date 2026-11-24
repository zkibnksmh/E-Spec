const assert = require("node:assert/strict");
const Module = require("node:module");
const test = require("node:test");

const repositoryPath = require.resolve("../src/repositories/specification-submission.repository");

const actor = {
  userId: "DEV-REQ-001",
  displayName: "Development Requestor",
};

const specification = ({ status = "Draft", createdbyuserid = actor.userId } = {}) => ({
  id: 60,
  specificationtypeid: 1,
  plantid: 10,
  departmentid: 20,
  materialcategoryid: 30,
  materialgroupid: 40,
  status,
  createdbyuserid,
  formdata: {
    requestor: "Requestor",
    materialDescription: "Bearing test",
    partNumber: "PN-1",
    variant: "V1",
    dimension: "D1",
    brand: "Brand",
    uom: "EA",
    drawingImage: "image",
    additionalService: "None",
  },
});

const route = {
  steps: [
    {
      stepNo: 1,
      approverRole: "Manager",
      assignedApproverUserId: "DEV-MGR-001",
      assignedApproverDisplayName: "Development Manager",
    },
    {
      stepNo: 2,
      approverRole: "HeadEngineering",
      assignedApproverUserId: "DEV-HE-001",
      assignedApproverDisplayName: "Development Head Engineering",
    },
  ],
};

const loadRepository = ({ current = specification(), latest = null, active = null, failAt } = {}) => {
  const originalLoad = Module._load;
  const calls = [];
  let released = false;

  const client = {
    query: async (sql, values = []) => {
      calls.push({ sql, values });

      if (/^(BEGIN|COMMIT|ROLLBACK)$/.test(sql)) return { rows: [] };
      if (/FROM specifications s[\s\S]*FOR UPDATE/.test(sql)) return { rows: [current].filter(Boolean) };
      if (/FROM specification_approval_cycles[\s\S]*status = \$2/.test(sql)) return { rows: [active].filter(Boolean) };
      if (/FROM specification_approval_cycles[\s\S]*ORDER BY cycleno DESC/.test(sql)) return { rows: [latest].filter(Boolean) };
      if (/FROM specification_types/.test(sql)) return { rows: [{ id: 1, typecode: "BRG" }] };
      if (/SELECT id FROM plants/.test(sql)) return { rows: [{ id: 10 }] };
      if (/FROM departments d/.test(sql)) return { rows: [{ id: 20 }] };
      if (/FROM material_categories/.test(sql)) {
        return { rows: [{ id: 30, categoryname: "OPEX - BARANG", specificationtypeid: 1 }] };
      }
      if (/FROM material_groups/.test(sql)) {
        return { rows: [{ id: 40, sapgroupcode: "SERVICE", materialcategoryid: 30 }] };
      }
      if (/INSERT INTO specification_approval_cycles/.test(sql)) {
        return { rows: [{ id: 70, cycleno: latest ? latest.cycleno + 1 : 1, status: "Active", submittedat: "2026-11-22T00:00:00.000Z" }] };
      }
      if (/INSERT INTO specification_approval_steps/.test(sql)) {
        if (failAt === "step") throw new Error("step write failed");
        return {
          rows: [{
            approvalmatrixruleid: null,
            stepno: values[2],
            approverrole: values[3],
            approvername: values[4],
            approvalstatus: values[5],
            assignedapproveruserid: values[6],
          }],
        };
      }
      if (/UPDATE specifications/.test(sql)) return { rows: [] };
      if (/INSERT INTO specification_status_history/.test(sql)) return { rows: [] };

      throw new Error(`Unexpected query: ${sql}`);
    },
    release: () => { released = true; },
  };
  const pool = { connect: async () => client };

  Module._load = (request, parent, isMain) => {
    if (request === "../config/database") return pool;
    return originalLoad(request, parent, isMain);
  };
  delete require.cache[repositoryPath];

  try {
    return {
      repository: require(repositoryPath),
      calls,
      released: () => released,
    };
  } finally {
    Module._load = originalLoad;
    delete require.cache[repositoryPath];
  }
};

test("initial submission persists an active cycle, pending step, status history, and audit identity", async () => {
  const { repository, calls, released } = loadRepository();
  const routeCalls = [];

  const result = await repository.submit({
    specificationId: 60,
    actor,
    comment: "Submit",
    buildRoute: async (input) => {
      routeCalls.push(input);
      return route;
    },
  });

  assert.equal(result.status, "In Approval");
  assert.equal(result.cycle.cycleno, 1);
  assert.equal(result.approvalSteps[0].assignedapproveruserid, "DEV-MGR-001");
  assert.equal(routeCalls[0].materialGroupCode, "SERVICE");
  assert.equal(routeCalls[0].specification.plantId, 10);
  assert.equal(calls[0].sql, "BEGIN");
  assert.equal(calls.at(-1).sql, "COMMIT");
  assert.equal(calls.some(({ sql }) => /INSERT INTO specification_status_history/.test(sql)), true);
  assert.equal(calls.some(({ sql }) => /UPDATE specifications/.test(sql)), true);
  assert.equal(released(), true);
});

test("approval step insert uses approvalmatrixruleid with NULL for development routing", async () => {
  const { repository, calls } = loadRepository();

  const result = await repository.submit({
    specificationId: 60,
    actor,
    buildRoute: async () => route,
  });

  const stepInserts = calls.filter(({ sql }) => /INSERT INTO specification_approval_steps/.test(sql));
  assert.equal(stepInserts.length, 2);

  for (const { sql } of stepInserts) {
    assert.match(sql, /\bapprovalmatrixruleid\b/);
    assert.doesNotMatch(sql, /\bapprovalruleid\b/);
    assert.match(sql, /VALUES \(\$1, \$2, \$3, NULL, \$4, \$5, \$6, \$7\)/);
  }

  assert.deepEqual(result.approvalSteps.map(({ approvalmatrixruleid }) => approvalmatrixruleid), [null, null]);
  assert.deepEqual(
    result.approvalSteps.map(({ assignedapproveruserid }) => assignedapproveruserid),
    ["DEV-MGR-001", "DEV-HE-001"]
  );
  assert.deepEqual(
    result.approvalSteps.map(({ approverrole }) => approverrole),
    ["Manager", "HeadEngineering"]
  );
});

test("failed submission rolls back all workflow writes", async () => {
  const { repository, calls, released } = loadRepository({ failAt: "step" });

  await assert.rejects(
    () => repository.submit({
      specificationId: 60,
      actor,
      buildRoute: async () => route,
    }),
    /step write failed/
  );

  assert.equal(calls.at(-1).sql, "ROLLBACK");
  assert.equal(calls.some(({ sql }) => /UPDATE specifications/.test(sql)), false);
  assert.equal(calls.some(({ sql }) => /INSERT INTO specification_status_history/.test(sql)), false);
  assert.equal(released(), true);
});

test("submission rejects legacy and non-owner specifications before workflow writes", async () => {
  for (const createdbyuserid of [null, "DEV-REQ-999"]) {
    const { repository, calls } = loadRepository({ current: specification({ createdbyuserid }) });

    await assert.rejects(
      () => repository.submit({ specificationId: 60, actor, buildRoute: async () => route }),
      { statusCode: 403 }
    );
    assert.equal(calls.some(({ sql }) => /INSERT INTO specification_approval_cycles/.test(sql)), false);
    assert.equal(calls.at(-1).sql, "ROLLBACK");
  }
});

test("resubmission requires Revision Required and a previous Returned cycle", async () => {
  const { repository, calls } = loadRepository({
    current: specification({ status: "Revision Required" }),
    latest: { id: 69, cycleno: 1, status: "Returned" },
  });

  const result = await repository.submit({
    specificationId: 60,
    actor,
    buildRoute: async () => route,
    resubmission: true,
  });

  assert.equal(result.cycle.cycleno, 2);
  const statusHistory = calls.find(({ sql }) => /INSERT INTO specification_status_history/.test(sql));
  assert.equal(statusHistory.values[1], "Revision Required");
});

test("resubmission rejects a missing or non-Returned prior cycle", async () => {
  for (const latest of [null, { id: 69, cycleno: 1, status: "Completed" }]) {
    const { repository, calls } = loadRepository({
      current: specification({ status: "Revision Required" }),
      latest,
    });

    await assert.rejects(
      () => repository.submit({
        specificationId: 60,
        actor,
        buildRoute: async () => route,
        resubmission: true,
      }),
      { statusCode: 409 }
    );
    assert.equal(calls.some(({ sql }) => /INSERT INTO specification_approval_cycles/.test(sql)), false);
  }
});
