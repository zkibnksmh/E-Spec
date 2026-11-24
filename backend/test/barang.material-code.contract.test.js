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

test("Barang Material Code stays in formData and is not sent as an unsupported attribute", () => {
  assert.match(barangPage, /name="materialCode"/);
  assert.doesNotMatch(barangScript, /add\("MATERIAL_CODE"/);
  assert.match(repositoryScript, /payload\.formData\.materialCode \|\| null/);
});
