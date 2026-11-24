const specificationTypeService = require("../services/specification-type.service");

const getAllSpecificationTypes = async (req, res, next) => {
  try {
    const specificationTypes =
      await specificationTypeService.getAllSpecificationTypes();

    return res.status(200).json({
      success: true,
      data: specificationTypes,
      total: specificationTypes.length,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllSpecificationTypes,
};
