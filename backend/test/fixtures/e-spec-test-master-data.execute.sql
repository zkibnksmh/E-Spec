-- E-Spec isolated integration-test master data.
-- Execute only against the e-spec-integration-test branch.
-- Test-only identifiers: 7101-7835. No specification or user records are created.

BEGIN;

DO $$
DECLARE
  conflict_count integer;
BEGIN
  SELECT count(*) INTO conflict_count
  FROM (
    SELECT id::bigint FROM specification_types WHERE id IN (7101, 7102)
    UNION ALL SELECT id::bigint FROM plants WHERE id IN (7201)
    UNION ALL SELECT id FROM departments WHERE id IN (7301)
    UNION ALL SELECT id::bigint FROM idxplantsdepartments WHERE id IN (7401)
    UNION ALL SELECT id FROM material_categories WHERE id IN (7501, 7502)
    UNION ALL SELECT id FROM material_groups WHERE id IN (7601, 7602)
    UNION ALL SELECT id FROM reason_to_procure_options WHERE id IN (7701, 7702)
    UNION ALL SELECT id FROM specification_sections WHERE id IN (7801, 7802)
    UNION ALL SELECT id FROM specification_attributes WHERE id BETWEEN 7810 AND 7835
  ) reserved_ids;

  IF conflict_count > 0 THEN
    RAISE EXCEPTION 'E-Spec integration-test fixture ID conflict detected';
  END IF;

  IF EXISTS (
    SELECT 1 FROM specification_types WHERE typecode IN ('BRG', 'JASA')
    UNION ALL SELECT 1 FROM plants WHERE plantid = 7201
    UNION ALL SELECT 1 FROM departments WHERE departmentname = 'E-Spec Integration Test Department'
    UNION ALL SELECT 1 FROM material_categories
      WHERE categoryname IN ('OPEX - BARANG TEKNIK', 'OPEX - JASA')
    UNION ALL SELECT 1 FROM material_groups WHERE sapgroupcode IN ('BEARING', 'SERVICE')
    UNION ALL SELECT 1 FROM reason_to_procure_options
      WHERE optionname IN ('E-Spec Test Barang Reason', 'E-Spec Test Jasa Reason')
    UNION ALL SELECT 1 FROM specification_sections
      WHERE sectioncode IN ('E_SPEC_TEST_BRG', 'E_SPEC_TEST_JASA')
  ) THEN
    RAISE EXCEPTION 'E-Spec integration-test fixture key conflict detected';
  END IF;
END $$;

INSERT INTO specification_types (id, typecode, typename, isactive, createdby)
VALUES
  (7101, 'BRG', 'Barang', TRUE, 'integration-test'),
  (7102, 'JASA', 'Jasa', TRUE, 'integration-test');

-- plants.id is the PK and FK target; plantid is the unique business/display code.
INSERT INTO plants (id, plantid, plantname, createdby)
VALUES (7201, 7201, 'E-Spec Integration Test Plant', 'integration-test');

INSERT INTO departments (id, departmentname, isactive, createdby)
VALUES (7301, 'E-Spec Integration Test Department', TRUE, 'integration-test');

INSERT INTO idxplantsdepartments (id, plantid, departmentid, createdby)
VALUES (7401, 7201, 7301, 'integration-test');

INSERT INTO material_categories (
  id, categoryname, specificationtypeid, description, isactive, createdby
) VALUES
  (7501, 'OPEX - BARANG TEKNIK', 7101, 'Test-only Barang category', TRUE, 'integration-test'),
  (7502, 'OPEX - JASA', 7102, 'Test-only Expense Jasa category', TRUE, 'integration-test');

INSERT INTO material_groups (
  id, materialcategoryid, groupno, sapgroupcode, dashboardgroupname,
  eprgroupname, description, isactive, createdby
) VALUES
  (7601, 7501, 1, 'BEARING', 'BEARING', 'BEARING', 'Test-only Barang group', TRUE, 'integration-test'),
  (7602, 7502, 2, 'SERVICE', 'SERVICE', 'SERVICE', 'Test-only Jasa group', TRUE, 'integration-test');

INSERT INTO reason_to_procure_options (
  id, specificationtypeid, optionname, description, allowscustomtext,
  sortorder, isactive, createdby
) VALUES
  (7701, 7101, 'E-Spec Test Barang Reason', 'Test-only Barang reason', FALSE, 1, TRUE, 'integration-test'),
  (7702, 7102, 'E-Spec Test Jasa Reason', 'Test-only Jasa reason', FALSE, 1, TRUE, 'integration-test');

INSERT INTO specification_sections (
  id, specificationtypeid, sectioncode, sectionname, sortorder, isactive, createdby
) VALUES
  (7801, 7101, 'E_SPEC_TEST_BRG', 'E-Spec Test Barang', 1, TRUE, 'integration-test'),
  (7802, 7102, 'E_SPEC_TEST_JASA', 'E-Spec Test Jasa', 1, TRUE, 'integration-test');

INSERT INTO specification_attributes (
  id, sectionid, attributecode, attributename, inputtype, defaultrequired,
  allowscustomoption, supportsattachment, supportsmultiplevalues, sortorder,
  isactive, createdby
) VALUES
  (7810, 7801, 'VERSION', 'Version', 'text', FALSE, FALSE, FALSE, FALSE, 10, TRUE, 'integration-test'),
  (7811, 7801, 'CREATED_DATE', 'Created Date', 'text', FALSE, FALSE, FALSE, FALSE, 20, TRUE, 'integration-test'),
  (7812, 7801, 'PLANT', 'Plant', 'text', TRUE, FALSE, FALSE, FALSE, 30, TRUE, 'integration-test'),
  (7813, 7801, 'REQUESTOR', 'Requestor', 'text', TRUE, FALSE, FALSE, FALSE, 40, TRUE, 'integration-test'),
  (7814, 7801, 'DEPARTMENT', 'Department', 'text', FALSE, FALSE, FALSE, FALSE, 50, TRUE, 'integration-test'),
  (7815, 7801, 'MATERIAL_GROUP', 'Material Group', 'text', FALSE, FALSE, FALSE, FALSE, 60, TRUE, 'integration-test'),
  (7816, 7801, 'MATERIAL_CATEGORY', 'Material Category', 'text', FALSE, FALSE, FALSE, FALSE, 70, TRUE, 'integration-test'),
  (7817, 7801, 'REASON_TO_PROCURE', 'Reason to Procure', 'text', FALSE, FALSE, FALSE, FALSE, 80, TRUE, 'integration-test'),
  (7818, 7801, 'MATERIAL_DESCRIPTION', 'Material Description', 'text', TRUE, FALSE, FALSE, FALSE, 90, TRUE, 'integration-test'),
  (7819, 7801, 'TYPE_MODEL_PART_NUMBER', 'Part Number', 'text', TRUE, FALSE, FALSE, FALSE, 100, TRUE, 'integration-test'),
  (7820, 7801, 'VARIANS', 'Variant', 'text', TRUE, FALSE, FALSE, FALSE, 110, TRUE, 'integration-test'),
  (7821, 7801, 'DIMENSION', 'Dimension', 'text', TRUE, FALSE, FALSE, FALSE, 120, TRUE, 'integration-test'),
  (7822, 7801, 'BRAND', 'Brand', 'text', TRUE, FALSE, FALSE, FALSE, 130, TRUE, 'integration-test'),
  (7823, 7801, 'UOM', 'UOM', 'text', TRUE, FALSE, FALSE, FALSE, 140, TRUE, 'integration-test'),
  (7824, 7801, 'ADDITIONAL_SERVICE', 'Additional Service', 'text', TRUE, FALSE, FALSE, FALSE, 150, TRUE, 'integration-test'),
  (7825, 7802, 'VERSION', 'Version', 'text', FALSE, FALSE, FALSE, FALSE, 10, TRUE, 'integration-test'),
  (7826, 7802, 'CREATED_DATE', 'Created Date', 'text', FALSE, FALSE, FALSE, FALSE, 20, TRUE, 'integration-test'),
  (7827, 7802, 'PLANT', 'Plant', 'text', TRUE, FALSE, FALSE, FALSE, 30, TRUE, 'integration-test'),
  (7828, 7802, 'REQUESTOR', 'Requestor', 'text', TRUE, FALSE, FALSE, FALSE, 40, TRUE, 'integration-test'),
  (7829, 7802, 'DEPARTMENT', 'Department', 'text', TRUE, FALSE, FALSE, FALSE, 50, TRUE, 'integration-test'),
  (7830, 7802, 'REASON_TO_PROCURE', 'Reason to Procure', 'text', TRUE, FALSE, FALSE, FALSE, 60, TRUE, 'integration-test'),
  (7831, 7802, 'PROJECT_NAME', 'Project Name', 'text', TRUE, FALSE, FALSE, FALSE, 70, TRUE, 'integration-test'),
  (7832, 7802, 'PROJECT_DESCRIPTION', 'Project Description', 'text', TRUE, FALSE, FALSE, FALSE, 80, TRUE, 'integration-test'),
  (7833, 7802, 'TIMELINE', 'Timeline', 'text', TRUE, FALSE, FALSE, FALSE, 90, TRUE, 'integration-test'),
  (7834, 7802, 'ATTACHMENT_DOCUMENTS', 'Attachment Documents', 'json', FALSE, FALSE, TRUE, FALSE, 100, TRUE, 'integration-test'),
  (7835, 7802, 'REQUIRED_DOCUMENTS', 'Required Documents', 'json', FALSE, FALSE, TRUE, FALSE, 110, TRUE, 'integration-test');

-- Post-seed verification: every selected row must be active and correctly related.
SELECT st.id, st.typecode, st.typename, st.isactive
FROM specification_types st
WHERE st.id IN (7101, 7102)
ORDER BY st.id;

SELECT p.id AS plant_pk, p.plantid AS plant_business_id, p.plantname,
       d.id AS department_id, d.departmentname, d.isactive AS department_active
FROM plants p
JOIN idxplantsdepartments ip ON ip.plantid = p.id
JOIN departments d ON d.id = ip.departmentid
WHERE p.id = 7201 AND d.id = 7301;

SELECT st.typecode, mc.id AS category_id, mc.categoryname, mc.isactive AS category_active,
       mg.id AS group_id, mg.sapgroupcode, mg.isactive AS group_active
FROM material_categories mc
JOIN specification_types st ON st.id = mc.specificationtypeid
JOIN material_groups mg ON mg.materialcategoryid = mc.id
WHERE mc.id IN (7501, 7502)
ORDER BY mc.id;

SELECT st.typecode, r.id, r.optionname, r.isactive
FROM reason_to_procure_options r
JOIN specification_types st ON st.id = r.specificationtypeid
WHERE r.id IN (7701, 7702)
ORDER BY r.id;

SELECT st.typecode, ss.sectioncode, sa.attributecode, sa.isactive
FROM specification_sections ss
JOIN specification_types st ON st.id = ss.specificationtypeid
JOIN specification_attributes sa ON sa.sectionid = ss.id
WHERE ss.id IN (7801, 7802)
ORDER BY ss.id, sa.sortorder;

COMMIT;

-- Cleanup is intentionally commented. First delete test specifications that
-- reference these rows; their values, revisions, and status history cascade.
-- DELETE FROM specification_attributes WHERE id BETWEEN 7810 AND 7835;
-- DELETE FROM specification_sections WHERE id IN (7801, 7802);
-- DELETE FROM reason_to_procure_options WHERE id IN (7701, 7702);
-- DELETE FROM material_groups WHERE id IN (7601, 7602);
-- DELETE FROM material_categories WHERE id IN (7501, 7502);
-- DELETE FROM idxplantsdepartments WHERE id = 7401;
-- DELETE FROM departments WHERE id = 7301;
-- DELETE FROM plants WHERE id = 7201;
-- DELETE FROM specification_types WHERE id IN (7101, 7102);
