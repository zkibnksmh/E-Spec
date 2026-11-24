const specificationService = require("../services/specification.service");
const submissionService = require("../services/specification-submission.service");
const approvalService = require("../services/approval.service");

const getAllSpecifications = async (req, res, next) => {
  try {
    const { specificationTypeId, status } = req.query;

    const specifications = await specificationService.getAllSpecifications({
      specificationTypeId,
      status,
    });

    return res.status(200).json({
      success: true,
      data: specifications,
      total: specifications.length,
    });
  } catch (error) {
    next(error);
  }
};

const getSpecificationById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!/^[1-9]\d*$/.test(id)) {
      return res.status(400).json({
        success: false,
        message: "ID spesifikasi tidak valid.",
      });
    }

    const specification = await specificationService.getSpecificationById(
      Number(id)
    );

    return res.status(200).json({
      success: true,
      data: specification,
    });
  } catch (error) {
    next(error);
  }
};

const getMyDraftSpecifications = async (req, res, next) => {
  try {
    const { specificationTypeId, status } = req.query;

    const specifications = await specificationService.getMyDraftSpecifications(
      { specificationTypeId, status },
      req.user
    );

    return res.status(200).json({
      success: true,
      data: specifications,
      total: specifications.length,
    });
  } catch (error) {
    next(error);
  }
};

const getMyDraftSpecificationById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!/^[1-9]\d*$/.test(id)) {
      return res.status(400).json({
        success: false,
        message: "ID spesifikasi tidak valid.",
      });
    }

    const specification = await specificationService.getMyDraftSpecificationById(
      Number(id),
      req.user
    );

    return res.status(200).json({
      success: true,
      data: specification,
    });
  } catch (error) {
    next(error);
  }
};

const getScopedSpecifications = async (req, res, next) => {
  try {
    const specifications = await specificationService.getScopedSpecifications(req.user);

    return res.status(200).json({
      success: true,
      data: specifications,
      total: specifications.length,
    });
  } catch (error) {
    next(error);
  }
};

const getScopedSpecificationById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!/^[1-9]\d*$/.test(id)) {
      return res.status(400).json({
        success: false,
        message: "ID spesifikasi tidak valid.",
      });
    }

    const specification = await specificationService.getScopedSpecificationById(
      Number(id),
      req.user
    );

    return res.status(200).json({
      success: true,
      data: specification,
    });
  } catch (error) {
    next(error);
  }
};

const createSpecificationDraft = async (req, res, next) => {
  try {
    const specification = await specificationService.createSpecificationDraft(
      req.body,
      req.user
    );

    return res.status(201).json({
      success: true,
      data: specification,
      message: "Specification draft created successfully.",
    });
  } catch (error) {
    next(error);
  }
};

const updateSpecificationDraft = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!/^[1-9]\d*$/.test(id)) {
      return res.status(400).json({
        success: false,
        message: "ID spesifikasi tidak valid.",
      });
    }

    const specification = await specificationService.updateSpecificationDraft(
      Number(id),
      req.body,
      req.user
    );

    return res.status(200).json({
      success: true,
      data: specification,
      message: "Specification draft updated successfully.",
    });
  } catch (error) {
    next(error);
  }
};

const submitSpecification = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!/^[1-9]\d*$/.test(id)) {
      return res.status(400).json({ success: false, message: "ID spesifikasi tidak valid." });
    }

    const result = await submissionService.submitSpecification(Number(id), req.body, req.user);

    return res.status(200).json({
      success: true,
      message: "Specification submitted successfully.",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

const resubmitSpecification = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!/^[1-9]\d*$/.test(id)) {
      return res.status(400).json({ success: false, message: "ID spesifikasi tidak valid." });
    }

    const result = await submissionService.resubmitSpecification(Number(id), req.body, req.user);

    return res.status(200).json({
      success: true,
      message: "Specification resubmitted successfully.",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

const approveSpecification = async (req, res, next) => {
  try {
    if (!/^[1-9]\d*$/.test(req.params.id)) return res.status(400).json({ success: false, message: "ID spesifikasi tidak valid." });
    const data = await approvalService.approve(Number(req.params.id), req.body, req.user);
    return res.status(200).json({ success: true, message: "Specification approved successfully.", data });
  } catch (error) {
    next(error);
  }
};

const rejectSpecification = async (req, res, next) => {
  try {
    if (!/^[1-9]\d*$/.test(req.params.id)) return res.status(400).json({ success: false, message: "ID spesifikasi tidak valid." });
    const data = await approvalService.reject(Number(req.params.id), req.body, req.user);
    return res.status(200).json({ success: true, message: "Specification rejected successfully.", data });
  } catch (error) {
    next(error);
  }
};

const returnSpecification = async (req, res, next) => {
  try {
    if (!/^[1-9]\d*$/.test(req.params.id)) return res.status(400).json({ success: false, message: "ID spesifikasi tidak valid." });
    const data = await approvalService.returnForRevision(Number(req.params.id), req.body, req.user);
    return res.status(200).json({ success: true, message: "Specification returned for revision.", data });
  } catch (error) {
    next(error);
  }
};

const getWorkflow = async (req, res, next) => {
  try {
    if (!/^[1-9]\d*$/.test(req.params.id)) return res.status(400).json({ success: false, message: "ID spesifikasi tidak valid." });
    const data = await approvalService.getWorkflow(Number(req.params.id), req.user);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllSpecifications,
  getSpecificationById,
  getMyDraftSpecifications,
  getMyDraftSpecificationById,
  getScopedSpecifications,
  getScopedSpecificationById,
  createSpecificationDraft,
  updateSpecificationDraft,
  submitSpecification,
  resubmitSpecification,
  approveSpecification,
  rejectSpecification,
  returnSpecification,
  getWorkflow,
};
