const pool = require("../config/database");
const {
  validateBarang,
  validateJasa,
  createValidationError,
} = require("../utils/specification-draft.validation");
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

const loadLockedSpecification = async (client, specificationId) => {
  const result = await client.query(
    `SELECT
       s.id,
       s.specificationtypeid,
       s.plantid,
       s.departmentid,
       s.materialcategoryid,
       s.materialgroupid,
       s.status,
       s.formdata,
       s.createdbyuserid
     FROM specifications s
     WHERE s.id = $1
     FOR UPDATE`,
    [specificationId]
  );

  return result.rows[0] || null;
};

const loadSubmissionMasterData = async (client, specification) => {
  const typeResult = await client.query(
    `SELECT id, typecode
     FROM specification_types
     WHERE id = $1 AND isactive = TRUE`,
    [specification.specificationtypeid]
  );
  const plantResult = await client.query(
    "SELECT id FROM plants WHERE id = $1",
    [specification.plantid]
  );
  const departmentResult = await client.query(
    `SELECT d.id
     FROM departments d
     INNER JOIN idxplantsdepartments pd
       ON pd.departmentid = d.id
     WHERE d.id = $1
       AND pd.plantid = $2
       AND d.isactive = TRUE`,
    [specification.departmentid, specification.plantid]
  );
  const categoryResult = await client.query(
    `SELECT id, categoryname, specificationtypeid
     FROM material_categories
     WHERE id = $1 AND isactive = TRUE`,
    [specification.materialcategoryid]
  );
  const groupResult = await client.query(
    `SELECT id, sapgroupcode, materialcategoryid
     FROM material_groups
     WHERE id = $1 AND isactive = TRUE`,
    [specification.materialgroupid]
  );

  const type = typeResult.rows[0];
  const plant = plantResult.rows[0];
  const department = departmentResult.rows[0];
  const category = categoryResult.rows[0];
  const group = groupResult.rows[0];

  if (!type) throw createValidationError("Tipe spesifikasi tidak aktif atau tidak ditemukan.");
  if (!plant) throw createValidationError("Plant tidak ditemukan.");
  if (!department) throw createValidationError("Department tidak aktif atau tidak sesuai Plant.");
  if (!category) throw createValidationError("Material Category tidak aktif atau tidak ditemukan.");
  if (!group) throw createValidationError("Material Group tidak aktif atau tidak ditemukan.");

  if (Number(category.specificationtypeid) !== Number(type.id)) {
    throw createValidationError("Material Category tidak sesuai dengan tipe spesifikasi.");
  }

  if (Number(group.materialcategoryid) !== Number(category.id)) {
    throw createValidationError("Material Group tidak sesuai dengan Material Category.");
  }

  return {
    typeCode: type.typecode,
    categoryName: category.categoryname,
    groupCode: group.sapgroupcode,
  };
};

const validateSubmissionForm = (specification, masterData) => {
  const formData = specification.formdata;

  if (!formData || typeof formData !== "object" || Array.isArray(formData)) {
    throw createValidationError("Data form spesifikasi tidak valid.");
  }

  if (String(masterData.typeCode).toUpperCase() === "JASA") {
    validateJasa(
      {
        ...formData,
        plant: specification.plantid,
        department: specification.departmentid,
        materialCategory: specification.materialcategoryid,
        materialGroup: specification.materialgroupid,
        reasonChoice: formData.reasonChoice || formData.reasonToProcure || formData.reason,
      },
      masterData
    );
    return;
  }

  validateBarang({
    ...formData,
    materialGroup: masterData.groupCode,
  });
};

const getCycleState = async (client, specificationId) => {
  const activeResult = await client.query(
    `SELECT id
     FROM specification_approval_cycles
     WHERE specificationid = $1 AND status = $2`,
    [specificationId, APPROVAL_CYCLE_STATUS.ACTIVE]
  );
  const latestResult = await client.query(
    `SELECT id, cycleno, status
     FROM specification_approval_cycles
     WHERE specificationid = $1
     ORDER BY cycleno DESC
     LIMIT 1`,
    [specificationId]
  );

  return {
    active: activeResult.rows[0] || null,
    latest: latestResult.rows[0] || null,
  };
};

const insertCycleAndSteps = async ({
  client,
  specification,
  actor,
  route,
  previousStatus,
  comment,
  cycleNo,
}) => {
  const cycleResult = await client.query(
    `INSERT INTO specification_approval_cycles (
       specificationid,
       cycleno,
       approvalpatternid,
       approvalpatternno,
       approvalpatternname,
       status,
       submittedbyuserid,
       submittedbydisplayname
     ) VALUES ($1, $2, NULL, NULL, $3, $4, $5, $6)
     RETURNING id, cycleno, status, submittedat`,
    [
      specification.id,
      cycleNo,
      "Development routing",
      APPROVAL_CYCLE_STATUS.ACTIVE,
      actor.userId,
      actor.displayName,
    ]
  );
  const cycle = cycleResult.rows[0];
  const approvalSteps = [];

  for (const step of route.steps) {
    const result = await client.query(
      `INSERT INTO specification_approval_steps (
         specificationid,
         approvalcycleid,
         stepno,
         approvalmatrixruleid,
         approverrole,
         approvername,
         approvalstatus,
         assignedapproveruserid
       ) VALUES ($1, $2, $3, NULL, $4, $5, $6, $7)
       RETURNING
         approvalmatrixruleid,
         stepno,
         approverrole,
         approvername,
         approvalstatus,
         assignedapproveruserid`,
      [
        specification.id,
        cycle.id,
        step.stepNo,
        step.approverRole,
        step.assignedApproverDisplayName,
        APPROVAL_STEP_STATUS.PENDING,
        step.assignedApproverUserId,
      ]
    );
    approvalSteps.push(result.rows[0]);
  }

  await client.query(
    `UPDATE specifications
     SET status = $2,
         submittedat = CURRENT_TIMESTAMP,
         updatedbyuserid = $3,
         updatedby = $4,
         updateddate = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [
      specification.id,
      SPECIFICATION_STATUS.IN_APPROVAL,
      actor.userId,
      actor.displayName,
    ]
  );
  await client.query(
    `INSERT INTO specification_status_history (
       specificationid,
       previousstatus,
       newstatus,
       changedby,
       changedbyuserid,
       changereason
     ) VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      specification.id,
      previousStatus,
      SPECIFICATION_STATUS.IN_APPROVAL,
      actor.displayName,
      actor.userId,
      comment || null,
    ]
  );

  return { cycle, approvalSteps };
};

const submit = async ({ specificationId, actor, comment, buildRoute, resubmission = false }) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const specification = await loadLockedSpecification(client, specificationId);

    if (!specification) throw createHttpError("Spesifikasi tidak ditemukan.", 404);

    const expectedStatus = resubmission
      ? SPECIFICATION_STATUS.REVISION_REQUIRED
      : SPECIFICATION_STATUS.DRAFT;

    if (specification.status !== expectedStatus) {
      throw createHttpError("Status spesifikasi tidak valid untuk pengajuan.", 409);
    }

    if (
      !specification.createdbyuserid ||
      String(specification.createdbyuserid) !== actor.userId
    ) {
      throw createHttpError("Anda bukan pemilik spesifikasi ini.", 403);
    }

    const cycleState = await getCycleState(client, specification.id);

    if (cycleState.active) {
      throw createHttpError("Spesifikasi masih memiliki approval cycle aktif.", 409);
    }

    if (resubmission && (!cycleState.latest || cycleState.latest.status !== APPROVAL_CYCLE_STATUS.RETURNED)) {
      throw createHttpError("Approval cycle sebelumnya belum berstatus Returned.", 409);
    }

    if (!resubmission && cycleState.latest) {
      throw createHttpError("Spesifikasi sudah pernah diajukan.", 409);
    }

    const masterData = await loadSubmissionMasterData(client, specification);
    validateSubmissionForm(specification, masterData);
    const route = await buildRoute({
      materialGroupCode: masterData.groupCode,
      specification: {
        id: specification.id,
        plantId: specification.plantid,
        departmentId: specification.departmentid,
        materialCategoryId: specification.materialcategoryid,
        materialGroupId: specification.materialgroupid,
        specificationTypeId: specification.specificationtypeid,
      },
      requestorUserId: actor.userId,
    });

    if (!route?.steps?.length) {
      throw createValidationError("Approval route tidak lengkap.");
    }

    const result = await insertCycleAndSteps({
      client,
      specification,
      actor,
      route,
      previousStatus: expectedStatus,
      comment,
      cycleNo: Number(cycleState.latest?.cycleno || 0) + 1,
    });

    await client.query("COMMIT");
    return {
      specificationId: specification.id,
      status: SPECIFICATION_STATUS.IN_APPROVAL,
      cycle: result.cycle,
      approvalSteps: result.approvalSteps,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  submit,
};
