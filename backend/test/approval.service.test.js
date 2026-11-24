const assert = require("node:assert/strict");
const Module = require("node:module");
const test = require("node:test");

const servicePath = require.resolve("../src/services/approval.service");

const loadService = (repository) => {
  const originalLoad = Module._load;
  Module._load = (request, parent, isMain) => {
    if (request === "../repositories/approval.repository") return repository;
    return originalLoad(request, parent, isMain);
  };
  delete require.cache[servicePath];
  try {
    return require(servicePath);
  } finally {
    Module._load = originalLoad;
    delete require.cache[servicePath];
  }
};

const actor = {
  userId: "DEV-MGR-001",
  displayName: "Development Manager",
  roles: ["Manager"],
  plantIds: [7201],
  departmentIds: [7301],
};

test("approval service requires a comment for Return and Reject", async () => {
  const service = loadService({ decide: async () => ({}) });
  assert.throws(() => service.returnForRevision(60, {}, actor), { statusCode: 422 });
  assert.throws(() => service.reject(60, { comment: "  " }, actor), { statusCode: 422 });
});

test("approval service accepts an optional approval comment and trusted actor only", async () => {
  const received = [];
  const service = loadService({
    decide: async (input) => {
      received.push(input);
      return {};
    },
  });
  await service.approve(60, { comment: " Approved ", actorUserId: "FORGED" }, actor);
  assert.equal(received[0].actor.userId, "DEV-MGR-001");
  assert.equal(received[0].comment, "Approved");
});
