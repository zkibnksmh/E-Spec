const express = require("express");
const plantController = require("../controllers/plant.controller");
const departmentController = require("../controllers/department.controller");

const router = express.Router();

// GET seluruh data plant
router.get("/", plantController.getAllPlants);

// GET detail plant berdasarkan ID
router.get("/:id", plantController.getPlantById);

// GET department berdasarkan Plant ID
router.get(
  "/:plantId/departments",
  departmentController.getDepartmentsByPlantId
);

module.exports = router;