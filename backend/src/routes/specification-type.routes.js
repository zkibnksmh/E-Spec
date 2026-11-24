const express = require("express");
const specificationTypeController = require("../controllers/specification-type.controller");

const router = express.Router();

router.get("/", specificationTypeController.getAllSpecificationTypes);

module.exports = router;
