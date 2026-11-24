-- =====================================================
-- E-SPEC TEST DATABASE
-- Final schema berdasarkan Excel dan migration
-- Target: e_spec_test_db
-- =====================================================

BEGIN;

-- =====================================================
-- 1. SPECIFICATION TYPES
-- =====================================================

CREATE TABLE specification_types (
    id SMALLINT PRIMARY KEY,
    typecode VARCHAR(20) NOT NULL,
    typename VARCHAR(50) NOT NULL,
    isactive BOOLEAN NOT NULL DEFAULT TRUE,
    createdby VARCHAR(100),
    createddate TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updatedby VARCHAR(100),
    updateddate TIMESTAMP WITHOUT TIME ZONE
);

-- =====================================================
-- 2. PLANTS
-- =====================================================

CREATE TABLE plants (
    id SERIAL PRIMARY KEY,
    plantname VARCHAR(100) NOT NULL,
    createdby VARCHAR(100) NOT NULL,
    createddate TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedby VARCHAR(100),
    updateddate TIMESTAMP WITHOUT TIME ZONE,
    plantid INTEGER NOT NULL
);

-- =====================================================
-- 3. DEPARTMENTS
-- =====================================================

CREATE TABLE departments (
    id BIGINT PRIMARY KEY,
    departmentname VARCHAR(150) NOT NULL,
    managername VARCHAR(150),
    groupingname VARCHAR(100),
    isactive BOOLEAN NOT NULL DEFAULT TRUE,
    createdby VARCHAR(100),
    createddate TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updatedby VARCHAR(100),
    updateddate TIMESTAMP WITHOUT TIME ZONE
);

-- =====================================================
-- 4. SUB DEPARTMENTS
-- =====================================================

CREATE TABLE sub_departments (
    id BIGINT PRIMARY KEY,
    subdepartmentname VARCHAR(150) NOT NULL,
    departmentid BIGINT NOT NULL,
    managername VARCHAR(150),
    isactive BOOLEAN NOT NULL DEFAULT TRUE,
    createdby VARCHAR(100),
    createddate TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updatedby VARCHAR(100),
    updateddate TIMESTAMP WITHOUT TIME ZONE,

    CONSTRAINT sub_departments_departmentid_fkey
        FOREIGN KEY (departmentid)
        REFERENCES departments(id)
);

-- =====================================================
-- 5. PLANT - DEPARTMENT RELATION
-- =====================================================

CREATE TABLE idxplantsdepartments (
    id SERIAL PRIMARY KEY,
    plantid INTEGER NOT NULL,
    departmentid INTEGER NOT NULL,
    createdby VARCHAR(100) DEFAULT 'system',
    createddate TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updatedby VARCHAR(100),
    updateddate TIMESTAMP WITHOUT TIME ZONE,

    CONSTRAINT fk_idxplantsdepartments_plant
        FOREIGN KEY (plantid)
        REFERENCES plants(id),

    CONSTRAINT fk_idxplantsdepartments_department
        FOREIGN KEY (departmentid)
        REFERENCES departments(id)
);

-- =====================================================
-- 6. MATERIAL CATEGORIES
-- =====================================================

CREATE TABLE material_categories (
    id BIGINT PRIMARY KEY,
    categoryname VARCHAR(150) NOT NULL,
    specificationtypeid SMALLINT,
    description TEXT,
    isactive BOOLEAN NOT NULL DEFAULT TRUE,
    createdby VARCHAR(100),
    createddate TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updatedby VARCHAR(100),
    updateddate TIMESTAMP WITHOUT TIME ZONE,

    CONSTRAINT material_categories_specificationtypeid_fkey
        FOREIGN KEY (specificationtypeid)
        REFERENCES specification_types(id)
);

-- =====================================================
-- 7. MATERIAL GROUPS
-- =====================================================

CREATE TABLE material_groups (
    id BIGINT PRIMARY KEY,
    materialcategoryid BIGINT NOT NULL,
    groupno INTEGER,
    sapgroupcode VARCHAR(80) NOT NULL,
    dashboardgroupname VARCHAR(150),
    eprgroupname VARCHAR(150),
    description TEXT,
    slaallplant2025 INTEGER,
    approvalpatternno SMALLINT,
    isactive BOOLEAN NOT NULL DEFAULT TRUE,
    createdby VARCHAR(100),
    createddate TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updatedby VARCHAR(100),
    updateddate TIMESTAMP WITHOUT TIME ZONE,

    CONSTRAINT material_groups_materialcategoryid_fkey
        FOREIGN KEY (materialcategoryid)
        REFERENCES material_categories(id)
);

-- =====================================================
-- 8. APPROVAL PATTERNS
-- =====================================================

CREATE TABLE approval_patterns (
    id BIGINT PRIMARY KEY,
    patternno SMALLINT NOT NULL,
    patternname VARCHAR(150),
    description TEXT,
    isactive BOOLEAN NOT NULL DEFAULT TRUE,
    createdby VARCHAR(100) NOT NULL,
    createddate TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedby VARCHAR(100),
    updateddate TIMESTAMP WITHOUT TIME ZONE
);

-- =====================================================
-- 9. APPROVAL MATRIX RULES
-- =====================================================

CREATE TABLE approval_matrix_rules (
    id BIGINT PRIMARY KEY,
    approvalpatternid BIGINT NOT NULL,
    stepno SMALLINT NOT NULL,
    approverrole VARCHAR(100) NOT NULL,
    approverdescription VARCHAR(200),
    isrequired BOOLEAN NOT NULL DEFAULT TRUE,
    isactive BOOLEAN NOT NULL DEFAULT TRUE,
    createdby VARCHAR(100),
    createddate TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updatedby VARCHAR(100),
    updateddate TIMESTAMP WITHOUT TIME ZONE,

    CONSTRAINT approval_matrix_rules_approvalpatternid_fkey
        FOREIGN KEY (approvalpatternid)
        REFERENCES approval_patterns(id)
);

-- =====================================================
-- 10. ADDITIONAL SERVICE OPTIONS
-- =====================================================

CREATE TABLE additional_service_options (
    additional_service_option_id BIGINT PRIMARY KEY,
    option_name VARCHAR(150) NOT NULL,
    description TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    createdby VARCHAR(100) NOT NULL,
    createddate TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedby VARCHAR(100),
    updateddate TIMESTAMP WITHOUT TIME ZONE
);

-- =====================================================
-- 11. ATTACHMENT DOCUMENT OPTIONS
-- =====================================================

CREATE TABLE attachment_document_options (
    attachment_document_option_id BIGINT PRIMARY KEY,
    document_name VARCHAR(180) NOT NULL,
    allows_custom_text BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    createdby VARCHAR(100) NOT NULL,
    createddate TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedby VARCHAR(100),
    updateddate TIMESTAMP WITHOUT TIME ZONE
);

-- =====================================================
-- 12. CREATED BY REFERENCES
-- =====================================================

CREATE TABLE created_by_references (
    created_by_reference_id BIGINT PRIMARY KEY,
    reference_code VARCHAR(100) NOT NULL,
    description VARCHAR(150),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    createdby VARCHAR(100) NOT NULL,
    createddate TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedby VARCHAR(100),
    updateddate TIMESTAMP WITHOUT TIME ZONE
);

-- =====================================================
-- 13. ELECTRICAL UOMS
-- =====================================================

CREATE TABLE electrical_uoms (
    electrical_uom_id BIGINT PRIMARY KEY,
    uom_code VARCHAR(30) NOT NULL,
    description VARCHAR(150),
    electrical_group VARCHAR(100),
    createdby VARCHAR(100) NOT NULL,
    createddate TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedby VARCHAR(100),
    updateddate TIMESTAMP WITHOUT TIME ZONE
);

-- =====================================================
-- 14. MECHANICAL DIMENSIONS
-- =====================================================

CREATE TABLE mechanical_dimensions (
    mechanical_dimension_id BIGINT PRIMARY KEY,
    dimension_code VARCHAR(30) NOT NULL,
    description_english VARCHAR(150),
    description_indonesia VARCHAR(150),
    sap_dimension_code VARCHAR(30),
    createdby VARCHAR(100) NOT NULL,
    createddate TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedby VARCHAR(100),
    updateddate TIMESTAMP WITHOUT TIME ZONE
);

-- =====================================================
-- 15. PURCHASE GROUPS
-- =====================================================

CREATE TABLE purchase_groups (
    purchase_group_id BIGINT PRIMARY KEY,
    purchase_group_code VARCHAR(20) NOT NULL,
    purchase_group_name VARCHAR(150) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    createdby VARCHAR(100) NOT NULL,
    createddate TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedby VARCHAR(100),
    updateddate TIMESTAMP WITHOUT TIME ZONE
);

-- =====================================================
-- 16. REASON TO PROCURE OPTIONS
-- =====================================================

CREATE TABLE reason_to_procure_options (
    id BIGINT PRIMARY KEY,
    specificationtypeid SMALLINT NOT NULL,
    optionname VARCHAR(150) NOT NULL,
    description TEXT,
    allowscustomtext BOOLEAN NOT NULL DEFAULT FALSE,
    sortorder INTEGER NOT NULL DEFAULT 0,
    isactive BOOLEAN NOT NULL DEFAULT TRUE,
    createdby VARCHAR(100),
    createddate TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updatedby VARCHAR(100),
    updateddate TIMESTAMP WITHOUT TIME ZONE,

    CONSTRAINT reason_to_procure_options_specificationtypeid_fkey
        FOREIGN KEY (specificationtypeid)
        REFERENCES specification_types(id)
);

-- =====================================================
-- 17. REQUIRED DOCUMENT OPTIONS
-- =====================================================

CREATE TABLE required_document_options (
    id BIGINT PRIMARY KEY,
    specificationtypeid SMALLINT NOT NULL,
    documentname VARCHAR(180) NOT NULL,
    allowscustomtext BOOLEAN NOT NULL DEFAULT FALSE,
    sortorder INTEGER NOT NULL DEFAULT 0,
    isactive BOOLEAN NOT NULL DEFAULT TRUE,
    createdby VARCHAR(100),
    createddate TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updatedby VARCHAR(100),
    updateddate TIMESTAMP WITHOUT TIME ZONE,

    CONSTRAINT required_document_options_specificationtypeid_fkey
        FOREIGN KEY (specificationtypeid)
        REFERENCES specification_types(id)
);

-- =====================================================
-- 18. SYMBOLS
-- =====================================================

CREATE TABLE symbols (
    symbol_id BIGINT PRIMARY KEY,
    symbol_value VARCHAR(30) NOT NULL,
    description VARCHAR(150),
    createdby VARCHAR(100) NOT NULL,
    createddate TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedby VARCHAR(100),
    updateddate TIMESTAMP WITHOUT TIME ZONE
);

-- =====================================================
-- 19. UOM GENERAL
-- =====================================================

CREATE TABLE uom_general (
    uom_id BIGINT PRIMARY KEY,
    uom_code VARCHAR(30) NOT NULL,
    commercial_code VARCHAR(30),
    description VARCHAR(200),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    createdby VARCHAR(100) NOT NULL,
    createddate TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedby VARCHAR(100),
    updateddate TIMESTAMP WITHOUT TIME ZONE
);

-- =====================================================
-- 20. SPECIFICATION SECTIONS
-- =====================================================

CREATE TABLE specification_sections (
    id BIGINT PRIMARY KEY,
    specificationtypeid SMALLINT NOT NULL,
    sectioncode VARCHAR(50) NOT NULL,
    sectionname VARCHAR(150) NOT NULL,
    sortorder INTEGER NOT NULL DEFAULT 0,
    isactive BOOLEAN NOT NULL DEFAULT TRUE,
    createdby VARCHAR(100),
    createddate TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updatedby VARCHAR(100),
    updateddate TIMESTAMP WITHOUT TIME ZONE,

    CONSTRAINT specification_sections_specificationtypeid_fkey
        FOREIGN KEY (specificationtypeid)
        REFERENCES specification_types(id)
);

-- =====================================================
-- 21. SPECIFICATION ATTRIBUTES
-- =====================================================

CREATE TABLE specification_attributes (
    id BIGINT PRIMARY KEY,
    sectionid BIGINT NOT NULL,
    parentattributeid BIGINT,
    attributecode VARCHAR(100) NOT NULL,
    attributename VARCHAR(200) NOT NULL,
    description TEXT,
    inputtype VARCHAR(80),
    defaultrequired BOOLEAN NOT NULL DEFAULT FALSE,
    allowscustomoption BOOLEAN NOT NULL DEFAULT FALSE,
    supportsattachment BOOLEAN NOT NULL DEFAULT FALSE,
    supportsmultiplevalues BOOLEAN NOT NULL DEFAULT FALSE,
    sortorder INTEGER NOT NULL DEFAULT 0,
    isactive BOOLEAN NOT NULL DEFAULT TRUE,
    createdby VARCHAR(100),
    createddate TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updatedby VARCHAR(100),
    updateddate TIMESTAMP WITHOUT TIME ZONE,

    CONSTRAINT specification_attributes_sectionid_fkey
        FOREIGN KEY (sectionid)
        REFERENCES specification_sections(id),

    CONSTRAINT specification_attributes_parentattributeid_fkey
        FOREIGN KEY (parentattributeid)
        REFERENCES specification_attributes(id)
);

-- =====================================================
-- 22. ATTRIBUTE OPTIONS
-- =====================================================

CREATE TABLE attribute_options (
    id BIGINT PRIMARY KEY,
    attributeid BIGINT NOT NULL,
    optionvalue VARCHAR(200) NOT NULL,
    optiondescription TEXT,
    sortorder INTEGER NOT NULL DEFAULT 0,
    isactive BOOLEAN NOT NULL DEFAULT TRUE,
    createdby VARCHAR(100),
    createddate TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updatedby VARCHAR(100),
    updateddate TIMESTAMP WITHOUT TIME ZONE,

    CONSTRAINT attribute_options_attributeid_fkey
        FOREIGN KEY (attributeid)
        REFERENCES specification_attributes(id)
);

-- =====================================================
-- 23. MATERIAL GROUP ATTRIBUTE RULES
-- =====================================================

CREATE TABLE material_group_attribute_rules (
    id BIGINT PRIMARY KEY,
    materialgroupid BIGINT NOT NULL,
    attributeid BIGINT NOT NULL,
    requirementcode CHARACTER(1) NOT NULL,
    createdby VARCHAR(100),
    createddate TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updatedby VARCHAR(100),
    updateddate TIMESTAMP WITHOUT TIME ZONE,

    CONSTRAINT material_group_attribute_rules_materialgroupid_fkey
        FOREIGN KEY (materialgroupid)
        REFERENCES material_groups(id),

    CONSTRAINT material_group_attribute_rules_attributeid_fkey
        FOREIGN KEY (attributeid)
        REFERENCES specification_attributes(id)
);

-- =====================================================
-- 24. SPECIFICATIONS
-- =====================================================

CREATE TABLE specifications (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    documentno VARCHAR(80) NOT NULL,
    revisionno INTEGER NOT NULL DEFAULT 0,
    specificationtypeid SMALLINT NOT NULL,
    plantid INTEGER NOT NULL,
    departmentid BIGINT,
    subdepartmentid BIGINT,
    materialcategoryid BIGINT,
    materialgroupid BIGINT,
    requestor VARCHAR(150) NOT NULL,
    materialdescription TEXT NOT NULL,
    materialcode VARCHAR(80),
    purchasegroupid BIGINT,
    reasonprocure TEXT,
    status VARCHAR(40) NOT NULL DEFAULT 'Draft',
    formdata JSONB NOT NULL DEFAULT '{}'::jsonb,
    submittedat TIMESTAMP WITHOUT TIME ZONE,
    createdby VARCHAR(100),
    createddate TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updatedby VARCHAR(100),
    updateddate TIMESTAMP WITHOUT TIME ZONE,
    createdbyuserid VARCHAR(255),
    updatedbyuserid VARCHAR(255),

    CONSTRAINT specifications_specificationtypeid_fkey
        FOREIGN KEY (specificationtypeid)
        REFERENCES specification_types(id),

    CONSTRAINT specifications_plantid_fkey
        FOREIGN KEY (plantid)
        REFERENCES plants(id),

    CONSTRAINT specifications_departmentid_fkey
        FOREIGN KEY (departmentid)
        REFERENCES departments(id),

    CONSTRAINT specifications_subdepartmentid_fkey
        FOREIGN KEY (subdepartmentid)
        REFERENCES sub_departments(id),

    CONSTRAINT specifications_materialcategoryid_fkey
        FOREIGN KEY (materialcategoryid)
        REFERENCES material_categories(id),

    CONSTRAINT specifications_materialgroupid_fkey
        FOREIGN KEY (materialgroupid)
        REFERENCES material_groups(id)
);

-- =====================================================
-- 25. SPECIFICATION STATUS HISTORY
-- =====================================================

CREATE TABLE specification_status_history (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    specificationid BIGINT NOT NULL,
    previousstatus VARCHAR(40),
    newstatus VARCHAR(40) NOT NULL,
    changedby VARCHAR(150),
    changereason TEXT,
    changedat TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    createdby VARCHAR(100),
    createddate TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updatedby VARCHAR(100),
    updateddate TIMESTAMP WITHOUT TIME ZONE,
    changedbyuserid VARCHAR(255),

    CONSTRAINT specification_status_history_specificationid_fkey
        FOREIGN KEY (specificationid)
        REFERENCES specifications(id)
);

-- =====================================================
-- 26. SPECIFICATION REVISIONS
-- =====================================================

CREATE TABLE specification_revisions (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    specificationid BIGINT NOT NULL,
    revisionno INTEGER NOT NULL,
    revisionnote TEXT,
    snapshotdata JSONB NOT NULL DEFAULT '{}'::jsonb,
    revisedby VARCHAR(100),
    revisedat TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    createdby VARCHAR(100),
    createddate TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updatedby VARCHAR(100),
    updateddate TIMESTAMP WITHOUT TIME ZONE,

    CONSTRAINT specification_revisions_specificationid_fkey
        FOREIGN KEY (specificationid)
        REFERENCES specifications(id)
);

-- =====================================================
-- 27. SPECIFICATION VALUES
-- =====================================================

CREATE TABLE specification_values (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    specificationid BIGINT NOT NULL,
    attributeid BIGINT NOT NULL,
    optionid BIGINT,
    valuetext TEXT,
    valuenumber NUMERIC,
    valueboolean BOOLEAN,
    valuejson JSONB,
    sortorder INTEGER NOT NULL DEFAULT 0,
    createdby VARCHAR(100),
    createddate TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updatedby VARCHAR(100),
    updateddate TIMESTAMP WITHOUT TIME ZONE,

    CONSTRAINT specification_values_specificationid_fkey
        FOREIGN KEY (specificationid)
        REFERENCES specifications(id),

    CONSTRAINT specification_values_attributeid_fkey
        FOREIGN KEY (attributeid)
        REFERENCES specification_attributes(id),

    CONSTRAINT specification_values_optionid_fkey
        FOREIGN KEY (optionid)
        REFERENCES attribute_options(id)
);

-- =====================================================
-- 28. SPECIFICATION ATTACHMENTS
-- =====================================================

CREATE TABLE specification_attachments (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    specificationid BIGINT NOT NULL,
    attributeid BIGINT,
    documentoptionid BIGINT,
    filename VARCHAR(255) NOT NULL,
    storagepath TEXT NOT NULL,
    mimetype VARCHAR(150),
    filesize BIGINT,
    description TEXT,
    uploadedby VARCHAR(100),
    uploadedat TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    createdby VARCHAR(100),
    createddate TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updatedby VARCHAR(100),
    updateddate TIMESTAMP WITHOUT TIME ZONE,

    CONSTRAINT specification_attachments_specificationid_fkey
        FOREIGN KEY (specificationid)
        REFERENCES specifications(id),

    CONSTRAINT specification_attachments_attributeid_fkey
        FOREIGN KEY (attributeid)
        REFERENCES specification_attributes(id)
);

-- =====================================================
-- 29. SPECIFICATION APPROVAL CYCLES
-- =====================================================

CREATE TABLE specification_approval_cycles (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    specificationid BIGINT NOT NULL,
    cycleno INTEGER NOT NULL,
    approvalpatternid BIGINT,
    approvalpatternno SMALLINT,
    approvalpatternname VARCHAR(150),
    status VARCHAR(30) NOT NULL,
    submittedbyuserid VARCHAR(255),
    submittedbydisplayname VARCHAR(150),
    submittedat TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completedat TIMESTAMP WITHOUT TIME ZONE,
    closedreason TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT specification_approval_cycles_specificationid_fkey
        FOREIGN KEY (specificationid)
        REFERENCES specifications(id)
        ON DELETE CASCADE,

    CONSTRAINT specification_approval_cycles_approvalpatternid_fkey
        FOREIGN KEY (approvalpatternid)
        REFERENCES approval_patterns(id),

    CONSTRAINT chk_specification_approval_cycle_number
        CHECK (cycleno > 0),

    CONSTRAINT chk_specification_approval_cycle_status
        CHECK (status IN ('Active', 'Completed', 'Returned', 'Rejected')),

    CONSTRAINT uq_specification_approval_cycle
        UNIQUE (specificationid, cycleno),

    CONSTRAINT uq_specification_approval_cycle_id_specification
        UNIQUE (id, specificationid)
);

CREATE INDEX idx_specification_approval_cycles_specificationid
    ON specification_approval_cycles (specificationid);

CREATE UNIQUE INDEX uq_specification_approval_cycles_active_specification
    ON specification_approval_cycles (specificationid)
    WHERE status = 'Active';

-- =====================================================
-- 30. SPECIFICATION APPROVAL STEPS
-- =====================================================

CREATE TABLE specification_approval_steps (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    specificationid BIGINT NOT NULL,
    approvalmatrixruleid BIGINT,
    stepno SMALLINT NOT NULL,
    approverrole VARCHAR(100) NOT NULL,
    approvername VARCHAR(150),
    approvalstatus VARCHAR(30) NOT NULL DEFAULT 'Pending',
    comments TEXT,
    actionby VARCHAR(150),
    actionat TIMESTAMP WITHOUT TIME ZONE,
    createdby VARCHAR(100),
    createddate TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updatedby VARCHAR(100),
    updateddate TIMESTAMP WITHOUT TIME ZONE,
    approvalcycleid BIGINT,
    assignedapproveruserid VARCHAR(255),
    actionbyuserid VARCHAR(255),

    CONSTRAINT specification_approval_steps_specificationid_fkey
        FOREIGN KEY (specificationid)
        REFERENCES specifications(id),

    CONSTRAINT specification_approval_steps_approvalmatrixruleid_fkey
        FOREIGN KEY (approvalmatrixruleid)
        REFERENCES approval_matrix_rules(id),

    CONSTRAINT specification_approval_steps_approvalcycleid_fkey
        FOREIGN KEY (approvalcycleid)
        REFERENCES specification_approval_cycles(id)
        ON DELETE CASCADE,

    CONSTRAINT specification_approval_steps_cycle_specification_fkey
        FOREIGN KEY (approvalcycleid, specificationid)
        REFERENCES specification_approval_cycles(id, specificationid),

    CONSTRAINT uq_specification_approval_cycle_step
        UNIQUE (approvalcycleid, stepno),

    CONSTRAINT chk_specification_approval_steps_status
        CHECK (
            approvalstatus IN (
                'Pending',
                'Approved',
                'Returned',
                'Rejected',
                'Cancelled'
            )
        )
);

CREATE INDEX idx_specification_approval_steps_approvalcycleid
    ON specification_approval_steps (approvalcycleid);

CREATE INDEX idx_specification_approval_steps_assigned_pending
    ON specification_approval_steps (assignedapproveruserid)
    WHERE approvalstatus = 'Pending';

-- =====================================================
-- 31. SPECIFICATION APPROVAL STEP EVENTS
-- =====================================================

CREATE TABLE specification_approval_step_events (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    specificationid BIGINT NOT NULL,
    approvalcycleid BIGINT NOT NULL,
    approvalstepid BIGINT NOT NULL,
    assignedapproveruserid VARCHAR(255),
    actoruserid VARCHAR(255),
    actordisplayname VARCHAR(150),
    actorrole VARCHAR(100),
    eventtype VARCHAR(30) NOT NULL,
    previousstepstatus VARCHAR(30),
    newstepstatus VARCHAR(30) NOT NULL,
    comments TEXT,
    occurredat TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT specification_approval_step_events_specificationid_fkey
        FOREIGN KEY (specificationid)
        REFERENCES specifications(id)
        ON DELETE CASCADE,

    CONSTRAINT specification_approval_step_events_approvalcycleid_fkey
        FOREIGN KEY (approvalcycleid)
        REFERENCES specification_approval_cycles(id)
        ON DELETE CASCADE,

    CONSTRAINT specification_approval_step_events_approvalstepid_fkey
        FOREIGN KEY (approvalstepid)
        REFERENCES specification_approval_steps(id)
        ON DELETE CASCADE,

    CONSTRAINT chk_specification_approval_step_events_type
        CHECK (
            eventtype IN (
                'Approved',
                'Returned',
                'Rejected',
                'Cancelled'
            )
        ),

    CONSTRAINT chk_specification_approval_step_events_status
        CHECK (
            newstepstatus IN (
                'Approved',
                'Returned',
                'Rejected',
                'Cancelled'
            )
        )
);

CREATE INDEX idx_specification_approval_step_events_specificationid
    ON specification_approval_step_events (specificationid);

CREATE INDEX idx_specification_approval_step_events_approvalcycleid
    ON specification_approval_step_events (approvalcycleid);

CREATE INDEX idx_specification_approval_step_events_approvalstepid
    ON specification_approval_step_events (approvalstepid);

-- =====================================================
-- FINISH
-- =====================================================

COMMIT;