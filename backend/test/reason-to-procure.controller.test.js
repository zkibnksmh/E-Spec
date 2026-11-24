const assert = require("node:assert/strict");
const Module = require("node:module");
const test = require("node:test");

const controllerPath = require.resolve("../src/controllers/reason-to-procure.controller");

const loadController = (service) => {
  const originalLoad = Module._load;
  delete require.cache[controllerPath];

  Module._load = (request, parent, isMain) => {
    if (request === "../services/reason-to-procure.service") {
      return service;
    }

    return originalLoad(request, parent, isMain);
  };

  try {
    return require(controllerPath);
  } finally {
    Module._load = originalLoad;
    delete require.cache[controllerPath];
  }
};

const response = () => {
  const result = {};
  result.status = (statusCode) => {
    result.statusCode = statusCode;
    return result;
  };
  result.json = (body) => {
    result.body = body;
    return result;
  };
  return result;
};

test("returns only Barang reasons for specification type 7101", async () => {
  const reasons = [{ id: "7701", specificationtypeid: 7101, optionname: "Barang reason", isactive: true }];
  const calls = [];
  const controller = loadController({
    getReasonToProcureBySpecificationTypeId: async (id) => {
      calls.push(id);
      return reasons;
    },
  });
  const res = response();

  await controller.getReasonToProcureBySpecificationTypeId(
    { params: { specificationTypeId: "7101" } },
    res,
    assert.fail
  );

  assert.deepEqual(calls, ["7101"]);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.data, reasons);
  assert.equal(res.body.data.every((reason) => reason.specificationtypeid === 7101), true);
});

test("returns only Jasa reasons for specification type 7102", async () => {
  const reasons = [{ id: "7702", specificationtypeid: 7102, optionname: "Jasa reason", isactive: true }];
  const controller = loadController({
    getReasonToProcureBySpecificationTypeId: async () => reasons,
  });
  const res = response();

  await controller.getReasonToProcureBySpecificationTypeId(
    { params: { specificationTypeId: "7102" } },
    res,
    assert.fail
  );

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.data, reasons);
  assert.equal(res.body.data.every((reason) => reason.specificationtypeid === 7102), true);
});

test("rejects an invalid specification type ID", async () => {
  const controller = loadController({
    getReasonToProcureBySpecificationTypeId: assert.fail,
  });
  const res = response();

  await controller.getReasonToProcureBySpecificationTypeId(
    { params: { specificationTypeId: "invalid" } },
    res,
    assert.fail
  );

  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body, {
    success: false,
    message: "ID tipe spesifikasi tidak valid.",
  });
});

test("rejects a missing specification type ID", async () => {
  const controller = loadController({
    getReasonToProcureBySpecificationTypeId: assert.fail,
  });
  const res = response();

  await controller.getReasonToProcureBySpecificationTypeId(
    { params: {} },
    res,
    assert.fail
  );

  assert.equal(res.statusCode, 400);
});
