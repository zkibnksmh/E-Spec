const assert = require("node:assert/strict");
const http = require("node:http");
const Module = require("node:module");
const test = require("node:test");
const express = require("express");
const errorMiddleware = require("../src/middlewares/error.middleware");

const routesPath = require.resolve("../src/routes/specification.routes");
const controllerPath = require.resolve("../src/controllers/specification.controller");
const servicePath = require.resolve("../src/services/specification.service");
const submissionServicePath = require.resolve("../src/services/specification-submission.service");
const repositoryPath = require.resolve("../src/repositories/specification.repository");

const enabledEnvironment = {
  E_SPEC_ENV: "test",
  E_SPEC_ENABLE_DEV_IDENTITY: "true",
  NODE_ENV: "test",
};

const requestorHeaders = { "X-ESpec-Dev-Identity": "requestor" };
const managerHeaders = { "X-ESpec-Dev-Identity": "manager" };

const withEnvironment = async (environment, run) => {
  const original = {
    E_SPEC_ENV: process.env.E_SPEC_ENV,
    E_SPEC_ENABLE_DEV_IDENTITY: process.env.E_SPEC_ENABLE_DEV_IDENTITY,
    NODE_ENV: process.env.NODE_ENV,
  };

  Object.assign(process.env, environment);

  try {
    await run();
  } finally {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
};

const draftDetail = () => ({
  id: 61,
  document_no: "E-SPEC-MY-DRAFT-001",
  revision_no: 0,
  specification_type_id: 7101,
  specification_type_code: "BRG",
  specification_type_name: "Barang",
  status: "Draft",
  form_data: { plant: "10", requestor: "Requestor", docNo: "F/SCW05" },
  created_by: "Development Requestor",
  created_at: "2026-11-23T00:00:00.000Z",
  updated_at: "2026-11-23T01:00:00.000Z",
  sections: [
    {
      code: "MASTER",
      attributes: [
        { code: "MATERIAL_CATEGORY", values: [{ text: "30" }] },
        {
          code: "REQUIRED_DOCUMENTS",
          values: [{ text: "MSDS" }, { text: "COA" }],
        },
      ],
    },
  ],
});

const createRepositoryMock = () => {
  const calls = [];

  return {
    calls,
    findAll: async (filters) => {
      calls.push({ type: "findAll", filters });
      return [];
    },
    findAllMyDrafts: async (filters) => {
      calls.push({ type: "findAllMyDrafts", filters });
      return [
        {
          id: 61,
          document_no: "E-SPEC-MY-DRAFT-001",
          revision_no: 0,
          specification_type_id: 7101,
          specification_type_code: "BRG",
          specification_type_name: "Barang",
          status: "Draft",
          created_at: "2026-11-23T00:00:00.000Z",
          updated_at: "2026-11-23T01:00:00.000Z",
        },
      ];
    },
    findById: async (id) => {
      calls.push({ type: "findById", id });
      return draftDetail();
    },
    findMyDraftById: async (id, creatorUserId) => {
      calls.push({ type: "findMyDraftById", id, creatorUserId });

      if (id === 61 && creatorUserId === "DEV-REQ-001") return draftDetail();
      return null;
    },
    findEditableById: async () => ({ status: "Draft", createdbyuserid: "DEV-REQ-001" }),
    createDraft: async () => ({ id: 61 }),
    updateDraft: async () => ({ id: 61 }),
    submit: async (input) => ({ specificationId: input.specificationId }),
  };
};

const loadRoutes = (repositoryMock) => {
  const originalLoad = Module._load;

  Module._load = (request, parent, isMain) => {
    if (request === "../repositories/specification.repository") return repositoryMock;
    if (request === "../repositories/specification-submission.repository") return repositoryMock;
    return originalLoad(request, parent, isMain);
  };

  delete require.cache[routesPath];
  delete require.cache[controllerPath];
  delete require.cache[servicePath];
  delete require.cache[submissionServicePath];

  try {
    return require(routesPath);
  } finally {
    Module._load = originalLoad;
    delete require.cache[routesPath];
    delete require.cache[controllerPath];
    delete require.cache[servicePath];
    delete require.cache[submissionServicePath];
  }
};

const withServer = async (repositoryMock, run) => {
  const routes = loadRoutes(repositoryMock);
  const app = express();
  app.use(express.json());
  app.use("/api/specifications", routes);
  app.use(errorMiddleware);

  const server = await new Promise((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });

  try {
    await run(server);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
};

const request = (server, { method = "GET", path = "/api/specifications", headers = {}, body } = {}) => (
  new Promise((resolve, reject) => {
    const address = server.address();
    const payload = body === undefined ? undefined : JSON.stringify(body);
    const requestHeaders = { ...headers };

    if (payload !== undefined) {
      requestHeaders["Content-Type"] = "application/json";
      requestHeaders["Content-Length"] = Buffer.byteLength(payload);
    }

    const client = http.request({
      hostname: "127.0.0.1",
      port: address.port,
      method,
      path,
      headers: requestHeaders,
    }, (response) => {
      let text = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => { text += chunk; });
      response.on("end", () => {
        resolve({
          status: response.statusCode,
          body: text ? JSON.parse(text) : {},
        });
      });
    });

    client.on("error", reject);
    if (payload !== undefined) client.write(payload);
    client.end();
  })
);

test("GET /my-drafts returns only the authenticated Requestor's editable Drafts", async () => {
  await withEnvironment(enabledEnvironment, async () => {
    const repository = createRepositoryMock();
    await withServer(repository, async (server) => {
      const response = await request(server, {
        path: "/api/specifications/my-drafts",
        headers: requestorHeaders,
      });

      assert.equal(response.status, 200);
      assert.equal(response.body.success, true);
      assert.equal(response.body.total, 1);
      assert.equal(response.body.data[0].documentNo, "E-SPEC-MY-DRAFT-001");
      assert.equal(response.body.data[0].updatedAt, "2026-11-23T01:00:00.000Z");

      const call = repository.calls.find(({ type }) => type === "findAllMyDrafts");
      assert.equal(call.filters.creatorUserId, "DEV-REQ-001");
      assert.equal(call.filters.status, undefined);
      assert.equal(Object.hasOwn(call.filters, "userId"), false);
      assert.equal(Object.hasOwn(call.filters, "createdbyuserid"), false);
    });
  });
});

test("GET /my-drafts ignores client-supplied owner identity", async () => {
  await withEnvironment(enabledEnvironment, async () => {
    const repository = createRepositoryMock();
    await withServer(repository, async (server) => {
      const response = await request(server, {
        path: "/api/specifications/my-drafts?userId=DEV-REQ-999&createdbyuserid=DEV-REQ-999&owner=DEV-REQ-999",
        headers: requestorHeaders,
      });

      assert.equal(response.status, 200);
      const call = repository.calls.find(({ type }) => type === "findAllMyDrafts");
      assert.equal(call.filters.creatorUserId, "DEV-REQ-001");
      assert.equal(Object.keys(call.filters).sort().join(","), "creatorUserId");
    });
  });
});

test("GET /my-drafts requires an authenticated Requestor", async () => {
  await withEnvironment(enabledEnvironment, async () => {
    for (const [headers, expectedStatus] of [[{}, 401], [managerHeaders, 403]]) {
      const repository = createRepositoryMock();
      await withServer(repository, async (server) => {
        const response = await request(server, {
          path: "/api/specifications/my-drafts",
          headers,
        });

        assert.equal(response.status, expectedStatus);
        assert.equal(repository.calls.some(({ type }) => type === "findAllMyDrafts"), false);
      });
    }
  });
});

test("GET /my-drafts rejects non-editable status filters", async () => {
  await withEnvironment(enabledEnvironment, async () => {
    const repository = createRepositoryMock();
    await withServer(repository, async (server) => {
      const response = await request(server, {
        path: "/api/specifications/my-drafts?status=Approved",
        headers: requestorHeaders,
      });

      assert.equal(response.status, 400);
      assert.equal(repository.calls.some(({ type }) => type === "findAllMyDrafts"), false);
    });
  });
});

test("GET /my-drafts/:id returns complete owned Draft data", async () => {
  await withEnvironment(enabledEnvironment, async () => {
    const repository = createRepositoryMock();
    await withServer(repository, async (server) => {
      const response = await request(server, {
        path: "/api/specifications/my-drafts/61",
        headers: requestorHeaders,
      });

      assert.equal(response.status, 200);
      assert.equal(response.body.data.documentNo, "E-SPEC-MY-DRAFT-001");
      assert.deepEqual(response.body.data.formData, {
        plant: "10",
        requestor: "Requestor",
        docNo: "F/SCW05",
      });
      assert.deepEqual(response.body.data.attributeValues, {
        MATERIAL_CATEGORY: "30",
        REQUIRED_DOCUMENTS: ["MSDS", "COA"],
      });

      const call = repository.calls.find(({ type }) => type === "findMyDraftById");
      assert.equal(call.id, 61);
      assert.equal(call.creatorUserId, "DEV-REQ-001");
    });
  });
});

test("GET /my-drafts/:id hides Drafts owned by another user", async () => {
  await withEnvironment(enabledEnvironment, async () => {
    const repository = createRepositoryMock();
    await withServer(repository, async (server) => {
      const response = await request(server, {
        path: "/api/specifications/my-drafts/62",
        headers: requestorHeaders,
      });

      assert.equal(response.status, 404);
      assert.equal(response.body.success, false);
      const call = repository.calls.find(({ type }) => type === "findMyDraftById");
      assert.equal(call.id, 62);
      assert.equal(call.creatorUserId, "DEV-REQ-001");
    });
  });
});

test("GET /my-drafts/:id validates the id", async () => {
  await withEnvironment(enabledEnvironment, async () => {
    const repository = createRepositoryMock();
    await withServer(repository, async (server) => {
      const response = await request(server, {
        path: "/api/specifications/my-drafts/abc",
        headers: requestorHeaders,
      });

      assert.equal(response.status, 400);
      assert.equal(repository.calls.some(({ type }) => type === "findMyDraftById"), false);
    });
  });
});

const loadRepository = () => {
  const originalLoad = Module._load;
  const calls = [];

  const pool = {
    query: async (sql, values = []) => {
      calls.push({ sql, values });

      if (/s\.createdbyuserid = \$1/.test(sql) && /s\.status IN \(\$2, \$3\)/.test(sql)) {
        return { rows: [] };
      }

      if (/COALESCE\(values_by_section\.sections/.test(sql)) {
        return { rows: [draftDetail()] };
      }

      throw new Error(`Unexpected test query: ${sql}`);
    },
  };

  Module._load = (request, parent, isMain) => {
    if (request === "../config/database") return pool;
    return originalLoad(request, parent, isMain);
  };
  delete require.cache[repositoryPath];

  try {
    return { repository: require(repositoryPath), calls };
  } finally {
    Module._load = originalLoad;
    delete require.cache[repositoryPath];
  }
};

test("findAllMyDrafts filters by trusted creator and editable statuses in SQL", async () => {
  const { repository, calls } = loadRepository();

  const rows = await repository.findAllMyDrafts({ creatorUserId: "DEV-REQ-001" });

  assert.deepEqual(rows, []);
  const call = calls[0];
  assert.match(call.sql, /s\.createdbyuserid = \$1/);
  assert.match(call.sql, /s\.status IN \(\$2, \$3\)/);
  assert.deepEqual(call.values, ["DEV-REQ-001", "Draft", "Revision Required"]);
});

test("findMyDraftById applies owner and editable-status predicates in SQL", async () => {
  const { repository, calls } = loadRepository();

  const row = await repository.findMyDraftById(61, "DEV-REQ-001");

  assert.equal(row.id, 61);
  const call = calls[0];
  assert.match(call.sql, /s\.id = \$1/);
  assert.match(call.sql, /s\.createdbyuserid = \$2/);
  assert.match(call.sql, /s\.status IN \(\$3, \$4\)/);
  assert.deepEqual(call.values, [61, "DEV-REQ-001", "Draft", "Revision Required"]);
});

test("findById remains unscoped for existing read APIs", async () => {
  const { repository, calls } = loadRepository();

  await repository.findById(61);

  const call = calls[0];
  assert.doesNotMatch(call.sql, /createdbyuserid =/);
  assert.doesNotMatch(call.sql, /status IN/);
  assert.deepEqual(call.values, [61]);
});
