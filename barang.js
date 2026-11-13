
(() => {
  "use strict";

  // =====================================================
  // E-SPEC BARANG — QUESTIONNAIRE CONTROLLER
  // =====================================================

  const STORAGE_KEY = "eSpecBarangQuestionnaire.v2";
  const OLD_STORAGE_KEY = "eSpecBarangQuestionnaire.v1";
  const VERSION_STORAGE_KEY = "eSpecBarangVersion.v1";
  const HISTORY_KEY = "eSpecBarangTransactions.v1";

  // Jika backend production berbeda, ubah alamat ini.
  const API_BASE_URL =
    window.E_SPEC_API_BASE_URL || "http://localhost:3000";

  const questionnaire = document.getElementById("questionnaireForm");
  const printForm = document.getElementById("printSpecForm");

  if (!questionnaire) {
    console.error("Form kuesioner Barang tidak ditemukan.");
    return;
  }

  const $ = (selector, parent = document) =>
    parent?.querySelector(selector) || null;

  const $$ = (selector, parent = document) =>
    parent ? [...parent.querySelectorAll(selector)] : [];

  const pdfBtn = $("#pdfBtn");
  const resetBtn = $("#resetBtn");
  const saveBtn = $("#saveAdminBtn");
  const draftStatus = $("#draftStatus");

  const plantSelect = $("#plantCodeSelect");
  const plantDesc = $("#plantDescInput");
  const deptSelect = $("#deptSelect");

  const reasonChoice = $("#reasonChoice");
  const reasonOther = $("#reasonOther");
  const reasonOthers = $("#reasonOthersBarang");
  const reasonFinal = $("#reasonFinal");

  const dimensionContainer = $("#dimensionRows");
  const drawingUpload = $("#questionDrawingUpload");
  const drawingPreview = $("#drawingPreview");

  const technicalContainer = $("#dynamicCustomTechnicalContainer");
  const uniqueContainer = $("#dynamicCustomUniqueContainer");

  const DIMENSION_OPTIONS = ["L", "W", "H", "T", "ID", "OD", "DN"];

  const MECHANICAL_PARAMETERS = [
    "Capacity",
    "Pressure",
    "Flowrate",
    "Speed & Tolerance"
  ];

  const MECHANICAL_SYMBOLS = [
    "x",
    "--",
    "~",
    "/",
    "±",
    "-"
  ];

  const PLANT_DATA = {
    "1210 - Plant Gending": [
      "HRGA",
      "Fermentation - Decalcium",
      "Fermentation - Glucose",
      "Fermentation - Fermentation",
      "Isolation & Purification - Isolation",
      "Isolation & Purification - Purification",
      "Packing",
      "Polycello & Technic Packing",
      "Liquid Fertilizer Sales",
      "SCM - PPIC",
      "SCM - Inderect Sourcing",
      "Engineering & Technical Development",
      "Utility",
      "Electrical Instrument",
      "Mechanical & Maintenance",
      "Logistic & Warehouse",
      "QA & QC",
      "SHE",
      "IT",
      "Costing Associate"
    ],

    "1220 - Plant Cikarang": [
      "HRGA",
      "Production - Dry",
      "Production - Wet",
      "SCM - PPIC",
      "SCM - Inderect Sourcing",
      "Maintenance",
      "Project",
      "Warehouse",
      "QA & QC",
      "SHE",
      "IT",
      "Supply Chain Finance"
    ],

    "1230 - Plant Minahasa Selatan": [
      "Production - Opening & Processing",
      "Production - Production & TCA",
      "PPIC",
      "Indirect Sourcing",
      "Maintenance",
      "Utility",
      "Warehouse",
      "QA & QC",
      "SHE",
      "IT",
      "Plant Operation Controller"
    ]
  };

  const CATEGORY_MAPPING = {
    "Asset Barang": "Asset Barang",
    "Expense Barang Umum / Teknik": "Expense Barang General",
    "Expense Bahan Kimia / Sanitasi / Pelumas": "Expense Barang Kimia"
  };

  let drawingImage = "";
  let loadingDocument = false;
  let saving = false;

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

  function setStatus(message) {
    if (draftStatus) {
      draftStatus.textContent = message;
    }
  }

  function formatDate(value) {
    if (!value) return "";

    const date = new Date(`${value}T00:00:00`);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric"
    });
  }

  function safeJSONParse(value, fallback = null) {
    try {
      return value ? JSON.parse(value) : fallback;
    } catch (error) {
      console.warn("Gagal membaca JSON:", error);
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

  function isValidArray(value) {
    return Array.isArray(value) ? value : [];
  }

  // =====================================================
  // PLANT & DEPARTMENT
  // =====================================================

  function updateDepartment(restoreValue = "") {
    if (!plantSelect || !deptSelect) return;

    const selectedPlant = plantSelect.value;
    const description = selectedPlant.split(" - ")[1] || "";

    if (plantDesc) {
      plantDesc.value = description;
    }

    deptSelect.innerHTML =
      '<option value="">-- Pilih Departemen --</option>';

    const departments = PLANT_DATA[selectedPlant] || [];

    departments.forEach(department => {
      const option = document.createElement("option");

      option.value = department;
      option.textContent = department;

      deptSelect.appendChild(option);
    });

    if (restoreValue) {
      deptSelect.value = restoreValue;
    }
  }

  // =====================================================
  // MATERIAL CATEGORY — SINGLE SELECTION
  // =====================================================

  function getSelectedCategories() {
    return $$(
      '[name="materialCategory"]:checked',
      questionnaire
    ).map(field => field.value);
  }

  function updateCategory() {
    const selected = getSelectedCategories();

    $$('[name="category"]', questionnaire).forEach(field => {
      field.checked = selected.some(
        category => CATEGORY_MAPPING[category] === field.value
      );
    });
  }

  // Menjaga agar hanya satu kategori yang terpilih.
  function normalizeMaterialCategory() {
    const selectedFields = $$(
      '[name="materialCategory"]:checked',
      questionnaire
    );

    selectedFields.slice(1).forEach(field => {
      field.checked = false;
    });

    updateCategory();
  }

  questionnaire.addEventListener("change", event => {
    if (!event.target.matches('[name="materialCategory"]')) {
      return;
    }

    if (event.target.checked) {
      $$('[name="materialCategory"]', questionnaire).forEach(field => {
        if (field !== event.target) {
          field.checked = false;
        }
      });
    }

    updateCategory();
  });

  // =====================================================
  // REASON TO PROCURE
  // =====================================================

  function updateReason() {
    if (!reasonChoice || !reasonFinal) return;

    const isOthers = reasonChoice.value === "Others";

    if (reasonOthers) {
      reasonOthers.hidden = !isOthers;
    }

    if (reasonOther) {
      reasonOther.hidden = !isOthers;
      reasonOther.disabled = !isOthers;
      reasonOther.required = isOthers;

      if (!isOthers) {
        reasonOther.value = "";
      }
    }

    reasonFinal.value = isOthers
      ? (reasonOther?.value.trim() || "")
      : reasonChoice.value;
  }

  // =====================================================
  // DIMENSION
  // =====================================================

  function createDimensionRow(item = {}) {
    if (!dimensionContainer) return;

    const row = document.createElement("div");
    row.className = "dimension-row";

    const typeSelect = document.createElement("select");
    typeSelect.className = "dimension-type";

    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.textContent = "-- Pilih Dimension --";

    typeSelect.appendChild(defaultOption);

    DIMENSION_OPTIONS.forEach(type => {
      const option = document.createElement("option");

      option.value = type;
      option.textContent = type;

      typeSelect.appendChild(option);
    });

    const valueInput = document.createElement("input");
    valueInput.type = "text";
    valueInput.className = "dimension-value";
    valueInput.placeholder = "Masukkan nilai";

    const symbolSelect = document.createElement("select");
    symbolSelect.className = "dimension-symbol";

    [
      ["x", "x"],
      ["~", "~"],
      ["/", "/"],
      ["±", "±"],
      ["-", "-"]
    ].forEach(([value, label]) => {
      const option = document.createElement("option");

      option.value = value;
      option.textContent = label;

      symbolSelect.appendChild(option);
    });

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "remove-dimension";
    removeButton.title = "Hapus";
    removeButton.textContent = "×";

    typeSelect.value = item.type || "";
    valueInput.value = item.value || "";
    symbolSelect.value = item.symbol || "x";

    row.append(
      typeSelect,
      valueInput,
      symbolSelect,
      removeButton
    );

    dimensionContainer.appendChild(row);
  }

  function collectDimensionItems() {
    if (!dimensionContainer) return [];

    return $$(".dimension-row", dimensionContainer)
      .map(row => ({
        type: $(".dimension-type", row)?.value || "",
        value: $(".dimension-value", row)?.value.trim() || "",
        symbol: $(".dimension-symbol", row)?.value || "x"
      }))
      .filter(item => item.type && item.value);
  }

  function updateDimension() {
    const finalField = $("#dimensionFinal", questionnaire);

    if (!finalField) return;

    const items = collectDimensionItems();
    let previousType = "";

    const groupedTypes = ["ID", "OD", "DN"];

    finalField.value = items.map((item, index) => {
      const text = `${item.type} : ${item.value}`;

      if (index === 0) {
        previousType = item.type;
        return text;
      }

      let separator = item.symbol || "x";

      const currentGrouped = groupedTypes.includes(item.type);
      const previousGrouped = groupedTypes.includes(previousType);

      if (currentGrouped || previousGrouped) {
        separator = "-";
      }

      previousType = item.type;

      return `${separator} ${text}`;
    }).join(" ");
  }

  // =====================================================
  // PACK SIZE
  // =====================================================

  function updatePackSize() {
    const quantity =
      $("#packQuantity", questionnaire)?.value.trim() || "";

    const packUom =
      $("#packUom", questionnaire)?.value || "";

    const symbol =
      $("#packSymbol", questionnaire)?.value || "";

    const packageUom =
      $("#packageUom", questionnaire)?.value || "";

    const finalField = $("#packSizeFinal", questionnaire);

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

  // =====================================================
  // MECHANICAL — SAP UOM DROPDOWN
  // =====================================================

  function initializeMechanicalUomOptions() {
    const mainUom = $('select[name="uom"]', questionnaire);

    if (!mainUom) {
      console.warn("Dropdown UoM utama tidak ditemukan.");
      return;
    }

    const sourceOptions = $$("option", mainUom)
      .filter(option => option.value.trim() !== "")
      .map(option => ({
        value: option.value,
        text: option.textContent.trim()
      }));

    $$("[data-mechanical-unit]", questionnaire).forEach(select => {
      const currentValue = select.value;

      select.innerHTML = "";

      const placeholder = document.createElement("option");
      placeholder.value = "";
      placeholder.textContent = "-- Pilih UoM --";

      select.appendChild(placeholder);

      sourceOptions.forEach(item => {
        if (item.value === "Others") return;

        const option = document.createElement("option");

        option.value = item.value;
        option.textContent = item.text;

        select.appendChild(option);
      });

      const othersOption = document.createElement("option");
      othersOption.value = "Others";
      othersOption.textContent = "Others";

      select.appendChild(othersOption);

      if (
        currentValue &&
        [...select.options].some(option => option.value === currentValue)
      ) {
        select.value = currentValue;
      } else {
        select.value = "";
      }
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

      if (!isOthers) {
        otherInput.value = "";
      }
    });

    const symbolSelect = $("[data-mechanical-symbol]", row);
    const symbolOther = $("[data-mechanical-symbol-other]", row);

    if (symbolSelect && symbolOther) {
      const isOthers = symbolSelect.value === "Others";

      symbolOther.hidden = !isOthers;
      symbolOther.disabled = !isOthers;

      if (!isOthers) {
        symbolOther.value = "";
      }
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
    const select = $(
      `[data-mechanical-unit="${position}"]`,
      row
    );

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
        value1 ||
        value2 ||
        unit1 ||
        unit2 ||
        symbol;

      if (!hasData) return;

      const first = [value1, unit1]
        .filter(Boolean)
        .join(" ");

      const second = [value2, unit2]
        .filter(Boolean)
        .join(" ");

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
    $$("[data-electric-row]", questionnaire).forEach(row => {
      const label = row.dataset.electricRow || "";

      const value1 =
        $('[data-electric-value="1"]', row)?.value.trim() || "";

      const unit1 =
        $('[data-electric-unit="1"]', row)?.value || "";

      const value2 =
        $('[data-electric-value="2"]', row)?.value.trim() || "";

      const unit2 =
        $('[data-electric-unit="2"]', row)?.value || "";

      const symbol =
        $("[data-electric-symbol]", row)?.value || "/";

      if (!value1 && !value2) return;

      const first = [value1, unit1]
        .filter(Boolean)
        .join(" ");

      const second = [value2, unit2]
        .filter(Boolean)
        .join(" ");

      let value = first;

      if (second) {
        value += `${first ? ` ${symbol} ` : ""}${second}`;
      }

      attributes.push({
        category: "Electric",
        label,
        value,
        unit: ""
      });
    });

    // MATERIAL, CONNECTION TYPE, LIQUID
    $$("[data-tech-label]", questionnaire).forEach(input => {
      const label = input.dataset.techLabel || "";
      const value = input.value.trim();

      if (!label || !value) return;

      const unitInput = $$(
        "[data-tech-unit]",
        questionnaire
      ).find(field => field.dataset.techUnit === label);

      attributes.push({
        category: getTechnicalCategory(input),
        label,
        value,
        unit: unitInput?.value.trim() || ""
      });
    });

    // MECHANICAL
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

      const unit =
        $("[data-custom-tech-unit]", row)?.value.trim() || "";

      if (label && value) {
        attributes.push({
          category: "Other",
          label,
          value,
          unit
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

      if (labelField) {
        labelField.value = item?.label || "";
      }

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

    if (name1 || detail1) {
      attributes.push({
        name: name1,
        detail: detail1
      });
    }

    if (name2 || detail2) {
      attributes.push({
        name: name2,
        detail: detail2
      });
    }

    $$(".custom-unique-row", questionnaire).forEach(row => {
      const name = $(
        'input[name^="customUniqueName"]',
        row
      )?.value.trim() || "";

      const detail = $(
        'input[name^="customUniqueDetail"]',
        row
      )?.value.trim() || "";

      if (name || detail) {
        attributes.push({
          name,
          detail
        });
      }
    });

    return attributes;
  }

  // =====================================================
  // FORM DATA
  // =====================================================

  function getFormData() {
    updateReason();
    updateCategory();
    updateDimension();
    updatePackSize();
    updateAllMechanicalOthers();

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
        data[name] =
          fields.find(field => field.checked)?.value || "";

        return;
      }

      data[name] = first.value ?? "";
    });

    data.materialCategory = getSelectedCategories();

    data.category = $$(
      '[name="category"]:checked',
      questionnaire
    ).map(field => field.value);

    data.technicalAttributes = technicalAttributes;
    data.mechanicalAttributes = mechanicalAttributes;
    data.uniqueAttributes = uniqueAttributes;
    data.dimensionItems = collectDimensionItems();
    data.drawingImage = drawingImage;
    data.specType = "Barang";

    return data;
  }

  // =====================================================
  // DYNAMIC TECHNICAL ROWS
  // =====================================================

  function createCustomTechnicalRow(item = {}) {
    if (!technicalContainer) return;

    const row = document.createElement("div");
    row.className = "custom-tech-row q-grid";

    row.innerHTML = `
      <label class="q-field">
        Nama Atribut
        <input
          type="text"
          data-custom-tech-name
          placeholder="Nama atribut"
        >
      </label>

      <label class="q-field">
        Nilai
        <input
          type="text"
          data-custom-tech-value
          placeholder="Nilai teknis"
        >
      </label>

      <label class="q-field">
        UoM
        <input
          type="text"
          data-custom-tech-unit
          placeholder="Satuan"
        >
      </label>

      <button type="button" class="q-remove-button">
        Hapus
      </button>
    `;

    $("[data-custom-tech-name]", row).value = item.label || "";
    $("[data-custom-tech-value]", row).value = item.value || "";
    $("[data-custom-tech-unit]", row).value = item.unit || "";

    technicalContainer.appendChild(row);
  }

  // =====================================================
  // DYNAMIC UNIQUE ROWS
  // =====================================================

  function createCustomUniqueRow(item = {}) {
    if (!uniqueContainer) return;

    const index =
      Date.now() + Math.floor(Math.random() * 1000);

    const row = document.createElement("div");
    row.className = "q-grid custom-unique-row";

    const nameLabel = document.createElement("label");
    nameLabel.className = "q-field";
    nameLabel.textContent = "Nama Unique Attribute";

    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.name = `customUniqueName${index}`;
    nameInput.value = item.name || "";

    nameLabel.appendChild(nameInput);

    const detailLabel = document.createElement("label");
    detailLabel.className = "q-field";
    detailLabel.textContent = "Detail Unique Attribute";

    const detailInput = document.createElement("input");
    detailInput.type = "text";
    detailInput.name = `customUniqueDetail${index}`;
    detailInput.value = item.detail || "";

    detailLabel.appendChild(detailInput);

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "q-remove-button";
    removeButton.textContent = "Hapus";

    row.append(
      nameLabel,
      detailLabel,
      removeButton
    );

    uniqueContainer.appendChild(row);
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
  // RESTORE MECHANICAL ATTRIBUTES
  // =====================================================

  function restoreMechanicalAttributes(data) {
    const savedAttributes = isValidArray(data);

    savedAttributes.forEach(item => {
      if (!item?.label) return;

      const row = $$(
        "[data-mechanical-row]",
        questionnaire
      ).find(element =>
        element.dataset.mechanicalRow === item.label
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

      // UOM 1
      if (unitSelect1) {
        if (item.unit1Selection) {
          unitSelect1.value = item.unit1Selection;
        } else if (item.unit1) {
          unitSelect1.value = item.unit1;
        }
      }

      if (unitOther1) {
        unitOther1.value = item.unit1Other || "";
      }

      // UOM 2
      if (unitSelect2) {
        if (item.unit2Selection) {
          unitSelect2.value = item.unit2Selection;
        } else if (item.unit2) {
          unitSelect2.value = item.unit2;
        }
      }

      if (unitOther2) {
        unitOther2.value = item.unit2Other || "";
      }

      // SYMBOL
      if (symbolSelect) {
        if (item.symbolSelection) {
          symbolSelect.value = item.symbolSelection;
        } else if (item.symbol) {
          symbolSelect.value = MECHANICAL_SYMBOLS.includes(item.symbol)
            ? item.symbol
            : "Others";
        }
      }

      if (symbolOther) {
        symbolOther.value = item.symbolOther || "";
      }

      updateMechanicalOthers(row);
    });
  }

  // =====================================================
  // RESTORE OLD MECHANICAL DATA
  // =====================================================

  function restoreOldMechanicalAttributes(data) {
    const attributes = isValidArray(data.technicalAttributes);

    attributes
      .filter(item =>
        item.category === "Mechanical" &&
        MECHANICAL_PARAMETERS.includes(item.label)
      )
      .forEach(item => {
        const row = $$(
          "[data-mechanical-row]",
          questionnaire
        ).find(element =>
          element.dataset.mechanicalRow === item.label
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

    isValidArray(data.technicalAttributes)
      .filter(item => item.category === "Other")
      .forEach(createCustomTechnicalRow);

    isValidArray(data.uniqueAttributes)
      .slice(2)
      .forEach(createCustomUniqueRow);
  }

  // =====================================================
  // RESTORE FORM
  // =====================================================

  function restoreForm(data) {
    if (!data || typeof data !== "object") return;

    restoreDynamicAttributes(data);

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
        "technicalAttributes",
        "mechanicalAttributes",
        "uniqueAttributes",
        "dimensionItems",
        "drawingImage",
        "specType"
      ].includes(name)) {
        return;
      }

      setFieldValue(name, value);
    });

    // Normalisasi kategori dari draft lama.
    normalizeMaterialCategory();

    // Pulihkan Mechanical.
    if (Array.isArray(data.mechanicalAttributes)) {
      restoreMechanicalAttributes(data.mechanicalAttributes);
    } else {
      restoreOldMechanicalAttributes(data);
    }

    // Pulihkan gambar.
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

    // Pulihkan Department sesuai Plant.
    if (plantSelect?.value) {
      updateDepartment(data.department || "");
    } else if (deptSelect) {
      updateDepartment();
    }

    updateReason();
    updateCategory();
    updateDimension();
    updatePackSize();
    updateAllMechanicalOthers();

    updateLegacyTechnicalFields(
      collectTechnicalAttributes()
    );
  }

  // =====================================================
  // VERSION & CREATED DATE
  // =====================================================

  function initializeDocumentInfo() {
    const versionInput = getVersionInput();
    const createdDateInput = getCreatedDateInput();

    if (versionInput) {
      const savedVersion = Number(
        localStorage.getItem(VERSION_STORAGE_KEY) || 0
      );

      versionInput.value = String(savedVersion).padStart(2, "0");
    }

    if (createdDateInput && !createdDateInput.value) {
      createdDateInput.value = todayISO();
    }
  }

  // =====================================================
  // AUTOSAVE
  // =====================================================

  function saveDraft() {
    if (loadingDocument) return;

    try {
      const data = getFormData();

      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(data)
      );

      setStatus("Draft tersimpan otomatis di browser");
    } catch (error) {
      console.error("Gagal menyimpan draft:", error);

      setStatus(
        "Draft gagal disimpan. Periksa ukuran gambar atau penyimpanan browser."
      );
    }
  }

  function restoreDraft() {
    try {
      const saved =
        localStorage.getItem(STORAGE_KEY) ||
        localStorage.getItem(OLD_STORAGE_KEY);

      if (!saved) return false;

      const data = safeJSONParse(saved, null);

      if (!data || typeof data !== "object") {
        return false;
      }

      loadingDocument = true;

      restoreForm(data);

      loadingDocument = false;

      // Simpan kembali dalam format terbaru setelah migrasi.
      saveDraft();

      setStatus("Draft sebelumnya berhasil dipulihkan");

      return true;
    } catch (error) {
      loadingDocument = false;

      console.error("Gagal memulihkan draft:", error);

      setStatus("Draft sebelumnya gagal dipulihkan");

      return false;
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

    reader.onerror = () => {
      alert("Gagal membaca gambar.");
    };

    reader.readAsDataURL(file);
  });

  // =====================================================
  // VALIDATION
  // =====================================================

  function validateForm() {
    updateReason();
    updateCategory();

    // Material Category wajib tepat satu.
    const categories = getSelectedCategories();

    if (categories.length !== 1) {
      alert("Material Category wajib dipilih tepat satu.");

      const firstCategory = $(
        '[name="materialCategory"]',
        questionnaire
      );

      firstCategory?.focus();

      return false;
    }

    // Validasi seluruh field required dari HTML.
    if (!questionnaire.reportValidity()) {
      return false;
    }

    // Reason Others wajib diisi jika dipilih.
    if (
      reasonChoice?.value === "Others" &&
      !reasonOther?.value.trim()
    ) {
      alert("Reason Others wajib diisi.");

      reasonOther?.focus();

      return false;
    }

    return true;
  }

  // =====================================================
  // LOCAL TRANSACTION
  // =====================================================

  function saveTransactionLocally() {
    try {
      const data = getFormData();

      const versionInput = getVersionInput();
      const createdDateInput = getCreatedDateInput();

      const currentVersion = Number(
        versionInput?.value || 0
      );

      const parsedHistory = safeJSONParse(
        localStorage.getItem(HISTORY_KEY),
        []
      );

      const history = Array.isArray(parsedHistory)
        ? parsedHistory
        : [];

      history.push({
        id: Date.now(),
        version: String(currentVersion).padStart(2, "0"),
        createdDate: createdDateInput?.value || todayISO(),
        submittedAt: new Date().toISOString(),
        formData: data
      });

      localStorage.setItem(
        HISTORY_KEY,
        JSON.stringify(history)
      );

      const nextVersion = currentVersion + 1;

      localStorage.setItem(
        VERSION_STORAGE_KEY,
        String(nextVersion)
      );

      if (versionInput) {
        versionInput.value = String(nextVersion).padStart(2, "0");
      }

      saveDraft();

      return true;
    } catch (error) {
      console.error("Gagal menyimpan transaksi:", error);

      alert(
        "Transaksi gagal disimpan di browser. Periksa kapasitas penyimpanan."
      );

      return false;
    }
  }

  // =====================================================
  // PRINT DATA TRANSFER
  // =====================================================

  function transferToPrint(data = getFormData()) {
    if (!printForm) {
      console.warn("Form PDF #printSpecForm tidak ditemukan.");
      return;
    }

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

    const categoryField = $(
      '[name="materialCategory"]',
      printForm
    );

    if (categoryField) {
      categoryField.value = (
        data.materialCategory || []
      ).join(", ");
    }

    const revisionDate = $(
      '[name="revisionDate"]',
      printForm
    );

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
  // BUTTON EVENTS — DIMENSION
  // =====================================================

  $("#addDimensionBtn")?.addEventListener("click", () => {
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
      $(".dimension-symbol", row).value = "x";
    }

    updateDimension();
    saveDraft();
  });

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

  // Cegah form melakukan reload saat submit biasa.
  questionnaire.addEventListener("submit", event => {
    event.preventDefault();
  });

  // =====================================================
  // RESET
  // =====================================================

  resetBtn?.addEventListener("click", () => {
    const confirmed = confirm(
      "Yakin ingin mengosongkan seluruh jawaban spesifikasi barang?"
    );

    if (!confirmed) return;

    questionnaire.reset();

    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(OLD_STORAGE_KEY);

    drawingImage = "";

    if (drawingUpload) {
      drawingUpload.value = "";
    }

    if (drawingPreview) {
      drawingPreview.removeAttribute("src");
      drawingPreview.style.display = "none";
    }

    technicalContainer?.replaceChildren();
    uniqueContainer?.replaceChildren();

    if (dimensionContainer) {
      dimensionContainer.replaceChildren();
      createDimensionRow();
    }

    updateDepartment();

    initializeDocumentInfo();

    normalizeMaterialCategory();
    updateReason();
    updateDimension();
    updatePackSize();
    updateAllMechanicalOthers();

    saveDraft();

    setStatus("Form berhasil direset");

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  });

  // =====================================================
  // SAVE FOR ADMIN
  // Saat ini transaksi disimpan di browser lokal.
  // =====================================================

  saveBtn?.addEventListener("click", () => {
    if (saving) return;

    if (!validateForm()) return;

    saving = true;
    saveBtn.disabled = true;

    try {
      initializeDocumentInfo();

      if (!saveTransactionLocally()) {
        return;
      }

      alert(
        "Transaksi berhasil disimpan di browser!\n" +
        "Version berikutnya: " +
        (getVersionInput()?.value || "00")
      );
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
        `${API_BASE_URL}/api/documents/${encodeURIComponent(id)}`
      );

      let result;

      try {
        result = await response.json();
      } catch {
        throw new Error("Respons server bukan JSON yang valid.");
      }

      if (!response.ok) {
        throw new Error(
          result.message ||
          result.error ||
          "Dokumen tidak ditemukan."
        );
      }

      const row = result.document || result;

      let formData =
        row.form_data ||
        row.formData ||
        {};

      if (typeof formData === "string") {
        formData = safeJSONParse(formData, {});
      }

      if (!formData || typeof formData !== "object") {
        formData = {};
      }

      const data = {
        ...formData,

        id: row.id,

        docNo:
          row.doc_no ??
          row.docNo ??
          formData.docNo ??
          "",

        revision:
          row.revision ??
          formData.revision ??
          "",

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
          row.material_description ??
          formData.materialDescription ??
          "",

        materialCode:
          row.material_code ??
          formData.materialCode ??
          "",

        specType:
          row.spec_type ||
          formData.specType ||
          "Barang"
      };

      restoreForm(data);

      transferToPrint(data);

      loadingDocument = false;

      setStatus("Dokumen berhasil dimuat dari database");

      window.setTimeout(() => {
        window.print();
      }, 500);

    } catch (error) {
      loadingDocument = false;

      console.error("Gagal mengambil dokumen:", error);

      setStatus("Gagal memuat dokumen dari database");

      alert(error.message);
    }
  }

  // =====================================================
  // INITIALIZATION
  // =====================================================

  function initialize() {
    const params = new URLSearchParams(
      window.location.search
    );

    const printId = params.get("printId");

    // Isi dropdown Mechanical dari UoM utama.
    initializeMechanicalUomOptions();

    if (printId) {
      loadDocumentFromDatabase(printId);
      return;
    }

    updateDepartment();

    initializeDocumentInfo();

    const restored = restoreDraft();

    if (
      !restored &&
      dimensionContainer &&
      !$(".dimension-row", dimensionContainer)
    ) {
      createDimensionRow();
    }

    normalizeMaterialCategory();
    updateReason();
    updateCategory();
    updateDimension();
    updatePackSize();
    updateAllMechanicalOthers();

    saveDraft();
  }

  // =====================================================
  // PDF BUTTON
  // =====================================================

  pdfBtn?.addEventListener("click", () => {
    if (!validateForm()) return;

    initializeDocumentInfo();

    const data = getFormData();

    saveDraft();

    transferToPrint(data);

    window.print();
  });

  // =====================================================
  // START APPLICATION
  // =====================================================

  initialize();

})();
