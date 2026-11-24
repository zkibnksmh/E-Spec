const departmentService = require("../services/department.service");

// GET seluruh department
const getAllDepartments = async (req, res, next) => {
  try {
    const departments = await departmentService.getAllDepartments();

    return res.status(200).json({
      success: true,
      message: "Data department berhasil diambil.",
      total: departments.length,
      data: departments,
    });
  } catch (error) {
    next(error);
  }
};

// GET detail department berdasarkan ID
const getDepartmentById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!/^[1-9]\d*$/.test(id)) {
      return res.status(400).json({
        success: false,
        message: "ID department tidak valid.",
      });
    }

    const department = await departmentService.getDepartmentById(Number(id));

    return res.status(200).json({
      success: true,
      message: "Detail department berhasil diambil.",
      data: department,
    });
  } catch (error) {
    next(error);
  }
};

// GET department berdasarkan Plant ID
const getDepartmentsByPlantId = async (req, res, next) => {
  try {
    const { plantId } = req.params;

    if (!/^[1-9]\d*$/.test(plantId)) {
      return res.status(400).json({
        success: false,
        message: "Plant ID tidak valid.",
      });
    }

    const departments = await departmentService.getDepartmentsByPlantId(
      Number(plantId)
    );

    return res.status(200).json({
      success: true,
      message: "Data department berdasarkan plant berhasil diambil.",
      total: departments.length,
      data: departments,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllDepartments,
  getDepartmentById,
  getDepartmentsByPlantId,
};