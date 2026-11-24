const {
  resolveDevelopmentIdentity,
} = require("../identity/development-identity.provider");

const resolveRequestIdentity = (request) => (
  resolveDevelopmentIdentity(request.get("X-ESpec-Dev-Identity"))
);

module.exports = {
  resolveRequestIdentity,
};
