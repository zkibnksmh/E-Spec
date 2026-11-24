const { resolveRequestIdentity } = require("../services/identity.service");
const { isNormalizedPrincipal } = require("../policies/authorization.policy");

const authenticate = (req, res, next) => {
  try {
    req.user = resolveRequestIdentity(req);
    next();
  } catch (error) {
    next(error);
  }
};

const requireAuthenticated = (req, res, next) => {
  if (isNormalizedPrincipal(req.user)) {
    next();
    return;
  }

  const error = new Error("Autentikasi diperlukan.");
  error.statusCode = 401;
  next(error);
};

module.exports = {
  authenticate,
  requireAuthenticated,
};
