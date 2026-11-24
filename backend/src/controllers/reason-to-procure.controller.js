
const reasonToProcureService = require("../services/reason-to-procure.service");

// GET seluruh reason to procure
const getAllReasonToProcure = async (req, res, next) => {
  try {
    const reasons = await reasonToProcureService.getAllReasonToProcure();

    return res.status(200).json({
      success: true,
      message: "Data reason to procure berhasil diambil.",
      total: reasons.length,
      data: reasons,
    });
  } catch (error) {
    next(error);
  }
};

// GET detail berdasarkan ID
const getReasonToProcureById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!/^[1-9]\d*$/.test(id)) {
      return res.status(400).json({
        success: false,
        message: "ID reason to procure tidak valid.",
      });
    }

    const reason =
      await reasonToProcureService.getReasonToProcureById(id);

    return res.status(200).json({
      success: true,
      message: "Detail reason to procure berhasil diambil.",
      data: reason,
    });
  } catch (error) {
    next(error);
  }
};

// GET berdasarkan tipe spesifikasi (Barang / Jasa)
const getReasonToProcureBySpecificationTypeId = async (
  req,
  res,
  next
) => {
  try {
    const { specificationTypeId } = req.params;

    if (!/^[1-9]\d*$/.test(specificationTypeId)) {
      return res.status(400).json({
        success: false,
        message: "ID tipe spesifikasi tidak valid.",
      });
    }

    const reasons =
      await reasonToProcureService.getReasonToProcureBySpecificationTypeId(
        specificationTypeId
      );

    return res.status(200).json({
      success: true,
      message: "Data reason to procure berdasarkan tipe spesifikasi berhasil diambil.",
      total: reasons.length,
      data: reasons,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllReasonToProcure,
  getReasonToProcureById,
  getReasonToProcureBySpecificationTypeId,
};
