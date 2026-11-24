const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "../..");
const read = (file) => fs.readFileSync(path.resolve(root, file), "utf8");

const barangScript = read("barang.js");
const jasaScript = read("jasa.js");
const barangPage = read("barang.html");
const jasaPage = read("jasa.html");
const myEspecScript = read("approval.js");
const myEspecPage = read("approval.html");
const workspaceScript = read("draft-workspace.js");

for (const [name, page, script, source, legacyKey, importCallback] of [
  [
    "Barang",
    barangPage,
    barangScript,
    "barang",
    "eSpecBarangQuestionnaire.v2",
    "importLegacyBarang"
  ],
  [
    "Jasa",
    jasaPage,
    jasaScript,
    "jasa",
    "eSpecJasaQuestionnaire.v1",
    "importLegacyJasa"
  ]
]) {
  const workspaceIds = [
    `${source}DraftPicker`,
    `resume${name}DraftBtn`,
    `new${name}DraftBtn`,
    `${source}LegacyRecovery`,
    `export${name}LegacyBtn`,
    `recover${name}LegacyBtn`
  ];

  test(`${name} exposes the Draft workspace in My E-Spec, not in the form footer`, () => {
    assert.match(myEspecPage, /<script src="draft-workspace\.js"><\/script>/);
    assert.match(myEspecPage, new RegExp(`id="${source}DraftSource"`));

    for (const id of workspaceIds) {
      assert.match(myEspecPage, new RegExp(`id="${id}"`));
      assert.doesNotMatch(page, new RegExp(`id="${id}"`), `${id} must not be in the ${name} footer`);
    }

    assert.match(page, /id="draftStatus"/);
    assert.match(script, /params\.get\("legacyImport"\)/);
    assert.match(script, new RegExp(`readLegacy\\?\\.\\("${source}"\\)`));
  });

  test(`My E-Spec ${name} Draft resume is explicit and never auto-selects`, () => {
    assert.match(myEspecScript, /draftWorkspace\.mount\(/);
    assert.match(myEspecScript, new RegExp(`${source}: \\{`));
    assert.match(myEspecScript, /onResume: \(detail\) => openDraftPage\(source, \{ resumeId: detail\.id \}\)/);
    assert.match(myEspecScript, /onNew: \(\) => openDraftPage\(source\)/);
    assert.match(myEspecScript, /onImportLegacy: \(\) => openDraftPage\(source, \{ legacyImport: "1" \}\)/);
    assert.doesNotMatch(myEspecScript, /picker\.value\s*=\s*drafts\[0\]/);
  });

  test(`${name} restores an explicit resumeId or legacy import into memory`, () => {
    assert.match(script, /resumeDraftFromQuery/);
    assert.match(script, new RegExp(`if \\(legacyImport\\)[\\s\\S]{0,160}${importCallback}`));
    assert.match(script, /persistedDraftId = detail\?\.id \|\| null/);
    assert.match(script, /persistedDocumentNo = detail\?\.documentNo \|\| null/);
    assert.doesNotMatch(script, /window\.ESpecDraftWorkspace\.mount\(/);
    assert.doesNotMatch(
      script,
      /localStorage\.(getItem|setItem|removeItem)\((STORAGE_KEY|PERSISTED_)/
    );
    assert.doesNotMatch(script, /createdbyuserid/i);
  });

  test(`${name} confirms before replacing unsaved work`, () => {
    assert.match(script, /hasUnsavedChanges/);
    assert.match(script, /confirmDiscardChanges\(\)/);
    assert.match(script, /hasUnsavedChanges = true/);
    assert.match(script, /hasUnsavedChanges = false/);
  });

  test(`${name} clears legacy browser data only after a confirmed server save`, () => {
    const canonicalIndex = script.indexOf(
      "persistedDocumentNo = result.data?.documentNo || documentNo"
    );
    const clearIndex = script.indexOf(
      `window.ESpecDraftWorkspace?.clearLegacy?.("${source}")`
    );

    assert.ok(canonicalIndex > -1);
    assert.ok(clearIndex > canonicalIndex);
    assert.equal(workspaceScript.includes(legacyKey), true);
    assert.equal(script.includes(legacyKey), false);
  });

  test(`${name} keeps existing PDF and attribute payload behavior`, () => {
    assert.match(script, /transferToPrint/);
    assert.match(script, /window\.print\(\)/);
    assert.match(script, /function getAttributeValues\(formData\)/);
  });
}

test("Server Draft fetch is identity scoped, never auto-selects, and refreshes every mount", () => {
  assert.match(workspaceScript, /fetchDrafts/);
  assert.match(workspaceScript, /fetchDraft/);
  assert.match(workspaceScript, /\/specifications\/my-drafts/);
  assert.match(workspaceScript, /getApiHeaders\(\)/);
  assert.match(workspaceScript, /getApiBaseUrl\(\)/);
  assert.match(workspaceScript, /mounts\.forEach\(\(api\) => api\.refresh/);
  assert.doesNotMatch(workspaceScript, /picker\.value\s*=\s*drafts\[0\]/);
  assert.doesNotMatch(workspaceScript, /localStorage\.setItem/);
  assert.doesNotMatch(workspaceScript, /sessionStorage/);
});

test("Both forms use POST for new Drafts and PUT for owned Drafts", () => {
  for (const [name, script] of [["Barang", barangScript], ["Jasa", jasaScript]]) {
    assert.match(script, /const isUpdate = Boolean\(persistedDraftId\)/, name);
    assert.match(script, /method: isUpdate \? "PUT" : "POST"/, name);
    assert.match(
      script,
      /\.\.\.\(isUpdate \? \{\} : \{ specificationTypeId:/,
      name
    );
  }
});
