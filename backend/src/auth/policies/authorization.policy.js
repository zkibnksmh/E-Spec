const isPositiveInteger = (value) => /^[1-9]\d*$/.test(String(value));

const isNormalizedPrincipal = (user) => (
  user &&
  typeof user === "object" &&
  !Array.isArray(user) &&
  typeof user.userId === "string" &&
  user.userId.trim().length > 0 &&
  Array.isArray(user.roles) &&
  user.roles.every((role) => typeof role === "string" && role.length > 0) &&
  Array.isArray(user.plantIds) &&
  Array.isArray(user.departmentIds)
);

const hasScopeAccess = (scopeIds, targetId) => (
  isPositiveInteger(targetId) &&
  Array.isArray(scopeIds) &&
  scopeIds.some((scopeId) => String(scopeId) === String(targetId))
);

const hasPlantAccess = (user, plantId) => (
  isNormalizedPrincipal(user) && hasScopeAccess(user.plantIds, plantId)
);

const hasDepartmentAccess = (user, departmentId) => (
  isNormalizedPrincipal(user) && hasScopeAccess(user.departmentIds, departmentId)
);

module.exports = {
  isNormalizedPrincipal,
  hasPlantAccess,
  hasDepartmentAccess,
};
