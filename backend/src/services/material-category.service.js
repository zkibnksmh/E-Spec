
const materialCategoryRepository = require("../repositories/material-category.repository");

// Mengambil seluruh kategori material
const getAllMaterialCategories = async () => {
  return await materialCategoryRepository.findAll();
};

// Mengambil detail kategori berdasarkan ID
const getMaterialCategoryById = async (id) => {
  const category = await materialCategoryRepository.findById(id);

  if (!category) {
    const error = new Error("Kategori material tidak ditemukan.");
    error.statusCode = 404;
    throw error;
  }

  return category;
};

module.exports = {
  getAllMaterialCategories,
  getMaterialCategoryById,
};
