const approvalService = require("../services/approval.service");

const validId = (id) => /^[1-9]\d*$/.test(id);

const approve = async (req, res, next) => {
  try {
    if (!validId(req.params.id)) return res.status(400).json({ success: false, message: "ID spesifikasi tidak valid." });
    const data = await approvalService.approve(Number(req.params.id), req.body, req.user);
    return res.status(200).json({ success: true, message: "Specification approved successfully.", data });
  } catch (error) {
    next(error);
  }
};

const reject = async (req, res, next) => {
  try {
    if (!validId(req.params.id)) return res.status(400).json({ success: false, message: "ID spesifikasi tidak valid." });
    const data = await approvalService.reject(Number(req.params.id), req.body, req.user);
    return res.status(200).json({ success: true, message: "Specification rejected successfully.", data });
  } catch (error) {
    next(error);
  }
};

const returnForRevision = async (req, res, next) => {
  try {
    if (!validId(req.params.id)) return res.status(400).json({ success: false, message: "ID spesifikasi tidak valid." });
    const data = await approvalService.returnForRevision(Number(req.params.id), req.body, req.user);
    return res.status(200).json({ success: true, message: "Specification returned for revision.", data });
  } catch (error) {
    next(error);
  }
};

const getInbox = async (req, res, next) => {
  try {
    const data = await approvalService.getInbox(req.user);
    return res.status(200).json({ success: true, data, total: data.length });
  } catch (error) {
    next(error);
  }
};

const getWorkflow = async (req, res, next) => {
  try {
    if (!validId(req.params.id)) return res.status(400).json({ success: false, message: "ID spesifikasi tidak valid." });
    const data = await approvalService.getWorkflow(Number(req.params.id), req.user);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

module.exports = { approve, reject, returnForRevision, getInbox, getWorkflow };
