const SPECIFICATION_STATUS = Object.freeze({
  DRAFT: "Draft",
  IN_APPROVAL: "In Approval",
  REVISION_REQUIRED: "Revision Required",
  APPROVED: "Approved",
  REJECTED: "Rejected",
});

const APPROVAL_STEP_STATUS = Object.freeze({
  PENDING: "Pending",
  APPROVED: "Approved",
  RETURNED: "Returned",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
});

const APPROVAL_CYCLE_STATUS = Object.freeze({
  ACTIVE: "Active",
  COMPLETED: "Completed",
  RETURNED: "Returned",
  REJECTED: "Rejected",
});

module.exports = {
  SPECIFICATION_STATUS,
  APPROVAL_STEP_STATUS,
  APPROVAL_CYCLE_STATUS,
};
