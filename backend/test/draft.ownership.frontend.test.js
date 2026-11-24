const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "../..");
const barangScript = fs.readFileSync(path.join(root, "barang.js"), "utf8");
const jasaScript = fs.readFileSync(path.join(root, "jasa.js"), "utf8");
const gitignore = fs.readFileSync(path.join(root, ".gitignore"), "utf8");

for (const [name, script] of [
  ["Barang", barangScript],
  ["Jasa", jasaScript],
]) {
  test(`${name} reads an optional DEV_IDENTITY from local configuration`, () => {
    assert.match(script, /window\.ESPEC_CONFIG\?\.DEV_IDENTITY/);
    assert.match(
      script,
      /DEV_IDENTITY_ALIASES\s*=\s*\[\s*"requestor"\s*,\s*"manager"\s*,\s*"head-engineering"\s*\]/
    );
    assert.match(script, /headers\["X-ESpec-Dev-Identity"\]\s*=\s*identity/);
  });

  test(`${name} does not hardcode a default development identity`, () => {
    assert.doesNotMatch(script, /DEV_IDENTITY\s*:\s*["']requestor["']/);
    assert.doesNotMatch(script, /DEV_IDENTITY\s*=\s*["']requestor["']/);
    assert.doesNotMatch(script, /DEV_IDENTITY\s*:\s*["']manager["']/);
    assert.doesNotMatch(script, /DEV_IDENTITY\s*:\s*["']head-engineering["']/);
  });

  test(`${name} sends the optional identity header on draft save`, () => {
    assert.match(script, /headers:\s*getApiHeaders\(\)/);
  });

  test(`${name} does not derive identity from storage or form data`, () => {
    assert.doesNotMatch(script, /DEV_IDENTITY[^\n]*localStorage/);
    assert.doesNotMatch(script, /localStorage[^\n]*DEV_IDENTITY/);
    assert.doesNotMatch(script, /DEV_IDENTITY[^\n]*formData/);
  });
}

test("local frontend configuration remains git-ignored", () => {
  assert.match(gitignore, /^\/frontend\.local\.js$/m);
});
