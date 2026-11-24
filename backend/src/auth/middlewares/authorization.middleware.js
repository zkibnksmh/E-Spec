const {
  isNormalizedPrincipal,
  hasPlantAccess,
  hasDepartmentAccess,
} = require("../policies/authorization.policy");

const unauthorized = () => {
  const error = new Error("Autentikasi diperlukan.");
  error.statusCode = 401;
  return error;
};

const forbidden = () => {
  const error = new Error("Anda tidak memiliki akses untuk operasi ini.");
  error.statusCode = 403;
  return error;
};

const requireRoles = (permittedRoles) => {
  if (!Array.isArray(permittedRoles) || !permittedRoles.length) {
    throw new Error("requireRoles memerlukan sedikitnya satu role.");
  }

  return (req, res, next) => {
    if (!isNormalizedPrincipal(req.user)) {
      next(unauthorized());
      return;
    }

    if (!req.user.roles.some((role) => permittedRoles.includes(role))) {
      next(forbidden());
      return;
    }

    next();
  };
};

const requireScopeAccess = (hasAccess, resolveTargetId) => {
  if (typeof resolveTargetId !== "function") {
    throw new Error("Scope target resolver harus berupa function.");
  }

  return (req, res, next) => {
    if (!isNormalizedPrincipal(req.user)) {
      next(unauthorized());
      return;
    }

    const targetId = resolveTargetId(req);

    if (!hasAccess(req.user, targetId)) {
      next(forbidden());
      return;
    }

    next();
  };
};

const requirePlantAccess = (resolveTargetPlantId) => (
  requireScopeAccess(hasPlantAccess, resolveTargetPlantId)
);

const requireDepartmentAccess = (resolveTargetDepartmentId) => (
  requireScopeAccess(hasDepartmentAccess, resolveTargetDepartmentId)
);

module.exports = {
  requireRoles,
  requirePlantAccess,
  requireDepartmentAccess,
};
