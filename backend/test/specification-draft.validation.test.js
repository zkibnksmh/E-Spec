const assert = require("node:assert/strict");
const test = require("node:test");
const {
  validateBarang,
  validateJasa,
} = require("../src/utils/specification-draft.validation");

const barangBase = {
  materialGroup: "MEASURE",
  drawingImage: "data:image/png;base64,test",
  additionalService: "None",
};

const bearingBase = {
  ...barangBase,
  materialGroup: "BEARING",
  materialDescription: "Bearing test",
  partNumber: "BRG-001",
  variant: "Standard",
  brand: "Test Brand",
  uom: "EA",
  dimensionItems: [{ type: "ID", value: "10", unit: "MM" }],
};

const jasaBase = {
  plant: "1",
  requestor: "Requestor",
  department: "1",
  materialGroup: "4",
  materialCategory: "4",
  reasonChoice: "1",
  projectName: "Project",
  projectDescription: "Description",
  timeline: "2026",
  attachmentDocuments: [],
};

test("Barang populated matrix rejects missing mandatory field", () => {
  assert.throws(
    () => validateBarang({ ...barangBase, materialGroup: "BEARING" }),
    /materialDescription wajib diisi/
  );
});

test("BEARING accepts valid structured dimensions without a legacy dimension string", () => {
  assert.doesNotThrow(() => validateBarang(bearingBase));
});

test("BEARING rejects missing dimensions", () => {
  assert.throws(
    () => validateBarang({ ...bearingBase, dimensionItems: [], dimension: "" }),
    /dimension wajib diisi/
  );
});

test("BEARING keeps catalogue and location optional", () => {
  assert.doesNotThrow(() => validateBarang({
    ...bearingBase,
    catalogue: "",
    location: "",
  }));
});

test("BEARING keeps Additional Service mandatory", () => {
  assert.throws(
    () => validateBarang({ ...bearingBase, additionalService: "" }),
    /Additional Service wajib diisi/
  );
});

test("BEARING keeps drawing mandatory", () => {
  assert.throws(
    () => validateBarang({ ...bearingBase, drawingImage: "" }),
    /Design \/ Drawing \/ Visual \/ Illustration wajib diisi/
  );
});

test("Barang group without populated matrix accepts optional omissions", () => {
  assert.doesNotThrow(() => validateBarang(barangBase));
});

test("Jasa rejects unsupported category", () => {
  assert.throws(
    () => validateJasa(jasaBase, { categoryName: "CAPEX", groupCode: "SERVICE" }),
    /Kategori Jasa tidak didukung/
  );
});

test("Jasa accepts OPEX SERVICE draft metadata", () => {
  assert.doesNotThrow(() => validateJasa(
    jasaBase,
    { categoryName: "OPEX - JASA", groupCode: "SERVICE" }
  ));
});

test("Jasa rejects mismatched attachment metadata", () => {
  assert.throws(
    () => validateJasa(
      { ...jasaBase, attachmentDocuments: [{ type: "Scope", fileName: "" }] },
      { categoryName: "OPEX - JASA", groupCode: "SERVICEPM" }
    ),
    /kategori dan metadata file/
  );
});
