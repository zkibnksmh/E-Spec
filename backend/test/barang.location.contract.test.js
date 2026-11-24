const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "../..");
const barangScript = fs.readFileSync(path.resolve(root, "barang.js"), "utf8");
const barangPage = fs.readFileSync(path.resolve(root, "barang.html"), "utf8");
const repositoryScript = fs.readFileSync(
  path.resolve(root, "backend/src/repositories/specification.repository.js"),
  "utf8"
);
const serviceScript = fs.readFileSync(
  path.resolve(root, "backend/src/services/specification.service.js"),
  "utf8"
);

test("new Barang Draft preserves Location in canonical formData", () => {
  assert.match(barangPage, /name="location"/);
  assert.match(barangScript, /\$\$\("\[name\]", questionnaire\)/);
  assert.match(barangScript, /data\[name\] = first\.value \?\? ""/);
  assert.match(barangScript, /documentNo,\s*formData,\s*attributeValues: getAttributeValues\(formData\)/);
});

test("existing Barang Draft PUT keeps the Draft ID and document number", () => {
  assert.match(barangScript, /const isUpdate = Boolean\(persistedDraftId\)/);
  assert.match(
    barangScript,
    /isUpdate\s*\?\s*`\$\{API_BASE_URL\}\/specifications\/\$\{encodeURIComponent\(persistedDraftId\)\}`/
  );
  assert.match(barangScript, /method: isUpdate \? "PUT" : "POST"/);
  assert.match(barangScript, /const documentNo = getDraftDocumentNumber\(formData\)/);
  assert.match(
    barangScript,
    /const existing = String\(persistedDocumentNo \|\| formData\.persistedDocumentNo \|\| ""\)\.trim\(\)/
  );
  assert.match(barangScript, /persistedDraftId = result\.data\?\.id \|\| persistedDraftId/);
});

test("existing Barang Draft PUT preserves updated Location", () => {
  assert.match(barangScript, /const formData = getFormData\(\)/);
  assert.match(barangScript, /body: JSON\.stringify\(\{[\s\S]*formData,[\s\S]*attributeValues/);
  assert.doesNotMatch(barangScript, /delete formData\.location/);
});

test("Draft detail GET exposes and restores Location into the location field", () => {
  assert.match(repositoryScript, /s\.formdata AS form_data/);
  assert.match(serviceScript, /formData,/);
  assert.match(serviceScript, /form_data: formData/);
  assert.match(barangScript, /detail\?\.formData \|\| detail\?\.form_data/);
  assert.match(barangScript, /setFieldValue\(name, value\)/);
  assert.match(barangScript, /printForm\.querySelectorAll\("\[name\]"\)/);
});

test("Barang attributeValues do not include unsupported LOCATION", () => {
  assert.doesNotMatch(barangScript, /add\("LOCATION"/);
});

test("existing Material Code mapping remains correct", () => {
  assert.match(barangPage, /name="materialCode"/);
  assert.doesNotMatch(barangScript, /add\("MATERIAL_CODE"/);
  assert.match(repositoryScript, /payload\.formData\.materialCode \|\| null/);
});

test("existing supported Barang attributes remain unaffected", () => {
  const supportedCodes = [
    "VERSION",
    "CREATED_DATE",
    "PLANT",
    "REQUESTOR",
    "DEPARTMENT",
    "MATERIAL_GROUP",
    "MATERIAL_CATEGORY",
    "REASON_TO_PROCURE",
    "MATERIAL_DESCRIPTION",
    "TYPE_MODEL_PART_NUMBER",
    "VARIANS",
    "DIMENSION",
    "BRAND",
    "UOM",
    "ADDITIONAL_SERVICE",
  ];

  for (const code of supportedCodes) {
    assert.match(barangScript, new RegExp(`add\\("${code}"`));
  }
});
