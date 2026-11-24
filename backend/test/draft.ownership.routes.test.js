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

const baseFormData = {
  plant: "10",
  requestor: "Requestor",
  department: "20",
  materialCategory: "30",
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
};

const draftPayload = (overrides = {}) => ({
  specificationTypeId: 1,
  documentNo: "E-SPEC-ROUTE-OWNERSHIP",
  formData: { ...baseFormData },
  attributeValues: {},
  ...overrides,
});

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

const createRepositoryMock = (overrides = {}) => {
  const calls = [];

  return {
    calls,
    findAll: async (filters) => {
      calls.push({ type: "findAll", filters });
      return [];
    },
    findById: async (id) => {
      calls.push({ type: "findById", id });
      return {
        id,
        document_no: "E-SPEC-ROUTE-OWNERSHIP",
        status: "Draft",
      };
    },
    findEditableById: async (id) => {
      calls.push({ type: "findEditableById", id });
      return {
        id,
        specificationtypeid: 1,
        status: "Draft",
        createdbyuserid: "DEV-REQ-001",
        ...overrides.existing,
      };
    },
    createDraft: async (payload) => {
      calls.push({ type: "createDraft", payload });
      return { id: 60, specification_type_id: 1, status: "Draft" };
    },
    updateDraft: async (id, payload, actor) => {
      calls.push({ type: "updateDraft", id, payload, actor });
      return { id, specification_type_id: 1, status: "Draft" };
    },
    submit: async (input) => {
      calls.push({ type: "submit", input });
      return {
        specificationId: input.specificationId,
        status: "In Approval",
        cycle: { id: 70, cycleNo: input.resubmission ? 2 : 1, status: "Active" },
        approvalSteps: [],
      };
    },
  };
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

const enabledEnvironment = {
  E_SPEC_ENV: "test",
  E_SPEC_ENABLE_DEV_IDENTITY: "true",
  NODE_ENV: "test",
};

const requestorHeaders = { "X-ESpec-Dev-Identity": "requestor" };
const managerHeaders = { "X-ESpec-Dev-Identity": "manager" };
const headEngineeringHeaders = { "X-ESpec-Dev-Identity": "head-engineering" };

test("POST requires an authenticated identity", async () => {
  await withEnvironment(enabledEnvironment, async () => {
    const repository = createRepositoryMock();
    await withServer(repository, async (server) => {
      const response = await request(server, {
        method: "POST",
        body: draftPayload(),
      });

      assert.equal(response.status, 401);
      assert.equal(repository.calls.some((call) => call.type === "createDraft"), false);
    });
  });
});

test("POST rejects Manager and HeadEngineering principals", async () => {
  await withEnvironment(enabledEnvironment, async () => {
    for (const headers of [managerHeaders, headEngineeringHeaders]) {
      const repository = createRepositoryMock();
      await withServer(repository, async (server) => {
        const response = await request(server, {
          method: "POST",
          headers,
          body: draftPayload(),
        });

        assert.equal(response.status, 403);
        assert.equal(repository.calls.some((call) => call.type === "createDraft"), false);
      });
    }
  });
});

test("POST persists creator identity from req.user and ignores forged fields", async () => {
  await withEnvironment(enabledEnvironment, async () => {
    const repository = createRepositoryMock();
    await withServer(repository, async (server) => {
      const response = await request(server, {
        method: "POST",
        headers: requestorHeaders,
        body: draftPayload({
          createdbyuserid: "CLIENT-USER",
          createdby: "Client User",
        }),
      });

      assert.equal(response.status, 201);
      const created = repository.calls.find((call) => call.type === "createDraft");
      assert.equal(created.payload.creatorUserId, "DEV-REQ-001");
      assert.equal(created.payload.creatorDisplayName, "Development Requestor");
    });
  });
});

test("PUT requires an authenticated identity", async () => {
  await withEnvironment(enabledEnvironment, async () => {
    const repository = createRepositoryMock();
    await withServer(repository, async (server) => {
      const response = await request(server, {
        method: "PUT",
        path: "/api/specifications/60",
        body: draftPayload(),
      });

      assert.equal(response.status, 401);
      assert.equal(repository.calls.some((call) => call.type === "updateDraft"), false);
    });
  });
});

test("PUT rejects Manager and HeadEngineering principals", async () => {
  await withEnvironment(enabledEnvironment, async () => {
    for (const headers of [managerHeaders, headEngineeringHeaders]) {
      const repository = createRepositoryMock();
      await withServer(repository, async (server) => {
        const response = await request(server, {
          method: "PUT",
          path: "/api/specifications/60",
          headers,
          body: draftPayload(),
        });

        assert.equal(response.status, 403);
        assert.equal(repository.calls.some((call) => call.type === "updateDraft"), false);
      });
    }
  });
});

test("PUT allows the exact owner and records the authenticated updater", async () => {
  await withEnvironment(enabledEnvironment, async () => {
    const repository = createRepositoryMock();
    await withServer(repository, async (server) => {
      const response = await request(server, {
        method: "PUT",
        path: "/api/specifications/60",
        headers: requestorHeaders,
        body: draftPayload({
          updatedbyuserid: "CLIENT-USER",
          updatedby: "Client User",
        }),
      });

      assert.equal(response.status, 200);
      const updated = repository.calls.find((call) => call.type === "updateDraft");
      assert.equal(updated.actor.userId, "DEV-REQ-001");
      assert.equal(updated.actor.displayName, "Development Requestor");
    });
  });
});

test("PUT rejects a different owner", async () => {
  await withEnvironment(enabledEnvironment, async () => {
    const repository = createRepositoryMock({
      existing: { createdbyuserid: "DEV-REQ-999" },
    });
    await withServer(repository, async (server) => {
      const response = await request(server, {
        method: "PUT",
        path: "/api/specifications/60",
        headers: requestorHeaders,
        body: draftPayload(),
      });

      assert.equal(response.status, 403);
      assert.equal(repository.calls.some((call) => call.type === "updateDraft"), false);
    });
  });
});

test("PUT rejects a legacy draft without creator identity", async () => {
  await withEnvironment(enabledEnvironment, async () => {
    const repository = createRepositoryMock({
      existing: { createdbyuserid: null },
    });
    await withServer(repository, async (server) => {
      const response = await request(server, {
        method: "PUT",
        path: "/api/specifications/60",
        headers: requestorHeaders,
        body: draftPayload(),
      });

      assert.equal(response.status, 403);
      assert.equal(repository.calls.some((call) => call.type === "updateDraft"), false);
    });
  });
});

test("PUT preserves the non-Draft conflict response", async () => {
  await withEnvironment(enabledEnvironment, async () => {
    const repository = createRepositoryMock({
      existing: { status: "In Approval" },
    });
    await withServer(repository, async (server) => {
      const response = await request(server, {
        method: "PUT",
        path: "/api/specifications/60",
        headers: requestorHeaders,
        body: draftPayload(),
      });

      assert.equal(response.status, 409);
    });
  });
});

test("PUT allows the exact owner to edit Revision Required", async () => {
  await withEnvironment(enabledEnvironment, async () => {
    const repository = createRepositoryMock({
      existing: { status: "Revision Required" },
    });
    await withServer(repository, async (server) => {
      const response = await request(server, {
        method: "PUT",
        path: "/api/specifications/60",
        headers: requestorHeaders,
        body: draftPayload(),
      });

      assert.equal(response.status, 200);
      assert.equal(repository.calls.some((call) => call.type === "updateDraft"), true);
    });
  });
});

test("submission endpoints require Requestor identity and pass only req.user to the service", async () => {
  await withEnvironment(enabledEnvironment, async () => {
    const repository = createRepositoryMock();
    await withServer(repository, async (server) => {
      const unauthenticated = await request(server, {
        method: "POST",
        path: "/api/specifications/60/submit",
        body: { comment: "Submit" },
      });
      const manager = await request(server, {
        method: "POST",
        path: "/api/specifications/60/submit",
        headers: managerHeaders,
        body: { comment: "Submit" },
      });
      const response = await request(server, {
        method: "POST",
        path: "/api/specifications/60/submit",
        headers: requestorHeaders,
        body: { comment: "Submit", userId: "FORGED", materialGroup: "FORGED" },
      });

      assert.equal(unauthenticated.status, 401);
      assert.equal(manager.status, 403);
      assert.equal(response.status, 200);
      const submitted = repository.calls.find((call) => call.type === "submit");
      assert.equal(submitted.input.actor.userId, "DEV-REQ-001");
      assert.equal(submitted.input.comment, "Submit");
      assert.equal(submitted.input.resubmission, false);
    });
  });
});

test("resubmission endpoint uses the protected Requestor workflow", async () => {
  await withEnvironment(enabledEnvironment, async () => {
    const repository = createRepositoryMock();
    await withServer(repository, async (server) => {
      const response = await request(server, {
        method: "POST",
        path: "/api/specifications/60/resubmit",
        headers: requestorHeaders,
        body: { comment: "Revisions completed" },
      });

      assert.equal(response.status, 200);
      const submitted = repository.calls.find((call) => call.type === "submit");
      assert.equal(submitted.input.resubmission, true);
      assert.equal(response.body.data.cycle.cycleNo, 2);
    });
  });
});

test("GET endpoints remain unauthenticated and ignore client userId filters", async () => {
  await withEnvironment(enabledEnvironment, async () => {
    const repository = createRepositoryMock();
    await withServer(repository, async (server) => {
      const list = await request(server, {
        path: "/api/specifications?userId=DEV-MGR-001&status=Draft",
      });
      const detail = await request(server, {
        path: "/api/specifications/60",
      });

      assert.equal(list.status, 200);
      assert.equal(detail.status, 200);

      const findAll = repository.calls.find((call) => call.type === "findAll");
      assert.deepEqual(findAll.filters, { status: "Draft" });
      assert.equal(Object.hasOwn(findAll.filters, "userId"), false);
    });
  });
});
