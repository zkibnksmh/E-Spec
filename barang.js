(() => {
  "use strict";

  // =====================================================
  // E-SPEC BARANG — QUESTIONNAIRE CONTROLLER
  // =====================================================

  const VERSION_STORAGE_KEY = "eSpecBarangVersion.v1";
  const API_BASE_URL = window.ESPEC_CONFIG?.API_BASE_URL || "http://localhost:3000/api";
  const DEV_IDENTITY_ALIASES = ["requestor", "manager", "head-engineering"];

  function getApiHeaders() {
    const headers = { "Content-Type": "application/json" };
    const configuredIdentity = window.ESPEC_CONFIG?.DEV_IDENTITY;
    const identity = typeof configuredIdentity === "string"
      ? configuredIdentity.trim().toLowerCase()
      : "";

    if (DEV_IDENTITY_ALIASES.includes(identity)) {
      headers["X-ESpec-Dev-Identity"] = identity;
    }

    return headers;
  }

  const questionnaire = document.getElementById("questionnaireForm");
  const printForm = document.getElementById("printSpecForm");

  if (!questionnaire) {
    console.error("Form kuesioner Barang tidak ditemukan.");
    return;
  }

  const $ = (selector, parent = document) =>
    parent.querySelector(selector);

  const $$ = (selector, parent = document) =>
    [...parent.querySelectorAll(selector)];

  const resetBtn = $("#resetBtn");
  const saveBtn = $("#saveAdminBtn");
  const submitBtn = $("#submitBtn");
  const draftStatus = $("#draftStatus");

  const plantSelect = $("#plantCodeSelect");
  const plantDesc = $("#plantDescInput");
  const deptSelect = $("#deptSelect");
  const materialGroupSelect = $("#materialGroup");
  const materialCategoryOptions = $("#materialCategoryOptions");

  const reasonChoice = $("#reasonChoice");
  const reasonOther = $("#reasonOther");
  const reasonOthers = $("#reasonOthersBarang");
  const reasonFinal = $("#reasonFinal");

  const dimensionContainer = $("#dimensionRows");
  const drawingUpload = $("#questionDrawingUpload");
  const drawingPreview = $("#drawingPreview");

  const technicalContainer = $("#dynamicCustomTechnicalContainer");
  const uniqueContainer = $("#dynamicCustomUniqueContainer");

  // =====================================================
  // REQUIRED DOCUMENTS
  // =====================================================

  const requiredDocumentsContainer = $("#requiredDocumentsContainer");
  const addRequiredDocumentBtn = $("#addRequiredDocumentBtn");

  const requiredDocumentOptions = [
    ...$$(
      'input[type="hidden"][name^="document"]',
      questionnaire
    )
      .map(input => input.value.trim())
      .filter(Boolean)
  ];

  if (!requiredDocumentOptions.includes("Others")) {
    requiredDocumentOptions.push("Others");
  }

  const DIMENSION_OPTIONS = ["L", "W", "H", "T", "ID", "OD", "DN"];
  const DIMENSION_SYMBOLS = ["/", "x", "~", "-", "±"];

  const MECHANICAL_PARAMETERS = [
    "Capacity",
    "Pressure",
    "Flowrate",
    "Speed",
    "Tolerance"
  ];

  const MECHANICAL_SYMBOLS = ["x", "--", "~", "/", "±", "-"];

  // Source: OLAH DATA WEB.xlsx, MATRIKS ATT. MAT (2). Only `*` values
  // become save blockers; `O` values remain optional.
  const MATERIAL_GROUP_REQUIRED_FIELDS = {
    BEARING: ["materialDescription", "partNumber", "variant", "dimension", "brand", "uom"],
    MATERIAL: ["materialDescription", "variant", "dimension", "uom"],
    GASKET: ["materialDescription", "variant", "dimension", "uom", "technical:Material"],
    MS: ["materialDescription", "variant", "dimension", "uom", "technical:Material"],
    ELECTRIC: ["materialDescription", "partNumber", "variant", "brand", "uom", "technical:Voltage", "technical:Phase", "technical:Power", "technical:Current", "technical:Frequency"],
    PIPE: ["materialDescription", "variant", "dimension", "uom", "technical:Material"],
    BNR: ["materialDescription", "variant", "dimension", "uom", "technical:Material"],
    LUBRICANT: ["materialDescription", "partNumber", "uom", "packSize", "technical:Konsentrasi", "technical:Viscositas"],
    CABLE: ["materialDescription", "partNumber", "variant", "dimension", "uom"],
    VALVE: ["materialDescription", "variant", "dimension", "uom", "technical:Material", "technical:Connection Type"],
    EQUIPMENT: ["materialDescription", "partNumber", "variant", "dimension", "uom"],
    PAINT: ["materialDescription", "partNumber", "variant", "brand", "catalogue", "uom", "packSize"],
    IT: ["materialDescription", "partNumber", "variant", "uom"],
    "BARANG UM": ["materialDescription", "partNumber", "variant", "uom"],
    K3: ["materialDescription", "partNumber", "variant", "uom"],
    LAB_MAT: ["materialDescription", "variant", "brand", "catalogue", "uom", "packSize"],
    ATK: ["materialDescription", "variant", "uom"],
    "ASSET UMU": ["materialDescription", "uom"],
    "ASSET TEK": ["materialDescription", "uom"],
    "ASSET LAB": ["materialDescription", "uom"]
  };

  let drawingImage = "";
  let loadingDocument = false;
  let saving = false;
  let submitting = false;
  let masterDataReady = false;
  let barangSpecificationTypeId = null;
  let persistedDraftId = null;
  let persistedDocumentNo = null;
  let hasUnsavedChanges = false;
  let legacyPendingClear = false;
  let plants = [];
  let categories = [];
  let departmentRequestId = 0;
  let materialGroupRequestId = 0;
  let pendingMaterialCategoryValue = "";
  let pendingMaterialGroupValue = "";

  // =====================================================
  // MATERIAL GROUP — OTHERS
  // =====================================================

  const materialGroupOtherInput = $("#materialGroupOther", questionnaire);

  function updateMaterialGroupOther(clearValue = true) {
    if (!materialGroupSelect || !materialGroupOtherInput) return;

    const isOthers = materialGroupSelect.value === "Others";

    materialGroupOtherInput.hidden = !isOthers;
    materialGroupOtherInput.disabled = !isOthers;
    materialGroupOtherInput.required = isOthers;

    if (!isOthers && clearValue) {
      materialGroupOtherInput.value = "";
    }
  }




  // =====================================================
  // MATERIAL GROUP MATRIX — FULL SPECIFICATION
  //
  // * = Mandatory
  // O = Optional
  // "" = Hidden
  // =====================================================

  const MATERIAL_GROUP_MATRIX = {
    "BEARING": {
      materialDescription: "*",
      materialCode: "O",
      partNumber: "*",
      variant: "*",
      dimension: "*",
      brand: "*",
      catalogue: "O",
      uom: "*",
      packSize: "O",

      voltage: "",
      current: "",
      power: "",
      resistance: "",
      frequency: "",
      capacitance: "",
      phase: "",
      temperature: "",

      material: "O",
      capacity: "",
      connectionType: "",
      pressure: "",
      flowrate: "",
      speed: "",
      tolerance: "",

      concentration: "",
      viscosity: "",
      technicalOthers: "O",

      accessories: "O",
      uniqueOthers: "O"
    },

    "ELECTRIC": {
      materialDescription: "*",
      materialCode: "O",
      partNumber: "*",
      variant: "*",
      dimension: "O",
      brand: "*",
      catalogue: "O",
      uom: "*",
      packSize: "O",

      voltage: "*",
      current: "*",
      power: "*",
      resistance: "O",
      frequency: "O",
      capacitance: "O",
      phase: "O",
      temperature: "O",

      material: "",
      capacity: "",
      connectionType: "",
      pressure: "",
      flowrate: "",
      speed: "",
      tolerance: "",

      concentration: "",
      viscosity: "",
      technicalOthers: "O",

      accessories: "O",
      uniqueOthers: "O"
    },

    "PIPE": {
      materialDescription: "*",
      materialCode: "O",
      partNumber: "O",
      variant: "*",
      dimension: "*",
      brand: "O",
      catalogue: "O",
      uom: "*",
      packSize: "O",

      voltage: "",
      current: "",
      power: "",
      resistance: "",
      frequency: "",
      capacitance: "",
      phase: "",
      temperature: "",

      material: "*",
      capacity: "",
      connectionType: "O",
      pressure: "O",
      flowrate: "",
      speed: "",
      tolerance: "O",

      concentration: "",
      viscosity: "",
      technicalOthers: "O",

      accessories: "O",
      uniqueOthers: "O"
    },

    "EQUIPMENT": {
      materialDescription: "*",
      materialCode: "O",
      partNumber: "*",
      variant: "*",
      dimension: "*",
      brand: "O",
      catalogue: "O",
      uom: "*",
      packSize: "O",

      voltage: "",
      current: "",
      power: "",
      resistance: "",
      frequency: "",
      capacitance: "",
      phase: "",
      temperature: "O",

      material: "O",
      capacity: "O",
      connectionType: "",
      pressure: "",
      flowrate: "",
      speed: "",
      tolerance: "O",

      concentration: "",
      viscosity: "",
      technicalOthers: "O",

      accessories: "O",
      uniqueOthers: "O"
    },

    "BARANG UM": {
      materialDescription: "*",
      materialCode: "O",
      partNumber: "*",
      variant: "*",
      dimension: "O",
      brand: "O",
      catalogue: "O",
      uom: "*",
      packSize: "O",

      voltage: "",
      current: "",
      power: "",
      resistance: "",
      frequency: "",
      capacitance: "",
      phase: "",
      temperature: "",

      material: "O",
      capacity: "O",
      connectionType: "",
      pressure: "",
      flowrate: "",
      speed: "",
      tolerance: "O",

      concentration: "",
      viscosity: "",
      technicalOthers: "O",

      accessories: "O",
      uniqueOthers: "O"
    },

    // =====================================================
    // CAPEX — ASSET UMU
    // =====================================================

    "ASSET UMU": {
      materialDescription: "*",
      materialCode: "O",
      partNumber: "O",
      variant: "O",
      dimension: "O",
      brand: "O",
      catalogue: "O",
      uom: "*",
      packSize: "O",

      voltage: "O",
      current: "O",
      power: "O",
      resistance: "O",
      frequency: "O",
      capacitance: "O",
      phase: "O",
      temperature: "O",

      material: "O",
      capacity: "O",
      connectionType: "O",
      pressure: "O",
      flowrate: "O",
      speed: "O",
      tolerance: "O",

      concentration: "O",
      viscosity: "O",
      technicalOthers: "O",

      accessories: "O",
      uniqueOthers: "O"
    },

    // =====================================================
    // CAPEX — ASSET TEK
    // =====================================================

    "ASSET TEK": {
      materialDescription: "*",
      materialCode: "O",
      partNumber: "O",
      variant: "O",
      dimension: "O",
      brand: "O",
      catalogue: "O",
      uom: "*",
      packSize: "O",

      voltage: "O",
      current: "O",
      power: "O",
      resistance: "O",
      frequency: "O",
      capacitance: "O",
      phase: "O",
      temperature: "O",

      material: "O",
      capacity: "O",
      connectionType: "O",
      pressure: "O",
      flowrate: "O",
      speed: "O",
      tolerance: "O",

      concentration: "O",
      viscosity: "O",
      technicalOthers: "O",

      accessories: "O",
      uniqueOthers: "O"
    },

    // =====================================================
    // CAPEX — ASSET LAB
    // =====================================================

    "ASSET LAB": {
      materialDescription: "*",
      materialCode: "O",
      partNumber: "O",
      variant: "O",
      dimension: "O",
      brand: "O",
      catalogue: "O",
      uom: "*",
      packSize: "O",

      voltage: "O",
      current: "O",
      power: "O",
      resistance: "O",
      frequency: "O",
      capacitance: "O",
      phase: "O",
      temperature: "O",

      material: "O",
      capacity: "O",
      connectionType: "O",
      pressure: "O",
      flowrate: "O",
      speed: "O",
      tolerance: "O",

      concentration: "O",
      viscosity: "O",
      technicalOthers: "O",

      accessories: "O",
      uniqueOthers: "O"
    }
  };


  // =====================================================
  // GENERAL SPECIFICATION FIELDS
  // =====================================================

  const generalMatrixFields = {
    materialDescription: {
      wrapper: $('[name="materialDescription"]', questionnaire)?.closest(".q-field"),
      input: $('[name="materialDescription"]', questionnaire)
    },

    materialCode: {
      wrapper: $('[name="materialCode"]', questionnaire)?.closest(".q-field"),
      input: $('[name="materialCode"]', questionnaire)
    },

    partNumber: {
      wrapper: $('[name="partNumber"]', questionnaire)?.closest(".q-field"),
      input: $('[name="partNumber"]', questionnaire)
    },

    variant: {
      wrapper: $('[name="variant"]', questionnaire)?.closest(".q-field"),
      input: $('[name="variant"]', questionnaire)
    },

    dimension: {
      wrapper: $(".dimension-field", questionnaire),
      input: $("#dimensionFinal", questionnaire)
    },

    brand: {
      wrapper: $('[name="brand"]', questionnaire)?.closest(".q-field"),
      input: $('[name="brand"]', questionnaire)
    },

    catalogue: {
      wrapper: $('[name="catalogue"]', questionnaire)?.closest(".q-field"),
      input: $('[name="catalogue"]', questionnaire)
    },

    uom: {
      wrapper: $(".uom-field", questionnaire),
      input: $("#uomSelect", questionnaire)
    },

    packSize: {
      wrapper: $(".pack-size-field", questionnaire),
      input: $("#packSizeFinal", questionnaire)
    }
  };


  // =====================================================
  // TECHNICAL SPECIFICATION FIELDS
  // =====================================================

  const technicalMatrixFields = {

    // ELECTRICAL
    voltage: {
      wrapper: $('[data-electric-row="Voltage"]', questionnaire)
    },

    current: {
      wrapper: $('[data-electric-row="Current"]', questionnaire)
    },

    power: {
      wrapper: $('[data-electric-row="Power"]', questionnaire)
    },

    resistance: {
      wrapper: $('[data-electric-row="Resistance"]', questionnaire)
    },

    frequency: {
      wrapper: $('[data-electric-row="Frequency"]', questionnaire)
    },

    capacitance: {
      wrapper: $('[data-electric-row="Capacitance"]', questionnaire)
    },

    phase: {
      wrapper: $('[data-electric-row="Phase"]', questionnaire)
    },

    temperature: {
      wrapper: $('[data-electric-row="Temperature"]', questionnaire)
    },

    // MECHANICAL — MATERIAL
    material: {
      wrapper: $('[data-tech-label="Material"]', questionnaire)?.closest(".spec-field")
    },

    // MECHANICAL — CAPACITY
    capacity: {
      wrapper: $('[data-mechanical-row="Capacity"]', questionnaire)
    },

    // MECHANICAL — CONNECTION TYPE
    connectionType: {
      wrapper: $('[data-tech-label="Connection Type"]', questionnaire)?.closest(".spec-field")
    },

    pressure: {
      wrapper: $('[data-mechanical-row="Pressure"]', questionnaire)
    },

    flowrate: {
      wrapper: $('[data-mechanical-row="Flowrate"]', questionnaire)
    },

    speed: {
      wrapper: $('[data-mechanical-row="Speed"]', questionnaire)
    },

    tolerance: {
      wrapper: $('[data-mechanical-row="Tolerance"]', questionnaire)
    },

    // LIQUID
    concentration: {
      wrapper: $("#concentration", questionnaire)?.closest(".field")
    },

    viscosity: {
      wrapper: $("#viscosity", questionnaire)?.closest(".field")
    },

    // TECHNICAL OTHERS
    // Mencakup heading, tombol Add Custom Attribute,
    // dan dynamicCustomTechnicalContainer.
    technicalOthers: {
      wrapper: $("#dynamicCustomTechnicalContainer", questionnaire)
        ?.closest(".q-technical-group")
    }
  };


  // =====================================================
  // UNIQUE SPECIFICATION FIELDS
  // =====================================================

  const uniqueMatrixFields = {
    accessories: {
      wrapper: $(".unique-accessories-field", questionnaire)
    },

    // UNIQUE OTHERS
    // Mencakup heading, tombol addUniqueBtn,
    // Accessories, dan dynamicCustomUniqueContainer.
    // Bagian Unique Specification selalu opsional.
    uniqueOthers: {
      wrapper: $(".unique-specification-section", questionnaire)
    }
  };

// =====================================================
// TECHNICAL SPECIFICATION — REQUIRED STAR
// =====================================================

function updateTechnicalRequiredStar() {
  Object.entries(technicalMatrixFields).forEach(([key, field]) => {
    const wrapper = field.wrapper;
    if (!wrapper) return;

    const status = getCurrentMatrixStatus(key);

    let label = null;

    // ELECTRICAL
    if (
      ["voltage", "current", "power", "resistance",
       "frequency", "capacitance", "phase", "temperature"].includes(key)
    ) {
      label = wrapper.querySelector(".electric-parameter strong");
    }

    // MATERIAL & CONNECTION TYPE
    else if (key === "material" || key === "connectionType") {
      label = wrapper.querySelector("span");
    }

    // MECHANICAL
    else if (
      ["capacity", "pressure", "flowrate", "speed", "tolerance"].includes(key)
    ) {
      label = wrapper.querySelector(
        ".mechanical-parameter-heading strong"
      );
    }

    if (!label) return;

    // Hapus tanda bintang lama
    label.querySelectorAll(".matrix-required-star").forEach(star => {
      star.remove();
    });

    // Tambahkan tanda bintang jika wajib
    if (status === "*") {
      const star = document.createElement("span");

      star.className = "matrix-required-star";
      star.textContent = "*";
      star.setAttribute("aria-label", "Wajib diisi");

      label.appendChild(star);
    }
  });
}

  // =====================================================
  // COMBINE ALL MATRIX FIELDS
  // =====================================================

  const allMatrixFields = {
    ...generalMatrixFields,
    ...technicalMatrixFields,
    ...uniqueMatrixFields
  };


  // =====================================================
  // SAVE ORIGINAL FIELD STATES
  // =====================================================

  const matrixOriginalStates = new Map();

  Object.entries(allMatrixFields).forEach(([key, field]) => {
    if (!field.wrapper) return;

    matrixOriginalStates.set(key, {
      hidden: field.wrapper.hidden,
      required: field.input?.required ?? false,
      disabled: field.input?.disabled ?? false
    });
  });


  // =====================================================
  // SHOW HIDDEN ATTRIBUTE ELEMENTS
  // =====================================================

  const showHiddenToggle =
    $(".show-hidden-toggle input[type='checkbox']", document) ||
    $("#showHiddenAttribute", document);

  const showHiddenCounter =
    $(".show-hidden-info small", document);


  // =====================================================
  // GET CURRENT MATRIX STATUS
  // =====================================================

  function getCurrentMatrixStatus(fieldName) {
    const group = materialGroupSelect?.value || "";

    if (group === "Others") return "LEGACY";

    return MATERIAL_GROUP_MATRIX[group]?.[fieldName] || "";
  }


  // =====================================================
  // UPDATE SHOW HIDDEN COUNTER
  // =====================================================

  function updateShowHiddenCounter(hiddenCount = 0) {
    if (!showHiddenCounter) return;

    showHiddenCounter.textContent =
      `${hiddenCount} atribut tersembunyi`;
  }


  // =====================================================
  // RESTORE ORIGINAL MATRIX FIELD
  // =====================================================

  function restoreMatrixField(key) {
    const field = allMatrixFields[key];
    const original = matrixOriginalStates.get(key);

    if (!field?.wrapper || !original) return;

    field.wrapper.hidden = original.hidden;

    if (field.input) {
      field.input.required = original.required;
      field.input.disabled = original.disabled;
    }

    field.wrapper.removeAttribute("data-matrix-status");
    field.wrapper.removeAttribute("data-matrix-required");
  }


  // =====================================================
  // UPDATE CARD VISIBILITY
  // =====================================================

  function updateTechnicalCardVisibility() {
    const electricCard = $(".electric-spec-card", questionnaire);
    const mechanicalCard = $(".mechanical-spec-card", questionnaire);
    const liquidCard = $(".liquid-spec-card", questionnaire);

    if (electricCard) {
      const rows = $$("[data-electric-row]", electricCard);

      electricCard.hidden =
        rows.length > 0 && rows.every(row => row.hidden);
    }

    if (mechanicalCard) {
      const fields = [
        ...$$(".mechanical-basic-grid .spec-field", mechanicalCard),
        ...$$("[data-mechanical-row]", mechanicalCard)
      ];

      mechanicalCard.hidden =
        fields.length > 0 && fields.every(field => field.hidden);
    }

    if (liquidCard) {
      const fields = [
        $("#concentration", liquidCard)?.closest(".field"),
        $("#viscosity", liquidCard)?.closest(".field")
      ].filter(Boolean);

      liquidCard.hidden =
        fields.length > 0 && fields.every(field => field.hidden);
    }
  }

// =====================================================
// UPDATE GENERAL SPECIFICATION REQUIRED STAR
// =====================================================

function updateGeneralRequiredStar(key, field, status) {
  if (!field?.wrapper) return;

  let target = null;

  if (key === "dimension") {
    target = $(".dimension-title", field.wrapper);
  } else if (key === "uom") {
    target = $("label", field.wrapper);
  } else if (key === "packSize") {
    target = $(".pack-size-heading strong", field.wrapper);
  } else {
    target = field.wrapper;
  }

  if (!target) return;

  // Jika sudah ada tanda bintang bawaan HTML,
  // cukup atur tampil atau sembunyinya.
  const originalStar = target.querySelector(".required-star");

  if (originalStar) {
    originalStar.hidden = status !== "*";
    return;
  }

  // Cari pembungkus teks label yang sudah dibuat sebelumnya.
  let labelText = target.querySelector(
    ":scope > .matrix-label-text"
  );

  // Jika belum ada, bungkus teks label.
  if (!labelText) {
    const textNode = Array.from(target.childNodes).find(node =>
      node.nodeType === Node.TEXT_NODE &&
      node.textContent.trim() !== ""
    );

    if (!textNode) return;

    labelText = document.createElement("span");
    labelText.className = "matrix-label-text";

    target.insertBefore(labelText, textNode);
    labelText.appendChild(textNode);
  }

  // Hapus bintang dinamis sebelumnya.
  labelText.querySelectorAll(".matrix-required-star")
    .forEach(star => star.remove());

  // Buat bintang baru hanya jika wajib.
  if (status === "*") {
    const star = document.createElement("span");

    star.className = "matrix-required-star";
    star.textContent = "*";

    labelText.appendChild(star);
  }
}

  // =====================================================
  // UPDATE MATERIAL GROUP MATRIX
  // =====================================================

  function updateMaterialGroupMatrix() {
    if (!materialGroupSelect) return;

    const group = materialGroupSelect.value;

    // Others atau belum memilih Material Group:
    // Kembalikan seluruh field ke kondisi awal.
if (!MATERIAL_GROUP_MATRIX[group]) {
  Object.keys(allMatrixFields).forEach(restoreMatrixField);

  updateTechnicalCardVisibility();
  updateTechnicalRequiredStar();
  updateShowHiddenCounter(0);

  return;
}

    const rules = MATERIAL_GROUP_MATRIX[group];
    const showHidden = Boolean(showHiddenToggle?.checked);

    let hiddenCount = 0;

    Object.entries(allMatrixFields).forEach(([key, field]) => {
      if (!field.wrapper) return;

      const status = rules[key] || "";

      // Update tanda bintang General Specification.
if (generalMatrixFields[key]) {
  updateGeneralRequiredStar(key, field, status);
}

field.wrapper.dataset.matrixStatus = status;

      if (status === "") {
        hiddenCount++;

        // Blank: hidden, kecuali toggle sedang aktif.
        field.wrapper.hidden = !showHidden;

        // Field yang muncul melalui toggle bersifat opsional.
        field.wrapper.removeAttribute("data-matrix-required");

        if (field.input) {
          field.input.required = false;
        }

        // Jangan disable dan jangan hapus nilai.
        return;
      }

      // * atau O: tampil.
      field.wrapper.hidden = false;

      if (status === "*") {
        field.wrapper.dataset.matrixRequired = "true";
      } else {
        field.wrapper.removeAttribute("data-matrix-required");
      }

      // Required pada General Specification.
      // Dimension dan Pack Size tetap memakai validasi khusus.
      if (field.input) {
        if (key === "dimension" || key === "packSize") {
          field.input.required = false;
        } else {
          field.input.required = status === "*";
        }
      }
    });

    updateTechnicalCardVisibility();
updateTechnicalRequiredStar();
updateShowHiddenCounter(hiddenCount);
  }


  // =====================================================
  // MATERIAL GROUP EVENTS
  // =====================================================

  materialGroupSelect?.addEventListener("change", () => {
    updateMaterialGroupOther();
    updateMaterialGroupMatrix();

    saveDraft();
    transferToPrint();
  });

  materialGroupOtherInput?.addEventListener("input", () => {
    saveDraft();
    transferToPrint();
  });


  // =====================================================
  // SHOW HIDDEN ATTRIBUTE EVENT
  // =====================================================

  showHiddenToggle?.addEventListener("change", () => {
    updateMaterialGroupMatrix();

    saveDraft();
    transferToPrint();
  });




  // =====================================================
  // UTILITIES
  // =====================================================

  function todayISO() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  function setStatus(message, warning = false) {
    if (!draftStatus) return;

    draftStatus.textContent = message;
    draftStatus.classList.toggle("warning", Boolean(warning));
  }

  function showDraftOwnershipIssue(message) {
    setStatus(message, true);
  }

  function clearDraftOwnershipIssue() {
    setStatus(draftStatus?.textContent || "", false);
  }

  function formatDate(value) {
    if (!value) return "";

    const date = new Date(`${value}T00:00:00`);

    if (Number.isNaN(date.getTime())) return value;

    return date.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric"
    });
  }

  function safeJSONParse(value, fallback) {
    try {
      return value ? JSON.parse(value) : fallback;
    } catch {
      return fallback;
    }
  }

  function escapeSelector(value) {
    if (window.CSS?.escape) {
      return window.CSS.escape(String(value));
    }

    return String(value).replace(/["\\]/g, "\\$&");
  }

  function getVersionInput() {
    return $('[name="version"]', questionnaire);
  }

  function getCreatedDateInput() {
    return $('[name="createdDate"]', questionnaire);
  }

  // =====================================================
  // PLANT & DEPARTMENT
  // =====================================================

  async function fetchMasterData(path) {
    const response = await fetch(`${API_BASE_URL}${path}`);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const result = await response.json();

    return Array.isArray(result.data) ? result.data : [];
  }

  function setSelectMessage(select, message) {
    if (!select) return;

    select.innerHTML = "";
    const option = document.createElement("option");
    option.value = "";
    option.textContent = message;
    select.appendChild(option);
  }

  function findPlant(value) {
    return plants.find((plant) =>
      String(plant.id) === String(value) ||
      `${plant.plantid} - ${plant.plantname}` === value ||
      String(plant.plantid) === String(value)
    );
  }

  function setSelectedOption(select, value, label) {
    if (!select || value === undefined || value === null || value === "") {
      return;
    }

    const target = String(value);
    const option = [...select.options].find((item) =>
      item.value === target ||
      item.dataset?.groupId === target ||
      item.textContent === target
    );

    if (option) {
      select.value = option.value;
      return;
    }

    const legacyOption = document.createElement("option");
    legacyOption.value = String(value);
    legacyOption.textContent = label || String(value);
    legacyOption.dataset.legacy = "true";
    if (/^[1-9]\d*$/.test(target)) {
      legacyOption.dataset.groupId = target;
    } else {
      legacyOption.dataset.groupCode = target;
    }
    select.appendChild(legacyOption);
    select.value = legacyOption.value;
  }

  async function loadDepartments(plantId, restoreValue = "") {
    if (!deptSelect) return;

    const requestId = ++departmentRequestId;

    if (!plantId) {
      setSelectMessage(deptSelect, "-- Pilih Plant Terlebih Dahulu --");
      return;
    }

    setSelectMessage(deptSelect, "Memuat Departemen...");
    deptSelect.disabled = true;

    try {
      const departments = await fetchMasterData(`/plants/${plantId}/departments`);

      if (requestId !== departmentRequestId) return;

      setSelectMessage(
        deptSelect,
        departments.length ? "-- Pilih Departemen --" : "Tidak ada Departemen tersedia"
      );

      departments.forEach((department) => {
        const option = document.createElement("option");
        option.value = String(department.id);
        option.textContent = department.departmentname;
        deptSelect.appendChild(option);
      });

      setSelectedOption(deptSelect, restoreValue);
    } catch (error) {
      if (requestId !== departmentRequestId) return;

      console.error("Gagal memuat department:", error);
      setSelectMessage(deptSelect, "Gagal memuat Departemen");
      setStatus("Gagal memuat Departemen dari server");
    } finally {
      if (requestId === departmentRequestId) {
        deptSelect.disabled = false;
      }
    }
  }

  async function updateDepartment(restoreValue = "") {
    if (!plantSelect || !deptSelect) return;

    const plant = findPlant(plantSelect.value);

    if (plantDesc) {
      plantDesc.value = plant?.plantname || "";
    }

    await loadDepartments(plant?.id, restoreValue);
  }

  // =====================================================
  // MATERIAL CATEGORY — SINGLE SELECTION
  // =====================================================

  function getSelectedCategories() {
    return $$('[name="materialCategory"]:checked', questionnaire)
      .map(field => field.value);
  }

  function normalizeMaterialCategory() {
    const selected = $$(
      '[name="materialCategory"]:checked',
      questionnaire
    );

    selected.slice(1).forEach(field => {
      field.checked = false;
    });

    updateCategory();
  }

  function updateCategory() {
    const selected = getSelectedCategories()[0] || "";

    $$('[name="category"]', questionnaire).forEach(field => {
      field.checked = field.value === selected;
    });
  }

  questionnaire.addEventListener("change", event => {
    if (!event.target.matches('[name="materialCategory"]')) return;

    if (event.target.checked) {
      $$('[name="materialCategory"]', questionnaire).forEach(field => {
        if (field !== event.target) field.checked = false;
      });
    }

    updateCategory();
    loadMaterialGroups(event.target.value);
    saveDraft();
  });

  async function loadMaterialGroups(categoryId, restoreValue = "") {
    if (!materialGroupSelect) return;

    const requestId = ++materialGroupRequestId;

    if (!categoryId) {
      setSelectMessage(
        materialGroupSelect,
        "-- Pilih Material Category terlebih dahulu --"
      );
      updateMaterialGroupOther(false);
      updateMaterialGroupMatrix();
      return;
    }

    setSelectMessage(materialGroupSelect, "Memuat Material Group...");
    materialGroupSelect.disabled = true;

    try {
      const groups = await fetchMasterData(
        `/material-groups/categories/${encodeURIComponent(categoryId)}`
      );

      if (requestId !== materialGroupRequestId) return;

      setSelectMessage(
        materialGroupSelect,
        groups.length ? "-- Pilih Material Group --" : "Tidak ada Material Group tersedia"
      );

      groups.forEach((group) => {
        const code = group.sapgroupcode ? String(group.sapgroupcode) : "";
        const option = document.createElement("option");
        option.value = code || String(group.id);
        option.textContent =
          code ||
          group.dashboardgroupname ||
          group.description ||
          String(group.id);
        option.dataset.groupId = String(group.id);
        option.dataset.groupCode = code;
        materialGroupSelect.appendChild(option);
      });

      setSelectedOption(materialGroupSelect, restoreValue);
      updateMaterialGroupOther(false);
      updateMaterialGroupMatrix();
    } catch (error) {
      if (requestId !== materialGroupRequestId) return;

      console.error("Gagal memuat material group:", error);
      setSelectMessage(materialGroupSelect, "Gagal memuat Material Group");
      setStatus("Gagal memuat Material Group dari server");
    } finally {
      if (requestId === materialGroupRequestId) {
        materialGroupSelect.disabled = false;
      }
    }
  }

  // =====================================================
  // REASON TO PROCURE
  // =====================================================

  function updateReason() {
    if (!reasonChoice || !reasonFinal) return;

    const selectedOption = reasonChoice.selectedOptions[0];
    const isOthers = selectedOption?.dataset.allowsCustom === "true";

    if (reasonOthers) reasonOthers.hidden = !isOthers;

    if (reasonOther) {
      reasonOther.hidden = !isOthers;
      reasonOther.disabled = !isOthers;
      reasonOther.required = isOthers;

      if (!isOthers) reasonOther.value = "";
    }

    reasonFinal.value = isOthers
      ? (reasonOther?.value.trim() || "")
      : reasonChoice.value;
  }

  // =====================================================
  // MAIN UOM — OTHERS VISIBILITY
  // =====================================================

  const uomSelect = $("#uomSelect", questionnaire);
  const uomOther = $("#uomOther", questionnaire);

  function updateUomOther() {
    if (!uomSelect || !uomOther) return;

    const isOthers = uomSelect.value === "Others";

    uomOther.hidden = !isOthers;
    uomOther.disabled = !isOthers;
    uomOther.required = isOthers;

    if (!isOthers) uomOther.value = "";
  }

  // =====================================================
  // ELECTRICAL — OTHERS VISIBILITY
  // =====================================================

  function updateElectricalOthers(row) {
    if (!row) return;

    $$("[data-electric-unit]", row).forEach(select => {
      const position = select.dataset.electricUnit;

      const otherInput = $(
        `[data-electric-other="${position}"]`,
        row
      );

      if (!otherInput) return;

      const isOthers = select.value === "Others";

      otherInput.hidden = !isOthers;
      otherInput.disabled = !isOthers;
      otherInput.required = isOthers;

      otherInput.style.display = isOthers ? "block" : "none";

      if (!isOthers) {
        otherInput.value = "";
      }
    });
  }

  function updateAllElectricalOthers() {
    $$("[data-electric-row]", questionnaire).forEach(row => {
      updateElectricalOthers(row);
    });
  }

  function getElectricalEffectiveUnit(row, position) {
    const select = $(
      `[data-electric-unit="${position}"]`,
      row
    );

    const otherInput = $(
      `[data-electric-other="${position}"]`,
      row
    );

    if (!select) return "";

    if (select.value === "Others") {
      return otherInput?.value.trim() || "";
    }

    return select.value || "";
  }

  // =====================================================
  // DIMENSION
  // =====================================================

  function createDimensionRow(item = {}) {
    if (!dimensionContainer) return;

    if (dimensionContainer.querySelectorAll(".dimension-row").length >= 3) {
      return;
    }

    const row = document.createElement("div");
    row.className = "dimension-row";

    // DIMENSION
    const typeSelect = document.createElement("select");
    typeSelect.className = "dimension-type";

    const defaultType = document.createElement("option");
    defaultType.value = "";
    defaultType.textContent = "-- Pilih Dimension --";
    typeSelect.appendChild(defaultType);

    DIMENSION_OPTIONS.forEach(value => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      typeSelect.appendChild(option);
    });

    typeSelect.value = item.type || "";

    // DATA
    const valueInput = document.createElement("input");
    valueInput.type = "text";
    valueInput.className = "dimension-value";
    valueInput.placeholder = "Masukkan nilai";
    valueInput.value = item.value || "";

    // UOM
    const unitSelect = document.createElement("select");
    unitSelect.className = "dimension-unit";

    const defaultUnit = document.createElement("option");
    defaultUnit.value = "";
    defaultUnit.textContent = "-- Pilih UoM --";
    unitSelect.appendChild(defaultUnit);

    ["MM", "CM", "M", "INCH", "Others"].forEach(value => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      unitSelect.appendChild(option);
    });

    unitSelect.value = item.unit || "";

    // INPUT UOM OTHERS
    const othersWrapper = document.createElement("div");
    othersWrapper.className = "dimension-unit-others";

    const othersInput = document.createElement("input");
    othersInput.type = "text";
    othersInput.className = "dimension-unit-other-input";
    othersInput.placeholder = "Masukkan satuan lainnya...";
    othersInput.value = item.otherUnit || "";

    othersWrapper.appendChild(othersInput);

    function toggleOthersInput() {
      const isOthers = unitSelect.value === "Others";

      othersWrapper.style.display = isOthers ? "block" : "none";
      othersInput.required = isOthers;

      if (!isOthers) {
        othersInput.value = "";
      }
    }

    unitSelect.addEventListener("change", () => {
      toggleOthersInput();
      saveDraft();
    });

    othersInput.addEventListener("input", saveDraft);

    // SYMBOL
    const symbolSelect = document.createElement("select");
    symbolSelect.className = "dimension-symbol";

    const defaultSymbol = document.createElement("option");
    defaultSymbol.value = "";
    defaultSymbol.textContent = "-- Pilih Simbol --";
    symbolSelect.appendChild(defaultSymbol);

    DIMENSION_SYMBOLS.forEach(value => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      symbolSelect.appendChild(option);
    });

    symbolSelect.value = item.symbol || "";

    // REMOVE BUTTON
    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "remove-dimension";
    removeButton.textContent = "×";
    removeButton.title = "Hapus";

    removeButton.addEventListener("click", () => {
      row.remove();
      updateDimension();
      saveDraft();
    });

    row.append(
      typeSelect,
      valueInput,
      unitSelect,
      symbolSelect,
      removeButton,
      othersWrapper
    );

    dimensionContainer.appendChild(row);

    toggleOthersInput();
    updateDimension();
  }

  function collectDimensionItems() {
    if (!dimensionContainer) return [];

    return $$(".dimension-row", dimensionContainer)
      .map(row => ({
        type: $(".dimension-type", row)?.value || "",
        value: $(".dimension-value", row)?.value.trim() || "",
        unit: $(".dimension-unit", row)?.value || "",
        otherUnit: $(".dimension-unit-other-input", row)?.value.trim() || "",
        symbol: $(".dimension-symbol", row)?.value || ""
      }))
      .filter(item => item.type && item.value);
  }

  function formatDimensionItems(items) {
    return items.map((item) => {
      const unit = item.unit === "Others" ? item.otherUnit : item.unit;
      return [item.type, item.value, unit, item.symbol].filter(Boolean).join(" ");
    }).join("; ");
  }

  function syncDimensionField() {
    const value = formatDimensionItems(collectDimensionItems());
    const dimensionField = $("#dimensionFinal", questionnaire);

    if (dimensionField) dimensionField.value = value;

    return value;
  }

  function updateDimension() {
    if (!dimensionContainer) return;

    const totalRows = $$(".dimension-row", dimensionContainer).length;
    const addButton = $("#addDimensionBtn");

    if (addButton) addButton.disabled = totalRows >= 3;

    syncDimensionField();
  }

  // =====================================================
  // REQUIRED DOCUMENTS — DYNAMIC DROPDOWN + OTHERS
  // =====================================================

  function collectRequiredDocuments() {
    if (!requiredDocumentsContainer) return [];

    return $$(".required-document-row", requiredDocumentsContainer)
      .map(row => {
        const select = $(".required-document-select", row);
        const otherInput = $(".required-document-other", row);

        if (!select || !select.value) return "";

        if (select.value === "Others") {
          const detail = otherInput?.value.trim() || "";

          return detail
            ? `Others: ${detail}`
            : "Others";
        }

        return select.value;
      })
      .filter(Boolean);
  }

  function updateRequiredDocumentOptions() {
    if (!requiredDocumentsContainer) return;

    const rows = $$(".required-document-row", requiredDocumentsContainer);

    const selects = rows.map(row =>
      $(".required-document-select", row)
    );

    const selectedValues = selects.map(select => select.value);

    selects.forEach((select, index) => {
      const currentValue = select.value;

      select.innerHTML = "";

      const placeholder = document.createElement("option");
      placeholder.value = "";
      placeholder.textContent = "-- Pilih Required Document --";
      select.appendChild(placeholder);

      requiredDocumentOptions.forEach(optionValue => {
        if (optionValue !== "Others") {
          const alreadySelected = selectedValues.some(
            (value, selectedIndex) =>
              selectedIndex !== index &&
              value === optionValue
          );

          if (alreadySelected) return;
        }

        const option = document.createElement("option");
        option.value = optionValue;
        option.textContent = optionValue;

        select.appendChild(option);
      });

      select.value = currentValue;
    });

    rows.forEach(row => {
      const removeButton = $(".remove-required-document", row);

      if (removeButton) {
        removeButton.hidden = rows.length <= 1;
      }
    });
  }

  function createRequiredDocumentRow(value = "", otherValue = "") {
    if (!requiredDocumentsContainer) return;

    const selectedValues = $$(".required-document-select", requiredDocumentsContainer)
      .map(select => select.value)
      .filter(Boolean);

    const row = document.createElement("div");
    row.className = "required-document-row";

    // DROPDOWN REQUIRED DOCUMENT
    const select = document.createElement("select");
    select.className = "required-document-select";
    select.name = "requiredDocuments";

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "-- Pilih Required Document --";
    select.appendChild(placeholder);

    requiredDocumentOptions.forEach(optionValue => {
      if (
        optionValue !== "Others" &&
        selectedValues.includes(optionValue) &&
        optionValue !== value
      ) {
        return;
      }

      const option = document.createElement("option");
      option.value = optionValue;
      option.textContent = optionValue;

      select.appendChild(option);
    });

    select.value = value;

    // CONTAINER OTHERS
    const otherContainer = document.createElement("div");
    otherContainer.className = "required-document-other-container";
    otherContainer.hidden = value !== "Others";

    // INPUT OTHERS
    const otherInput = document.createElement("input");
    otherInput.type = "text";
    otherInput.className = "required-document-other";
    otherInput.placeholder = "Masukkan keterangan lainnya...";
    otherInput.value = otherValue;

    otherContainer.appendChild(otherInput);

    // TOMBOL HAPUS
    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "remove-required-document";
    removeButton.textContent = "Hapus";
    removeButton.title = "Hapus dokumen";

    row.append(
      select,
      otherContainer,
      removeButton
    );

    requiredDocumentsContainer.appendChild(row);

    select.addEventListener("change", () => {
      const isOthers = select.value === "Others";

      otherContainer.hidden = !isOthers;

      if (!isOthers) {
        otherInput.value = "";
      }

      updateRequiredDocumentOptions();
      saveDraft();
    });

    otherInput.addEventListener("input", saveDraft);

    removeButton.addEventListener("click", () => {
      row.remove();

      if (
        !$$(".required-document-row", requiredDocumentsContainer).length
      ) {
        createRequiredDocumentRow();
      }

      updateRequiredDocumentOptions();
      saveDraft();
    });

    updateRequiredDocumentOptions();
  }

  function restoreRequiredDocuments(data) {
    if (!requiredDocumentsContainer) return;

    requiredDocumentsContainer.replaceChildren();

    const savedDocuments = Array.isArray(data.requiredDocuments)
      ? data.requiredDocuments
      : [];

    if (savedDocuments.length) {
      savedDocuments.forEach(item => {
        let value = item;
        let otherValue = "";

        if (
          typeof item === "string" &&
          item.startsWith("Others:")
        ) {
          value = "Others";
          otherValue = item.substring("Others:".length).trim();
        }

        if (requiredDocumentOptions.includes(value)) {
          createRequiredDocumentRow(value, otherValue);
        }
      });
    }

    if (!requiredDocumentsContainer.children.length) {
      createRequiredDocumentRow();
    }

    updateRequiredDocumentOptions();
  }

  // =====================================================
  // PACK SIZE
  // =====================================================

  function updatePackSizeOthers() {
    const packUom = $("#packUom", questionnaire);
    const packUomOther = $("#packUomOther", questionnaire);

    const packageUom = $("#packageUom", questionnaire);
    const packageUomOther = $("#packageUomOther", questionnaire);

    if (packUom && packUomOther) {
      const showPackOther = packUom.value === "Others";

      packUomOther.hidden = !showPackOther;
      packUomOther.disabled = !showPackOther;
      packUomOther.required = showPackOther;

      if (!showPackOther) {
        packUomOther.value = "";
      }
    }

    if (packageUom && packageUomOther) {
      const showPackageOther = packageUom.value === "Others";

      packageUomOther.hidden = !showPackageOther;
      packageUomOther.disabled = !showPackageOther;
      packageUomOther.required = showPackageOther;

      if (!showPackageOther) {
        packageUomOther.value = "";
      }
    }
  }

  function updatePackSize() {
    updatePackSizeOthers();

    const quantity =
      $("#packQuantity", questionnaire)?.value.trim() || "";

    const packUomSelect =
      $("#packUom", questionnaire);

    const packageUomSelect =
      $("#packageUom", questionnaire);

    const packUomOther =
      $("#packUomOther", questionnaire)?.value.trim() || "";

    const packageUomOther =
      $("#packageUomOther", questionnaire)?.value.trim() || "";

    const symbol =
      $("#packSymbol", questionnaire)?.value || "";

    const packUom =
      packUomSelect?.value === "Others"
        ? packUomOther
        : packUomSelect?.value || "";

    const packageUom =
      packageUomSelect?.value === "Others"
        ? packageUomOther
        : packageUomSelect?.value || "";

    const finalField =
      $("#packSizeFinal", questionnaire);

    if (!finalField) return;

    const firstPart = [quantity, packUom]
      .filter(Boolean)
      .join(" ");

    let result = firstPart;

    if (packageUom) {
      result += `${
        result && symbol
          ? ` ${symbol} `
          : result
            ? " "
            : ""
      }${packageUom}`;
    }

    finalField.value = result.trim();
  }

  $("#packUomOther", questionnaire)?.addEventListener(
    "input",
    updatePackSize
  );

  $("#packageUomOther", questionnaire)?.addEventListener(
    "input",
    updatePackSize
  );

  // =====================================================
  // MECHANICAL — SAP UOM DROPDOWN
  // =====================================================

  function initializeMechanicalUomOptions() {
    const uomOptions = {
      Capacity: ["L", "ML", "M3", "Others"],
      Pressure: ["Bar", "PA", "PSI", "Others"],
      Flowrate: ["M3H", "CFM", "KGS", "LMI", "LPH", "Others"],
      Speed: ["RPM", "RPS", "Others"],
      Tolerance: ["µM", "MM", "CM", "%", "Others"]
    };

    document.querySelectorAll("[data-mechanical-row]").forEach(row => {
      const parameter = row.dataset.mechanicalRow;
      const options = uomOptions[parameter];

      if (!options) return;

      row.querySelectorAll("select[data-mechanical-unit]").forEach(select => {
        const currentValue = select.value;

        select.innerHTML = `
          <option value="">-- Pilih UoM --</option>
        `;

        options.forEach(value => {
          const option = document.createElement("option");
          option.value = value;
          option.textContent = value;
          select.appendChild(option);
        });

        select.value = options.includes(currentValue) ? currentValue : "";
      });
    });
  }

  // =====================================================
  // MECHANICAL — OTHERS VISIBILITY
  // =====================================================

  function updateMechanicalOthers(row) {
    if (!row) return;

    $$("[data-mechanical-unit]", row).forEach(select => {
      const position = select.dataset.mechanicalUnit;

      const otherInput = $(
        `[data-mechanical-unit-other="${position}"]`,
        row
      );

      if (!otherInput) return;

      const isOthers = select.value === "Others";

      otherInput.hidden = !isOthers;
      otherInput.disabled = !isOthers;

      if (!isOthers) otherInput.value = "";
    });

    const symbolSelect = $("[data-mechanical-symbol]", row);
    const symbolOther = $("[data-mechanical-symbol-other]", row);

    if (symbolSelect && symbolOther) {
      const isOthers = symbolSelect.value === "Others";

      symbolOther.hidden = !isOthers;
      symbolOther.disabled = !isOthers;

      if (!isOthers) symbolOther.value = "";
    }
  }

  function updateAllMechanicalOthers() {
    $$("[data-mechanical-row]", questionnaire).forEach(row => {
      updateMechanicalOthers(row);
    });
  }

  // =====================================================
  // MECHANICAL — COLLECT DATA
  // =====================================================

  function getMechanicalEffectiveUnit(row, position) {
    const select = $(`[data-mechanical-unit="${position}"]`, row);
    const otherInput = $(
      `[data-mechanical-unit-other="${position}"]`,
      row
    );

    if (!select) return "";

    if (select.value === "Others") {
      return otherInput?.value.trim() || "";
    }

    return select.value || "";
  }

  function getMechanicalEffectiveSymbol(row) {
    const select = $("[data-mechanical-symbol]", row);
    const otherInput = $("[data-mechanical-symbol-other]", row);

    if (!select) return "";

    if (select.value === "Others") {
      return otherInput?.value.trim() || "";
    }

    return select.value || "";
  }

  function collectMechanicalAttributes() {
    const result = [];

    $$("[data-mechanical-row]", questionnaire).forEach(row => {
      const label = row.dataset.mechanicalRow || "";

      const value1 =
        $('[data-mechanical-value="1"]', row)?.value.trim() || "";

      const value2 =
        $('[data-mechanical-value="2"]', row)?.value.trim() || "";

      const unit1 = getMechanicalEffectiveUnit(row, "1");
      const unit2 = getMechanicalEffectiveUnit(row, "2");

      const unitSelect1 = $('[data-mechanical-unit="1"]', row);
      const unitSelect2 = $('[data-mechanical-unit="2"]', row);

      const unitOther1 = $('[data-mechanical-unit-other="1"]', row);
      const unitOther2 = $('[data-mechanical-unit-other="2"]', row);

      const symbolSelect = $("[data-mechanical-symbol]", row);
      const symbolOther = $("[data-mechanical-symbol-other]", row);

      const symbol = getMechanicalEffectiveSymbol(row);

      const hasData =
        value1 || value2 || unit1 || unit2 || symbol;

      if (!hasData) return;

      const first = [value1, unit1].filter(Boolean).join(" ");
      const second = [value2, unit2].filter(Boolean).join(" ");

      let formattedValue = first;

      if (second) {
        formattedValue += `${
          first && symbol
            ? ` ${symbol} `
            : first
              ? " "
              : ""
        }${second}`;
      }

      result.push({
        category: "Mechanical",
        label,
        value: formattedValue,
        unit: "",

        data1: value1,
        unit1,
        unit1Selection: unitSelect1?.value || "",
        unit1Other: unitOther1?.value.trim() || "",

        data2: value2,
        unit2,
        unit2Selection: unitSelect2?.value || "",
        unit2Other: unitOther2?.value.trim() || "",

        symbol,
        symbolSelection: symbolSelect?.value || "",
        symbolOther: symbolOther?.value.trim() || ""
      });
    });

    return result;
  }

  // =====================================================
  // ELECTRICAL — COLLECT DATA
  // =====================================================

  function collectElectricalAttributes() {
    const result = [];

    $$("[data-electric-row]", questionnaire).forEach(row => {
      const label = row.dataset.electricRow || "";

      const value1 =
        $('[data-electric-value="1"]', row)?.value.trim() || "";

      const value2 =
        $('[data-electric-value="2"]', row)?.value.trim() || "";

      const unit1 = getElectricalEffectiveUnit(row, "1");
      const unit2 = getElectricalEffectiveUnit(row, "2");

      const unitSelect1 = $('[data-electric-unit="1"]', row);
      const unitSelect2 = $('[data-electric-unit="2"]', row);

      const unitOther1 = $('[data-electric-other="1"]', row);
      const unitOther2 = $('[data-electric-other="2"]', row);

      const symbol = $("[data-electric-symbol]", row)?.value || "/";

      if (!value1 && !value2 && !unit1 && !unit2) return;

      const first = [value1, unit1].filter(Boolean).join(" ");
      const second = [value2, unit2].filter(Boolean).join(" ");

      let formattedValue = first;

      if (second) {
        formattedValue += `${
          first && symbol
            ? ` ${symbol} `
            : first
              ? " "
              : ""
        }${second}`;
      }

      result.push({
        category: "Electric",
        label,
        value: formattedValue,
        unit: "",

        data1: value1,
        unit1,
        unit1Selection: unitSelect1?.value || "",
        unit1Other: unitOther1?.value.trim() || "",

        data2: value2,
        unit2,
        unit2Selection: unitSelect2?.value || "",
        unit2Other: unitOther2?.value.trim() || "",

        symbol
      });
    });

    return result;
  }

  // =====================================================
  // TECHNICAL SPECIFICATION
  // =====================================================

  function getTechnicalCategory(input) {
    const group = input.closest(".q-technical-group");
    const heading = $("h4", group)?.textContent.toLowerCase() || "";

    if (heading.includes("electric")) return "Electric";
    if (heading.includes("mechanical")) return "Mechanical";
    if (heading.includes("liquid")) return "Liquid";

    return "Other";
  }

  function collectTechnicalAttributes() {
    const attributes = [];

    // ELECTRICAL
    const electricalAttributes = collectElectricalAttributes();

    electricalAttributes.forEach(item => {
      attributes.push({
        category: "Electric",
        label: item.label,
        value: item.value,
        unit: ""
      });
    });

    // MATERIAL, CONNECTION TYPE, LIQUID
    $$("[data-tech-label]", questionnaire).forEach(input => {
      const label = input.dataset.techLabel || "";
      const value = input.value.trim();

      if (!label || !value) return;

      const unitInput = $$("[data-tech-unit]", questionnaire)
        .find(field => field.dataset.techUnit === label);

      attributes.push({
        category: getTechnicalCategory(input),
        label,
        value,
        unit: unitInput?.value.trim() || ""
      });
    });

    // MECHANICAL PARAMETERS
    collectMechanicalAttributes().forEach(item => {
      attributes.push({
        category: "Mechanical",
        label: item.label,
        value: item.value,
        unit: ""
      });
    });

    // CUSTOM TECHNICAL
    $$(".custom-tech-row", questionnaire).forEach(row => {
      const label =
        $("[data-custom-tech-name]", row)?.value.trim() || "";

      const value =
        $("[data-custom-tech-value]", row)?.value.trim() || "";

      if (label || value) {
        attributes.push({
          category: "Other",
          label,
          value,
          unit: ""
        });
      }
    });

    return attributes;
  }

  // =====================================================
  // LEGACY TECHNICAL FIELDS
  // =====================================================

  function updateLegacyTechnicalFields(attributes) {
    for (let index = 1; index <= 5; index++) {
      const item = attributes[index - 1];

      const labelField = $(`#technical${index}`, questionnaire);
      const valueField = $(`#technicalUnit${index}`, questionnaire);

      if (labelField) labelField.value = item?.label || "";

      if (valueField) {
        valueField.value = item
          ? [item.value, item.unit].filter(Boolean).join(" ")
          : "";
      }
    }
  }

  // =====================================================
  // UNIQUE SPECIFICATION
  // =====================================================

  function collectUniqueAttributes() {
    const attributes = [];

    const name1 =
      $('[name="unique1"]', questionnaire)?.value.trim() || "";

    const detail1 =
      $('[name="uniqueDetail1"]', questionnaire)?.value.trim() || "";

    const name2 =
      $('[name="unique2"]', questionnaire)?.value.trim() || "";

    const detail2 =
      $('[name="uniqueDetail2"]', questionnaire)?.value.trim() || "";

    if (detail1) attributes.push({ name: name1, detail: detail1 });
    if (name2 || detail2) attributes.push({ name: name2, detail: detail2 });

    $$(".custom-unique-row", questionnaire).forEach(row => {
      const name = $('input[name^="customUniqueName"]', row)
        ?.value.trim() || "";

      const detail = $('input[name^="customUniqueDetail"]', row)
        ?.value.trim() || "";

      if (name || detail) attributes.push({ name, detail });
    });

    return attributes;
  }

  // =====================================================
  // FORM DATA
  // =====================================================

  function getFormData() {
    updateReason();
    updateCategory();
    updateMaterialGroupMatrix();
    updateDimension();
    updatePackSize();
    updateAllElectricalOthers();
    updateAllMechanicalOthers();

    const electricalAttributes = collectElectricalAttributes();
    const technicalAttributes = collectTechnicalAttributes();
    const mechanicalAttributes = collectMechanicalAttributes();
    const uniqueAttributes = collectUniqueAttributes();

    updateLegacyTechnicalFields(technicalAttributes);

    const data = {};
    const fieldsByName = new Map();

    $$("[name]", questionnaire).forEach(field => {
      if (field.type === "file" || field.disabled) return;

      if (!fieldsByName.has(field.name)) {
        fieldsByName.set(field.name, []);
      }

      fieldsByName.get(field.name).push(field);
    });

    fieldsByName.forEach((fields, name) => {
      const first = fields[0];

      if (first.type === "checkbox") {
        if (fields.length > 1) {
          data[name] = fields
            .filter(field => field.checked)
            .map(field => field.value);
        } else {
          data[name] = first.checked;
        }

        return;
      }

      if (first.type === "radio") {
        data[name] = fields.find(field => field.checked)?.value || "";
        return;
      }

      data[name] = first.value ?? "";
    });

    data.materialCategory = getSelectedCategories();

    data.category = $$(
      '[name="category"]:checked',
      questionnaire
    ).map(field => field.value);

    const selectedGroupOption =
      materialGroupSelect?.selectedOptions?.[0] || null;
    const selectedGroupValue = selectedGroupOption?.value || "";
    const selectedGroupId = selectedGroupOption?.dataset?.groupId || "";
    const selectedGroupCode =
      selectedGroupOption?.dataset?.groupCode ||
      (/^[1-9]\d*$/.test(selectedGroupValue) ? "" : selectedGroupValue);
    const selectedGroupValueIsNumeric = /^[1-9]\d*$/.test(selectedGroupValue);

    data.materialGroup =
      selectedGroupId ||
      (selectedGroupValueIsNumeric ? selectedGroupValue : "");
    data.materialGroupCode = selectedGroupCode;

    data.electricalAttributes = electricalAttributes;
    data.technicalAttributes = technicalAttributes;
    data.mechanicalAttributes = mechanicalAttributes;
    data.uniqueAttributes = uniqueAttributes;

    // Tetap simpan Dimension meskipun field sedang disembunyikan.
    data.dimensionItems = collectDimensionItems();
    data.dimension = formatDimensionItems(data.dimensionItems);
    const dimensionField = $("#dimensionFinal", questionnaire);

    if (dimensionField) dimensionField.value = data.dimension;
    data.requiredDocuments = collectRequiredDocuments();
    data.drawingImage = drawingImage;
    data.specType = "Barang";

    return data;
  }

  function getAttributeValues(formData) {
    const values = {};
    const add = (code, value) => {
      if (value === undefined || value === null || value === "") return;
      values[code] = value;
    };

    add("VERSION", formData.version);
    add("CREATED_DATE", formData.createdDate);
    add("PLANT", formData.plant);
    add("REQUESTOR", formData.requestor);
    add("DEPARTMENT", formData.department);
    add("MATERIAL_GROUP", formData.materialGroupCode || formData.materialGroup);
    add("MATERIAL_CATEGORY", formData.materialCategory?.[0]);
    add("REASON_TO_PROCURE", formData.reason || formData.reasonChoice);
    add("MATERIAL_DESCRIPTION", formData.materialDescription);
    add("TYPE_MODEL_PART_NUMBER", formData.partNumber);
    add("VARIANS", formData.variant);
    add("DIMENSION", formData.dimension);
    add("BRAND", formData.brand);
    add("CATALOGUE", formData.catalogue);
    add("UOM", formData.uomOther || formData.uom);
    add("PACK_SIZE", formData.packSize);
    add("KONSENTRASI", formData.concentration);
    add("VISCOSITAS", formData.viscosity);
    add("ADDITIONAL_SERVICE", formData.additionalService);
    add("HSE_STANDARD", formData.hse);
    add("LICENSE_REGULATION", formData.license);
    add("WARRANTY_AFTER_SALES", formData.warranty);

    const technicalCodeByLabel = {
      Voltage: "VOLTAGE",
      Phase: "PHASE",
      Power: "POWER",
      Current: "CURRENT",
      Frequency: "FREQUENCY",
      Temperature: "TEMPERATURE",
      Capacity: "CAPACITY",
      "Connection Type": "CONNECTION_TYPE",
      Pressure: "PRESSURE",
      Flowrate: "FLOWRATE",
      Speed: "SPEED",
      Tolerance: "TOLERANCE",
      Konsentrasi: "KONSENTRASI",
      Viscositas: "VISCOSITAS"
    };

    formData.technicalAttributes?.forEach((attribute) => {
      const code = technicalCodeByLabel[attribute.label];

      if (code && attribute.value !== "") {
        add(code, attribute);
      }
    });

    if (formData.requiredDocuments?.length) {
      values.REQUIRED_DOCUMENTS = formData.requiredDocuments;
    }

    const technicalOthers = formData.technicalAttributes
      ?.filter((item) => item.category === "Other") || [];

    if (technicalOthers.length) values.TECHNICAL_OTHERS = technicalOthers;
    return values;
  }

  function getCurrentDraftOwnerId() {
    return String(window.ESpecDevAuth?.getProfile()?.userId || "").trim();
  }

  function confirmDiscardChanges() {
    return !hasUnsavedChanges || confirm(
      "Perubahan belum disimpan ke server akan hilang. Lanjutkan?"
    );
  }

  function parseDetailFormData(detail) {
    let formData = detail?.formData || detail?.form_data || {};

    if (typeof formData === "string") {
      formData = safeJSONParse(formData, {});
    }

    if (!formData || typeof formData !== "object" || Array.isArray(formData)) {
      formData = {};
    }

    return {
      ...formData,
      persistedDocumentNo: detail?.documentNo || formData.persistedDocumentNo || ""
    };
  }

  async function reapplyServerMasterData(data) {
    if (!masterDataReady) return;

    const savedPlant = String(data.plant || plantSelect?.value || "");
    await loadDepartments(findPlant(savedPlant)?.id, data.department || deptSelect?.value || "");

    const savedGroup = String(
      pendingMaterialGroupValue || data.materialGroup || materialGroupSelect?.value || ""
    );
    await loadMaterialGroups(getSelectedCategories()[0], savedGroup);
    pendingMaterialCategoryValue = "";
    pendingMaterialGroupValue = "";
  }

  function getDraftDocumentNumber(formData) {
    const existing = String(persistedDocumentNo || formData.persistedDocumentNo || "").trim();

    return existing || `${formData.docNo || "DRAFT"}-${Date.now()}`;
  }

  async function saveDraftToServer() {
    if (!barangSpecificationTypeId) {
      throw new Error("Tipe spesifikasi Barang belum tersedia.");
    }

    const currentOwnerId = getCurrentDraftOwnerId();

    if (!currentOwnerId) {
      throw new Error("Identitas development tidak tersedia untuk menyimpan Draft.");
    }

    const formData = getFormData();
    const documentNo = getDraftDocumentNumber(formData);
    persistedDocumentNo = documentNo;
    formData.persistedDocumentNo = documentNo;
    const isUpdate = Boolean(persistedDraftId);

    setStatus(
      isUpdate
        ? "Menyimpan perubahan Draft ke server..."
        : "Menyimpan Draft baru ke server..."
    );

    const response = await fetch(
      isUpdate
        ? `${API_BASE_URL}/specifications/${encodeURIComponent(persistedDraftId)}`
        : `${API_BASE_URL}/specifications`,
      {
        method: isUpdate ? "PUT" : "POST",
        headers: getApiHeaders(),
        body: JSON.stringify({
          ...(isUpdate ? {} : { specificationTypeId: barangSpecificationTypeId }),
          documentNo,
          formData,
          attributeValues: getAttributeValues(formData)
        })
      }
    );
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      if (response.status === 403 && /pemilik|akses/i.test(result.message || "")) {
        persistedDraftId = null;
        persistedDocumentNo = null;
        hasUnsavedChanges = true;
        showDraftOwnershipIssue(
          "Server menolak pembaruan karena Draft bukan milik identitas ini. Pilih Draft yang dimiliki atau buat Draft baru."
        );
      }

      throw new Error(result.message || "Gagal menyimpan draft ke server.");
    }

    persistedDraftId = result.data?.id || persistedDraftId;

    if (!persistedDraftId) {
      throw new Error("Server tidak mengembalikan ID spesifikasi.");
    }

    persistedDocumentNo = result.data?.documentNo || documentNo;
    formData.persistedDocumentNo = persistedDocumentNo;
    hasUnsavedChanges = false;
    clearDraftOwnershipIssue();

    if (legacyPendingClear) {
      window.ESpecDraftWorkspace?.clearLegacy?.("barang");
      legacyPendingClear = false;
    }

    window.ESpecDraftWorkspace?.refreshActive?.();

    return { isUpdate };
  }

  async function getSubmissionAction(id) {
    const response = await fetch(
      `${API_BASE_URL}/specifications/${encodeURIComponent(id)}`,
      { headers: getApiHeaders() }
    );
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(result.message || "Gagal memeriksa status dokumen.");
    }

    const status = result.data?.status;

    if (status === "Draft") return "submit";
    if (status === "Revision Required") return "resubmit";

    throw new Error(
      `Dokumen berstatus ${status || "tidak diketahui"} dan tidak dapat diajukan.`
    );
  }

  async function submitForApproval() {
    if (submitting) return;
    if (!validateForm()) return;

    submitting = true;
    const originalText = submitBtn?.textContent;

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Mengajukan...";
    }

    try {
      initializeDocumentInfo();
      saveDraft();
      setStatus("Menyimpan draft dan memeriksa status dokumen...");

      await saveDraftToServer();
      const action = await getSubmissionAction(persistedDraftId);

      const response = await fetch(
        `${API_BASE_URL}/specifications/${encodeURIComponent(persistedDraftId)}/${action}`,
        {
          method: "POST",
          headers: getApiHeaders(),
          body: JSON.stringify({})
        }
      );
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.message || "Gagal mengajukan spesifikasi.");
      }

      const message = result.message || (
        action === "resubmit"
          ? "Spesifikasi berhasil diajukan ulang untuk approval."
          : "Spesifikasi berhasil diajukan untuk approval."
      );

      setStatus(message);
      alert(message);
    } catch (error) {
      console.error("Gagal mengajukan spesifikasi Barang:", error);
      setStatus("Perubahan belum tersimpan, tetapi pengajuan gagal", true);
      alert(`Gagal mengajukan spesifikasi.\n\n${error.message}`);
    } finally {
      submitting = false;

      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    }
  }

  // =====================================================
  // RESTORE FIELD VALUE
  // =====================================================

  function setFieldValue(name, value) {
    const fields = $$(
      `[name="${escapeSelector(name)}"]`,
      questionnaire
    );

    if (!fields.length) return;

    fields.forEach(field => {
      if (field.type === "checkbox") {
        if (Array.isArray(value)) {
          field.checked = value.includes(field.value);
        } else {
          field.checked = Boolean(value);
        }

        return;
      }

      if (field.type === "radio") {
        field.checked = field.value === value;
        return;
      }

      field.value = value ?? "";
    });
  }

  // =====================================================
  // RESTORE ELECTRICAL ATTRIBUTES
  // =====================================================

  function restoreElectricalAttributes(data) {
    if (!Array.isArray(data)) return;

    data.forEach(item => {
      if (!item?.label) return;

      const row = $$("[data-electric-row]", questionnaire)
        .find(element =>
          element.dataset.electricRow === item.label
        );

      if (!row) return;

      const value1 = $('[data-electric-value="1"]', row);
      const value2 = $('[data-electric-value="2"]', row);

      const unitSelect1 = $('[data-electric-unit="1"]', row);
      const unitSelect2 = $('[data-electric-unit="2"]', row);

      const unitOther1 = $('[data-electric-other="1"]', row);
      const unitOther2 = $('[data-electric-other="2"]', row);

      const symbolSelect = $("[data-electric-symbol]", row);

      if (value1) value1.value = item.data1 || "";
      if (value2) value2.value = item.data2 || "";

      if (unitSelect1) {
        unitSelect1.value =
          item.unit1Selection || item.unit1 || "";
      }

      if (unitOther1) unitOther1.value = item.unit1Other || "";

      if (unitSelect2) {
        unitSelect2.value =
          item.unit2Selection || item.unit2 || "";
      }

      if (unitOther2) unitOther2.value = item.unit2Other || "";

      if (symbolSelect && item.symbol) {
        symbolSelect.value = item.symbol;
      }

      updateElectricalOthers(row);
    });
  }

  // =====================================================
  // RESTORE MECHANICAL ATTRIBUTES
  // =====================================================

  function restoreMechanicalAttributes(data) {
    const savedAttributes = Array.isArray(data) ? data : [];

    savedAttributes.forEach(item => {
      if (!item?.label) return;

      const targetLabel =
        item.label === "Speed & Tolerance"
          ? "Speed"
          : item.label;

      const row = $$("[data-mechanical-row]", questionnaire)
        .find(element =>
          element.dataset.mechanicalRow === targetLabel
        );

      if (!row) return;

      const value1 = $('[data-mechanical-value="1"]', row);
      const value2 = $('[data-mechanical-value="2"]', row);

      const unitSelect1 = $('[data-mechanical-unit="1"]', row);
      const unitSelect2 = $('[data-mechanical-unit="2"]', row);

      const unitOther1 = $('[data-mechanical-unit-other="1"]', row);
      const unitOther2 = $('[data-mechanical-unit-other="2"]', row);

      const symbolSelect = $("[data-mechanical-symbol]", row);
      const symbolOther = $("[data-mechanical-symbol-other]", row);

      if (value1) value1.value = item.data1 || "";
      if (value2) value2.value = item.data2 || "";

      if (unitSelect1) {
        if (item.unit1Selection) {
          unitSelect1.value = item.unit1Selection;
        } else if (item.unit1) {
          unitSelect1.value = item.unit1;
        }
      }

      if (unitOther1) unitOther1.value = item.unit1Other || "";

      if (unitSelect2) {
        if (item.unit2Selection) {
          unitSelect2.value = item.unit2Selection;
        } else if (item.unit2) {
          unitSelect2.value = item.unit2;
        }
      }

      if (unitOther2) unitOther2.value = item.unit2Other || "";

      if (symbolSelect) {
        if (item.symbolSelection) {
          symbolSelect.value = item.symbolSelection;
        } else if (item.symbol) {
          symbolSelect.value = MECHANICAL_SYMBOLS.includes(item.symbol)
            ? item.symbol
            : "Others";
        }
      }

      if (symbolOther) symbolOther.value = item.symbolOther || "";

      updateMechanicalOthers(row);
    });
  }

  // =====================================================
  // RESTORE OLD MECHANICAL DATA
  // =====================================================

  function restoreOldMechanicalAttributes(data) {
    const attributes = data.technicalAttributes || [];

    attributes
      .filter(item =>
        item.category === "Mechanical" &&
        (
          MECHANICAL_PARAMETERS.includes(item.label) ||
          item.label === "Speed & Tolerance"
        )
      )
      .forEach(item => {
        const targetLabel =
          item.label === "Speed & Tolerance"
            ? "Speed"
            : item.label;

        const row = $$("[data-mechanical-row]", questionnaire)
          .find(element =>
            element.dataset.mechanicalRow === targetLabel
          );

        if (!row) return;

        const value1 = $('[data-mechanical-value="1"]', row);

        if (value1 && !value1.value) {
          value1.value = item.value || "";
        }
      });
  }

  // =====================================================
  // RESTORE DYNAMIC ATTRIBUTES
  // =====================================================

  function restoreDynamicAttributes(data) {
    technicalContainer?.replaceChildren();
    uniqueContainer?.replaceChildren();

    (data.technicalAttributes || [])
      .filter(item => item.category === "Other")
      .forEach(createCustomTechnicalRow);

    (data.uniqueAttributes || [])
      .slice(2)
      .forEach(createCustomUniqueRow);
  }

  // =====================================================
  // RESTORE FORM
  // =====================================================

  function restoreForm(data) {
    if (!data || typeof data !== "object") return;

    const rawCategory = Array.isArray(data.materialCategory)
      ? data.materialCategory[0]
      : data.materialCategory;

    pendingMaterialCategoryValue = String(
      rawCategory || data.category || ""
    ).trim();
    pendingMaterialGroupValue = String(
      data.materialGroupCode || data.materialGroup || ""
    ).trim();

    restoreDynamicAttributes(data);
    restoreRequiredDocuments(data);

    if (dimensionContainer) {
      dimensionContainer.replaceChildren();

      if (
        Array.isArray(data.dimensionItems) &&
        data.dimensionItems.length
      ) {
        data.dimensionItems.forEach(createDimensionRow);
      } else {
        createDimensionRow();
      }
    }

    Object.entries(data).forEach(([name, value]) => {
      if ([
        "electricalAttributes",
        "technicalAttributes",
        "mechanicalAttributes",
        "uniqueAttributes",
        "dimensionItems",
        "requiredDocuments",
        "drawingImage",
        "specType"
      ].includes(name)) {
        return;
      }

      setFieldValue(name, value);
    });

    normalizeMaterialCategory();

    if (Array.isArray(data.electricalAttributes)) {
      restoreElectricalAttributes(data.electricalAttributes);
    }

    if (Array.isArray(data.mechanicalAttributes)) {
      restoreMechanicalAttributes(data.mechanicalAttributes);
    } else {
      restoreOldMechanicalAttributes(data);
    }

    drawingImage = data.drawingImage || "";

    if (drawingPreview) {
      if (drawingImage) {
        drawingPreview.src = drawingImage;
        drawingPreview.style.display = "block";
      } else {
        drawingPreview.removeAttribute("src");
        drawingPreview.style.display = "none";
      }
    }

    if (plantSelect?.value) {
      updateDepartment(data.department || "");
    }

    updateReason();
    updateMaterialGroupOther(false);
    updateMaterialGroupMatrix();
    updateUomOther();
    updateElectricalOthersInAllRows();
    updateCategory();
    updateDimension();
    updatePackSize();
    updateAllMechanicalOthers();

    updateLegacyTechnicalFields(
      collectTechnicalAttributes()
    );
  }

  function updateElectricalOthersInAllRows() {
    updateAllElectricalOthers();
  }

  // =====================================================
  // VERSION & CREATED DATE
  // =====================================================

  function initializeDocumentInfo() {
    const versionInput = getVersionInput();
    const createdDateInput = getCreatedDateInput();

    if (!versionInput || !createdDateInput) return;

    const savedVersion = Number(
      localStorage.getItem(VERSION_STORAGE_KEY) || 0
    );

    versionInput.value = String(savedVersion).padStart(2, "0");

    if (!createdDateInput.value) {
      createdDateInput.value = todayISO();
    }
  }

  // =====================================================
  // AUTOSAVE
  // =====================================================

  function saveDraft() {
    if (loadingDocument) return;

    hasUnsavedChanges = true;
    setStatus("Perubahan belum disimpan");
  }

  function applyFormDataToQuestionnaire(data) {
    loadingDocument = true;

    try {
      restoreForm(data);
      return true;
    } catch (error) {
      console.error("Gagal menerapkan data Draft:", error);
      return false;
    } finally {
      loadingDocument = false;
    }
  }

  async function resumeServerDraft(detail) {
    if (!confirmDiscardChanges()) return;

    const data = parseDetailFormData(detail);

    if (!applyFormDataToQuestionnaire(data)) {
      setStatus("Draft server gagal dipulihkan ke formulir.", true);
      return;
    }

    persistedDraftId = detail?.id || null;
    persistedDocumentNo = detail?.documentNo || null;
    await reapplyServerMasterData(data);
    hasUnsavedChanges = false;
    clearDraftOwnershipIssue();

    setStatus(
      `Draft ${detail?.documentNo || detail?.id || ""} dimuat dari server. Terakhir diperbarui ${
        window.ESpecDraftWorkspace?.formatUpdatedAt?.(detail?.updatedAt) || "-"
      }.`
    );
  }

  async function resumeDraftFromQuery(id) {
    if (!/^[1-9]\d*$/.test(String(id))) {
      setStatus("ID Draft tidak valid.", true);
      return;
    }

    try {
      setStatus("Memuat Draft dari server...");

      const response = await fetch(
        `${API_BASE_URL}/specifications/my-drafts/${encodeURIComponent(id)}`,
        { headers: getApiHeaders() }
      );
      const result = await response.json().catch(() => ({}));

      if (!response.ok || result.success !== true) {
        throw new Error(result.message || "Draft tidak ditemukan.");
      }

      await resumeServerDraft(result.data);
    } catch (error) {
      setStatus(error.message || "Gagal memuat Draft dari server.", true);
    }
  }

  async function importLegacyBarang(legacy) {
    if (!legacy?.formData) {
      setStatus("Tidak ada data Draft lama di browser untuk dipulihkan.", true);
      return;
    }

    if (!confirmDiscardChanges()) return;

    clearFormForNewDraft();
    persistedDraftId = null;
    persistedDocumentNo = null;
    legacyPendingClear = true;

    const source = legacy?.formData && typeof legacy.formData === "object"
      ? legacy.formData
      : {};
    const legacyFormData = { ...source };

    delete legacyFormData.persistedDocumentNo;

    const data = parseDetailFormData({ formData: legacyFormData, documentNo: "" });

    if (!applyFormDataToQuestionnaire(data)) {
      legacyPendingClear = false;
      setStatus("Data Draft lama gagal dipulihkan ke formulir.", true);
      return;
    }

    await reapplyServerMasterData(data);
    hasUnsavedChanges = true;

    setStatus(
      "Data Draft lama dimuat sebagai Draft baru. Klik Save As Draft untuk menyimpannya ke server."
    );
  }

  async function loadMasterData() {
    try {
      const [types, plantRows, categoryRows] = await Promise.all([
        fetchMasterData("/specification-types"),
        fetchMasterData("/plants"),
        fetchMasterData("/material-categories")
      ]);

      const barangType = types.find((type) =>
        String(type.typename).toLowerCase() === "barang" ||
        String(type.typecode).toLowerCase() === "brg"
      );

      if (!barangType) {
        throw new Error("Tipe spesifikasi Barang tidak ditemukan.");
      }

      barangSpecificationTypeId = barangType.id;
      plants = plantRows;
      categories = categoryRows.filter((category) =>
        Number(category.specificationtypeid) === Number(barangSpecificationTypeId)
      );

      const savedPlant = plantSelect?.value || "";
      const savedDepartment = deptSelect?.value || "";
      const savedCategory =
        pendingMaterialCategoryValue || getSelectedCategories()[0] || "";
      const savedGroup =
        pendingMaterialGroupValue || materialGroupSelect?.value || "";
      const savedReason = reasonChoice?.value || "";

      if (plantSelect) {
        setSelectMessage(plantSelect, "-- Pilih Plant --");

        plants.forEach((plant) => {
          const option = document.createElement("option");
          option.value = String(plant.id);
          option.textContent = `${plant.plantid} - ${plant.plantname}`;
          plantSelect.appendChild(option);
        });

        setSelectedOption(plantSelect, savedPlant);
      }

      if (materialCategoryOptions) {
        materialCategoryOptions.innerHTML = "";

        categories.forEach((category) => {
          const label = document.createElement("label");
          label.className = "q-check";

          const input = document.createElement("input");
          input.type = "checkbox";
          input.name = "materialCategory";
          input.value = String(category.id);
          input.dataset.categoryName = category.categoryname;

          if (
            String(category.id) === String(savedCategory) ||
            category.categoryname === savedCategory
          ) {
            input.checked = true;
          }

          label.append(input, document.createTextNode(` ${category.categoryname}`));
          materialCategoryOptions.appendChild(label);
        });
      }

      if (reasonChoice) {
        setSelectMessage(reasonChoice, "-- Pilih Reason --");

        const reasons = await fetchMasterData(
          `/reason-to-procure/specification-types/${barangSpecificationTypeId}`
        );

        reasons.forEach((reason) => {
          const option = document.createElement("option");
          option.value = String(reason.id);
          option.textContent = reason.optionname;
          option.dataset.allowsCustom = String(reason.allowscustomtext);
          reasonChoice.appendChild(option);
        });

        const matchingReason = reasons.find((reason) =>
          String(reason.id) === String(savedReason) ||
          reason.optionname === savedReason
        );

        setSelectedOption(reasonChoice, matchingReason?.id || savedReason);
      }

      const selectedPlant = findPlant(plantSelect?.value);
      await loadDepartments(selectedPlant?.id, savedDepartment);

      const selectedCategory = getSelectedCategories()[0];
      await loadMaterialGroups(selectedCategory, savedGroup);
      pendingMaterialCategoryValue = "";
      pendingMaterialGroupValue = "";

      normalizeMaterialCategory();
      updateReason();
      masterDataReady = true;
    } catch (error) {
      console.error("Gagal memuat master data Barang:", error);
      setStatus("Gagal memuat master data dari server. Coba muat ulang halaman.");
    }
  }

  // =====================================================
  // DRAWING UPLOAD
  // =====================================================

  drawingUpload?.addEventListener("change", event => {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("File harus berupa gambar.");
      event.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert("Ukuran gambar maksimal 5 MB.");
      event.target.value = "";
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      drawingImage = reader.result;

      if (drawingPreview) {
        drawingPreview.src = drawingImage;
        drawingPreview.style.display = "block";
      }

      saveDraft();
    };

    reader.onerror = () => alert("Gagal membaca gambar.");

    reader.readAsDataURL(file);
  });

  // =====================================================
  // VALIDATION
  // =====================================================

  function validateForm() {
    updateReason();
    updateCategory();
    updateMaterialGroupOther();
    updateMaterialGroupMatrix();

    syncDimensionField();

    if (!questionnaire.reportValidity()) return false;

    // VALIDASI DIMENSION
    if (
      getCurrentMatrixStatus("dimension") === "*" &&
      collectDimensionItems().length === 0
    ) {
      alert("Dimension wajib diisi untuk Material Group ini.");

      $(".dimension-type", dimensionContainer)?.focus();

      return false;
    }

    const categories = getSelectedCategories();

    if (categories.length !== 1) {
      alert("Pilih tepat satu Material Category.");

      $('[name="materialCategory"]', questionnaire)?.focus();

      return false;
    }

    if (
      reasonChoice?.selectedOptions[0]?.dataset.allowsCustom === "true" &&
      !reasonOther?.value.trim()
    ) {
      alert("Reason Others wajib diisi.");
      reasonOther?.focus();
      return false;
    }

    if (!drawingImage) {
      alert("Design / Drawing / Visual / Illustration wajib diunggah.");
      drawingUpload?.focus();
      return false;
    }

    const selectedGroup = (
      materialGroupSelect?.value ||
      materialGroupSelect?.selectedOptions[0]?.textContent ||
      ""
    ).trim();
    const requiredFields =
      MATERIAL_GROUP_REQUIRED_FIELDS[selectedGroup] ||
      MATERIAL_GROUP_REQUIRED_FIELDS[materialGroupSelect?.selectedOptions[0]?.dataset?.groupCode] ||
      MATERIAL_GROUP_REQUIRED_FIELDS[materialGroupSelect?.selectedOptions[0]?.textContent?.trim()] ||
      [];

    for (const field of requiredFields) {
      const missing = getMissingRequiredField(field);

      if (!missing) continue;

      alert(`${getRequiredFieldLabel(field)} wajib diisi untuk Material Group ${selectedGroup}.`);
      missing.focus?.();
      return false;
    }

    return true;
  }

  function getMissingRequiredField(field) {
    if (field === "dimension") {
      const hasDimension = collectDimensionItems().length > 0;

      return hasDimension ? null : $(".dimension-type", dimensionContainer) || $(".dimension-value", dimensionContainer);
    }

    if (field.startsWith("technical:")) {
      const label = field.slice("technical:".length);

      return !$$("[data-tech-label]", questionnaire).some((input) =>
        input.dataset.techLabel === label && input.value.trim()
      ) && !$$("[data-electric-row]", questionnaire).some((row) =>
        row.dataset.electricRow === label &&
        $$('[data-electric-value]', row).some((input) => input.value.trim())
      ) && !$$("[data-mechanical-row]", questionnaire).some((row) =>
        row.dataset.mechanicalRow === label &&
        $$('[data-mechanical-value]', row).some((input) => input.value.trim())
      )
        ? $("[data-tech-label]", questionnaire) || $("[data-electric-value]", questionnaire)
        : null;
    }

    const fieldElement = $(`[name="${escapeSelector(field)}"]`, questionnaire);

    return !fieldElement?.value.trim() ? fieldElement : null;
  }

  function getRequiredFieldLabel(field) {
    const labels = {
      materialDescription: "Material Description",
      partNumber: "Type/Model/Part Number",
      variant: "Varians",
      dimension: "Dimension",
      brand: "Brand",
      catalogue: "Catalogue",
      uom: "UoM",
      packSize: "Pack Size"
    };

    return field.startsWith("technical:")
      ? field.slice("technical:".length)
      : labels[field] || field;
  }

  // =====================================================
  // LOCAL TRANSACTION
  // =====================================================

  function saveTransactionLocally() {
    try {
      const versionInput = getVersionInput();
      const currentVersion = Number(versionInput?.value || 0);
      const nextVersion = currentVersion + 1;

      localStorage.setItem(
        VERSION_STORAGE_KEY,
        String(nextVersion)
      );

      if (versionInput) {
        versionInput.value = String(nextVersion).padStart(2, "0");
      }

      return true;
    } catch (error) {
      console.error("Gagal memperbarui versi dokumen:", error);
      return false;
    }
  }

  // =====================================================
  // PRINT DATA TRANSFER
  // =====================================================

  function transferToPrint(data = getFormData()) {
    if (!printForm) return;

    printForm.querySelectorAll("[name]").forEach(target => {
      const value = data[target.name];

      if (target.type === "checkbox") {
        target.checked = Array.isArray(value)
          ? value.includes(target.value)
          : Boolean(value);

        return;
      }

      if (target.type === "radio") {
        target.checked = target.value === value;
        return;
      }

      target.value = value ?? "";
    });

    // MATERIAL GROUP — OTHERS KE PDF
    const materialGroupPrint = $(
      '[name="materialGroup"]',
      printForm
    );

    if (materialGroupPrint) {
      const materialGroupLabel =
        data.materialGroupCode ||
        materialGroupSelect?.selectedOptions?.[0]?.textContent?.trim() ||
        data.materialGroup ||
        "";

      materialGroupPrint.value =
        data.materialGroup === "Others"
          ? (data.materialGroupOther || "Others")
          : materialGroupLabel;
    }

    const categoryField = $(
      '[name="materialCategory"]',
      printForm
    );

    if (categoryField) {
      categoryField.value = (data.materialCategory || []).join(", ");
    }

    const revisionDate = $('[name="revisionDate"]', printForm);

    if (revisionDate && !revisionDate.value) {
      revisionDate.value = formatDate(data.createdDate);
    }

    const printDrawing = $("#drawingPreview", printForm);

    if (printDrawing) {
      if (data.drawingImage) {
        printDrawing.src = data.drawingImage;
        printDrawing.style.display = "block";
      } else {
        printDrawing.removeAttribute("src");
        printDrawing.style.display = "none";
      }
    }
  }

  // =====================================================
  // BUTTON EVENTS — REQUIRED DOCUMENTS
  // =====================================================

  addRequiredDocumentBtn?.addEventListener("click", () => {
    createRequiredDocumentRow();
    updateRequiredDocumentOptions();
    saveDraft();
  });

  // =====================================================
  // BUTTON EVENTS — DIMENSION
  // =====================================================

  $("#addDimensionBtn")?.addEventListener("click", () => {
    const totalRows = $$(".dimension-row", dimensionContainer).length;

    if (totalRows >= 3) {
      updateDimension();
      return;
    }

    createDimensionRow();
    updateDimension();
    saveDraft();
  });

  dimensionContainer?.addEventListener("click", event => {
    const button = event.target.closest(".remove-dimension");

    if (!button) return;

    const row = button.closest(".dimension-row");
    const rows = $$(".dimension-row", dimensionContainer);

    if (rows.length > 1) {
      row.remove();
    } else {
      $(".dimension-type", row).value = "";
      $(".dimension-value", row).value = "";
      $(".dimension-unit", row).value = "";
      $(".dimension-symbol", row).value = "";
    }

    updateDimension();
    saveDraft();
  });


  // =====================================================
  // CREATE CUSTOM TECHNICAL ATTRIBUTE
  // =====================================================

  function createCustomTechnicalRow(item = {}) {
    if (!technicalContainer) return;

    const row = document.createElement("div");
    row.className = "custom-tech-row q-grid";

    // ATTRIBUTE NAME
    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.name = "customTechnicalName[]";
    nameInput.dataset.customTechName = "";
    nameInput.placeholder = "Masukkan nama atribut";
    nameInput.value = item.label || "";

    // ATTRIBUTE VALUE
    const valueInput = document.createElement("input");
    valueInput.type = "text";
    valueInput.name = "customTechnicalValue[]";
    valueInput.dataset.customTechValue = "";
    valueInput.placeholder = "Masukkan nilai atribut";
    valueInput.value = item.value || "";

    // REMOVE BUTTON
    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "q-remove-button";
    removeButton.textContent = "×";
    removeButton.title = "Hapus atribut";

    row.append(
      nameInput,
      valueInput,
      removeButton
    );

    technicalContainer.appendChild(row);
  }


  // =====================================================
  // CREATE CUSTOM UNIQUE ATTRIBUTE
  // =====================================================

  function createCustomUniqueRow(item = {}) {
    if (!uniqueContainer) return;

    const row = document.createElement("div");
    row.className = "custom-unique-row q-grid";

    // ATTRIBUTE NAME
    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.name = "customUniqueName[]";
    nameInput.placeholder = "Masukkan nama atribut";
    nameInput.value = item.name || "";

    // ATTRIBUTE DETAIL
    const detailInput = document.createElement("input");
    detailInput.type = "text";
    detailInput.name = "customUniqueDetail[]";
    detailInput.placeholder = "Masukkan detail atribut";
    detailInput.value = item.detail || "";

    // REMOVE BUTTON
    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "q-remove-button";
    removeButton.textContent = "×";
    removeButton.title = "Hapus atribut";

    row.append(
      nameInput,
      detailInput,
      removeButton
    );

    uniqueContainer.appendChild(row);
  }

  // =====================================================
  // BUTTON EVENTS — TECHNICAL & UNIQUE
  // =====================================================

$("#addTechnicalBtn")?.addEventListener("click", () => {
  createCustomTechnicalRow();
  saveDraft();
});

  $("#addUniqueBtn")?.addEventListener("click", () => {
    createCustomUniqueRow();
    saveDraft();
  });

  questionnaire.addEventListener("click", event => {
    const removeButton = event.target.closest(".q-remove-button");

    if (!removeButton) return;

    const row = removeButton.closest(
      ".custom-tech-row, .custom-unique-row"
    );

    if (!row) return;

    row.remove();
    saveDraft();
  });

  // =====================================================
  // MECHANICAL SELECT EVENTS
  // =====================================================

  questionnaire.addEventListener("change", event => {
    const mechanicalRow = event.target.closest(
      "[data-mechanical-row]"
    );

    if (!mechanicalRow) return;

    if (
      event.target.matches(
        "[data-mechanical-unit], [data-mechanical-symbol]"
      )
    ) {
      updateMechanicalOthers(mechanicalRow);
      saveDraft();
    }
  });

  // =====================================================
  // ELECTRICAL SELECT EVENTS
  // =====================================================

  questionnaire.addEventListener("change", event => {
    const electricalRow = event.target.closest("[data-electric-row]");

    if (!electricalRow) return;

    if (event.target.matches("[data-electric-unit]")) {
      updateElectricalOthers(electricalRow);
      saveDraft();
    }
  });

  // =====================================================
  // INPUT EVENTS
  // =====================================================

  questionnaire.addEventListener("input", () => {
    updateReason();
    updateDimension();
    updatePackSize();
    updateCategory();
    saveDraft();
  });

  questionnaire.addEventListener("change", () => {
    updateReason();
    updateUomOther();
    updateAllElectricalOthers();
    updateDimension();
    updatePackSize();
    updateCategory();
    updateAllMechanicalOthers();
    saveDraft();
  });

  plantSelect?.addEventListener("change", () => {
    updateDepartment();
    saveDraft();
  });

  reasonChoice?.addEventListener("change", () => {
    updateReason();
    saveDraft();
  });

  // =====================================================
  // RESET
  // =====================================================

  function clearFormForNewDraft() {
    questionnaire.reset();

    updateMaterialGroupOther();
    updateMaterialGroupMatrix();

    persistedDraftId = null;
    persistedDocumentNo = null;
    hasUnsavedChanges = false;
    clearDraftOwnershipIssue();

    drawingImage = "";

    if (drawingUpload) drawingUpload.value = "";

    if (drawingPreview) {
      drawingPreview.removeAttribute("src");
      drawingPreview.style.display = "none";
    }

    technicalContainer?.replaceChildren();
    uniqueContainer?.replaceChildren();

    requiredDocumentsContainer?.replaceChildren();
    createRequiredDocumentRow();

    if (dimensionContainer) {
      dimensionContainer.replaceChildren();
      createDimensionRow();
    }

    updateDepartment();
    initializeDocumentInfo();

    updateReason();
    updateUomOther();
    updateAllElectricalOthers();
    updateCategory();
    updateDimension();
    updatePackSize();
    updateAllMechanicalOthers();
    transferToPrint({});
  }

  function startNewDraft() {
    if (!confirmDiscardChanges()) return;

    clearFormForNewDraft();
    setStatus("Draft baru siap dibuat. Klik Save As Draft untuk menyimpannya ke server.");
  }

  resetBtn?.addEventListener("click", () => {
    const confirmed = confirm(
      "Yakin ingin mengosongkan seluruh jawaban spesifikasi barang?"
    );

    if (!confirmed) return;

    clearFormForNewDraft();
    setStatus("Form berhasil direset");

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  });

  // =====================================================
  // SAVE FOR ADMIN
  // =====================================================

  saveBtn?.addEventListener("click", async () => {
    if (saving) return;
    if (!validateForm()) return;

    saving = true;
    saveBtn.disabled = true;

    try {
      initializeDocumentInfo();

      saveDraft();
      setStatus("Menyimpan draft ke server...");

      const { isUpdate } = await saveDraftToServer();

      if (!isUpdate && !saveTransactionLocally()) return;

      setStatus(
        isUpdate
          ? "Draft berhasil diperbarui di server"
          : "Draft berhasil disimpan di server"
      );
      alert(
        isUpdate
          ? "Draft spesifikasi berhasil diperbarui di server."
          : "Draft spesifikasi berhasil disimpan di server."
      );
    } catch (error) {
      console.error("Gagal menyimpan draft Barang:", error);
      setStatus("Perubahan belum tersimpan, penyimpanan server gagal", true);
      alert(`Gagal menyimpan draft ke server.\n\n${error.message}`);
    } finally {
      saving = false;
      saveBtn.disabled = false;
    }
  });

  // =====================================================
  // LOAD DOCUMENT FROM DATABASE FOR PRINT
  // barang.html?printId=ID
  // =====================================================

  async function loadDocumentFromDatabase(id) {
    try {
      loadingDocument = true;

      setStatus("Mengambil dokumen dari database...");

      const response = await fetch(
        `${API_BASE_URL}/specifications/my-documents/${encodeURIComponent(id)}`,
        { headers: getApiHeaders() }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.message ||
          result.error ||
          "Dokumen tidak ditemukan."
        );
      }

      const row = result.data || result.document || result;

      let formData =
        row.formData ||
        row.form_data ||
        {};

      if (typeof formData === "string") {
        formData = safeJSONParse(formData, {});
      }

      const data = {
        ...formData,

        id: row.id,

        docNo:
          row.documentNo ??
          row.document_no ??
          row.docNo ??
          "",

        revision: row.revisionNo ?? row.revision ?? "",

        plant:
          row.plant ??
          formData.plant ??
          "",

        requestor:
          row.requestor ??
          formData.requestor ??
          "",

        department:
          row.department ??
          formData.department ??
          "",

        materialDescription:
          row.materialDescription ??
          row.material_description ??
          formData.materialDescription ??
          "",

        materialCode:
          row.materialCode ??
          row.material_code ??
          formData.materialCode ??
          "",

        specType: row.specificationTypeName || row.spec_type || "Barang"
      };

      restoreForm(data);
      transferToPrint(data);

      loadingDocument = false;

      setStatus("Dokumen berhasil dimuat dari database");

      setTimeout(() => window.print(), 500);

    } catch (error) {
      loadingDocument = false;

      console.error("Gagal mengambil dokumen:", error);

      setStatus("Gagal memuat dokumen dari database");

      alert(error.message);
    }
  }

  async function initialize() {
    const params = new URLSearchParams(window.location.search);
    const printId = params.get("printId");
    const legacyImport = params.get("legacyImport");

    initializeMechanicalUomOptions();

    if (requiredDocumentsContainer) {
      requiredDocumentsContainer.replaceChildren();
      createRequiredDocumentRow();
    }

    if (printId) {
      loadDocumentFromDatabase(printId);
      return;
    }

    initializeDocumentInfo();

    if (dimensionContainer && !$(".dimension-row", dimensionContainer)) {
      createDimensionRow();
    }

    normalizeMaterialCategory();

    updateReason();
    updateMaterialGroupOther(false);
    updateMaterialGroupMatrix();
    updateUomOther();
    updateAllElectricalOthers();
    updateCategory();
    updateDimension();
    updatePackSize();
    updateAllMechanicalOthers();

    loadMasterData().then(async () => {
      if (legacyImport) {
        await importLegacyBarang(window.ESpecDraftWorkspace?.readLegacy?.("barang"));
      }

      const resumeId = params.get("resumeId");

      if (resumeId) await resumeDraftFromQuery(resumeId);
    });
  }

  submitBtn?.addEventListener("click", submitForApproval);

  // =====================================================
  // START APPLICATION
  // =====================================================

  Promise.resolve(window.ESpecRoleNav?.ready).then(() => initialize());

})();
