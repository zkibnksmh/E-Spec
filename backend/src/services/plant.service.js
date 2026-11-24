const plantRepository = require("../repositories/plant.repository");

// Mengambil seluruh data plant
const getAllPlants = async () => {
  return await plantRepository.findAll();
};

// Mengambil detail plant berdasarkan ID
const getPlantById = async (id) => {
  const plant = await plantRepository.findById(id);

  if (!plant) {
    const error = new Error("Data plant tidak ditemukan.");
    error.statusCode = 404;
    throw error;
  }

  return plant;
};

module.exports = {
  getAllPlants,
  getPlantById,
};