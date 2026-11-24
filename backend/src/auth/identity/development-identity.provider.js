const DEVELOPMENT_IDENTITIES = Object.freeze({
  requestor: Object.freeze({
    userId: "DEV-REQ-001",
    employeeId: "DEV-EMP-REQ-001",
    displayName: "Development Requestor",
    email: "dev.requestor@example.test",
    roles: Object.freeze(["Requestor"]),
    plantIds: Object.freeze([7201]),
    departmentIds: Object.freeze([7301]),
    identitySource: "development",
  }),
  manager: Object.freeze({
    userId: "DEV-MGR-001",
    employeeId: "DEV-EMP-MGR-001",
    displayName: "Development Manager",
    email: "dev.manager@example.test",
    roles: Object.freeze(["Manager"]),
    plantIds: Object.freeze([7201]),
    departmentIds: Object.freeze([7301]),
    identitySource: "development",
  }),
  "head-engineering": Object.freeze({
    userId: "DEV-HE-001",
    employeeId: "DEV-EMP-HE-001",
    displayName: "Development Head Engineering",
    email: "dev.headengineering@example.test",
    roles: Object.freeze(["HeadEngineering"]),
    plantIds: Object.freeze([7201]),
    departmentIds: Object.freeze([7301]),
    identitySource: "development",
  }),
});

const isDevelopmentIdentityEnabled = (environment = process.env) => (
  environment.NODE_ENV !== "production" &&
  ["development", "test"].includes(environment.E_SPEC_ENV) &&
  environment.E_SPEC_ENABLE_DEV_IDENTITY === "true"
);

const resolveDevelopmentIdentity = (alias, environment = process.env) => {
  if (!isDevelopmentIdentityEnabled(environment)) {
    const error = new Error("Development identity tidak tersedia pada environment ini.");
    error.statusCode = 403;
    throw error;
  }

  if (!alias) {
    const error = new Error("Header X-ESpec-Dev-Identity wajib diisi.");
    error.statusCode = 401;
    throw error;
  }

  const identity = DEVELOPMENT_IDENTITIES[String(alias).trim().toLowerCase()];

  if (!identity) {
    const error = new Error("Development identity tidak dikenal.");
    error.statusCode = 400;
    throw error;
  }

  return {
    ...identity,
    roles: [...identity.roles],
    plantIds: [...identity.plantIds],
    departmentIds: [...identity.departmentIds],
  };
};

module.exports = {
  DEVELOPMENT_IDENTITIES,
  isDevelopmentIdentityEnabled,
  resolveDevelopmentIdentity,
};
