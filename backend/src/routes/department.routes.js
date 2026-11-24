const express = require("express");
const departmentController = require("../controllers/department.controller");

const router = express.Router();

// GET seluruh department
router.get("/", departmentController.getAllDepartments);

// GET detail department berdasarkan ID
router.get("/:id", departmentController.getDepartmentById);

module.exports = router;