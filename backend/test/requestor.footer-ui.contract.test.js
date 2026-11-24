const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "../..");
const read = (file) => fs.readFileSync(path.resolve(root, file), "utf8");

const files = {
  barangPage: read("barang.html"),
  barangScript: read("barang.js"),
  jasaPage: read("jasa.html"),
  jasaScript: read("jasa.js"),
  myEspecPage: read("approval.html"),
  myEspecScript: read("approval.js"),
  approvalDetailPage: read("approval-detail.html"),
  approvalDetailScript: read("approval-detail.js"),
  adminScript: read("admin.js"),
  myApprovalScript: read("my-approval.js"),
  documentWorkspace: read("document-workspace.js"),
  draftWorkspace: read("draft-workspace.js")
};

const footerActions = (page) =>
  page.match(/<div class="questionnaire-bottom-actions">([\s\S]*?)<\/div>/)?.[1] || "";

for (const [name, page, script] of [
  ["Barang", files.barangPage, files.barangScript],
  ["Jasa", files.jasaPage, files.jasaScript]
]) {
  test(`${name} form footer has exactly Save As Draft and Submit`, () => {
    const footer = footerActions(page);
    const buttons = footer.match(/<button\b/g) || [];

    assert.equal(buttons.length, 2, `${name} footer button count`);
    assert.match(footer, /Save As Draft/);
    assert.match(footer, />\s*Submit\s*</);
    assert.doesNotMatch(footer, /Submit Approval/);
    assert.doesNotMatch(footer, /id="pdfBtn"|id="pdfJasaBtn"/);
    assert.doesNotMatch(footer, /draft-workspace|draft-recovery-btn/);
    assert.doesNotMatch(script, /id="pdfBtn"|id="pdfJasaBtn"/);
  });

  test(`${name} Submit still uses the submit or resubmit API`, () => {
    assert.match(script, /if \(status === "Draft"\) return "submit"/);
    assert.match(script, /if \(status === "Revision Required"\) return "resubmit"/);
    assert.match(script, /\/\$\{action\}/);
    assert.match(script, /if \(submitting\) return/);
    assert.match(script, /disabled = true/);
    assert.match(script, /disabled = false/);
    assert.match(script, /validateForm\(\)/);
  });
}

test("My E-Spec owns the Draft workspace and opens blank forms for new Drafts", () => {
  assert.match(files.myEspecPage, /id="draftSourceSelect"/);
  assert.match(files.myEspecPage, /id="barangDraftSource"/);
  assert.match(files.myEspecPage, /id="jasaDraftSource"/);
  assert.match(files.myEspecScript, /draftWorkspace\.mount\(/);
  assert.match(files.myEspecScript, /onResume: \(detail\) => openDraftPage\(source, \{ resumeId: detail\.id \}\)/);
  assert.match(files.myEspecScript, /onNew: \(\) => openDraftPage\(source\)/);

  const start = files.myEspecScript.indexOf("const openDraftPage");
  const end = files.myEspecScript.indexOf("\n  };", start);
  const openDraftPage = files.myEspecScript.slice(start, end);

  assert.doesNotMatch(openDraftPage, /resumeId/);
});

test("Legacy recovery exports before any possible cleanup", () => {
  const start = files.draftWorkspace.indexOf("const downloadLegacy");
  const end = files.draftWorkspace.indexOf("const clearLegacy");
  const downloadLegacy = files.draftWorkspace.slice(start, end);

  assert.match(downloadLegacy, /JSON\.stringify\(snapshot, null, 2\)/);
  assert.doesNotMatch(downloadLegacy, /clearLegacy/);
  assert.match(files.myEspecScript, /onImportLegacy: \(\) => openDraftPage\(source, \{ legacyImport: "1" \}\)/);
  assert.match(files.barangScript, /params\.get\("legacyImport"\)/);
  assert.match(files.jasaScript, /params\.get\("legacyImport"\)/);
});

test("Approver decision UI is unchanged", () => {
  assert.match(files.approvalDetailPage, /Submit Approval/);
  assert.match(files.approvalDetailScript, /label: "Approval"/);
  assert.match(files.approvalDetailScript, /label: "Reject: Total"/);
  assert.match(files.approvalDetailScript, /label: "Reject: Request Revisi"/);
  assert.doesNotMatch(files.approvalDetailPage, /Save As Draft/);
});

test("PDF print access stays on Dashboard and My Approval", () => {
  assert.match(files.documentWorkspace, /openPrintPreview/);
  assert.match(files.adminScript, /data-action="print"/);
  assert.match(files.myApprovalScript, /data-approval-action="print"/);
});
