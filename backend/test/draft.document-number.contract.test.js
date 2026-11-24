const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const barangScript = fs.readFileSync(path.resolve(__dirname, "../../barang.js"), "utf8");
const jasaScript = fs.readFileSync(path.resolve(__dirname, "../../jasa.js"), "utf8");
const workspaceScript = fs.readFileSync(
  path.resolve(__dirname, "../../draft-workspace.js"),
  "utf8"
);

const businessKeys = [
  "eSpecBarangQuestionnaire.v2",
  "eSpecBarangQuestionnaire.v1",
  "eSpecBarangPersistedDraftId.v1",
  "eSpecBarangPersistedDraftOwner.v1",
  "eSpecBarangPersistedDocumentNo.v1",
  "eSpecBarangPreviousDocumentNo.v1",
  "eSpecBarangTransactions.v1",
  "eSpecJasaQuestionnaire.v1",
  "eSpecJasaPersistedDraftId.v1",
  "eSpecJasaPersistedDocumentNo.v1"
];

for (const [name, script] of [
  ["Barang", barangScript],
  ["Jasa", jasaScript]
]) {
  test(`${name} keeps the document number in memory and uses the server response`, () => {
    assert.match(
      script,
      /String\(persistedDocumentNo \|\| formData\.persistedDocumentNo \|\| ""\)\.trim\(\)/
    );
    assert.match(script, /persistedDocumentNo = documentNo/);
    assert.match(script, /persistedDocumentNo = result\.data\?\.documentNo \|\| documentNo/);
    assert.match(script, /const isUpdate = Boolean\(persistedDraftId\)/);
    assert.doesNotMatch(
      script,
      /localStorage\.(setItem|getItem|removeItem)\(PERSISTED_DOCUMENT_NO_KEY/
    );
  });

  test(`${name} never treats browser storage as Draft state`, () => {
    for (const key of businessKeys) {
      assert.equal(script.includes(key), false, `${key} must not appear in ${name}`);
    }

    assert.doesNotMatch(script, /"Draft tersimpan otomatis di browser"/);
    assert.doesNotMatch(script, /Draft browser tersimpan/);
  });
}

test("Draft workspace reads server-owned Drafts and handles legacy data explicitly", () => {
  assert.match(workspaceScript, /fetchJson\("\/specifications\/my-drafts"\)/);
  assert.equal(workspaceScript.includes("/specifications/my-drafts/"), true);
  assert.match(workspaceScript, /getApiHeaders\(\)/);
  assert.match(workspaceScript, /clearLegacy/);
  assert.match(workspaceScript, /downloadLegacy/);
  assert.doesNotMatch(workspaceScript, /localStorage\.setItem/);
  assert.doesNotMatch(workspaceScript, /picker\.value\s*=\s*drafts\[0\]/);
});
