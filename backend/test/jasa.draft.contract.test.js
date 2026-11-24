const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const jasaScript = fs.readFileSync(path.resolve(__dirname, "../../jasa.js"), "utf8");
const jasaPage = fs.readFileSync(path.resolve(__dirname, "../../jasa.html"), "utf8");

test("Jasa uses the shared local API override with the port 3001 fallback", () => {
  assert.match(jasaScript, /window\.ESPEC_CONFIG\?\.API_BASE_URL\s*\|\|\s*"http:\/\/localhost:3001\/api"/);
  assert.match(jasaPage, /<script src="dev-auth\.js"><\/script>/);
  assert.match(jasaPage, /<script src="role-nav\.js"><\/script>\s*<script src="draft-workspace\.js"><\/script>\s*<script src="jasa\.js"><\/script>/);
  assert.doesNotMatch(jasaPage, /frontend\.local\.js/);
});

test("Jasa sends only active test-master-data attribute codes", () => {
  for (const code of [
    "VERSION",
    "CREATED_DATE",
    "PLANT",
    "REQUESTOR",
    "DEPARTMENT",
    "REASON_TO_PROCURE",
    "PROJECT_NAME",
    "PROJECT_DESCRIPTION",
    "TIMELINE",
    "ATTACHMENT_DOCUMENTS",
    "REQUIRED_DOCUMENTS",
  ]) {
    assert.match(jasaScript, new RegExp(`add\\("${code}"`));
  }

  for (const code of [
    "LOCATION",
    "TECHNICAL",
    "KPI",
    "ENVIRONMENT_CONDITION_RESTRICTION",
    "HSE_STANDARD",
    "LICENSE_REGULATION",
    "WARRANTY_AFTER_SALES",
    "NOTES",
  ]) {
    assert.doesNotMatch(jasaScript, new RegExp(`add\\("${code}"`));
  }
});

test("Jasa preserves display values and sends compatible master-data references", () => {
  assert.match(jasaScript, /materialCategoryLabel: selectedCategory/);
  assert.match(jasaScript, /materialGroupCode: formData\.materialGroup/);
  assert.match(jasaScript, /reasonToProcure: formData\.reasonChoice/);
  assert.match(jasaScript, /option\.disabled = !availableGroups\.has\(option\.value\)/);
});
