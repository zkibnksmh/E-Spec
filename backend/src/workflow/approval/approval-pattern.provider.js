const { ROLES } = require("../../auth/constants/roles");
const {
  isDevelopmentIdentityEnabled,
} = require("../../auth/identity/development-identity.provider");
const { createApprovalError } = require("./approval-error");

const DEVELOPMENT_APPROVAL_PATTERNS = Object.freeze({
  SERVICE: Object.freeze([
    Object.freeze({
      stepNo: 1,
      approverRole: ROLES.MANAGER,
      isRequired: true,
    }),
  ]),
  SERVICEPM: Object.freeze([
    Object.freeze({
      stepNo: 1,
      approverRole: ROLES.MANAGER,
      isRequired: true,
    }),
    Object.freeze({
      stepNo: 2,
      approverRole: ROLES.HEAD_ENGINEERING,
      isRequired: true,
    }),
  ]),
});

const DEVELOPMENT_SIMULATION_BARANG_ROUTES = Object.freeze({
  "7101:7501:BEARING": Object.freeze([
    Object.freeze({
      stepNo: 1,
      approverRole: ROLES.MANAGER,
      isRequired: true,
    }),
    Object.freeze({
      stepNo: 2,
      approverRole: ROLES.HEAD_ENGINEERING,
      isRequired: true,
    }),
  ]),
});

const SUPPORTED_APPROVER_ROLES = Object.freeze([
  ROLES.MANAGER,
  ROLES.HEAD_ENGINEERING,
]);

const normalizeApprovalRules = (rules) => {
  if (!Array.isArray(rules) || rules.length === 0) {
    throw createApprovalError("Approval route tidak boleh kosong.");
  }

  const seenSteps = new Set();

  const normalized = rules.map((rule) => {
    if (!rule || typeof rule !== "object" || Array.isArray(rule)) {
      throw createApprovalError("Approval rule tidak valid.");
    }

    if (
      rule.stepNo === undefined ||
      rule.stepNo === null ||
      !/^[1-9]\d*$/.test(String(rule.stepNo).trim())
    ) {
      throw createApprovalError("Step number harus berupa angka positif.");
    }

    const stepNo = Number(String(rule.stepNo).trim());

    if (seenSteps.has(stepNo)) {
      throw createApprovalError(
        "Step number duplikat pada approval route."
      );
    }

    seenSteps.add(stepNo);

    if (rule.approverRole === ROLES.REQUESTOR) {
      throw createApprovalError("Requestor tidak dapat menjadi approver.");
    }

    if (!SUPPORTED_APPROVER_ROLES.includes(rule.approverRole)) {
      throw createApprovalError("Approver role tidak didukung.");
    }

    if (rule.isRequired !== true) {
      throw createApprovalError(
        "Setiap step approval harus ditandai required."
      );
    }

    return Object.freeze({
      stepNo,
      approverRole: rule.approverRole,
      isRequired: true,
    });
  });

  normalized.sort((left, right) => left.stepNo - right.stepNo);

  normalized.forEach((rule, index) => {
    if (rule.stepNo !== index + 1) {
      throw createApprovalError(
        "Approval route tidak boleh melewati step yang diwajibkan."
      );
    }
  });

  return Object.freeze(normalized);
};

const getDevelopmentApprovalRules = (
  materialGroupCode,
  environment = process.env,
  specification = null
) => {
  if (!isDevelopmentIdentityEnabled(environment)) {
    throw createApprovalError(
      "Development approval routing tidak tersedia pada environment ini.",
      403
    );
  }

  if (typeof materialGroupCode !== "string" || !materialGroupCode.trim()) {
    throw createApprovalError("Material group code wajib diisi.");
  }

  const normalizedCode = materialGroupCode.trim().toUpperCase();
  const groupRules = DEVELOPMENT_APPROVAL_PATTERNS[normalizedCode];
  const specificationTypeId = Number(specification?.specificationTypeId);
  const materialCategoryId = Number(specification?.materialCategoryId);
  const simulationKey = `${specificationTypeId}:${materialCategoryId}:${normalizedCode}`;
  const simulationRules = Number.isInteger(specificationTypeId)
    && Number.isInteger(materialCategoryId)
    ? DEVELOPMENT_SIMULATION_BARANG_ROUTES[simulationKey]
    : undefined;
  const rules = groupRules || simulationRules;

  if (!rules) {
    throw createApprovalError(
      "Material group code tidak memiliki development approval route."
    );
  }

  return normalizeApprovalRules(rules);
};

const developmentApprovalPatternProvider = Object.freeze({
  getApprovalRules: getDevelopmentApprovalRules,
});

module.exports = {
  DEVELOPMENT_APPROVAL_PATTERNS,
  DEVELOPMENT_SIMULATION_BARANG_ROUTES,
  SUPPORTED_APPROVER_ROLES,
  normalizeApprovalRules,
  getDevelopmentApprovalRules,
  developmentApprovalPatternProvider,
};
