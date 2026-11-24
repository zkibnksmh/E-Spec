
const express = require("express");
const reasonToProcureController = require("../controllers/reason-to-procure.controller");

const router = express.Router();

// GET seluruh reason to procure
router.get(
  "/",
  reasonToProcureController.getAllReasonToProcure
);

// GET reason to procure berdasarkan tipe spesifikasi
// 1 = Barang, 2 = Jasa
router.get(
  "/specification-types/:specificationTypeId",
  reasonToProcureController.getReasonToProcureBySpecificationTypeId
);

// GET detail reason to procure berdasarkan ID
router.get(
  "/:id",
  reasonToProcureController.getReasonToProcureById
);

module.exports = router;
