const approvalRepository = require("../repositories/approval.repository");

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
    ...actor,
    userId: actor.userId.trim(),
    displayName: String(actor.displayName || actor.userId).trim(),
  };
};

const normalizeComment = (body, required) => {
  if (body === undefined || body === null) {
    if (required) throw createHttpError("comment wajib diisi.", 422);
    return null;
  }
  if (typeof body !== "object" || Array.isArray(body)) {
    throw createHttpError("Payload JSON tidak valid.", 400);
  }
  if (body.comment === undefined || body.comment === null) {
    if (required) throw createHttpError("comment wajib diisi.", 422);
    return null;
  }
  if (typeof body.comment !== "string") {
    throw createHttpError("comment harus berupa teks.", 422);
  }
  const comment = body.comment.trim();
  if (required && !comment) throw createHttpError("comment wajib diisi.", 422);
  return comment || null;
};

const decide = (decision, id, body, actor) => approvalRepository.decide({
  specificationId: id,
  actor: normalizeActor(actor),
  decision,
  comment: normalizeComment(body, decision !== "approve"),
});

module.exports = {
  approve: (id, body, actor) => decide("approve", id, body, actor),
  returnForRevision: (id, body, actor) => decide("return", id, body, actor),
  reject: (id, body, actor) => decide("reject", id, body, actor),
  getInbox: (actor) => approvalRepository.findInbox(normalizeActor(actor)),
  getWorkflow: (id, actor) => approvalRepository.findWorkflow(id, normalizeActor(actor)),
};
