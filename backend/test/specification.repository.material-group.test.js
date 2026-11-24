const assert = require("node:assert/strict");
const Module = require("node:module");
const test = require("node:test");

const repositoryPath = require.resolve("../src/repositories/specification.repository");

const baseFormData = {
  plant: "10",
  requestor: "Requestor",
  department: "20",
  materialCategory: "30",
};

const loadRepository = ({ type, category, group, reason = { id: 50 }, attributes = [], existing = null }) => {
  const originalLoad = Module._load;
  const calls = [];
  let released = false;

  const client = {
    query: async (sql, values = []) => {
      calls.push({ sql, values });

      if (/^(BEGIN|COMMIT|ROLLBACK)$/.test(sql)) return { rows: [] };
      if (/FROM specifications WHERE id = \$1 FOR UPDATE/.test(sql)) {
        return { rows: [existing || { specificationtypeid: type.id, status: "Draft" }] };
      }
      if (/FROM specifications WHERE id = \$1/.test(sql)) {
        return { rows: [existing || { id: 60, specificationtypeid: type.id, status: "Draft" }] };
      }
      if (/FROM specification_types/.test(sql)) return { rows: type ? [type] : [] };
      if (/FROM plants/.test(sql)) return { rows: [{ id: 10 }] };
      if (/FROM departments/.test(sql)) return { rows: [{ id: 20 }] };
      if (/FROM material_categories/.test(sql)) return { rows: category ? [category] : [] };
      if (/FROM material_groups/.test(sql)) return { rows: group ? [group] : [] };
      if (/FROM reason_to_procure_options/.test(sql)) return { rows: reason ? [reason] : [] };
      if (/FROM specification_attributes/.test(sql)) return { rows: attributes };
      if (/INSERT INTO specifications/.test(sql)) {
        return { rows: [{ id: 60, specification_type_id: type.id, status: "Draft" }] };
      }
      if (/UPDATE specifications/.test(sql)) {
        return { rows: [{ id: 60, specification_type_id: type.id, status: "Draft" }] };
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
    connect: async () => client,
    query: async () => {
      throw new Error("Pool query is not expected in createDraft tests.");
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
    };
  } finally {
    Module._load = originalLoad;
    delete require.cache[repositoryPath];
  }
};

const createPayload = (formData, attributeValues = {}) => ({
  specificationTypeId: 1,
  documentNo: "E-SPEC-TEST",
  formData,
  attributeValues,
  creatorUserId: "DEV-REQ-001",
  creatorDisplayName: "Development Requestor",
});

const barangFormData = (materialGroup) => ({
  ...baseFormData,
  materialGroup,
  reasonChoice: "50",
  materialDescription: "Bearing test",
  partNumber: "PN-1",
  variant: "V1",
  dimension: "D1",
  brand: "Brand",
  uom: "EA",
  drawingImage: "image",
  additionalService: "None",
});

const barangMasterData = (group = { id: 40, sapgroupcode: "BEARING", materialcategoryid: 30 }) => ({
  type: { id: 1, typecode: "BRG" },
  category: { id: 30, categoryname: "Test Barang", specificationtypeid: 1 },
  group,
});

test("Barang BEARING code resolves to its database ID and business validation keeps the code", async () => {
  const { repository, calls, wasReleased } = loadRepository(barangMasterData());

  const draft = await repository.createDraft(createPayload(barangFormData("BEARING")));
  const groupCall = calls.find(({ sql }) => /FROM material_groups/.test(sql));
  const insertCall = calls.find(({ sql }) => /INSERT INTO specifications/.test(sql));

  assert.equal(draft.id, 60);
  assert.match(groupCall.sql, /sapgroupcode = \$1/);
  assert.deepEqual(groupCall.values, ["BEARING"]);
  assert.equal(insertCall.values[5], 40);
  assert.ok(calls.some(({ sql }) => sql === "COMMIT"));
  assert.ok(wasReleased());
});

test("POST inserts the supplied document number", async () => {
  const { repository, calls } = loadRepository(barangMasterData());
  const payload = createPayload(barangFormData("BEARING"));
  payload.documentNo = "DRAFT-POST-1";

  await repository.createDraft(payload);

  const insertCall = calls.find(({ sql }) => /INSERT INTO specifications/.test(sql));
  assert.equal(insertCall.values[0], "DRAFT-POST-1");
});

test("PUT preserves the stored document number despite changed client values", async () => {
  const { repository, calls } = loadRepository({
    ...barangMasterData(),
    existing: {
      id: 60,
      specificationtypeid: 1,
      status: "Draft",
      createdbyuserid: "DEV-REQ-001",
    },
  });
  const firstUpdate = createPayload(barangFormData("BEARING"));
  firstUpdate.documentNo = "DRAFT-CHANGED-1";
  const secondUpdate = createPayload(barangFormData("BEARING"));
  secondUpdate.documentNo = "DRAFT-CHANGED-2";
  const actor = { userId: "DEV-REQ-001", displayName: "Development Requestor" };

  await repository.updateDraft(60, firstUpdate, actor);
  await repository.updateDraft(60, secondUpdate, actor);

  const updateCalls = calls.filter(({ sql }) => /UPDATE specifications/.test(sql));
  assert.equal(updateCalls.length, 2);
  updateCalls.forEach(({ sql, values }) => {
    assert.doesNotMatch(sql, /documentno/);
    assert.equal(values.includes("DRAFT-CHANGED-1") || values.includes("DRAFT-CHANGED-2"), false);
  });
});

test("scalar Material Category ID is bound to PostgreSQL as a scalar", async () => {
  const { repository, calls } = loadRepository(barangMasterData());

  await repository.createDraft(createPayload(barangFormData("BEARING")));

  const categoryCall = calls.find(({ sql }) => /FROM material_categories/.test(sql));
  assert.deepEqual(categoryCall.values, ["30"]);
});

test("single-element Material Category array is normalized to a scalar", async () => {
  const { repository, calls } = loadRepository({
    ...barangMasterData(),
    attributes: [{ id: 70, attributecode: "MATERIAL_CATEGORY", supportsmultiplevalues: false }],
  });

  await repository.createDraft(createPayload({
    ...barangFormData("BEARING"),
    materialCategory: ["30"],
  }, { MATERIAL_CATEGORY: "30" }));

  const categoryCall = calls.find(({ sql }) => /FROM material_categories/.test(sql));
  assert.deepEqual(categoryCall.values, ["30"]);
});

test("Material Category attribute value takes precedence over legacy form data", async () => {
  const { repository, calls } = loadRepository({
    ...barangMasterData(),
    attributes: [{ id: 70, attributecode: "MATERIAL_CATEGORY", supportsmultiplevalues: false }],
  });

  await repository.createDraft(createPayload({
    ...barangFormData("BEARING"),
    materialCategory: ["999"],
  }, { MATERIAL_CATEGORY: "30" }));

  const categoryCall = calls.find(({ sql }) => /FROM material_categories/.test(sql));
  assert.deepEqual(categoryCall.values, ["30"]);
});

test("missing Material Category is rejected before PostgreSQL lookup", async () => {
  const { repository, calls } = loadRepository(barangMasterData());

  await assert.rejects(
    () => repository.createDraft(createPayload({
      ...barangFormData("BEARING"),
      materialCategory: [],
    })),
    /Material Category wajib diisi/
  );

  assert.equal(calls.some(({ sql }) => /FROM material_categories/.test(sql)), false);
});

test("multiple Material Category IDs are rejected", async () => {
  const { repository, calls } = loadRepository(barangMasterData());

  await assert.rejects(
    () => repository.createDraft(createPayload({
      ...barangFormData("BEARING"),
      materialCategory: ["30", "31"],
    })),
    /Pilih tepat satu Material Category/
  );

  assert.equal(calls.some(({ sql }) => /FROM material_categories/.test(sql)), false);
});

test("invalid and inactive Barang group codes are rejected and rolled back", async () => {
  for (const group of [null, null]) {
    const { repository, calls, wasReleased } = loadRepository(barangMasterData(group));

    await assert.rejects(
      () => repository.createDraft(createPayload(barangFormData("UNKNOWN"))),
      /materialGroup tidak aktif atau tidak ditemukan/
    );

    assert.ok(calls.some(({ sql }) => sql === "ROLLBACK"));
    assert.ok(wasReleased());
  }
});

test("wrong-category Barang group is rejected and rolled back", async () => {
  const { repository, calls } = loadRepository(barangMasterData({
    id: 40,
    sapgroupcode: "BEARING",
    materialcategoryid: 99,
  }));

  await assert.rejects(
    () => repository.createDraft(createPayload(barangFormData("BEARING"))),
    /Material Group tidak sesuai dengan Material Category/
  );

  assert.ok(calls.some(({ sql }) => sql === "ROLLBACK"));
});

test("legacy numeric Barang material-group IDs remain supported", async () => {
  const { repository, calls } = loadRepository(barangMasterData());

  await repository.createDraft(createPayload(barangFormData("40")));

  const groupCall = calls.find(({ sql }) => /FROM material_groups/.test(sql));
  assert.match(groupCall.sql, /id = \$1/);
  assert.deepEqual(groupCall.values, ["40"]);
});

test("Jasa numeric SERVICE mapping remains ID-based", async () => {
  const { repository, calls } = loadRepository({
    type: { id: 2, typecode: "JASA" },
    category: { id: 31, categoryname: "OPEX - JASA", specificationtypeid: 2 },
    group: { id: 41, sapgroupcode: "SERVICE", materialcategoryid: 31 },
  });
  const payload = createPayload({
    ...baseFormData,
    materialCategory: "31",
    materialGroup: "41",
    reasonChoice: "50",
    projectName: "Project",
    projectDescription: "Description",
    timeline: "2026",
    attachmentDocuments: [],
  });
  payload.specificationTypeId = 2;

  await repository.createDraft(payload);

  const groupCall = calls.find(({ sql }) => /FROM material_groups/.test(sql));
  const insertCall = calls.find(({ sql }) => /INSERT INTO specifications/.test(sql));
  assert.match(groupCall.sql, /id = \$1/);
  assert.deepEqual(groupCall.values, ["41"]);
  assert.equal(insertCall.values[5], 41);
});

test("supported normalized attributes persist while unsupported codes are rejected", async () => {
  const { repository, calls } = loadRepository({
    ...barangMasterData(),
    attributes: [{ id: 71, attributecode: "BRAND", supportsmultiplevalues: false }],
  });

  await repository.createDraft(createPayload(barangFormData("BEARING"), { BRAND: "Brand" }));

  assert.ok(calls.some(({ sql }) => /INSERT INTO specification_values/.test(sql)));

  const rejected = loadRepository(barangMasterData());
  await assert.rejects(
    () => rejected.repository.createDraft(createPayload(
      barangFormData("BEARING"),
      { UNIQUE_OTHERS: [{ name: "Accessories", detail: "Seal" }] }
    )),
    /Atribut tidak didukung.*UNIQUE_OTHERS/
  );
});

test("Jasa document metadata arrays persist as one JSON attribute value", async () => {
  const { repository, calls } = loadRepository({
    type: { id: 2, typecode: "JASA" },
    category: { id: 31, categoryname: "OPEX - JASA", specificationtypeid: 2 },
    group: { id: 41, sapgroupcode: "SERVICE", materialcategoryid: 31 },
    attributes: [{
      id: 80,
      attributecode: "ATTACHMENT_DOCUMENTS",
      inputtype: "json",
      supportsmultiplevalues: false,
    }],
  });
  const attachments = [
    { type: "BQ", other: "", fileName: "bq.pdf" },
    { type: "Timeline", other: "", fileName: "timeline.pdf" },
  ];
  const payload = createPayload({
    ...baseFormData,
    materialCategory: "31",
    materialGroup: "41",
    reasonChoice: "50",
    reasonToProcure: "50",
    projectName: "Project",
    projectDescription: "Description",
    timeline: "2026",
    attachmentDocuments: attachments,
  }, { ATTACHMENT_DOCUMENTS: attachments });
  payload.specificationTypeId = 2;

  await repository.createDraft(payload);

  const valueInserts = calls.filter(({ sql }) => /INSERT INTO specification_values/.test(sql));
  assert.equal(valueInserts.length, 1);
  assert.equal(valueInserts[0].values[2], null);
  assert.deepEqual(valueInserts[0].values[5], attachments);
});

test("ordinary non-JSON attributes still reject multiple values", async () => {
  const { repository } = loadRepository({
    ...barangMasterData(),
    attributes: [{
      id: 71,
      attributecode: "BRAND",
      inputtype: "text",
      supportsmultiplevalues: false,
    }],
  });

  await assert.rejects(
    () => repository.createDraft(createPayload(
      barangFormData("BEARING"),
      { BRAND: ["Brand A", "Brand B"] }
    )),
    /Atribut BRAND hanya menerima satu nilai/
  );
});
