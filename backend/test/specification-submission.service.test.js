const assert = require("node:assert/strict");
const Module = require("node:module");
const test = require("node:test");

const servicePath = require.resolve("../src/services/specification-submission.service");

const loadService = (repository) => {
  const originalLoad = Module._load;
  const calls = [];

  Module._load = (request, parent, isMain) => {
    if (request === "../repositories/specification-submission.repository") return repository;
    if (request === "../workflow/approval/approval-routing.service") {
      return { approvalRoutingService: { buildRoute: async () => ({ steps: [] }) } };
    }
    return originalLoad(request, parent, isMain);
  };
  delete require.cache[servicePath];

  try {
    return { service: require(servicePath), calls };
  } finally {
    Module._load = originalLoad;
    delete require.cache[servicePath];
  }
};

test("submission service uses only authenticated actor and accepted comment", async () => {
  const received = [];
  const { service } = loadService({
    submit: async (input) => {
      received.push(input);
      return { specificationId: 60 };
    },
  });

  await service.submitSpecification(60, {
    comment: "  Ready  ",
    userId: "FORGED",
    materialGroup: "FORGED",
  }, {
    userId: "DEV-REQ-001",
    displayName: "Development Requestor",
  });

  assert.equal(received[0].actor.userId, "DEV-REQ-001");
  assert.equal(received[0].comment, "Ready");
  assert.equal(received[0].resubmission, false);
});

test("submission service rejects missing identity and invalid comments", async () => {
  const { service } = loadService({ submit: async () => ({}) });

  await assert.rejects(
    () => service.submitSpecification(60, {}, undefined),
    { statusCode: 401 }
  );
  await assert.rejects(
    () => service.resubmitSpecification(60, { comment: 42 }, { userId: "DEV-REQ-001" }),
    { statusCode: 422 }
  );
});
