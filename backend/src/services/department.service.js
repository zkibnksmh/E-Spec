const departmentRepository = require("../repositories/department.repository");

// Mengambil seluruh department
const getAllDepartments = async () => {
  return await departmentRepository.findAll();
};

// Mengambil detail department berdasarkan ID
const getDepartmentById = async (id) => {
  const department = await departmentRepository.findById(id);

  if (!department) {
    const error = new Error("Data department tidak ditemukan.");
    error.statusCode = 404;
    throw error;
  }

  return department;
};

// Mengambil department berdasarkan Plant ID
const getDepartmentsByPlantId = async (plantId) => {
  return await departmentRepository.findByPlantId(plantId);
};

module.exports = {
  getAllDepartments,
  getDepartmentById,
  getDepartmentsByPlantId,
};