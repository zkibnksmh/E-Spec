const pool = require("../config/database");
const { hasPlantAccess, hasDepartmentAccess } = require("../auth/policies/authorization.policy");
const {
  SPECIFICATION_STATUS,
  APPROVAL_CYCLE_STATUS,
  APPROVAL_STEP_STATUS,
} = require("../workflow/constants/statuses");

const createHttpError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const assertScope = (actor, specification) => {
  if (
    !hasPlantAccess(actor, specification.plantid) ||
    !hasDepartmentAccess(actor, specification.departmentid)
  ) {
    throw createHttpError("Anda tidak memiliki akses untuk operasi ini.", 403);
  }
};

const insertEvent = async (client, { specificationId, cycleId, step, actor, eventType, comments }) => {
  await client.query(
    `INSERT INTO specification_approval_step_events (
       specificationid, approvalcycleid, approvalstepid, assignedapproveruserid,
       actoruserid, actordisplayname, actorrole, eventtype,
       previousstepstatus, newstepstatus, comments
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      specificationId,
      cycleId,
      step.id,
      step.assignedapproveruserid,
      actor.userId,
      actor.displayName,
      step.approverrole,
      eventType,
      step.approvalstatus,
      eventType,
      comments || null,
    ]
  );
};

const loadDecisionContext = async (client, specificationId) => {
  const specificationResult = await client.query(
    `SELECT id, status, plantid, departmentid
     FROM specifications
     WHERE id = $1
     FOR UPDATE`,
    [specificationId]
  );
  const specification = specificationResult.rows[0];

  if (!specification) throw createHttpError("Spesifikasi tidak ditemukan.", 404);
  if (specification.status !== SPECIFICATION_STATUS.IN_APPROVAL) {
    throw createHttpError("Spesifikasi tidak dalam proses approval.", 409);
  }

  const cycleResult = await client.query(
    `SELECT id, cycleno, status
     FROM specification_approval_cycles
     WHERE specificationid = $1 AND status = $2
     FOR UPDATE`,
    [specificationId, APPROVAL_CYCLE_STATUS.ACTIVE]
  );
  const cycle = cycleResult.rows[0];

  if (!cycle) throw createHttpError("Approval cycle aktif tidak ditemukan.", 409);

  const stepResult = await client.query(
    `SELECT id, stepno, approverrole, approvername, approvalstatus, assignedapproveruserid
     FROM specification_approval_steps
     WHERE approvalcycleid = $1 AND approvalstatus = $2
       AND NOT EXISTS (
         SELECT 1
         FROM specification_approval_steps previous
         WHERE previous.approvalcycleid = specification_approval_steps.approvalcycleid
           AND previous.stepno < specification_approval_steps.stepno
           AND previous.approvalstatus <> $3
       )
     ORDER BY stepno
     LIMIT 1
     FOR UPDATE`,
    [cycle.id, APPROVAL_STEP_STATUS.PENDING, APPROVAL_STEP_STATUS.APPROVED]
  );
  const step = stepResult.rows[0];

  if (!step) throw createHttpError("Tidak ada approval step yang dapat diproses.", 409);

  return { specification, cycle, step };
};

const assertAssignedApprover = (actor, specification, step) => {
  if (String(step.assignedapproveruserid) !== actor.userId) {
    throw createHttpError("Anda bukan approver yang ditugaskan.", 403);
  }
  if (!actor.roles.includes(step.approverrole)) {
    throw createHttpError("Role approver tidak sesuai.", 403);
  }
  assertScope(actor, specification);
};

const updateDecisionStep = async (client, step, actor, status, comment) => {
  const result = await client.query(
    `UPDATE specification_approval_steps
     SET approvalstatus = $2,
         actionbyuserid = $3,
         actionby = $4,
         actionat = CURRENT_TIMESTAMP,
         comments = $5
     WHERE id = $1 AND approvalstatus = $6
     RETURNING id, stepno, approverrole, approvername, approvalstatus, assignedapproveruserid`,
    [
      step.id,
      status,
      actor.userId,
      actor.displayName,
      comment || null,
      APPROVAL_STEP_STATUS.PENDING,
    ]
  );

  if (!result.rows[0]) {
    throw createHttpError("Approval step sudah diproses.", 409);
  }

  return result.rows[0];
};

const cancelFutureSteps = async (client, specificationId, cycleId, stepNo, actor, comment) => {
  const result = await client.query(
    `UPDATE specification_approval_steps
     SET approvalstatus = $4,
         actionbyuserid = $5,
         actionby = $6,
         actionat = CURRENT_TIMESTAMP,
         comments = $7
     WHERE approvalcycleid = $1
       AND specificationid = $2
       AND stepno > $3
       AND approvalstatus = $8
     RETURNING id, stepno, approverrole, approvalstatus, assignedapproveruserid`,
    [
      cycleId,
      specificationId,
      stepNo,
      APPROVAL_STEP_STATUS.CANCELLED,
      actor.userId,
      actor.displayName,
      comment,
      APPROVAL_STEP_STATUS.PENDING,
    ]
  );

  for (const step of result.rows) {
    await insertEvent(client, {
      specificationId,
      cycleId,
      step: { ...step, approvalstatus: APPROVAL_STEP_STATUS.PENDING },
      actor,
      eventType: APPROVAL_STEP_STATUS.CANCELLED,
      comments: comment,
    });
  }
};

const decide = async ({ specificationId, actor, decision, comment }) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const { specification, cycle, step } = await loadDecisionContext(client, specificationId);
    assertAssignedApprover(actor, specification, step);

    const decisionStatus = {
      approve: APPROVAL_STEP_STATUS.APPROVED,
      return: APPROVAL_STEP_STATUS.RETURNED,
      reject: APPROVAL_STEP_STATUS.REJECTED,
    }[decision];
    if (!decisionStatus) throw createHttpError("Keputusan approval tidak valid.", 422);

    const updatedStep = await updateDecisionStep(client, step, actor, decisionStatus, comment);
    await insertEvent(client, {
      specificationId,
      cycleId: cycle.id,
      step,
      actor,
      eventType: decisionStatus,
      comments: comment,
    });

    if (decision === "approve") {
      const nextStep = await client.query(
        `SELECT id
         FROM specification_approval_steps
         WHERE approvalcycleid = $1 AND approvalstatus = $2
         ORDER BY stepno
         LIMIT 1`,
        [cycle.id, APPROVAL_STEP_STATUS.PENDING]
      );

      if (!nextStep.rows[0]) {
        await client.query(
          `UPDATE specification_approval_cycles
           SET status = $2, completedat = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
           WHERE id = $1 AND status = $3`,
          [cycle.id, APPROVAL_CYCLE_STATUS.COMPLETED, APPROVAL_CYCLE_STATUS.ACTIVE]
        );
        await client.query(
          `UPDATE specifications
           SET status = $2, updatedbyuserid = $3, updatedby = $4, updateddate = CURRENT_TIMESTAMP
           WHERE id = $1 AND status = $5`,
          [specificationId, SPECIFICATION_STATUS.APPROVED, actor.userId, actor.displayName, SPECIFICATION_STATUS.IN_APPROVAL]
        );
        await client.query(
          `INSERT INTO specification_status_history (
             specificationid, previousstatus, newstatus, changedby, changedbyuserid, changereason
           ) VALUES ($1, $2, $3, $4, $5, $6)`,
          [specificationId, SPECIFICATION_STATUS.IN_APPROVAL, SPECIFICATION_STATUS.APPROVED, actor.displayName, actor.userId, comment || null]
        );
      }
    } else {
      await cancelFutureSteps(client, specificationId, cycle.id, step.stepno, actor, comment);
      const cycleStatus = decision === "return"
        ? APPROVAL_CYCLE_STATUS.RETURNED
        : APPROVAL_CYCLE_STATUS.REJECTED;
      const specificationStatus = decision === "return"
        ? SPECIFICATION_STATUS.REVISION_REQUIRED
        : SPECIFICATION_STATUS.REJECTED;

      await client.query(
        `UPDATE specification_approval_cycles
         SET status = $2, completedat = CURRENT_TIMESTAMP, closedreason = $3, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND status = $4`,
        [cycle.id, cycleStatus, comment, APPROVAL_CYCLE_STATUS.ACTIVE]
      );
      await client.query(
        `UPDATE specifications
         SET status = $2, updatedbyuserid = $3, updatedby = $4, updateddate = CURRENT_TIMESTAMP
         WHERE id = $1 AND status = $5`,
        [specificationId, specificationStatus, actor.userId, actor.displayName, SPECIFICATION_STATUS.IN_APPROVAL]
      );
      await client.query(
        `INSERT INTO specification_status_history (
           specificationid, previousstatus, newstatus, changedby, changedbyuserid, changereason
         ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [specificationId, SPECIFICATION_STATUS.IN_APPROVAL, specificationStatus, actor.displayName, actor.userId, comment]
      );
    }

    await client.query("COMMIT");
    return { specificationId, decision: decisionStatus, step: updatedStep };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const findInbox = async (actor) => {
  const result = await pool.query(
    `SELECT
       s.id AS specification_id,
       s.documentno AS document_no,
       st.typename AS specification_type,
       s.materialdescription,
       mg.sapgroupcode AS material_group,
       p.plantname AS plant,
       d.departmentname AS department,
       s.plantid,
       s.departmentid,
       step.stepno,
       cycle.cycleno,
       cycle.submittedat,
       step.approverrole,
       step.approvername,
       (SELECT count(*) FROM specification_approval_steps total WHERE total.approvalcycleid = cycle.id) AS total_steps
     FROM specification_approval_steps step
     INNER JOIN specification_approval_cycles cycle ON cycle.id = step.approvalcycleid
     INNER JOIN specifications s ON s.id = step.specificationid
     INNER JOIN specification_types st ON st.id = s.specificationtypeid
     LEFT JOIN material_groups mg ON mg.id = s.materialgroupid
     LEFT JOIN plants p ON p.id = s.plantid
     LEFT JOIN departments d ON d.id = s.departmentid
     WHERE step.assignedapproveruserid = $1
       AND step.approvalstatus = $2
       AND cycle.status = $3
       AND s.status = $4
       AND NOT EXISTS (
         SELECT 1 FROM specification_approval_steps previous
         WHERE previous.approvalcycleid = step.approvalcycleid
           AND previous.stepno < step.stepno
           AND previous.approvalstatus <> $5
       )
     ORDER BY cycle.submittedat ASC, s.id ASC`,
    [
      actor.userId,
      APPROVAL_STEP_STATUS.PENDING,
      APPROVAL_CYCLE_STATUS.ACTIVE,
      SPECIFICATION_STATUS.IN_APPROVAL,
      APPROVAL_STEP_STATUS.APPROVED,
    ]
  );

  return result.rows
    .filter((row) => (
      actor.roles.includes(row.approverrole) &&
      hasPlantAccess(actor, row.plantid) &&
      hasDepartmentAccess(actor, row.departmentid)
    ))
    .map(({ plantid, departmentid, ...row }) => row);
};

const findWorkflow = async (specificationId, actor) => {
  const accessResult = await pool.query(
    `SELECT s.id, s.status, s.createdbyuserid
     FROM specifications s
     WHERE s.id = $1
       AND (
         s.createdbyuserid = $2
         OR EXISTS (
           SELECT 1 FROM specification_approval_steps step
           WHERE step.specificationid = s.id
             AND (step.assignedapproveruserid = $2 OR step.actionbyuserid = $2)
         )
       )`,
    [specificationId, actor.userId]
  );
  const specification = accessResult.rows[0];

  if (!specification) throw createHttpError("Spesifikasi tidak ditemukan atau tidak dapat diakses.", 403);

  const [cycles, steps, events, history] = await Promise.all([
    pool.query(
      `SELECT id, cycleno, status, approvalpatternname, submittedbydisplayname, submittedat, completedat, closedreason
       FROM specification_approval_cycles WHERE specificationid = $1 ORDER BY cycleno`,
      [specificationId]
    ),
    pool.query(
      `SELECT approvalcycleid, id, stepno, approverrole, approvername, approvalstatus,
              assignedapproveruserid, actionby, actionbyuserid, actionat, comments
       FROM specification_approval_steps WHERE specificationid = $1 ORDER BY approvalcycleid, stepno`,
      [specificationId]
    ),
    pool.query(
      `SELECT approvalcycleid, approvalstepid, assignedapproveruserid, actoruserid,
              actordisplayname, actorrole, eventtype, previousstepstatus,
              newstepstatus, comments, occurredat
       FROM specification_approval_step_events WHERE specificationid = $1 ORDER BY occurredat, id`,
      [specificationId]
    ),
    pool.query(
      `SELECT previousstatus, newstatus, changedby, changedbyuserid, changereason, changedat
       FROM specification_status_history WHERE specificationid = $1 ORDER BY changedat, id`,
      [specificationId]
    ),
  ]);

  return {
    specificationId,
    status: specification.status,
    cycles: cycles.rows.map((cycle) => ({
      ...cycle,
      steps: steps.rows.filter((step) => String(step.approvalcycleid) === String(cycle.id)),
      events: events.rows.filter((event) => String(event.approvalcycleid) === String(cycle.id)),
    })),
    statusHistory: history.rows,
  };
};

module.exports = {
  decide,
  findInbox,
  findWorkflow,
};
