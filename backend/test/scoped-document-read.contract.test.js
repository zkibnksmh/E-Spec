const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "../..");
const read = (file) => fs.readFileSync(path.resolve(root, file), "utf8");

const routes = read("backend/src/routes/specification.routes.js");
const controller = read("backend/src/controllers/specification.controller.js");
const service = read("backend/src/services/specification.service.js");
const repository = read("backend/src/repositories/specification.repository.js");

test("Scoped document read routes are authenticated and ordered before /:id", () => {
  assert.match(routes, /const requireScopedReadUser = \[authenticate, requireAuthenticated\]/);
  assert.match(routes, /router\.get\("\/my-documents", \.\.\.requireScopedReadUser/);
  assert.match(routes, /router\.get\(\s*"\/my-documents\/:id",\s*\.\.\.requireScopedReadUser/);

  const listIndex = routes.indexOf('router.get("/my-documents"');
  const detailIndex = routes.indexOf('"/my-documents/:id"');
  const unscopedIndex = routes.indexOf('router.get("/:id"');

  assert.ok(listIndex > -1);
  assert.ok(detailIndex > listIndex);
  assert.ok(unscopedIndex > detailIndex);
});

test("Scoped document list SQL uses actor ownership or approval assignment", () => {
  assert.match(repository, /const findAllScopedDocuments = async \(\{ actorUserId \}\)/);
  assert.match(repository, /s\.createdbyuserid = \$1/);
  assert.match(repository, /step\.assignedapproveruserid = \$1 OR step\.actionbyuserid = \$1/);
  assert.match(repository, /LEFT JOIN departments d\s+ON d\.id = s\.departmentid/);
});

test("Scoped document detail allows creator or assigned approver only", () => {
  assert.match(repository, /const findScopedDocumentById = \(id, actorUserId\)/);
  assert.match(repository, /creatorUserId: actorUserId/);
  assert.match(repository, /approverUserId: actorUserId/);
  assert.equal(
    repository.includes("(step.assignedapproveruserid = $${values.length} OR step.actionbyuserid = $${values.length})"),
    true
  );
  assert.match(service, /Spesifikasi tidak ditemukan atau tidak dapat diakses\./);
});

test("Scoped document service returns metadata, form data, attributes, and history", () => {
  assert.match(service, /const getScopedSpecifications = async \(actor\)/);
  assert.match(service, /const getScopedSpecificationById = async \(id, actor\)/);
  assert.match(service, /specificationRepository\.findAllScopedDocuments/);
  assert.match(service, /specificationRepository\.findScopedDocumentById/);
  assert.match(service, /materialDescription: row\.material_description/);
  assert.match(service, /attributeValues: attributeValuesFromSections\(row\.sections\)/);
  assert.match(service, /statusHistory: row\.status_history \|\| \[\]/);
  assert.match(controller, /getScopedSpecifications/);
  assert.match(controller, /getScopedSpecificationById/);
});

test("Unscoped specification reads remain unchanged for backward compatibility", () => {
  assert.match(routes, /router\.get\("\/", specificationController\.getAllSpecifications\)/);
  assert.match(routes, /router\.get\("\/:id", specificationController\.getSpecificationById\)/);
  assert.match(repository, /const findById = \(id\) => loadSpecificationById\(id\)/);
});
