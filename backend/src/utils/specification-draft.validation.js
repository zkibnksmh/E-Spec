const BARANG_REQUIRED_FIELDS = {
  BEARING: ["materialDescription", "partNumber", "variant", "dimension", "brand", "uom"],
  MATERIAL: ["materialDescription", "variant", "dimension", "uom"],
  GASKET: ["materialDescription", "variant", "dimension", "uom", "technical:Material"],
  MS: ["materialDescription", "variant", "dimension", "uom", "technical:Material"],
  ELECTRIC: ["materialDescription", "partNumber", "variant", "brand", "uom", "technical:Voltage", "technical:Phase", "technical:Power", "technical:Current", "technical:Frequency"],
  PIPE: ["materialDescription", "variant", "dimension", "uom", "technical:Material"],
  BNR: ["materialDescription", "variant", "dimension", "uom", "technical:Material"],
  LUBRICANT: ["materialDescription", "partNumber", "uom", "packSize", "technical:Konsentrasi", "technical:Viscositas"],
  CABLE: ["materialDescription", "partNumber", "variant", "dimension", "uom"],
  VALVE: ["materialDescription", "variant", "dimension", "uom", "technical:Material", "technical:Connection Type"],
  EQUIPMENT: ["materialDescription", "partNumber", "variant", "dimension", "uom"],
  PAINT: ["materialDescription", "partNumber", "variant", "brand", "catalogue", "uom", "packSize"],
  IT: ["materialDescription", "partNumber", "variant", "uom"],
  "BARANG UM": ["materialDescription", "partNumber", "variant", "uom"],
  K3: ["materialDescription", "partNumber", "variant", "uom"],
  LAB_MAT: ["materialDescription", "variant", "brand", "catalogue", "uom", "packSize"],
  ATK: ["materialDescription", "variant", "uom"],
  "ASSET UMU": ["materialDescription", "uom"],
  "ASSET TEK": ["materialDescription", "uom"],
  "ASSET LAB": ["materialDescription", "uom"],
};

const createValidationError = (message) => {
  const error = new Error(message);
  error.statusCode = 422;
  return error;
};

const isFilled = (value) => {
  if (Array.isArray(value)) return value.some(isFilled);
  if (value && typeof value === "object") return Object.keys(value).length > 0;
  return String(value ?? "").trim().length > 0;
};

const hasTechnicalValue = (formData, label) => {
  const collections = [
    formData.technicalAttributes,
    formData.electricalAttributes,
    formData.mechanicalAttributes,
  ];

  return collections.some((items) =>
    Array.isArray(items) && items.some((item) =>
      item?.label === label && isFilled(item.value ?? item.data1)
    )
  );
};

const hasDimensionValue = (formData) => {
  if (Array.isArray(formData.dimensionItems)) {
    return formData.dimensionItems.some((item) =>
      isFilled(item?.type) && isFilled(item?.value)
    );
  }

  return isFilled(formData.dimension);
};

const validateBarang = (formData) => {
  if (!isFilled(formData.drawingImage)) {
    throw createValidationError(
      "Design / Drawing / Visual / Illustration wajib diisi."
    );
  }

  if (!isFilled(formData.additionalService)) {
    throw createValidationError("Additional Service wajib diisi.");
  }

  const requiredFields = BARANG_REQUIRED_FIELDS[formData.materialGroup] || [];

  for (const field of requiredFields) {
    const isTechnical = field.startsWith("technical:");
    const value = isTechnical
      ? hasTechnicalValue(formData, field.slice("technical:".length))
      : field === "dimension"
        ? hasDimensionValue(formData)
        : isFilled(formData[field]);

    if (!value) {
      throw createValidationError(
        `${isTechnical ? field.slice("technical:".length) : field} wajib diisi untuk Material Group ${formData.materialGroup}.`
      );
    }
  }
};

const validateJasa = (formData, masterData) => {
  const requiredFields = [
    "plant",
    "requestor",
    "department",
    "materialGroup",
    "materialCategory",
    "reasonChoice",
    "projectName",
    "projectDescription",
    "timeline",
  ];

  for (const field of requiredFields) {
    if (!isFilled(formData[field])) {
      throw createValidationError(`formData.${field} wajib diisi untuk Jasa.`);
    }
  }

  if (masterData.categoryName !== "OPEX - JASA") {
    throw createValidationError("Kategori Jasa tidak didukung.");
  }

  if (!["SERVICE", "SERVICEPM"].includes(masterData.groupCode)) {
    throw createValidationError("Material Group Jasa tidak didukung.");
  }

  for (const attachment of formData.attachmentDocuments || []) {
    const hasCategory = isFilled(attachment?.type);
    const hasFileMetadata = isFilled(attachment?.fileName);

    if (hasCategory !== hasFileMetadata) {
      throw createValidationError(
        "Attachment Document harus memiliki kategori dan metadata file secara bersamaan."
      );
    }
  }
};

module.exports = {
  createValidationError,
  validateBarang,
  validateJasa,
};
