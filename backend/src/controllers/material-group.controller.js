const materialGroupService = require("../services/material-group.service");

// GET seluruh material group
const getAllMaterialGroups = async (req, res, next) => {
  try {
    const materialGroups =
      await materialGroupService.getAllMaterialGroups();

    return res.status(200).json({
      success: true,
      message: "Data material group berhasil diambil.",
      total: materialGroups.length,
      data: materialGroups,
    });
  } catch (error) {
    next(error);
  }
};

// GET detail material group berdasarkan ID
const getMaterialGroupById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!/^[1-9]\d*$/.test(id)) {
      return res.status(400).json({
        success: false,
        message: "ID material group tidak valid.",
      });
    }

    const materialGroup =
      await materialGroupService.getMaterialGroupById(Number(id));

    return res.status(200).json({
      success: true,
      message: "Detail material group berhasil diambil.",
      data: materialGroup,
    });
  } catch (error) {
    next(error);
  }
};

// GET material group berdasarkan category ID
const getMaterialGroupsByCategoryId = async (req, res, next) => {
  try {
    const { categoryId } = req.params;

    if (!/^[1-9]\d*$/.test(categoryId)) {
      return res.status(400).json({
        success: false,
        message: "Category ID tidak valid.",
      });
    }

    const materialGroups =
      await materialGroupService.getMaterialGroupsByCategoryId(
        Number(categoryId)
      );

    return res.status(200).json({
      success: true,
      message: "Data material group berdasarkan kategori berhasil diambil.",
      total: materialGroups.length,
      data: materialGroups,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllMaterialGroups,
  getMaterialGroupById,
  getMaterialGroupsByCategoryId,
};