const express = require("express");
const approvalController = require("../controllers/approval.controller");
const { authenticate, requireAuthenticated } = require("../auth/middlewares/authentication.middleware");

const router = express.Router();
router.use(authenticate, requireAuthenticated);
router.get("/inbox", approvalController.getInbox);

module.exports = router;
