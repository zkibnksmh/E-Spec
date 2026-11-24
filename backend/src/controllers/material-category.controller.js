
const materialCategoryService = require("../services/material-category.service");

// GET seluruh kategori material
const getAllMaterialCategories = async (req, res, next) => {
  try {
    const categories =
      await materialCategoryService.getAllMaterialCategories();

    return res.status(200).json({
      success: true,
      message: "Data kategori material berhasil diambil.",
      total: categories.length,
      data: categories,
    });
  } catch (error) {
    next(error);
  }
};

// GET detail kategori berdasarkan ID
const getMaterialCategoryById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!/^[1-9]\d*$/.test(id)) {
      return res.status(400).json({
        success: false,
        message: "ID kategori harus berupa angka positif.",
      });
    }

    const category =
      await materialCategoryService.getMaterialCategoryById(id);

    return res.status(200).json({
      success: true,
      message: "Detail kategori material berhasil diambil.",
      data: category,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllMaterialCategories,
  getMaterialCategoryById,
};
