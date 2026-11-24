const { createApprovalError } = require("./approval-error");
const {
  developmentApproverAssignmentProvider,
} = require("./approver-assignment.provider");

const ASSIGNMENT_FIELDS = Object.freeze([
  "assignedApproverUserId",
  "assignedApproverEmployeeId",
  "assignedApproverDisplayName",
  "assignedApproverEmail",
  "assignedApproverRole",
  "plantId",
  "departmentId",
  "identitySource",
]);

const normalizeStepNo = (stepNo) => {
  if (stepNo === undefined || stepNo === null || String(stepNo).trim() === "") {
    throw createApprovalError("Step number wajib diisi.");
  }

  if (!/^[1-9]\d*$/.test(String(stepNo).trim())) {
    throw createApprovalError("Step number harus berupa angka positif.");
  }

  return Number(String(stepNo).trim());
};

const assertCompleteAssignment = (assignment) => {
  if (!assignment || typeof assignment !== "object" || Array.isArray(assignment)) {
    throw createApprovalError("Assignment approver tidak lengkap.");
  }

  ASSIGNMENT_FIELDS.forEach((field) => {
    const value = assignment[field];

    if (value === undefined || value === null || String(value).trim() === "") {
      throw createApprovalError(
        `Assignment approver tidak lengkap: ${field}.`
      );
    }
  });
};

const resolveApproverAssignment = ({
  rule,
  specification,
  requestorUserId,
  assignmentProvider = developmentApproverAssignmentProvider,
  environment = process.env,
} = {}) => {
  if (!rule || typeof rule !== "object" || Array.isArray(rule)) {
    throw createApprovalError("Approval rule tidak valid.");
  }

  if (
    !specification ||
    typeof specification !== "object" ||
    Array.isArray(specification)
  ) {
    throw createApprovalError("Konteks specification tidak valid.");
  }

  if (typeof requestorUserId !== "string" || !requestorUserId.trim()) {
    throw createApprovalError("Requestor user ID wajib diisi.");
  }

  const stepNo = normalizeStepNo(rule.stepNo);
  const assignment = assignmentProvider.resolveAssignment({
    approverRole: rule.approverRole,
    plantId: specification.plantId,
    departmentId: specification.departmentId,
    environment,
  });

  assertCompleteAssignment(assignment);

  if (assignment.assignedApproverUserId === requestorUserId.trim()) {
    throw createApprovalError(
      "Approver tidak boleh sama dengan Requestor.",
      409
    );
  }

  return Object.freeze({
    stepNo,
    approverRole: assignment.assignedApproverRole,
    ...assignment,
  });
};

const approverAssignmentService = Object.freeze({
  resolveApproverAssignment,
});

module.exports = {
  ASSIGNMENT_FIELDS,
  normalizeStepNo,
  assertCompleteAssignment,
  resolveApproverAssignment,
  approverAssignmentService,
};
