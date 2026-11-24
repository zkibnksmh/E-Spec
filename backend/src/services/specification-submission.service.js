const submissionRepository = require("../repositories/specification-submission.repository");
const { approvalRoutingService } = require("../workflow/approval/approval-routing.service");

const createHttpError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const normalizeActor = (actor) => {
  if (!actor || typeof actor.userId !== "string" || !actor.userId.trim()) {
    throw createHttpError("Autentikasi diperlukan.", 401);
  }

  return {
    userId: actor.userId.trim(),
    displayName: String(actor.displayName ?? actor.userId).trim() || actor.userId.trim(),
  };
};

const normalizeComment = (body) => {
  if (body === undefined || body === null) return null;
  if (typeof body !== "object" || Array.isArray(body)) {
    throw createHttpError("Payload JSON tidak valid.", 400);
  }
  if (body.comment === undefined || body.comment === null) return null;
  if (typeof body.comment !== "string") {
    throw createHttpError("comment harus berupa teks.", 422);
  }
  return body.comment.trim() || null;
};

const submitSpecification = async (id, body, actor) => submissionRepository.submit({
  specificationId: id,
  actor: normalizeActor(actor),
  comment: normalizeComment(body),
  buildRoute: approvalRoutingService.buildRoute,
  resubmission: false,
});

const resubmitSpecification = async (id, body, actor) => submissionRepository.submit({
  specificationId: id,
  actor: normalizeActor(actor),
  comment: normalizeComment(body),
  buildRoute: approvalRoutingService.buildRoute,
  resubmission: true,
});

module.exports = {
  submitSpecification,
  resubmitSpecification,
};
