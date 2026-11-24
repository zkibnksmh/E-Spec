process.env.E_SPEC_ENV = "test";

const assert = require("node:assert/strict");
const test = require("node:test");
const pool = require("../src/config/database");
const {
  SPECIFICATION_STATUS,
  APPROVAL_STEP_STATUS,
  APPROVAL_CYCLE_STATUS,
} = require("../src/workflow/constants/statuses");

const createSpecification = async (client, suffix) => {
  const result = await client.query(
    `INSERT INTO specifications (
      documentno, specificationtypeid, plantid, requestor, materialdescription, formdata
    ) VALUES ($1, 7101, 7201, 'workflow-schema-test', 'Workflow schema test', '{}'::jsonb)
    RETURNING id`,
    [`WF-SCHEMA-${suffix}-${Date.now()}-${Math.random()}`]
  );
  return result.rows[0].id;
};

const createCycle = async (client, specificationId, cycleNo, status = "Active") => {
  const result = await client.query(
    `INSERT INTO specification_approval_cycles (
      specificationid, cycleno, status, submittedbyuserid, submittedbydisplayname
    ) VALUES ($1, $2, $3, 'DEV-REQ-001', 'Development Requestor')
    RETURNING id`,
    [specificationId, cycleNo, status]
  );
  return result.rows[0].id;
};

const createStep = async (client, specificationId, cycleId, stepNo, status = "Pending") => {
  const result = await client.query(
    `INSERT INTO specification_approval_steps (
      specificationid, approvalcycleid, stepno, approverrole, approvername,
      approvalstatus, assignedapproveruserid, actionbyuserid, actionby
    ) VALUES ($1, $2, $3, 'Manager', 'Development Manager', $4,
      'DEV-MGR-001', 'DEV-MGR-001', 'Development Manager')
    RETURNING id`,
    [specificationId, cycleId, stepNo, status]
  );
  return result.rows[0].id;
};

const expectConstraintViolation = async (client, operation) => {
  await client.query("SAVEPOINT expected_constraint_violation");
  await assert.rejects(operation(), { code: "23505" });
  await client.query("ROLLBACK TO SAVEPOINT expected_constraint_violation");
};

test.after(async () => {
  await pool.end();
});

test("workflow status constants are canonical and separate", () => {
  assert.deepEqual(Object.values(SPECIFICATION_STATUS), [
    "Draft",
    "In Approval",
    "Revision Required",
    "Approved",
    "Rejected",
  ]);
  assert.deepEqual(Object.values(APPROVAL_STEP_STATUS), [
    "Pending",
    "Approved",
    "Returned",
    "Rejected",
    "Cancelled",
  ]);
  assert.deepEqual(Object.values(APPROVAL_CYCLE_STATUS), [
    "Active",
    "Completed",
    "Returned",
    "Rejected",
  ]);
});

test("cycles and cycle-aware approval steps preserve multiple workflow attempts", async () => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const specificationId = await createSpecification(client, "cycles");
    const firstCycleId = await createCycle(client, specificationId, 1, "Completed");
    const secondCycleId = await createCycle(client, specificationId, 2, "Active");

    await createStep(client, specificationId, firstCycleId, 1, "Approved");
    await createStep(client, specificationId, secondCycleId, 1);

    await expectConstraintViolation(
      client,
      () => createStep(client, specificationId, secondCycleId, 1)
    );

    await expectConstraintViolation(
      client,
      () => createCycle(client, specificationId, 3, "Active")
    );

    const cycles = await client.query(
      "SELECT cycleno, status FROM specification_approval_cycles WHERE specificationid = $1 ORDER BY cycleno",
      [specificationId]
    );
    const steps = await client.query(
      `SELECT approvalcycleid, stepno, assignedapproveruserid, actionbyuserid
       FROM specification_approval_steps
       WHERE specificationid = $1
       ORDER BY approvalcycleid`,
      [specificationId]
    );

    assert.deepEqual(cycles.rows, [
      { cycleno: 1, status: "Completed" },
      { cycleno: 2, status: "Active" },
    ]);
    assert.equal(steps.rowCount, 2);
    steps.rows.forEach((step) => {
      assert.equal(step.stepno, 1);
      assert.equal(step.assignedapproveruserid, "DEV-MGR-001");
      assert.equal(step.actionbyuserid, "DEV-MGR-001");
    });
  } finally {
    await client.query("ROLLBACK");
    client.release();
  }
});

test("a step cannot reference a cycle for another specification", async () => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const firstSpecificationId = await createSpecification(client, "mismatch-one");
    const secondSpecificationId = await createSpecification(client, "mismatch-two");
    const cycleId = await createCycle(client, firstSpecificationId, 1);

    await assert.rejects(
      createStep(client, secondSpecificationId, cycleId, 1),
      { code: "23503" }
    );
  } finally {
    await client.query("ROLLBACK");
    client.release();
  }
});

test("status history and immutable approval events retain stable actor identities", async () => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const specificationId = await createSpecification(client, "events");
    const firstCycleId = await createCycle(client, specificationId, 1, "Returned");
    const firstStepId = await createStep(client, specificationId, firstCycleId, 1, "Returned");
    const secondCycleId = await createCycle(client, specificationId, 2);
    const secondStepId = await createStep(client, specificationId, secondCycleId, 1);

    await client.query(
      `INSERT INTO specification_status_history (
        specificationid, previousstatus, newstatus, changedby, changedbyuserid, changereason
      ) VALUES ($1, 'Draft', 'In Approval', 'Development Requestor', 'DEV-REQ-001', 'Submitted')`,
      [specificationId]
    );
    await client.query(
      `INSERT INTO specification_approval_step_events (
        specificationid, approvalcycleid, approvalstepid, assignedapproveruserid,
        actoruserid, actordisplayname, actorrole, eventtype, previousstepstatus,
        newstepstatus, comments
      ) VALUES
        ($1, $2, $3, 'DEV-MGR-001', 'DEV-MGR-001', 'Development Manager', 'Manager',
          'Returned', 'Pending', 'Returned', 'Clarify the scope'),
        ($1, $4, $5, 'DEV-MGR-001', 'DEV-MGR-001', 'Development Manager', 'Manager',
          'Approved', 'Pending', 'Approved', 'Approved after revision')`,
      [specificationId, firstCycleId, firstStepId, secondCycleId, secondStepId]
    );

    const history = await client.query(
      "SELECT changedbyuserid FROM specification_status_history WHERE specificationid = $1",
      [specificationId]
    );
    const events = await client.query(
      `SELECT approvalcycleid, approvalstepid, eventtype, actoruserid, assignedapproveruserid
       FROM specification_approval_step_events
       WHERE specificationid = $1
       ORDER BY id`,
      [specificationId]
    );

    assert.equal(history.rows[0].changedbyuserid, "DEV-REQ-001");
    assert.deepEqual(events.rows, [
      {
        approvalcycleid: firstCycleId,
        approvalstepid: firstStepId,
        eventtype: "Returned",
        actoruserid: "DEV-MGR-001",
        assignedapproveruserid: "DEV-MGR-001",
      },
      {
        approvalcycleid: secondCycleId,
        approvalstepid: secondStepId,
        eventtype: "Approved",
        actoruserid: "DEV-MGR-001",
        assignedapproveruserid: "DEV-MGR-001",
      },
    ]);
  } finally {
    await client.query("ROLLBACK");
    client.release();
  }
});
