const express = require("express");
const specificationController = require("../controllers/specification.controller");
const {
  authenticate,
  requireAuthenticated,
} = require("../auth/middlewares/authentication.middleware");
const {
  requireRoles,
} = require("../auth/middlewares/authorization.middleware");
const { ROLES } = require("../auth/constants/roles");

const router = express.Router();

const requireRequestor = [
  authenticate,
  requireAuthenticated,
  requireRoles([ROLES.REQUESTOR]),
];
const requireApprovalUser = [authenticate, requireAuthenticated];
const requireScopedReadUser = [authenticate, requireAuthenticated];

router.get("/", specificationController.getAllSpecifications);
router.get("/my-drafts", ...requireRequestor, specificationController.getMyDraftSpecifications);
router.get("/my-drafts/:id", ...requireRequestor, specificationController.getMyDraftSpecificationById);
router.get("/my-documents", ...requireScopedReadUser, specificationController.getScopedSpecifications);
router.get(
  "/my-documents/:id",
  ...requireScopedReadUser,
  specificationController.getScopedSpecificationById
);
router.post("/", ...requireRequestor, specificationController.createSpecificationDraft);
router.post("/:id/submit", ...requireRequestor, specificationController.submitSpecification);
router.post("/:id/resubmit", ...requireRequestor, specificationController.resubmitSpecification);
router.post("/:id/approval/approve", ...requireApprovalUser, specificationController.approveSpecification);
router.post("/:id/approval/reject", ...requireApprovalUser, specificationController.rejectSpecification);
router.post("/:id/approval/return", ...requireApprovalUser, specificationController.returnSpecification);
router.get("/:id/workflow", ...requireApprovalUser, specificationController.getWorkflow);
router.get("/:id", specificationController.getSpecificationById);
router.put("/:id", ...requireRequestor, specificationController.updateSpecificationDraft);

module.exports = router;
