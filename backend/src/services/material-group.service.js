const materialGroupRepository = require("../repositories/material-group.repository");

// Mengambil seluruh material group
const getAllMaterialGroups = async () => {
  return await materialGroupRepository.findAll();
};

// Mengambil detail material group berdasarkan ID
const getMaterialGroupById = async (id) => {
  const materialGroup = await materialGroupRepository.findById(id);

  if (!materialGroup) {
    const error = new Error("Data material group tidak ditemukan.");
    error.statusCode = 404;
    throw error;
  }

  return materialGroup;
};

// Mengambil material group berdasarkan category ID
const getMaterialGroupsByCategoryId = async (categoryId) => {
  return await materialGroupRepository.findByCategoryId(categoryId);
};

module.exports = {
  getAllMaterialGroups,
  getMaterialGroupById,
  getMaterialGroupsByCategoryId,
};