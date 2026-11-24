const specificationTypeRepository = require("../repositories/specification-type.repository");

const getAllSpecificationTypes = async () => {
  return specificationTypeRepository.findAll();
};

module.exports = {
  getAllSpecificationTypes,
};
