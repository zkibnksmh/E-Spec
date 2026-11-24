const plantService = require("../services/plant.service");

// GET seluruh data plant
const getAllPlants = async (req, res, next) => {
  try {
    const plants = await plantService.getAllPlants();

    return res.status(200).json({
      success: true,
      message: "Data plant berhasil diambil.",
      total: plants.length,
      data: plants,
    });
  } catch (error) {
    next(error);
  }
};

// GET detail plant berdasarkan ID
const getPlantById = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Validasi ID
    if (!/^[1-9]\d*$/.test(id)) {
      return res.status(400).json({
        success: false,
        message: "ID plant tidak valid.",
      });
    }

    const plant = await plantService.getPlantById(Number(id));

    return res.status(200).json({
      success: true,
      message: "Detail plant berhasil diambil.",
      data: plant,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllPlants,
  getPlantById,
};