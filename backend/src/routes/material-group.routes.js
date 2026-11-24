const express = require("express");
const materialGroupController = require("../controllers/material-group.controller");

const router = express.Router();

// GET seluruh material group
router.get(
  "/",
  materialGroupController.getAllMaterialGroups
);

// GET material group berdasarkan kategori
router.get(
  "/categories/:categoryId",
  materialGroupController.getMaterialGroupsByCategoryId
);

// GET detail material group berdasarkan ID
router.get(
  "/:id",
  materialGroupController.getMaterialGroupById
);

module.exports = router;