
const express = require("express");
const materialCategoryController = require("../controllers/material-category.controller");

const router = express.Router();

// GET seluruh kategori material
router.get(
  "/",
  materialCategoryController.getAllMaterialCategories
);

// GET detail kategori berdasarkan ID
router.get(
  "/:id",
  materialCategoryController.getMaterialCategoryById
);

module.exports = router;
