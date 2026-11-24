
const reasonToProcureRepository = require("../repositories/reason-to-procure.repository");

// Mengambil seluruh reason to procure
const getAllReasonToProcure = async () => {
  return await reasonToProcureRepository.findAll();
};

// Mengambil detail berdasarkan ID
const getReasonToProcureById = async (id) => {
  const reason = await reasonToProcureRepository.findById(id);

  if (!reason) {
    const error = new Error("Reason to procure tidak ditemukan.");
    error.statusCode = 404;
    throw error;
  }

  return reason;
};

// Mengambil reason to procure berdasarkan tipe spesifikasi
const getReasonToProcureBySpecificationTypeId = async (specificationTypeId) => {
  return await reasonToProcureRepository.findBySpecificationTypeId(
    specificationTypeId
  );
};

module.exports = {
  getAllReasonToProcure,
  getReasonToProcureById,
  getReasonToProcureBySpecificationTypeId,
};
