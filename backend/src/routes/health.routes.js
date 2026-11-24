const express = require("express");
const healthController = require("../controllers/health.controller");

const router = express.Router();

// GET /api/health
router.get("/", healthController.checkDatabase);

module.exports = router;