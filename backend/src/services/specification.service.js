const specificationRepository = require("../repositories/specification.repository");
const { SPECIFICATION_STATUS } = require("../workflow/constants/statuses");

const EDITABLE_DRAFT_STATUSES = [
  SPECIFICATION_STATUS.DRAFT,
  SPECIFICATION_STATUS.REVISION_REQUIRED,
];

const getAllSpecifications = async ({ specificationTypeId, status }) => {
  const filters = {};

  if (specificationTypeId !== undefined) {
    if (!/^[1-9]\d*$/.test(specificationTypeId)) {
      const error = new Error("specificationTypeId harus berupa angka positif.");
      error.statusCode = 400;
      throw error;
    }

    filters.specificationTypeId = Number(specificationTypeId);
  }

  if (status !== undefined) {
    const normalizedStatus = String(status).trim();

    if (!normalizedStatus) {
      const error = new Error("status tidak boleh kosong.");
      error.statusCode = 400;
      throw error;
    }

    filters.status = normalizedStatus;
  }

  return specificationRepository.findAll(filters);
};

const getSpecificationById = async (id) => {
  const specification = await specificationRepository.findById(id);

  if (!specification) {
    const error = new Error("Spesifikasi tidak ditemukan.");
    error.statusCode = 404;
    throw error;
  }

  return specification;
};

const parseFormData = (value) => {
  if (!value) return {};
  if (typeof value === "object") return value;

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

const attributeValueFromRow = (value) => {
  if (!value || typeof value !== "object") return undefined;

  if (value.json !== null && value.json !== undefined) return value.json;
  if (value.optionId !== null && value.optionId !== undefined) return value.optionId;
  if (value.text !== null && value.text !== undefined) return value.text;
  if (value.number !== null && value.number !== undefined) return value.number;
  if (value.boolean !== null && value.boolean !== undefined) return value.boolean;

  return undefined;
};

const attributeValuesFromSections = (sections) => {
  const values = {};

  if (!Array.isArray(sections)) return values;

  sections.forEach((section) => {
    if (!Array.isArray(section?.attributes)) return;

    section.attributes.forEach((attribute) => {
      if (!attribute?.code || !Array.isArray(attribute.values)) return;

      const normalized = attribute.values
        .map(attributeValueFromRow)
        .filter((value) => value !== undefined);

      if (normalized.length === 1) values[attribute.code] = normalized[0];
      else if (normalized.length > 1) values[attribute.code] = normalized;
    });
  });

  return values;
};

const createHttpError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const normalizeActor = (actor) => {
  if (
    !actor ||
    typeof actor !== "object" ||
    typeof actor.userId !== "string" ||
    !actor.userId.trim()
  ) {
    throw createHttpError("Autentikasi diperlukan.", 401);
  }

  return {
    userId: actor.userId.trim(),
    displayName: String(actor.displayName ?? actor.userId).trim() || actor.userId.trim(),
  };
};

const getMyDraftSpecifications = async ({ specificationTypeId, status }, actor) => {
  const normalizedActor = normalizeActor(actor);
  const filters = { creatorUserId: normalizedActor.userId };

  if (specificationTypeId !== undefined) {
    if (!/^[1-9]\d*$/.test(String(specificationTypeId))) {
      throw createHttpError("specificationTypeId harus berupa angka positif.", 400);
    }

    filters.specificationTypeId = Number(specificationTypeId);
  }

  if (status !== undefined) {
    const normalizedStatus = String(status).trim();

    if (!EDITABLE_DRAFT_STATUSES.includes(normalizedStatus)) {
      throw createHttpError("status Draft tidak dikenali.", 400);
    }

    filters.status = normalizedStatus;
  }

  const specifications = await specificationRepository.findAllMyDrafts(filters);

  return specifications.map((row) => ({
    id: row.id,
    documentNo: row.document_no,
    revisionNo: row.revision_no,
    specificationTypeId: row.specification_type_id,
    specificationTypeCode: row.specification_type_code,
    specificationTypeName: row.specification_type_name,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
};

const getMyDraftSpecificationById = async (id, actor) => {
  const normalizedActor = normalizeActor(actor);
  const row = await specificationRepository.findMyDraftById(id, normalizedActor.userId);

  if (!row) {
    throw createHttpError("Draft tidak ditemukan.", 404);
  }

  const formData = parseFormData(row.form_data);

  return {
    id: row.id,
    documentNo: row.document_no,
    revisionNo: row.revision_no,
    specificationTypeId: row.specification_type_id,
    specificationTypeCode: row.specification_type_code,
    specificationTypeName: row.specification_type_name,
    status: row.status,
    formData,
    form_data: formData,
    attributeValues: attributeValuesFromSections(row.sections),
    sections: row.sections || [],
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

const getScopedSpecifications = async (actor) => {
  const normalizedActor = normalizeActor(actor);
  const specifications = await specificationRepository.findAllScopedDocuments({
    actorUserId: normalizedActor.userId,
  });

  return specifications.map((row) => ({
    id: row.id,
    documentNo: row.document_no,
    revisionNo: row.revision_no,
    specificationTypeId: row.specification_type_id,
    specificationTypeCode: row.specification_type_code,
    specificationTypeName: row.specification_type_name,
    requestor: row.requestor,
    department: row.department,
    materialDescription: row.material_description,
    materialCode: row.material_code,
    status: row.status,
    submittedAt: row.submitted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
};

const getScopedSpecificationById = async (id, actor) => {
  const normalizedActor = normalizeActor(actor);
  const row = await specificationRepository.findScopedDocumentById(
    id,
    normalizedActor.userId
  );

  if (!row) {
    throw createHttpError("Spesifikasi tidak ditemukan atau tidak dapat diakses.", 403);
  }

  const formData = parseFormData(row.form_data);

  return {
    id: row.id,
    documentNo: row.document_no,
    revisionNo: row.revision_no,
    specificationTypeId: row.specification_type_id,
    specificationTypeCode: row.specification_type_code,
    specificationTypeName: row.specification_type_name,
    requestor: row.requestor,
    department: row.department,
    materialDescription: row.material_description,
    materialCode: row.material_code,
    status: row.status,
    formData,
    form_data: formData,
    attributeValues: attributeValuesFromSections(row.sections),
    sections: row.sections || [],
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    submittedAt: row.submitted_at,
    statusHistory: row.status_history || [],
  };
};

const normalizePayload = (payload, existingTypeId) => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw createHttpError("Payload JSON tidak valid.", 400);
  }

  const { specificationTypeId, formData, documentNo, attributeValues } = payload;

  if (payload.status !== undefined || payload.revisionNo !== undefined) {
    throw createHttpError(
      "status dan revisionNo ditentukan oleh server.",
      422
    );
  }

  if (!formData || typeof formData !== "object" || Array.isArray(formData)) {
    throw createHttpError("formData wajib berupa object.", 400);
  }

  if (
    specificationTypeId !== undefined &&
    !/^[1-9]\d*$/.test(String(specificationTypeId))
  ) {
    throw createHttpError("specificationTypeId harus berupa angka positif.", 400);
  }

  const normalizedTypeId = specificationTypeId === undefined
    ? undefined
    : Number(specificationTypeId);

  if (
    existingTypeId !== undefined &&
    normalizedTypeId !== undefined &&
    normalizedTypeId !== existingTypeId
  ) {
    throw createHttpError("Tipe spesifikasi tidak dapat diubah.", 422);
  }

  const attributes = attributeValues === undefined ? {} : attributeValues;

  if (!attributes || typeof attributes !== "object" || Array.isArray(attributes)) {
    throw createHttpError("attributeValues wajib berupa object.", 422);
  }

  const requiredFields = ["plant", "requestor"];

  requiredFields.forEach((field) => {
    if (!String(formData[field] ?? "").trim()) {
      throw createHttpError(`formData.${field} wajib diisi.`, 422);
    }
  });

  const normalizedDocumentNo = String(
    documentNo ?? formData.docNo ?? ""
  ).trim();

  if (!normalizedDocumentNo) {
    throw createHttpError("documentNo atau formData.docNo wajib diisi.", 422);
  }

  return {
    specificationTypeId: existingTypeId ?? normalizedTypeId,
    documentNo: normalizedDocumentNo,
    formData,
    attributeValues: attributes,
  };
};

const createSpecificationDraft = async (payload, actor) => {
  const normalizedActor = normalizeActor(actor);
  const normalizedPayload = normalizePayload(payload);

  if (normalizedPayload.specificationTypeId === undefined) {
    throw createHttpError("specificationTypeId wajib diisi.", 422);
  }

  return specificationRepository.createDraft({
    ...normalizedPayload,
    creatorUserId: normalizedActor.userId,
    creatorDisplayName: normalizedActor.displayName,
  });
};

const updateSpecificationDraft = async (id, payload, actor) => {
  const normalizedActor = normalizeActor(actor);
  const existing = await specificationRepository.findEditableById(id);

  if (!existing) {
    throw createHttpError("Spesifikasi tidak ditemukan.", 404);
  }

  if (!["Draft", "Revision Required"].includes(existing.status)) {
    throw createHttpError("Spesifikasi tidak lagi dapat diubah.", 409);
  }

  if (
    !existing.createdbyuserid ||
    String(existing.createdbyuserid) !== normalizedActor.userId
  ) {
    throw createHttpError("Anda bukan pemilik Draft ini.", 403);
  }

  const normalizedPayload = normalizePayload(payload, existing.specificationtypeid);

  return specificationRepository.updateDraft(id, normalizedPayload, normalizedActor);
};

module.exports = {
  getAllSpecifications,
  getSpecificationById,
  getMyDraftSpecifications,
  getMyDraftSpecificationById,
  getScopedSpecifications,
  getScopedSpecificationById,
  createSpecificationDraft,
  updateSpecificationDraft,
};
