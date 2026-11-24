const assert = require("node:assert/strict");
const Module = require("node:module");
const test = require("node:test");

const repositoryPath = require.resolve("../src/repositories/approval.repository");

const manager = {
  userId: "DEV-MGR-001",
  displayName: "Development Manager",
  roles: ["Manager"],
  plantIds: [7201],
  departmentIds: [7301],
};
const headEngineering = {
  userId: "DEV-HE-001",
  displayName: "Development Head Engineering",
  roles: ["HeadEngineering"],
  plantIds: [7201],
  departmentIds: [7301],
};
const requestor = {
  userId: "DEV-REQ-001",
  displayName: "Development Requestor",
  roles: ["Requestor"],
  plantIds: [7201],
  departmentIds: [7301],
};

const loadRepository = ({ step = {}, hasNextStep = false, failAt } = {}) => {
  const originalLoad = Module._load;
  const calls = [];
  const currentStep = {
    id: 80,
    stepno: 1,
    approverrole: "Manager",
    approvername: "Development Manager",
    approvalstatus: "Pending",
    assignedapproveruserid: "DEV-MGR-001",
    ...step,
  };
  let released = false;

  const client = {
    query: async (sql, values = []) => {
      calls.push({ sql, values });
      if (/^(BEGIN|COMMIT|ROLLBACK)$/.test(sql)) return { rows: [] };
      if (/FROM specifications[\s\S]*FOR UPDATE/.test(sql)) {
        return { rows: [{ id: 60, status: "In Approval", plantid: 7201, departmentid: 7301 }] };
      }
      if (/FROM specification_approval_cycles[\s\S]*FOR UPDATE/.test(sql)) {
        return { rows: [{ id: 70, cycleno: 1, status: "Active" }] };
      }
      if (/FROM specification_approval_steps[\s\S]*NOT EXISTS[\s\S]*FOR UPDATE/.test(sql)) {
        return { rows: [currentStep] };
      }
      if (/UPDATE specification_approval_steps[\s\S]*WHERE id = \$1/.test(sql)) {
        if (failAt === "decision") throw new Error("decision write failed");
        return { rows: [{ ...currentStep, approvalstatus: values[1] }] };
      }
      if (/INSERT INTO specification_approval_step_events/.test(sql)) return { rows: [] };
      if (/SELECT id[\s\S]*FROM specification_approval_steps[\s\S]*ORDER BY stepno/.test(sql)) {
        return { rows: hasNextStep ? [{ id: 81 }] : [] };
      }
      if (/UPDATE specification_approval_steps[\s\S]*stepno > \$3/.test(sql)) {
        return { rows: hasNextStep ? [{ id: 81, stepno: 2, approverrole: "HeadEngineering", assignedapproveruserid: "DEV-HE-001" }] : [] };
      }
      if (/UPDATE specification_approval_cycles/.test(sql)) return { rows: [] };
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
    return { repository: require(repositoryPath), calls, released: () => released };
  } finally {
    Module._load = originalLoad;
    delete require.cache[repositoryPath];
  }
};

const loadReadRepository = ({ inboxRows = [], accessRows = [], cycles = [], steps = [], events = [], history = [] } = {}) => {
  const originalLoad = Module._load;
  const calls = [];
  const pool = {
    query: async (sql, values = []) => {
      calls.push({ sql, values });
      if (/SELECT s\.id, s\.status, s\.createdbyuserid[\s\S]*FROM specifications s[\s\S]*OR\s+EXISTS\s*\(/.test(sql)) return { rows: accessRows };
      if (/FROM specification_approval_steps step/.test(sql)) return { rows: inboxRows };
      if (/FROM specification_approval_step_events/.test(sql)) return { rows: events };
      if (/FROM specification_status_history/.test(sql)) return { rows: history };
      if (/FROM specification_approval_cycles WHERE specificationid/.test(sql)) return { rows: cycles };
      if (/FROM specification_approval_steps WHERE specificationid/.test(sql)) return { rows: steps };
      throw new Error(`Unexpected read query: ${sql}`);
    },
  };
  Module._load = (request, parent, isMain) => {
    if (request === "../config/database") return pool;
    return originalLoad(request, parent, isMain);
  };
  delete require.cache[repositoryPath];
  try {
    return { repository: require(repositoryPath), calls };
  } finally {
    Module._load = originalLoad;
    delete require.cache[repositoryPath];
  }
};

test("Manager approves final SERVICE step and completes the cycle", async () => {
  const { repository, calls, released } = loadRepository();
  const result = await repository.decide({
    specificationId: 60,
    actor: manager,
    decision: "approve",
    comment: "Approved",
  });

  assert.equal(result.decision, "Approved");
  assert.equal(calls.at(-1).sql, "COMMIT");
  assert.equal(calls.some(({ sql, values }) => /UPDATE specification_approval_cycles/.test(sql) && values.includes("Completed")), true);
  assert.equal(calls.some(({ sql, values }) => /UPDATE specifications/.test(sql) && values.includes("Approved")), true);
  assert.equal(calls.some(({ sql, values }) => /INSERT INTO specification_status_history/.test(sql) && values.includes("Approved")), true);
  assert.equal(released(), true);
});

test("Manager approval of SERVICEPM keeps document and cycle active for the next step", async () => {
  const { repository, calls } = loadRepository({ hasNextStep: true });
  await repository.decide({ specificationId: 60, actor: manager, decision: "approve" });

  assert.equal(calls.some(({ sql }) => /UPDATE specification_approval_cycles/.test(sql)), false);
  assert.equal(calls.some(({ sql }) => /UPDATE specifications/.test(sql)), false);
  assert.equal(calls.some(({ sql }) => /INSERT INTO specification_status_history/.test(sql)), false);
});

test("HeadEngineering approves the final SERVICEPM step", async () => {
  const { repository, calls } = loadRepository({
    step: {
      id: 81,
      stepno: 2,
      approverrole: "HeadEngineering",
      approvername: "Development Head Engineering",
      assignedapproveruserid: "DEV-HE-001",
    },
  });
  const result = await repository.decide({ specificationId: 60, actor: headEngineering, decision: "approve" });

  assert.equal(result.decision, "Approved");
  assert.equal(calls.some(({ sql, values }) => /UPDATE specification_approval_cycles/.test(sql) && values.includes("Completed")), true);
  assert.equal(calls.some(({ sql, values }) => /UPDATE specifications/.test(sql) && values.includes("Approved")), true);
});

test("HeadEngineering cannot skip the Manager actionable step", async () => {
  const { repository, calls } = loadRepository();
  await assert.rejects(
    () => repository.decide({ specificationId: 60, actor: headEngineering, decision: "approve" }),
    { statusCode: 403 }
  );
  assert.equal(calls.some(({ sql }) => /UPDATE specification_approval_steps/.test(sql)), false);
  assert.equal(calls.at(-1).sql, "ROLLBACK");
});

test("BEARING first pending step is Manager", async () => {
  const { repository, calls } = loadRepository();
  await assert.rejects(
    () => repository.decide({ specificationId: 60, actor: headEngineering, decision: "approve" }),
    { statusCode: 403 }
  );
  assert.equal(calls.some(({ sql }) => /UPDATE specification_approval_steps/.test(sql)), false);
});

test("BEARING Manager approval leaves HeadEngineering as the next pending step", async () => {
  const { repository, calls } = loadRepository({ hasNextStep: true });
  const result = await repository.decide({
    specificationId: 60,
    actor: manager,
    decision: "approve",
  });

  assert.equal(result.decision, "Approved");
  assert.equal(
    calls.some(({ sql, values }) => /WHERE approvalcycleid = \$1 AND approvalstatus = \$2/.test(sql) && values[1] === "Pending"),
    true
  );
  assert.equal(calls.some(({ sql }) => /UPDATE specification_approval_cycles/.test(sql)), false);
  assert.equal(calls.some(({ sql }) => /UPDATE specifications/.test(sql)), false);
});

test("BEARING HeadEngineering approval completes the document", async () => {
  const { repository, calls } = loadRepository({
    step: {
      id: 81,
      stepno: 2,
      approverrole: "HeadEngineering",
      approvername: "Development Head Engineering",
      assignedapproveruserid: "DEV-HE-001",
    },
  });
  const result = await repository.decide({
    specificationId: 60,
    actor: headEngineering,
    decision: "approve",
  });

  assert.equal(result.decision, "Approved");
  assert.equal(calls.some(({ sql, values }) => /UPDATE specification_approval_cycles/.test(sql) && values.includes("Completed")), true);
  assert.equal(calls.some(({ sql, values }) => /UPDATE specifications/.test(sql) && values.includes("Approved")), true);
});

test("BEARING Requestor cannot approve the document", async () => {
  const { repository, calls } = loadRepository();
  await assert.rejects(
    () => repository.decide({ specificationId: 60, actor: requestor, decision: "approve" }),
    { statusCode: 403 }
  );
  assert.equal(calls.some(({ sql }) => /UPDATE specification_approval_steps/.test(sql)), false);
});

test("BEARING exact assigned-user authorization is enforced", async () => {
  const { repository, calls } = loadRepository();
  await assert.rejects(
    () => repository.decide({
      specificationId: 60,
      actor: { ...manager, userId: "DEV-MGR-002" },
      decision: "approve",
    }),
    { statusCode: 403, message: "Anda bukan approver yang ditugaskan." }
  );
  assert.equal(calls.some(({ sql }) => /UPDATE specification_approval_steps/.test(sql)), false);
});

test("wrong organizational scope is rejected before any decision write", async () => {
  const { repository, calls } = loadRepository();
  await assert.rejects(
    () => repository.decide({
      specificationId: 60,
      actor: { ...manager, plantIds: [9999] },
      decision: "approve",
    }),
    { statusCode: 403 }
  );
  assert.equal(calls.some(({ sql }) => /UPDATE specification_approval_steps/.test(sql)), false);
});

test("Return cancels future pending steps and moves the document to Revision Required", async () => {
  const { repository, calls } = loadRepository({ hasNextStep: true });
  await repository.decide({ specificationId: 60, actor: manager, decision: "return", comment: "Please revise" });

  assert.equal(calls.some(({ sql, values }) => /UPDATE specification_approval_cycles/.test(sql) && values.includes("Returned")), true);
  assert.equal(calls.some(({ sql, values }) => /UPDATE specifications/.test(sql) && values.includes("Revision Required")), true);
  assert.equal(calls.filter(({ sql }) => /INSERT INTO specification_approval_step_events/.test(sql)).length, 2);
});

test("Reject cancels future pending steps and moves the document to Rejected", async () => {
  const { repository, calls } = loadRepository({ hasNextStep: true });
  await repository.decide({ specificationId: 60, actor: manager, decision: "reject", comment: "Rejected" });

  assert.equal(calls.some(({ sql, values }) => /UPDATE specification_approval_cycles/.test(sql) && values.includes("Rejected")), true);
  assert.equal(calls.some(({ sql, values }) => /UPDATE specifications/.test(sql) && values.includes("Rejected")), true);
});

test("failed decision rolls back without completing the cycle or status history", async () => {
  const { repository, calls, released } = loadRepository({ failAt: "decision" });
  await assert.rejects(
    () => repository.decide({ specificationId: 60, actor: manager, decision: "approve" }),
    /decision write failed/
  );

  assert.equal(calls.at(-1).sql, "ROLLBACK");
  assert.equal(calls.some(({ sql }) => /UPDATE specification_approval_cycles/.test(sql)), false);
  assert.equal(calls.some(({ sql }) => /INSERT INTO specification_status_history/.test(sql)), false);
  assert.equal(released(), true);
});

test("inbox returns only actionable assigned steps within the approver scope", async () => {
  const { repository, calls } = loadReadRepository({
    inboxRows: [
      {
        specification_id: 60,
        document_no: "E-SPEC-60",
        approverrole: "Manager",
        approvername: "Development Manager",
        plantid: 7201,
        departmentid: 7301,
        stepno: 1,
      },
      {
        specification_id: 61,
        approverrole: "HeadEngineering",
        plantid: 7201,
        departmentid: 7301,
        stepno: 2,
      },
      {
        specification_id: 62,
        approverrole: "Manager",
        plantid: 9999,
        departmentid: 7301,
        stepno: 1,
      },
    ],
  });
  const inbox = await repository.findInbox(manager);

  assert.equal(inbox.length, 1);
  assert.equal(inbox[0].specification_id, 60);
  assert.equal(Object.hasOwn(inbox[0], "plantid"), false);
  assert.equal(calls[0].values[0], "DEV-MGR-001");
  assert.match(calls[0].sql, /NOT EXISTS/);
});

test("workflow history allows creator or assigned approver and preserves cycle ordering", async () => {
  const { repository } = loadReadRepository({
    accessRows: [{ id: 60, status: "In Approval", createdbyuserid: "DEV-REQ-001" }],
    cycles: [
      { id: 70, cycleno: 1, status: "Returned" },
      { id: 71, cycleno: 2, status: "Active" },
    ],
    steps: [
      { id: 80, approvalcycleid: 70, stepno: 1, approvalstatus: "Returned" },
      { id: 81, approvalcycleid: 71, stepno: 1, approvalstatus: "Pending" },
    ],
    events: [
      { approvalcycleid: 70, approvalstepid: 80, eventtype: "Returned", occurredat: "2026-01-01" },
    ],
    history: [{ previousstatus: "Draft", newstatus: "In Approval" }],
  });
  const workflow = await repository.findWorkflow(60, {
    userId: "DEV-REQ-001",
    roles: ["Requestor"],
    plantIds: [7201],
    departmentIds: [7301],
  });

  assert.deepEqual(workflow.cycles.map((cycle) => cycle.cycleno), [1, 2]);
  assert.equal(workflow.cycles[0].steps[0].id, 80);
  assert.equal(workflow.cycles[0].events[0].eventtype, "Returned");
  assert.equal(workflow.statusHistory.length, 1);
});

test("workflow history denies unrelated users", async () => {
  const { repository } = loadReadRepository();
  await assert.rejects(
    () => repository.findWorkflow(60, manager),
    { statusCode: 403 }
  );
});
