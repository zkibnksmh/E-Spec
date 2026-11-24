const assert = require("node:assert/strict");
const Module = require("node:module");
const test = require("node:test");

const repositoryPath = require.resolve("../src/repositories/specification.repository");
const servicePath = require.resolve("../src/services/specification.service");

const baseFormData = {
  plant: "10",
  requestor: "Requestor",
  department: "20",
  materialCategory: "30",
};

const createPayload = (overrides = {}) => ({
  specificationTypeId: 1,
  documentNo: "E-SPEC-OWNERSHIP",
  formData: {
    ...baseFormData,
    materialGroup: "BEARING",
    reasonChoice: "50",
    materialDescription: "Bearing test",
    partNumber: "PN-1",
    variant: "V1",
    dimension: "D1",
    brand: "Brand",
    uom: "EA",
    drawingImage: "image",
    additionalService: "None",
  },
  attributeValues: {},
  creatorUserId: "DEV-REQ-001",
  creatorDisplayName: "Development Requestor",
  ...overrides,
});

const loadRepository = (existing = null) => {
  const originalLoad = Module._load;
  const calls = [];
  let released = false;
  let connected = false;

  const client = {
    query: async (sql, values = []) => {
      calls.push({ sql, values });

      if (/^(BEGIN|COMMIT|ROLLBACK)$/.test(sql)) return { rows: [] };
      if (/FOR UPDATE/.test(sql)) return { rows: [existing].filter(Boolean) };
      if (/FROM specifications WHERE id = \$1/.test(sql)) return { rows: [existing].filter(Boolean) };
      if (/FROM specification_types/.test(sql)) return { rows: [{ id: 1, typecode: "BRG" }] };
      if (/FROM plants/.test(sql)) return { rows: [{ id: 10 }] };
      if (/FROM departments/.test(sql)) return { rows: [{ id: 20 }] };
      if (/FROM material_categories/.test(sql)) {
        return { rows: [{ id: 30, categoryname: "Test Barang", specificationtypeid: 1 }] };
      }
      if (/FROM material_groups/.test(sql)) {
        return { rows: [{ id: 40, sapgroupcode: "BEARING", materialcategoryid: 30 }] };
      }
      if (/FROM reason_to_procure_options/.test(sql)) return { rows: [{ id: 50 }] };
      if (/FROM specification_attributes/.test(sql)) return { rows: [] };
      if (/INSERT INTO specifications/.test(sql)) {
        return { rows: [{ id: 60, specification_type_id: 1, status: "Draft" }] };
      }
      if (/UPDATE specifications/.test(sql)) {
        return { rows: [{ id: 60, specification_type_id: 1, status: "Draft" }] };
      }
      if (/INSERT INTO specification_values/.test(sql)) return { rows: [] };
      if (/DELETE FROM specification_values/.test(sql)) return { rows: [] };

      throw new Error(`Unexpected test query: ${sql}`);
    },
    release: () => {
      released = true;
    },
  };

  const pool = {
    connect: async () => {
      connected = true;
      return client;
    },
    query: async (sql, values = []) => {
      calls.push({ sql, values });

      if (/FROM specifications WHERE id = \$1/.test(sql)) {
        return { rows: [existing].filter(Boolean) };
      }

      throw new Error(`Unexpected pool query: ${sql}`);
    },
  };

  Module._load = (request, parent, isMain) => {
    if (request === "../config/database") return pool;
    return originalLoad(request, parent, isMain);
  };
  delete require.cache[repositoryPath];

  try {
    return {
      repository: require(repositoryPath),
      calls,
      wasReleased: () => released,
      wasConnected: () => connected,
    };
  } finally {
    Module._load = originalLoad;
    delete require.cache[repositoryPath];
  }
};

const loadService = (repositoryMock) => {
  const originalLoad = Module._load;

  Module._load = (request, parent, isMain) => {
    if (request === "../repositories/specification.repository") return repositoryMock;
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

test("createDraft persists the trusted creator identity", async () => {
  const { repository, calls } = loadRepository();

  await repository.createDraft(createPayload());

  const insert = calls.find(({ sql }) => /INSERT INTO specifications/.test(sql));
  assert.match(insert.sql, /createdbyuserid/);
  assert.match(insert.sql, /createdby/);
  assert.equal(insert.values[11], "DEV-REQ-001");
  assert.equal(insert.values[12], "Development Requestor");
});

test("createDraft fails closed without a creator identity", async () => {
  const { repository, wasConnected } = loadRepository();

  await assert.rejects(
    () => repository.createDraft(createPayload({ creatorUserId: undefined })),
    { statusCode: 401 }
  );
  assert.equal(wasConnected(), false);
});

test("client-supplied creator fields cannot override the trusted creator", async () => {
  const { repository, calls } = loadRepository();

  await repository.createDraft(createPayload({
    createdbyuserid: "CLIENT-USER",
    createdby: "Client User",
  }));

  const insert = calls.find(({ sql }) => /INSERT INTO specifications/.test(sql));
  assert.equal(insert.values[11], "DEV-REQ-001");
  assert.equal(insert.values[12], "Development Requestor");
  assert.equal(insert.values.includes("CLIENT-USER"), false);
});

test("updateDraft allows the exact owner and records the updater identity", async () => {
  const { repository, calls } = loadRepository({
    id: 60,
    specificationtypeid: 1,
    status: "Draft",
    createdbyuserid: "DEV-REQ-001",
  });

  await repository.updateDraft(60, createPayload(), {
    userId: "DEV-REQ-001",
    displayName: "Development Requestor",
  });

  const update = calls.find(({ sql }) => /UPDATE specifications/.test(sql));
  assert.match(update.sql, /updatedbyuserid = \$11/);
  assert.match(update.sql, /updatedby = \$12/);
  assert.equal(update.values[10], "DEV-REQ-001");
  assert.equal(update.values[11], "Development Requestor");
  assert.doesNotMatch(update.sql, /documentno/);
});

test("updateDraft rejects a different user", async () => {
  const { repository, calls } = loadRepository({
    id: 60,
    specificationtypeid: 1,
    status: "Draft",
    createdbyuserid: "DEV-REQ-001",
  });

  await assert.rejects(
    () => repository.updateDraft(60, createPayload(), {
      userId: "DEV-REQ-999",
      displayName: "Other Requestor",
    }),
    { statusCode: 403 }
  );
  assert.equal(calls.some(({ sql }) => /UPDATE specifications/.test(sql)), false);
});

test("updateDraft rejects a legacy draft without a creator identity", async () => {
  const { repository, calls } = loadRepository({
    id: 60,
    specificationtypeid: 1,
    status: "Draft",
    createdbyuserid: null,
  });

  await assert.rejects(
    () => repository.updateDraft(60, createPayload(), {
      userId: "DEV-REQ-001",
      displayName: "Development Requestor",
    }),
    { statusCode: 403 }
  );
  assert.equal(calls.some(({ sql }) => /UPDATE specifications/.test(sql)), false);
});

test("updateDraft preserves the non-Draft conflict behavior", async () => {
  const { repository } = loadRepository({
    id: 60,
    specificationtypeid: 1,
    status: "In Approval",
    createdbyuserid: "DEV-REQ-001",
  });

  await assert.rejects(
    () => repository.updateDraft(60, createPayload(), {
      userId: "DEV-REQ-001",
      displayName: "Development Requestor",
    }),
    { statusCode: 409 }
  );
});

test("updateDraft allows the exact owner to edit Revision Required", async () => {
  const { repository, calls } = loadRepository({
    id: 60,
    specificationtypeid: 1,
    status: "Revision Required",
    createdbyuserid: "DEV-REQ-001",
  });

  await repository.updateDraft(60, createPayload(), {
    userId: "DEV-REQ-001",
    displayName: "Development Requestor",
  });

  assert.equal(calls.some(({ sql }) => /UPDATE specifications/.test(sql)), true);
});

test("updateDraft fails closed without an actor identity", async () => {
  const { repository, wasConnected } = loadRepository({
    id: 60,
    specificationtypeid: 1,
    status: "Draft",
    createdbyuserid: "DEV-REQ-001",
  });

  await assert.rejects(
    () => repository.updateDraft(60, createPayload(), undefined),
    { statusCode: 401 }
  );
  assert.equal(wasConnected(), false);
});

test("service passes the authenticated actor to draft creation", async () => {
  const received = [];
  const service = loadService({
    createDraft: async (payload) => {
      received.push(payload);
      return { id: 60, specification_type_id: 1, status: "Draft" };
    },
  });

  await service.createSpecificationDraft(createPayload(), {
    userId: "DEV-REQ-001",
    displayName: "Development Requestor",
  });

  assert.equal(received[0].creatorUserId, "DEV-REQ-001");
  assert.equal(received[0].creatorDisplayName, "Development Requestor");
});

test("service fails closed without an authenticated actor", async () => {
  const service = loadService({
    createDraft: async () => {
      throw new Error("should not be called");
    },
  });

  await assert.rejects(
    () => service.createSpecificationDraft(createPayload(), undefined),
    { statusCode: 401 }
  );
});

test("service passes the authenticated actor to draft update", async () => {
  const received = [];
  const service = loadService({
    findEditableById: async () => ({
      id: 60,
      specificationtypeid: 1,
      status: "Draft",
      createdbyuserid: "DEV-REQ-001",
    }),
    updateDraft: async (id, payload, actor) => {
      received.push({ id, payload, actor });
      return { id, specification_type_id: 1, status: "Draft" };
    },
  });

  await service.updateSpecificationDraft(60, createPayload(), {
    userId: "DEV-REQ-001",
    displayName: "Development Requestor",
  });

  assert.equal(received[0].actor.userId, "DEV-REQ-001");
  assert.equal(received[0].actor.displayName, "Development Requestor");
});

test("service rejects a non-owner before calling the repository update", async () => {
  let updateCalled = false;
  const service = loadService({
    findEditableById: async () => ({
      id: 60,
      specificationtypeid: 1,
      status: "Draft",
      createdbyuserid: "DEV-REQ-001",
    }),
    updateDraft: async () => {
      updateCalled = true;
      return {};
    },
  });

  await assert.rejects(
    () => service.updateSpecificationDraft(60, createPayload(), {
      userId: "DEV-REQ-999",
      displayName: "Other Requestor",
    }),
    { statusCode: 403 }
  );
  assert.equal(updateCalled, false);
});

test("service rejects a legacy draft without a creator identity", async () => {
  const service = loadService({
    findEditableById: async () => ({
      id: 60,
      specificationtypeid: 1,
      status: "Draft",
      createdbyuserid: null,
    }),
    updateDraft: async () => {
      throw new Error("should not be called");
    },
  });

  await assert.rejects(
    () => service.updateSpecificationDraft(60, createPayload(), {
      userId: "DEV-REQ-001",
      displayName: "Development Requestor",
    }),
    { statusCode: 403 }
  );
});

test("service allows the exact owner to edit Revision Required", async () => {
  let updateCalled = false;
  const service = loadService({
    findEditableById: async () => ({
      id: 60,
      specificationtypeid: 1,
      status: "Revision Required",
      createdbyuserid: "DEV-REQ-001",
    }),
    updateDraft: async () => {
      updateCalled = true;
      return { id: 60, status: "Revision Required" };
    },
  });

  await service.updateSpecificationDraft(60, createPayload(), {
    userId: "DEV-REQ-001",
    displayName: "Development Requestor",
  });

  assert.equal(updateCalled, true);
});

test("service ignores client-supplied creator and updater fields", async () => {
  const received = [];
  const service = loadService({
    createDraft: async (payload) => {
      received.push(payload);
      return { id: 60, specification_type_id: 1, status: "Draft" };
    },
    findEditableById: async () => ({
      id: 60,
      specificationtypeid: 1,
      status: "Draft",
      createdbyuserid: "DEV-REQ-001",
    }),
    updateDraft: async (id, payload, actor) => {
      received.push({ payload, actor });
      return { id, specification_type_id: 1, status: "Draft" };
    },
  });

  const forged = createPayload({
    createdbyuserid: "CLIENT-USER",
    updatedbyuserid: "CLIENT-USER",
    createdby: "Client User",
    updatedby: "Client User",
  });

  await service.createSpecificationDraft(forged, {
    userId: "DEV-REQ-001",
    displayName: "Development Requestor",
  });
  await service.updateSpecificationDraft(60, forged, {
    userId: "DEV-REQ-001",
    displayName: "Development Requestor",
  });

  assert.equal(received[0].creatorUserId, "DEV-REQ-001");
  assert.equal(received[1].actor.userId, "DEV-REQ-001");
  assert.equal(Object.hasOwn(received[1].payload, "updatedbyuserid"), false);
  assert.equal(Object.hasOwn(received[1].payload, "createdbyuserid"), false);
});
