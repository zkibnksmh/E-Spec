const express = require("express");
const authController = require("../controllers/auth.controller");
const {
  authenticate,
  requireAuthenticated,
} = require("../auth/middlewares/authentication.middleware");

const router = express.Router();

router.get("/me", authenticate, requireAuthenticated, authController.getCurrentUser);

module.exports = router;
