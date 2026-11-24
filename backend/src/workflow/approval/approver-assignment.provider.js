const { ROLES } = require("../../auth/constants/roles");
const {
  isDevelopmentIdentityEnabled,
  resolveDevelopmentIdentity,
} = require("../../auth/identity/development-identity.provider");
const {
  hasPlantAccess,
  hasDepartmentAccess,
} = require("../../auth/policies/authorization.policy");
const { createApprovalError } = require("./approval-error");

const APPROVER_ROLE_ALIASES = Object.freeze({
  [ROLES.MANAGER]: "manager",
  [ROLES.HEAD_ENGINEERING]: "head-engineering",
});

const isPositiveInteger = (value) => /^[1-9]\d*$/.test(String(value).trim());

const normalizeScopeId = (value, label) => {
  if (value === undefined || value === null || String(value).trim() === "") {
    throw createApprovalError(`${label} wajib diisi.`);
  }

  if (!isPositiveInteger(value)) {
    throw createApprovalError(`${label} harus berupa ID angka positif.`);
  }

  return Number(String(value).trim());
};

const normalizeApproverRole = (approverRole) => {
  if (typeof approverRole !== "string" || !approverRole.trim()) {
    throw createApprovalError("Approver role wajib diisi.");
  }

  const role = approverRole.trim();

  if (role === ROLES.REQUESTOR) {
    throw createApprovalError("Requestor tidak dapat menjadi approver.");
  }

  if (!APPROVER_ROLE_ALIASES[role]) {
    throw createApprovalError("Approver role tidak didukung.");
  }

  return role;
};

const resolveDevelopmentApproverAssignment = ({
  approverRole,
  plantId,
  departmentId,
  environment = process.env,
} = {}) => {
  if (!isDevelopmentIdentityEnabled(environment)) {
    throw createApprovalError(
      "Development approver assignment tidak tersedia pada environment ini.",
      403
    );
  }

  const role = normalizeApproverRole(approverRole);
  const normalizedPlantId = normalizeScopeId(plantId, "Plant ID");
  const normalizedDepartmentId = normalizeScopeId(departmentId, "Department ID");
  const principal = resolveDevelopmentIdentity(
    APPROVER_ROLE_ALIASES[role],
    environment
  );

  if (!principal.roles.includes(role)) {
    throw createApprovalError(
      "Identitas approver tidak memiliki role yang diminta.",
      403
    );
  }

  if (!hasPlantAccess(principal, normalizedPlantId)) {
    throw createApprovalError(
      "Approver tidak memiliki akses ke Plant yang diminta.",
      403
    );
  }

  if (!hasDepartmentAccess(principal, normalizedDepartmentId)) {
    throw createApprovalError(
      "Approver tidak memiliki akses ke Department yang diminta.",
      403
    );
  }

  return Object.freeze({
    assignedApproverUserId: principal.userId,
    assignedApproverEmployeeId: principal.employeeId,
    assignedApproverDisplayName: principal.displayName,
    assignedApproverEmail: principal.email,
    assignedApproverRole: role,
    plantId: normalizedPlantId,
    departmentId: normalizedDepartmentId,
    identitySource: principal.identitySource,
  });
};

const developmentApproverAssignmentProvider = Object.freeze({
  resolveAssignment: resolveDevelopmentApproverAssignment,
});

module.exports = {
  APPROVER_ROLE_ALIASES,
  normalizeApproverRole,
  normalizeScopeId,
  resolveDevelopmentApproverAssignment,
  developmentApproverAssignmentProvider,
};
