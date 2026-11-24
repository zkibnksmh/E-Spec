const pool = require("../config/database");
const {
  createValidationError,
  validateBarang,
  validateJasa,
} = require("../utils/specification-draft.validation");
const { SPECIFICATION_STATUS } = require("../workflow/constants/statuses");

const isPositiveInteger = (value) => /^[1-9]\d*$/.test(String(value));

const normalizeMaterialCategoryId = (formData, attributeValues = {}) => {
  const attributeValue = attributeValues.MATERIAL_CATEGORY;
  const rawValue = isPositiveInteger(attributeValue)
    ? attributeValue
    : formData.materialCategory ?? formData.category;
  const values = Array.isArray(rawValue) ? rawValue : [rawValue];
  const selected = values.filter((value) => value !== undefined && value !== null && value !== "");

  if (!selected.length) {
    throw createValidationError("Material Category wajib diisi.");
  }

  if (selected.length !== 1) {
    throw createValidationError("Pilih tepat satu Material Category.");
  }

  if (!isPositiveInteger(selected[0])) {
    throw createValidationError("Material Category harus berupa ID angka positif.");
  }

  return String(selected[0]);
};

const resolveMasterData = async (client, specificationTypeId, formData, attributeValues) => {
  const materialGroupCondition = isPositiveInteger(formData.materialGroup)
    ? "id = $1"
    : "sapgroupcode = $1";
  const materialCategoryId = normalizeMaterialCategoryId(formData, attributeValues);
  const typeResult = await client.query(
    `SELECT id, typecode FROM specification_types WHERE id = $1 AND isactive = TRUE`,
    [specificationTypeId]
  );
  const plantResult = await client.query(
    `SELECT id FROM plants WHERE id = $1`,
    [formData.plant]
  );
  const departmentResult = formData.department
    ? await client.query(
      `SELECT id FROM departments WHERE id = $1 AND isactive = TRUE`,
      [formData.department]
    )
    : { rows: [] };
  const categoryResult = await client.query(
    `SELECT id, categoryname, specificationtypeid
     FROM material_categories WHERE id = $1 AND isactive = TRUE`,
    [materialCategoryId]
  );
  const groupResult = formData.materialGroup
    ? await client.query(
      `SELECT id, sapgroupcode, materialcategoryid
       FROM material_groups WHERE ${materialGroupCondition} AND isactive = TRUE`,
      [formData.materialGroup]
    )
    : { rows: [] };

  if (!typeResult.rows[0]) {
    throw createValidationError("Tipe spesifikasi tidak aktif atau tidak ditemukan.");
  }

  if (!plantResult.rows[0]) {
    throw createValidationError("Plant tidak ditemukan.");
  }

  const type = typeResult.rows[0];
  const department = departmentResult.rows[0] || null;
  const category = categoryResult.rows[0] || null;
  const group = groupResult.rows[0] || null;

  for (const [field, value] of [["department", department], ["materialCategory", category], ["materialGroup", group]]) {
    if (formData[field] !== undefined && formData[field] !== null && formData[field] !== "" && !value) {
      throw createValidationError(`${field} tidak aktif atau tidak ditemukan.`);
    }
  }

  if (category && Number(category.specificationtypeid) !== Number(specificationTypeId)) {
    throw createValidationError("Material Category tidak sesuai dengan tipe spesifikasi.");
  }

  if (category && group && Number(group.materialcategoryid) !== Number(category.id)) {
    throw createValidationError("Material Group tidak sesuai dengan Material Category.");
  }

  return {
    plantId: plantResult.rows[0].id,
    department: department?.id || null,
    materialCategory: category?.id || null,
    materialGroup: group?.id || null,
    typeCode: type.typecode,
    categoryName: category?.categoryname || null,
    groupCode: group?.sapgroupcode || null,
  };
};

const validateReasonToProcure = async (client, specificationTypeId, formData) => {
  const reasonId = formData.reasonChoice || formData.reasonToProcure || formData.reason;

  if (!reasonId) return;

  const result = await client.query(
    `SELECT id FROM reason_to_procure_options
     WHERE id = $1 AND specificationtypeid = $2 AND isactive = TRUE`,
    [reasonId, specificationTypeId]
  );

  if (!result.rows[0]) {
    throw createValidationError("Reason to Procure tidak aktif, tidak ditemukan, atau tidak sesuai tipe spesifikasi.");
  }
};

const resolveAttributes = async (client, specificationTypeId, attributeValues) => {
  const entries = Object.entries(attributeValues);

  if (!entries.length) return [];

  const codes = entries.map(([code]) => code);
  const result = await client.query(
    `
      SELECT sa.id, sa.attributecode, sa.inputtype, sa.supportsmultiplevalues
      FROM specification_attributes sa
      INNER JOIN specification_sections ss ON ss.id = sa.sectionid
      WHERE ss.specificationtypeid = $1
        AND ss.isactive = TRUE
        AND sa.isactive = TRUE
        AND sa.attributecode = ANY($2::text[])
    `,
    [specificationTypeId, codes]
  );
  const attributes = new Map(
    result.rows.map((attribute) => [attribute.attributecode, attribute])
  );

  const unresolved = codes.filter((code) => !attributes.has(code));

  if (unresolved.length) {
    throw createValidationError(
      `Atribut tidak didukung untuk tipe spesifikasi ini: ${unresolved.join(", ")}.`
    );
  }

  return entries.flatMap(([code, value]) => {
    const attribute = attributes.get(code);

    if (attribute.inputtype === "json") {
      return [{
        attributeId: attribute.id,
        value,
        sortOrder: 0,
      }];
    }

    const values = Array.isArray(value) ? value : [value];

    if (!attribute.supportsmultiplevalues && values.length > 1) {
      throw createValidationError(`Atribut ${code} hanya menerima satu nilai.`);
    }

    return values.map((item, index) => ({
      attributeId: attribute.id,
      value: item,
      sortOrder: index,
    }));
  });
};

const validateBusinessRules = async (client, payload, masterData) => {
  await validateReasonToProcure(
    client,
    payload.specificationTypeId,
    payload.formData
  );

  if (String(masterData.typeCode).toUpperCase() === "JASA") {
    validateJasa(payload.formData, masterData);
    return;
  }

  validateBarang({
    ...payload.formData,
    materialGroup: masterData.groupCode || payload.formData.materialGroup,
  });
};

const insertValues = async (client, specificationId, values) => {
  for (const entry of values) {
    const value = entry.value;
    const isJson = value && typeof value === "object";
    const valueText = isJson || typeof value === "boolean" || typeof value === "number"
      ? null
      : String(value ?? "");
    const valueNumber = typeof value === "number" ? value : null;
    const valueBoolean = typeof value === "boolean" ? value : null;
    const valueJson = isJson ? value : null;

    await client.query(
      `
        INSERT INTO specification_values (
          specificationid,
          attributeid,
          valuetext,
          valuenumber,
          valueboolean,
          valuejson,
          sortorder
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
      [
        specificationId,
        entry.attributeId,
        valueText,
        valueNumber,
        valueBoolean,
        valueJson,
        entry.sortOrder,
      ]
    );
  }
};

const findEditableById = async (id) => {
  const result = await pool.query(
    `SELECT id, specificationtypeid, status, createdbyuserid
     FROM specifications WHERE id = $1`,
    [id]
  );

  return result.rows[0] || null;
};

const createDraft = async (payload) => {
  if (!payload.creatorUserId) {
    const error = new Error("Autentikasi diperlukan.");
    error.statusCode = 401;
    throw error;
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const masterData = await resolveMasterData(
      client,
      payload.specificationTypeId,
      payload.formData,
      payload.attributeValues
    );
    await validateBusinessRules(client, payload, masterData);
    const values = await resolveAttributes(
      client,
      payload.specificationTypeId,
      payload.attributeValues
    );
    const insertResult = await client.query(
      `
        INSERT INTO specifications (
          documentno, specificationtypeid, plantid, departmentid,
          materialcategoryid, materialgroupid, requestor,
          materialdescription, materialcode, reasonprocure, formdata,
          createdbyuserid, createdby
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING id, specificationtypeid AS specification_type_id, status
      `,
      [
        payload.documentNo,
        payload.specificationTypeId,
        masterData.plantId,
        masterData.department,
        masterData.materialCategory,
        masterData.materialGroup,
        String(payload.formData.requestor).trim(),
        String(payload.formData.materialDescription ?? "").trim(),
        payload.formData.materialCode || null,
        payload.formData.reasonToProcure || payload.formData.reason || null,
        payload.formData,
        payload.creatorUserId,
        payload.creatorDisplayName,
      ]
    );
    const specification = insertResult.rows[0];

    await insertValues(client, specification.id, values);
    await client.query("COMMIT");

    return specification;
  } catch (error) {
    await client.query("ROLLBACK");

    if (error.code === "23505") {
      throw createValidationError("Nomor dokumen sudah digunakan.");
    }

    throw error;
  } finally {
    client.release();
  }
};

const updateDraft = async (id, payload, actor) => {
  if (!actor || typeof actor.userId !== "string" || !actor.userId.trim()) {
    const error = new Error("Autentikasi diperlukan.");
    error.statusCode = 401;
    throw error;
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const locked = await client.query(
      `SELECT specificationtypeid, status, createdbyuserid
       FROM specifications WHERE id = $1 FOR UPDATE`,
      [id]
    );
    const current = locked.rows[0];

    if (!current) {
      const error = new Error("Spesifikasi tidak ditemukan.");
      error.statusCode = 404;
      throw error;
    }

    if (!["Draft", "Revision Required"].includes(current.status)) {
      const error = new Error("Spesifikasi tidak lagi dapat diubah.");
      error.statusCode = 409;
      throw error;
    }

    if (
      !current.createdbyuserid ||
      String(current.createdbyuserid) !== String(actor.userId).trim()
    ) {
      const error = new Error("Anda bukan pemilik Draft ini.");
      error.statusCode = 403;
      throw error;
    }

    const masterData = await resolveMasterData(
      client,
      current.specificationtypeid,
      payload.formData,
      payload.attributeValues
    );
    await validateBusinessRules(client, payload, masterData);
    const values = await resolveAttributes(
      client,
      current.specificationtypeid,
      payload.attributeValues
    );

    const updateResult = await client.query(
      `
        UPDATE specifications
        SET plantid = $2,
            departmentid = $3,
            materialcategoryid = $4,
            materialgroupid = $5,
            requestor = $6,
            materialdescription = $7,
            materialcode = $8,
            reasonprocure = $9,
            formdata = $10,
            updatedbyuserid = $11,
            updatedby = $12,
            updateddate = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING id, specificationtypeid AS specification_type_id, status
      `,
      [
        id,
        masterData.plantId,
        masterData.department,
        masterData.materialCategory,
        masterData.materialGroup,
        String(payload.formData.requestor).trim(),
        String(payload.formData.materialDescription ?? "").trim(),
        payload.formData.materialCode || null,
        payload.formData.reasonToProcure || payload.formData.reason || null,
        payload.formData,
        String(actor.userId).trim(),
        String(actor.displayName ?? actor.userId).trim(),
      ]
    );

    await client.query(`DELETE FROM specification_values WHERE specificationid = $1`, [id]);
    await insertValues(client, id, values);
    await client.query("COMMIT");

    return updateResult.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");

    if (error.code === "23505") {
      throw createValidationError("Nomor dokumen sudah digunakan.");
    }

    throw error;
  } finally {
    client.release();
  }
};

const findAll = async ({ specificationTypeId, status }) => {
  const conditions = [];
  const values = [];

  if (specificationTypeId !== undefined) {
    values.push(specificationTypeId);
    conditions.push(`s.specificationtypeid = $${values.length}`);
  }

  if (status !== undefined) {
    values.push(status);
    conditions.push(`s.status = $${values.length}`);
  }

  const whereClause = conditions.length
    ? `WHERE ${conditions.join(" AND ")}`
    : "";

  const result = await pool.query(
    `
      SELECT
        s.id,
        s.documentno AS document_no,
        s.revisionno AS revision_no,
        s.specificationtypeid AS specification_type_id,
        st.typecode AS specification_type_code,
        st.typename AS specification_type_name,
        s.requestor,
        s.materialdescription AS material_description,
        s.materialcode AS material_code,
        s.reasonprocure AS reason_to_procure,
        s.status,
        s.submittedat AS submitted_at,
        s.createddate AS created_at,
        s.updateddate AS updated_at,
        latest_status.changed_at AS status_changed_at
      FROM specifications s
      INNER JOIN specification_types st
        ON st.id = s.specificationtypeid
      LEFT JOIN LATERAL (
        SELECT ssh.changedat AS changed_at
        FROM specification_status_history ssh
        WHERE ssh.specificationid = s.id
        ORDER BY ssh.changedat DESC, ssh.id DESC
        LIMIT 1
      ) latest_status ON TRUE
      ${whereClause}
      ORDER BY s.createddate DESC NULLS LAST, s.id DESC
    `,
    values
  );

  return result.rows;
};

const findAllScopedDocuments = async ({ actorUserId }) => {
  const result = await pool.query(
    `
      SELECT
        s.id,
        s.documentno AS document_no,
        s.revisionno AS revision_no,
        s.specificationtypeid AS specification_type_id,
        st.typecode AS specification_type_code,
        st.typename AS specification_type_name,
        s.requestor,
        d.departmentname AS department,
        s.materialdescription AS material_description,
        s.materialcode AS material_code,
        s.status,
        s.submittedat AS submitted_at,
        s.createddate AS created_at,
        s.updateddate AS updated_at
      FROM specifications s
      INNER JOIN specification_types st
        ON st.id = s.specificationtypeid
      LEFT JOIN departments d
        ON d.id = s.departmentid
      WHERE s.createdbyuserid = $1
         OR EXISTS (
           SELECT 1
           FROM specification_approval_steps step
           WHERE step.specificationid = s.id
             AND (step.assignedapproveruserid = $1 OR step.actionbyuserid = $1)
         )
      ORDER BY s.updateddate DESC NULLS LAST, s.id DESC
    `,
    [actorUserId]
  );

  return result.rows;
};

const findAllMyDrafts = async ({ creatorUserId, specificationTypeId, status }) => {
  const conditions = [
    "s.createdbyuserid = $1",
    `s.status IN ($2, $3)`,
  ];
  const values = [
    creatorUserId,
    SPECIFICATION_STATUS.DRAFT,
    SPECIFICATION_STATUS.REVISION_REQUIRED,
  ];

  if (specificationTypeId !== undefined) {
    values.push(specificationTypeId);
    conditions.push(`s.specificationtypeid = $${values.length}`);
  }

  if (status !== undefined) {
    values.push(status);
    conditions.push(`s.status = $${values.length}`);
  }

  const result = await pool.query(
    `
      SELECT
        s.id,
        s.documentno AS document_no,
        s.revisionno AS revision_no,
        s.specificationtypeid AS specification_type_id,
        st.typecode AS specification_type_code,
        st.typename AS specification_type_name,
        s.status,
        s.createddate AS created_at,
        s.updateddate AS updated_at
      FROM specifications s
      INNER JOIN specification_types st
        ON st.id = s.specificationtypeid
      WHERE ${conditions.join(" AND ")}
      ORDER BY s.updateddate DESC NULLS LAST, s.id DESC
    `,
    values
  );

  return result.rows;
};

const loadSpecificationById = async (id, options = {}) => {
  const settings =
    options && typeof options === "object"
      ? options
      : { creatorUserId: options };

  const conditions = ["s.id = $1"];
  const values = [id];

  if (settings.creatorUserId) {
    values.push(settings.creatorUserId);
    conditions.push(`s.createdbyuserid = $${values.length}`);
  }

  if (settings.approverUserId) {
    values.push(settings.approverUserId);
    conditions.push(
      `EXISTS (
         SELECT 1
         FROM specification_approval_steps step
         WHERE step.specificationid = s.id
           AND (step.assignedapproveruserid = $${values.length} OR step.actionbyuserid = $${values.length})
       )`
    );
  }

  if (settings.editableOnly) {
    values.push(SPECIFICATION_STATUS.DRAFT, SPECIFICATION_STATUS.REVISION_REQUIRED);
    conditions.push(`s.status IN ($${values.length - 1}, $${values.length})`);
  }

  const result = await pool.query(
    `
      SELECT
        s.id,
        s.documentno AS document_no,
        s.revisionno AS revision_no,
        s.specificationtypeid AS specification_type_id,
        st.typecode AS specification_type_code,
        st.typename AS specification_type_name,
        d.departmentname AS department,
        s.plantid AS plant_id,
        s.departmentid AS department_id,
        s.subdepartmentid AS sub_department_id,
        s.materialcategoryid AS material_category_id,
        s.materialgroupid AS material_group_id,
        s.requestor,
        s.materialdescription AS material_description,
        s.materialcode AS material_code,
        s.purchasegroupid AS purchase_group_id,
        s.reasonprocure AS reason_to_procure,
        s.status,
        s.formdata AS form_data,
        s.submittedat AS submitted_at,
        s.createdby AS created_by,
        s.createddate AS created_at,
        s.updatedby AS updated_by,
        s.updateddate AS updated_at,
        COALESCE(values_by_section.sections, '[]'::jsonb) AS sections,
        COALESCE(status_history.items, '[]'::jsonb) AS status_history
      FROM specifications s
      INNER JOIN specification_types st
        ON st.id = s.specificationtypeid
      LEFT JOIN departments d
        ON d.id = s.departmentid
      LEFT JOIN LATERAL (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', section_data.id,
            'code', section_data.code,
            'name', section_data.name,
            'sortOrder', section_data.sort_order,
            'attributes', section_data.attributes
          )
          ORDER BY section_data.sort_order, section_data.id
        ) AS sections
        FROM (
          SELECT
            ss.id,
            ss.sectioncode AS code,
            ss.sectionname AS name,
            ss.sortorder AS sort_order,
            jsonb_agg(
              jsonb_build_object(
                'id', attribute_data.id,
                'code', attribute_data.code,
                'name', attribute_data.name,
                'inputType', attribute_data.input_type,
                'sortOrder', attribute_data.sort_order,
                'values', attribute_data.values
              )
              ORDER BY attribute_data.sort_order, attribute_data.id
            ) AS attributes
          FROM specification_values sv
          INNER JOIN specification_attributes sa
            ON sa.id = sv.attributeid
          INNER JOIN specification_sections ss
            ON ss.id = sa.sectionid
          CROSS JOIN LATERAL (
            SELECT
              sa.id,
              sa.attributecode AS code,
              sa.attributename AS name,
              sa.inputtype AS input_type,
              sa.sortorder AS sort_order,
              jsonb_agg(
                jsonb_build_object(
                  'id', sv2.id,
                  'optionId', sv2.optionid,
                  'text', sv2.valuetext,
                  'number', sv2.valuenumber,
                  'boolean', sv2.valueboolean,
                  'json', sv2.valuejson,
                  'sortOrder', sv2.sortorder
                )
                ORDER BY sv2.sortorder, sv2.id
              ) AS values
            FROM specification_values sv2
            WHERE sv2.specificationid = s.id
              AND sv2.attributeid = sa.id
            GROUP BY sa.id, sa.attributecode, sa.attributename, sa.inputtype, sa.sortorder
          ) attribute_data
          WHERE sv.specificationid = s.id
          GROUP BY ss.id, ss.sectioncode, ss.sectionname, ss.sortorder
        ) section_data
      ) values_by_section ON TRUE
      LEFT JOIN LATERAL (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', ssh.id,
            'previousStatus', ssh.previousstatus,
            'newStatus', ssh.newstatus,
            'changedBy', ssh.changedby,
            'reason', ssh.changereason,
            'changedAt', ssh.changedat
          )
          ORDER BY ssh.changedat DESC, ssh.id DESC
        ) AS items
        FROM specification_status_history ssh
        WHERE ssh.specificationid = s.id
      ) status_history ON TRUE
      WHERE ${[
        conditions[0],
        conditions.length > 1 ? `(${conditions.slice(1).join(" OR ")})` : null,
      ]
        .filter(Boolean)
        .join(" AND ")}
    `,
    values
  );

  return result.rows[0] || null;
};

const findById = (id) => loadSpecificationById(id);

const findMyDraftById = (id, creatorUserId) =>
  loadSpecificationById(id, { creatorUserId, editableOnly: true });

const findScopedDocumentById = (id, actorUserId) =>
  loadSpecificationById(id, {
    creatorUserId: actorUserId,
    approverUserId: actorUserId,
  });

module.exports = {
  findAll,
  findAllScopedDocuments,
  findAllMyDrafts,
  findById,
  findMyDraftById,
  findScopedDocumentById,
  findEditableById,
  createDraft,
  updateDraft,
};
