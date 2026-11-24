const { createApprovalError } = require("./approval-error");
const {
  developmentApprovalPatternProvider,
} = require("./approval-pattern.provider");
const {
  approverAssignmentService,
} = require("./approver-assignment.service");

const normalizeOrderedRules = (rules) => {
  if (!Array.isArray(rules) || rules.length === 0) {
    throw createApprovalError("Approval route tidak boleh kosong.");
  }

  const seenSteps = new Set();
  const ordered = [...rules].sort(
    (left, right) => Number(left?.stepNo) - Number(right?.stepNo)
  );

  ordered.forEach((rule) => {
    if (
      !rule ||
      typeof rule !== "object" ||
      Array.isArray(rule) ||
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

    if (rule.isRequired !== true) {
      throw createApprovalError(
        "Setiap step approval harus ditandai required."
      );
    }
  });

  ordered.forEach((rule, index) => {
    if (Number(String(rule.stepNo).trim()) !== index + 1) {
      throw createApprovalError(
        "Approval route tidak boleh melewati step yang diwajibkan."
      );
    }
  });

  return ordered;
};

const buildApprovalRoute = async ({
  materialGroupCode,
  specification,
  requestorUserId,
  patternProvider = developmentApprovalPatternProvider,
  assignmentService = approverAssignmentService,
  environment = process.env,
} = {}) => {
  if (
    !specification ||
    typeof specification !== "object" ||
    Array.isArray(specification)
  ) {
    throw createApprovalError("Konteks specification tidak valid.");
  }

  const rules = await patternProvider.getApprovalRules(
    materialGroupCode,
    environment,
    specification
  );
  const orderedRules = normalizeOrderedRules(rules);
  const steps = [];

  for (const rule of orderedRules) {
    const assignment = await assignmentService.resolveApproverAssignment({
      rule,
      specification,
      requestorUserId,
      environment,
    });

    steps.push(
      Object.freeze({
        stepNo: assignment.stepNo,
        approverRole: assignment.approverRole,
        assignedApproverUserId: assignment.assignedApproverUserId,
        assignedApproverEmployeeId: assignment.assignedApproverEmployeeId,
        assignedApproverDisplayName: assignment.assignedApproverDisplayName,
        assignedApproverEmail: assignment.assignedApproverEmail,
        plantId: assignment.plantId,
        departmentId: assignment.departmentId,
        identitySource: assignment.identitySource,
      })
    );
  }

  if (steps.length !== orderedRules.length) {
    throw createApprovalError("Approval route tidak lengkap.");
  }

  return Object.freeze({
    materialGroupCode: String(materialGroupCode).trim().toUpperCase(),
    plantId: steps[0].plantId,
    departmentId: steps[0].departmentId,
    steps: Object.freeze(steps),
  });
};

const approvalRoutingService = Object.freeze({
  buildRoute: buildApprovalRoute,
});

module.exports = {
  normalizeOrderedRules,
  buildApprovalRoute,
  approvalRoutingService,
};
