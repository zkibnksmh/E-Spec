const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "../..");
const read = (file) => fs.readFileSync(path.resolve(root, file), "utf8");

const files = {
  roleNav: read("role-nav.js"),
  admin: read("admin.js"),
  adminPage: read("admin.html"),
  myEspec: read("approval.js"),
  myEspecPage: read("approval.html"),
  myApproval: read("my-approval.js"),
  myApprovalPage: read("my-approval.html"),
  approvalDetail: read("approval-detail.js"),
  approvalDetailPage: read("approval-detail.html"),
  documentWorkspace: read("document-workspace.js"),
  barang: read("barang.js"),
  jasa: read("jasa.js"),
  adminCss: read("admin.css"),
  approvalCss: read("approval.css")
};

test("Requestor navigation hides My Approval and keeps Requestor pages", () => {
  assert.match(files.roleNav, /"approval\.html": "requestor"/);
  assert.match(files.roleNav, /"pilih-spesifikasi\.html": "requestor"/);
  assert.match(files.roleNav, /"barang\.html": "requestor"/);
  assert.match(files.roleNav, /"jasa\.html": "requestor"/);
  assert.match(files.roleNav, /"my-approval\.html": "approver"/);
  assert.match(files.roleNav, /roles\.includes\("Requestor"\)/);
});

test("Approver navigation hides My E-Spec and keeps My Approval", () => {
  assert.match(files.roleNav, /roles\.includes\("Manager"\) \|\| roles\.includes\("HeadEngineering"\)/);
  assert.match(files.roleNav, /REQUESTOR_PAGES = new Set\(/);
  assert.match(files.roleNav, /APPROVER_PAGES = new Set\(\["my-approval\.html", "approval-detail\.html"\]\)/);
  assert.match(files.roleNav, /REQUESTOR_PAGES\.has\(currentPage\) && role !== "requestor"/);
  assert.match(files.roleNav, /APPROVER_PAGES\.has\(currentPage\) && role !== "approver"/);
});

test("Unauthorized direct page access is redirected after session verification", () => {
  assert.match(files.roleNav, /\/auth\/me/);
  assert.match(files.roleNav, /identitySource !== "development"/);
  assert.match(files.roleNav, /const deny = \(\) => window\.location\.replace\("admin\.html"\)/);
  assert.match(files.roleNav, /window\.ESpecRoleNav\s*=\s*\{/);
  for (const page of [
    "admin.html",
    "approval.html",
    "approval-detail.html",
    "my-approval.html",
    "barang.html",
    "jasa.html",
    "pilih-spesifikasi.html",
    "pengaturan.html"
  ]) {
    assert.match(read(page), /<script src="role-nav\.js"><\/script>/, page);
  }
});

test("Role navigation uses only the authenticated profile and hides scoped links until verified", () => {
  assert.match(files.roleNav, /applyNavigation\(null\);/);
  assert.doesNotMatch(files.roleNav, /applyNavigation\(roleFromProfile\(auth\.getProfile/);
  assert.match(files.roleNav, /profile = result\.data;/);
  assert.match(files.roleNav, /const role = roleFromProfile\(profile\);/);
  assert.match(files.adminCss, /\[hidden\]\s*\{\s*display:\s*none !important;\s*\}/);
});

test("Dashboard document table uses scoped data and Print as its only row action", () => {
  assert.match(files.admin, /\/specifications\/my-documents/);
  assert.match(files.adminPage, /<th>KATEGORI \/ TIPE<\/th>/);
  assert.match(files.adminPage, /<th>DEPARTEMEN<\/th>/);
  assert.match(files.admin, /data-action="print"/);
  assert.doesNotMatch(files.admin, /data-action="detail"/);
  assert.doesNotMatch(files.admin, /data-action="json"/);
  assert.doesNotMatch(files.admin, /data-action="delete"/);
  assert.doesNotMatch(files.admin, />\s*Approve\s*</);
  assert.doesNotMatch(files.admin, />\s*Reject\s*</);
  assert.doesNotMatch(files.admin, />\s*Return\s*</);
});

test("My E-Spec lists owner-scoped documents with all required statuses", () => {
  assert.match(files.myEspec, /\/specifications\/my-documents/);
  assert.match(files.myEspecPage, /<th>STATUS SAAT INI<\/th>/);
  for (const status of ["Draft", "Revision Required", "In Approval", "Approved", "Rejected"]) {
    assert.equal(files.myEspec.includes(status), true, status);
  }
  assert.match(files.myEspec, /Resume \/ Edit/);
  assert.match(files.myEspec, /Revise \/ Resubmit/);
  assert.match(files.myEspec, /View \/ Print/);
  assert.match(files.myEspec, /data-action="history"/);
});

test("My Approval uses inbox data and exactly two row actions", () => {
  assert.match(files.myApproval, /\/approvals\/inbox/);
  assert.match(files.myApprovalPage, /<th>TIPE SPESIFIKASI<\/th>/);
  assert.match(files.myApprovalPage, /<th>REQUESTOR<\/th>/);
  assert.match(files.myApprovalPage, /<th>TANGGAL PENGAJUAN<\/th>/);
  assert.match(files.myApproval, /data-approval-action="approval"/);
  assert.match(files.myApproval, /data-approval-action="print"/);
  assert.doesNotMatch(files.myApproval, /data-decision/);
  assert.doesNotMatch(files.myApproval, /approval\/approve/);
  assert.doesNotMatch(files.myApproval, /approval\/reject/);
  assert.doesNotMatch(files.myApproval, /approval\/return/);
});

test("Approval action opens a dedicated read-only detail view", () => {
  assert.match(files.myApproval, /approval-detail\.html/);
  assert.match(files.approvalDetailPage, /<script src="role-nav\.js"><\/script>/);
  assert.match(files.approvalDetail, /\/specifications\/my-documents\//);
  assert.match(files.approvalDetail, /renderDocument\(result\.data\)/);
  assert.match(files.approvalDetailPage, /Read Only/);
});

test("Approval detail layout is sidebar-aware and centered", () => {
  assert.match(files.approvalDetailPage, /<main class="main">/);
  assert.match(files.approvalDetailPage, /<section class="content approval-detail-content">/);
  assert.doesNotMatch(files.approvalDetailPage, /main-content|content-wrap/);
  assert.match(files.adminCss, /\.main\s*\{[\s\S]*?margin-left:\s*var\(--sidebar-width\)/);
  assert.match(files.adminCss, /\.content\s*\{[\s\S]*?margin:\s*0 auto/);
  assert.match(files.adminCss, /body\s*\{[\s\S]*?overflow-x:\s*hidden/);
  assert.match(files.approvalCss, /\.approval-detail-content\s*\{[\s\S]*?min-width:\s*0[\s\S]*?max-width:\s*100%/);
});

test("Approval detail fields align in two columns across desktop widths", () => {
  assert.match(files.approvalDetailPage, /id="documentFields" class="approval-document-info approval-form-fields"/);
  assert.match(files.approvalCss, /\.approval-form-fields\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(files.approvalCss, /@media\s*\(max-width:\s*1280px\)/);
  assert.match(files.approvalCss, /\.approval-detail-content \.approval-document-info\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
});

test("Approval detail desktop breakpoints cover 1680, 1366, and 1280 viewport widths", () => {
  assert.match(files.adminCss, /--sidebar-width:\s*258px/);
  assert.match(files.adminCss, /@media\s*\(max-width:\s*1100px\)/);
  assert.match(files.approvalCss, /@media\s*\(max-width:\s*1280px\)/);
  assert.match(files.approvalCss, /@media\s*\(max-width:\s*700px\)/);
});

test("Approval detail card restores inner padding and clipped-field safeguards", () => {
  assert.match(files.approvalDetailPage, /class="panel approval-detail-panel"/);
  assert.match(files.approvalCss, /\.approval-detail-content\s*>\s*\.panel\s*\{[\s\S]*?padding:\s*24px[\s\S]*?overflow:\s*hidden/);
  assert.match(files.approvalCss, /\.approval-detail-content,\s*\.approval-detail-content \*[\s\S]*?box-sizing:\s*border-box/);
  assert.match(files.approvalCss, /\.approval-detail-content \.approval-document-info,\s*\.approval-detail-content \.approval-form-grid[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(files.approvalCss, /\.approval-detail-content\s*>\s*\.panel\s*>\s*\.panel-top\s*\{[\s\S]*?margin:\s*0/);
});

test("Approval detail uses Barang/Jasa business labels and original section hierarchy", () => {
  assert.match(files.approvalDetail, /reason:\s*"Reason to Procure"/);
  assert.match(files.approvalDetail, /reasonChoice:\s*"Reason to Procure"/);
  assert.match(files.approvalDetail, /unique1:\s*"Accessories"/);
  assert.match(files.approvalDetail, /unique2:\s*"Unique Specification 2"/);
  assert.match(files.approvalDetail, /specType:\s*"Specification Type"/);
  assert.match(files.approvalDetail, /plant:\s*"Plant"/);
  assert.match(files.approvalDetail, /department:\s*"Departemen \/ Sub Departemen"/);
  assert.match(files.approvalDetail, /location:\s*"Location"/);

  for (const heading of [
    "Version & Identity",
    "Purchase Objective",
    "General Specification",
    "Technical Specification",
    "Unique Specification",
    "Scope",
    "Required Documents"
  ]) {
    assert.equal(files.approvalDetail.includes(heading), true, heading);
  }
});

test("Approval detail resolves dropdown display labels from master data", () => {
  assert.match(files.approvalDetail, /fetchLookup\("plants"\)/);
  assert.match(files.approvalDetail, /fetchLookup\("departments"\)/);
  assert.match(files.approvalDetail, /fetchLookup\("material-categories"\)/);
  assert.match(files.approvalDetail, /fetchLookup\("material-groups"\)/);
  assert.match(files.approvalDetail, /fetchLookup\(`reason-to-procure\/\$\{encodeURIComponent\(id\)\}`\)/);
  assert.match(files.approvalDetail, /item\.plantname/);
  assert.match(files.approvalDetail, /item\.departmentname/);
  assert.match(files.approvalDetail, /item\.categoryname/);
  assert.match(files.approvalDetail, /item\.sapgroupcode/);
  assert.match(files.approvalDetail, /item\.optionname/);
  assert.match(files.approvalDetail, /UNAVAILABLE_LABEL = "Tidak tersedia"/);
});

test("Approval detail renders every persisted field as non-editable", () => {
  assert.match(files.approvalDetail, /Object\.entries\(formData\)/);
  assert.match(files.approvalDetail, /detail\.attributeValues/);
  assert.match(files.approvalDetail, /technicalAttributes/);
  assert.match(files.approvalDetail, /<input[^>]*disabled/);
  assert.match(files.approvalDetail, /<select disabled>/);
  assert.match(files.approvalDetail, /type="checkbox" disabled/);
  assert.match(files.approvalDetail, /displayFieldValue\(key, value, lookups\)/);
  assert.doesNotMatch(files.approvalDetail, /method:\s*"PUT"/);
  assert.doesNotMatch(files.approvalDetail, /saveDraftToServer/);
});

test("Approval decision labels map to exact backend endpoints", () => {
  assert.match(files.approvalDetail, /value: "approve", label: "Approval", endpoint: "\/approval\/approve"/);
  assert.match(files.approvalDetail, /value: "reject", label: "Reject: Total", endpoint: "\/approval\/reject"/);
  assert.match(files.approvalDetail, /value: "return", label: "Reject: Request Revisi", endpoint: "\/approval\/return"/);
  assert.match(files.approvalDetailPage, /Submit Approval/);
  assert.match(files.approvalDetail, /confirm\(`Kirim keputusan/);
});

test("Reject and Return require a comment while Approval does not", () => {
  assert.match(files.approvalDetail, /choice\.value !== "approve" && !commentValue/);
  assert.match(files.approvalDetail, /comment\.required = required/);
  assert.match(files.approvalDetail, /\["reject", "return"\]/);
  assert.match(files.approvalDetail, /Catatan keputusan wajib diisi\./);
});

test("Approval detail handles 401, 403, 409, and 422", () => {
  for (const code of [401, 403, 409, 422]) {
    assert.match(files.approvalDetail, new RegExp(`\\b${code}:`));
  }
  assert.match(files.approvalDetail, /button\.disabled = true/);
  assert.match(files.approvalDetail, /window\.location\.href = "my-approval\.html"/);
});

test("Print preview uses secure document reads and never submits decisions", () => {
  assert.match(files.documentWorkspace, /openPrintPreview/);
  assert.match(files.documentWorkspace, /window\.open\(url\.toString\(\), "_blank"\)/);
  assert.match(files.barang, /\/specifications\/my-documents\//);
  assert.match(files.jasa, /\/specifications\/my-documents\//);
  assert.doesNotMatch(files.documentWorkspace, /approval\//);
  assert.doesNotMatch(files.barang, /approval\/approve/);
  assert.doesNotMatch(files.jasa, /approval\/approve/);
});

test("Existing PDF content behavior remains intact", () => {
  assert.match(files.barang, /transferToPrint\(data\)/);
  assert.match(files.barang, /window\.print\(\)/);
  assert.match(files.jasa, /transferToPrint\(data\)/);
  assert.match(files.jasa, /window\.print\(\)/);
});

test("Task 05M Draft restoration remains intact with explicit resume links", () => {
  assert.match(files.myEspec, /resumeId/);
  assert.match(files.barang, /\/specifications\/my-drafts\//);
  assert.match(files.jasa, /\/specifications\/my-drafts\//);
  assert.match(files.barang, /resumeDraftFromQuery/);
  assert.match(files.jasa, /resumeDraftFromQuery/);
});

test("Workflow history access is scoped and escaped", () => {
  assert.match(files.myEspec, /\/specifications\/\$\{encodeURIComponent\(document\.id\)\}\/workflow/);
  assert.match(files.approvalDetail, /\/specifications\/\$\{encodeURIComponent\(specId\)\}\/workflow/);
  assert.match(files.myEspec, /escapeHTML\(cycle\.cycleno\)/);
  assert.match(files.approvalDetail, /escapeHTML\(step\.comments \|\| ""\)/);
});
