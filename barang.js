
(() => {
  "use strict";

  // =====================================================
  // E-SPEC BARANG
  // =====================================================

  const API_URL = "http://localhost:3000/api/documents";
  const STORAGE_KEY = "eSpecBarangQuestionnaire.v2";
  const OLD_STORAGE_KEY = "eSpecBarangQuestionnaire.v1";
  const VERSION_STORAGE_KEY = "eSpecBarangVersion.v1";
  const HISTORY_KEY = "eSpecBarangTransactions.v1";

  const questionnaire = document.getElementById("questionnaireForm");
  const printForm = document.getElementById("printSpecForm");

  if (!questionnaire || !printForm) {
    console.error("Form kuesioner atau template PDF Barang tidak ditemukan.");
    return;
  }

  const $ = (selector, parent = document) =>
    parent.querySelector(selector);

  const $$ = (selector, parent = document) =>
    [...parent.querySelectorAll(selector)];

  const pdfBtn = $("#pdfBtn");
  const resetBtn = $("#resetBtn");
  const saveBtn = $("#saveAdminBtn");
  const draftStatus = $("#draftStatus");

  const drawingUpload = $("#questionDrawingUpload");
  const drawingPreview = $("#drawingPreview");

  const DIMENSION_OPTIONS = [
    "L",
    "W",
    "H",
    "T",
    "ID",
    "OD",
    "DN",
    "Phase"
  ];

  let drawingImage = "";
  let loadingDocument = false;
  let saving = false;

  // =====================================================
  // UTILITAS
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

  function escapeSelector(value) {
    if (window.CSS && CSS.escape) {
      return CSS.escape(String(value));
    }

    return String(value).replace(/["\\]/g, "\\$&");
  }

  // =====================================================
  // VERSION & CREATED DATE
  // =====================================================

  function initializeDocumentInfo() {
    const versionInput = $('[name="version"]', questionnaire);
    const createdDateInput = $('[name="createdDate"]', questionnaire);

    if (!versionInput || !createdDateInput) return;

    const savedVersion = localStorage.getItem(VERSION_STORAGE_KEY);

    const currentVersion = savedVersion === null
      ? 0
      : Number(savedVersion);

    versionInput.value = String(currentVersion).padStart(2, "0");

    if (!createdDateInput.value) {
      createdDateInput.value = todayISO();
    }
  }

  function saveTransactionLocally() {
    try {
      const formData = getFormData();

      const versionInput = $('[name="version"]', questionnaire);
      const createdDateInput = $('[name="createdDate"]', questionnaire);

      const currentVersion = Number(versionInput?.value || 0);

      const history = JSON.parse(
        localStorage.getItem(HISTORY_KEY) || "[]"
      );

      const transaction = {
        id: Date.now(),
        version: String(currentVersion).padStart(2, "0"),
        createdDate: createdDateInput?.value || todayISO(),
        submittedAt: new Date().toISOString(),
        formData
      };

      history.push(transaction);

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
  // REASON TO PROCURE
  // =====================================================

  function updateReason() {
    const choice = $("#reasonChoice", questionnaire);
    const other = $('[name="reasonOther"]', questionnaire);
    const finalField = $("#reasonFinal", questionnaire);
    const otherContainer = $("#reasonOthersBarang");

    if (!choice || !finalField) return;

    const isOthers = choice.value === "Others";

    if (otherContainer) {
      otherContainer.hidden = !isOthers;
    }

    if (other) {
      other.disabled = !isOthers;
    }

    finalField.value = isOthers
      ? other?.value.trim() || ""
      : choice.value;
  }

  // =====================================================
  // DIMENSION
  // =====================================================

  function createDimensionRow(item = {}) {
    const container = $("#dimensionRows");

    if (!container) return;

    const row = document.createElement("div");
    row.className = "dimension-row";

    row.innerHTML = `
      <select class="dimension-type">
        <option value="">-- Pilih Dimension --</option>

        ${DIMENSION_OPTIONS.map(option => `
          <option value="${option}">${option}</option>
        `).join("")}
      </select>

      <input
        type="text"
        class="dimension-value"
        placeholder="Masukkan nilai"
      >

      <select class="dimension-symbol">
        <option value="x">x</option>
        <option value="~">~</option>
        <option value="/">/</option>
        <option value="±">±</option>
        <option value="-">-</option>
      </select>

      <button
        type="button"
        class="remove-dimension"
        title="Hapus"
      >&times;</button>
    `;

    $(".dimension-type", row).value = item.type || "";
    $(".dimension-value", row).value = item.value || "";
    $(".dimension-symbol", row).value = item.symbol || "x";

    container.appendChild(row);
  }

  function collectDimensionItems() {
    const container = $("#dimensionRows");

    if (!container) return [];

    return $$(".dimension-row", container)
      .map(row => ({
        type: $(".dimension-type", row)?.value || "",
        value: $(".dimension-value", row)?.value.trim() || "",
        symbol: $(".dimension-symbol", row)?.value || "x"
      }))
      .filter(item => item.type && item.value !== "");
  }

  function updateDimension() {
    const items = collectDimensionItems();
    const finalField = $("#dimensionFinal");

    if (!finalField) return;

    finalField.value = items.map((item, index) => {
      const dimension = `${item.type} ${item.value}`;

      return index === 0
        ? dimension
        : `${item.symbol} ${dimension}`;
    }).join(" ");
  }

  const dimensionRowsContainer = $("#dimensionRows");
  const addDimensionBtn = $("#addDimensionBtn");

  addDimensionBtn?.addEventListener("click", () => {
    createDimensionRow();

    updateDimension();
    saveDraft();
  });

  dimensionRowsContainer?.addEventListener("click", event => {
    const removeButton = event.target.closest(".remove-dimension");

    if (!removeButton) return;

    const rows = $$(".dimension-row", dimensionRowsContainer);
    const currentRow = removeButton.closest(".dimension-row");

    if (rows.length > 1) {
      currentRow.remove();
    } else {
      $(".dimension-type", currentRow).value = "";
      $(".dimension-value", currentRow).value = "";
      $(".dimension-symbol", currentRow).value = "x";
    }

    updateDimension();
    saveDraft();
  });

  dimensionRowsContainer?.addEventListener("input", updateDimension);
  dimensionRowsContainer?.addEventListener("change", updateDimension);

  // =====================================================
  // PACK SIZE
  // =====================================================

  function updatePackSize() {
    const quantity = $("#packQuantity", questionnaire)?.value || "";
    const uom = $("#packUom", questionnaire)?.value || "";
    const packageUom = $("#packageUom", questionnaire)?.value || "";

    const finalField = $("#packSizeFinal", questionnaire);

    if (finalField) {
      finalField.value = [
        quantity,
        uom,
        packageUom
      ].filter(Boolean).join(" ");
    }
  }

  // =====================================================
  // TECHNICAL SPECIFICATION
  // =====================================================

  function collectTechnicalAttributes() {
    const attributes = [];

    $$("[data-tech-label]", questionnaire).forEach(input => {
      const label = input.dataset.techLabel;
      const value = input.value.trim();

      if (!label || !value) return;

      const unitInput = $$("[data-tech-unit]", questionnaire)
        .find(item => item.dataset.techUnit === label);

      const unit = unitInput?.value.trim() || "";

      attributes.push({
        category: getTechnicalCategory(input),
        label,
        value,
        unit
      });
    });

    $$(".custom-tech-row", questionnaire).forEach(row => {
      const label = $("[data-custom-tech-name]", row)?.value.trim() || "";
      const value = $("[data-custom-tech-value]", row)?.value.trim() || "";
      const unit = $("[data-custom-tech-unit]", row)?.value.trim() || "";

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

  function getTechnicalCategory(input) {
    const group = input.closest(".q-technical-group");
    const heading = $("h4", group)?.textContent.toLowerCase() || "";

    if (heading.includes("electric")) return "Electric";
    if (heading.includes("mechanical")) return "Mechanical";
    if (heading.includes("liquid")) return "Liquid";

    return "Other";
  }

  function updateLegacyTechnicalFields(attributes) {
    for (let i = 1; i <= 5; i++) {
      const item = attributes[i - 1];

      const labelField = $(`#technical${i}`, questionnaire);
      const valueField = $(`#technicalUnit${i}`, questionnaire);

      if (labelField) {
        labelField.value = item ? item.label : "";
      }

      if (valueField) {
        valueField.value = item
          ? `${item.value} ${item.unit || ""}`.trim()
          : "";
      }
    }
  }

  // =====================================================
  // UNIQUE SPECIFICATION
  // =====================================================

  function collectUniqueAttributes() {
    const attributes = [];

    const name1 = $('[name="unique1"]', questionnaire)?.value.trim() || "";
    const detail1 = $('[name="uniqueDetail1"]', questionnaire)?.value.trim() || "";

    const name2 = $('[name="unique2"]', questionnaire)?.value.trim() || "";
    const detail2 = $('[name="uniqueDetail2"]', questionnaire)?.value.trim() || "";

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
      const name = $('input[name^="customUniqueName"]', row)?.value.trim() || "";
      const detail = $('input[name^="customUniqueDetail"]', row)?.value.trim() || "";

      if (name || detail) {
        attributes.push({ name, detail });
      }
    });

    return attributes;
  }

  // =====================================================
  // SERIALISASI DATA FORM
  // =====================================================

  function getFormData() {
    updateReason();
    updateDimension();
    updatePackSize();

    const technicalAttributes = collectTechnicalAttributes();

    updateLegacyTechnicalFields(technicalAttributes);

    const uniqueAttributes = collectUniqueAttributes();

    const data = {};
    const fieldsByName = new Map();

    $$("[name]", questionnaire).forEach(field => {
      if (field.type === "file") return;

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

    data.technicalAttributes = technicalAttributes;
    data.uniqueAttributes = uniqueAttributes;
    data.dimensionItems = collectDimensionItems();
    data.drawingImage = drawingImage;
    data.specType = "Barang";

    return data;
  }

  // =====================================================
  // RESTORE FIELD
  // =====================================================

  function setFieldValue(name, value) {
    const fields = $$(`[name="${escapeSelector(name)}"]`, questionnaire);

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
  // CUSTOM TECHNICAL ATTRIBUTE
  // =====================================================

  function createCustomTechnicalRow(item = {}) {
    const container = $("#dynamicCustomTechnicalContainer");

    if (!container) return;

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

    $(".q-remove-button", row).addEventListener("click", () => {
      row.remove();
      saveDraft();
    });

    container.appendChild(row);
  }

  // =====================================================
  // CUSTOM UNIQUE ATTRIBUTE
  // =====================================================

  function createCustomUniqueRow(item = {}) {
    const container = $("#dynamicCustomUniqueContainer");

    if (!container) return;

    const index = container.querySelectorAll(".custom-unique-row").length + 1;

    const row = document.createElement("div");
    row.className = "q-grid custom-unique-row";

    row.innerHTML = `
      <label class="q-field">
        Nama Unique Attribute
        <input type="text" name="customUniqueName${index}">
      </label>

      <label class="q-field">
        Detail Unique Attribute
        <input type="text" name="customUniqueDetail${index}">
      </label>

      <button type="button" class="q-remove-button">
        Hapus
      </button>
    `;

    $(`[name="customUniqueName${index}"]`, row).value = item.name || "";
    $(`[name="customUniqueDetail${index}"]`, row).value = item.detail || "";

    $(".q-remove-button", row).addEventListener("click", () => {
      row.remove();
      saveDraft();
    });

    container.appendChild(row);
  }

  function restoreDynamicAttributes(data) {
    const technicalContainer = $("#dynamicCustomTechnicalContainer");
    const uniqueContainer = $("#dynamicCustomUniqueContainer");

    if (technicalContainer) {
      technicalContainer.innerHTML = "";
    }

    if (uniqueContainer) {
      uniqueContainer.innerHTML = "";
    }

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

    restoreDynamicAttributes(data);

    const dimensionContainer = $("#dimensionRows");

    if (dimensionContainer) {
      dimensionContainer.innerHTML = "";

      if (Array.isArray(data.dimensionItems) && data.dimensionItems.length) {
        data.dimensionItems.forEach(createDimensionRow);
      } else if (data.dimension) {
        // Kompatibilitas dengan draft lama
        createDimensionRow();
      } else {
        createDimensionRow();
      }
    }

    Object.entries(data).forEach(([name, value]) => {
      if (
        name === "technicalAttributes" ||
        name === "uniqueAttributes" ||
        name === "dimensionItems" ||
        name === "drawingImage" ||
        name === "specType"
      ) {
        return;
      }

      setFieldValue(name, value);
    });

    drawingImage = data.drawingImage || "";

    if (drawingImage && drawingPreview) {
      drawingPreview.src = drawingImage;
      drawingPreview.style.display = "block";
    } else if (drawingPreview) {
      drawingPreview.removeAttribute("src");
      drawingPreview.style.display = "none";
    }

    updateReason();
    updateDimension();
    updatePackSize();

    const plantSelect = $("#plantCodeSelect", questionnaire);

    if (plantSelect?.value) {
      plantSelect.dispatchEvent(new Event("change", { bubbles: true }));

      const department = $('[name="department"]', questionnaire);

      if (department && data.department) {
        department.value = data.department;
      }
    }
  }

  // =====================================================
  // AUTOSAVE DRAFT
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
      let saved = localStorage.getItem(STORAGE_KEY);

      if (!saved) {
        saved = localStorage.getItem(OLD_STORAGE_KEY);
      }

      if (!saved) return false;

      const data = JSON.parse(saved);

      loadingDocument = true;
      restoreForm(data);
      loadingDocument = false;

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

    const maxSize = 5 * 1024 * 1024;

    if (file.size > maxSize) {
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
  // TRANSFER DATA KE TEMPLATE PDF
  // =====================================================

  function transferToPrint(data = getFormData()) {
    printForm.querySelectorAll("[name]").forEach(target => {
      const value = data[target.name];

      if (target.type === "checkbox") {
        if (Array.isArray(value)) {
          target.checked = value.includes(target.value);
        } else {
          target.checked = Boolean(value);
        }

        return;
      }

      if (target.type === "radio") {
        target.checked = target.value === value;
        return;
      }

      target.value = value ?? "";
    });

    const category = data.materialCategory || "";

    const categoryField = $('[name="materialCategory"]', printForm);

    if (categoryField && !categoryField.value) {
      categoryField.value = category;
    }

    const revisionDate = $('[name="revisionDate"]', printForm);

    if (revisionDate && !revisionDate.value) {
      revisionDate.value = formatDate(data.createdDate);
    }

    if (drawingPreview) {
      if (data.drawingImage) {
        drawingPreview.src = data.drawingImage;
        drawingPreview.style.display = "block";
      } else {
        drawingPreview.removeAttribute("src");
        drawingPreview.style.display = "none";
      }
    }
  }

  // =====================================================
  // VALIDASI
  // =====================================================

  function validateForm() {
    if (!questionnaire.reportValidity()) {
      return false;
    }

    const catalogue = $('[name="catalogue"]', questionnaire);

    if (catalogue && !catalogue.value.trim()) {
      catalogue.focus();

      alert("Catalogue wajib diisi sesuai rancangan form.");

      return false;
    }

    return true;
  }

  // =====================================================
  // CETAK PDF
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
  // SIMPAN TRANSAKSI LOKAL
  // =====================================================

  if (saveBtn) {
    saveBtn.addEventListener("click", () => {
      if (saving) return;

      if (!validateForm()) return;

      saving = true;
      saveBtn.disabled = true;

      try {
        initializeDocumentInfo();

        const success = saveTransactionLocally();

        if (!success) return;

        alert(
          "Transaksi berhasil disimpan!\n" +
          "Version berikutnya: " +
          ($('[name="version"]', questionnaire)?.value || "00")
        );

      } finally {
        saving = false;
        saveBtn.disabled = false;
      }
    });
  }

  // =====================================================
  // RESET FORM
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

    $("#dynamicCustomTechnicalContainer")?.replaceChildren();
    $("#dynamicCustomUniqueContainer")?.replaceChildren();

    if (dimensionRowsContainer) {
      dimensionRowsContainer.innerHTML = "";
      createDimensionRow();
    }

    initializeDocumentInfo();

    updateReason();
    updateDimension();
    updatePackSize();

    saveDraft();

    setStatus("Form berhasil direset");

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  });

  // =====================================================
  // AMBIL DOKUMEN DARI DATABASE
  // barang.html?printId=ID
  // =====================================================

  async function loadDocumentFromDatabase(id) {
    try {
      loadingDocument = true;

      setStatus("Mengambil dokumen dari database...");

      const response = await fetch(
        `${API_URL}/${encodeURIComponent(id)}`
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.message ||
          result.error ||
          "Dokumen tidak ditemukan."
        );
      }

      const row = result.document || result;

      let formData = row.form_data || row.formData || {};

      if (typeof formData === "string") {
        try {
          formData = JSON.parse(formData);
        } catch {
          formData = {};
        }
      }

      const data = {
        ...formData,

        id: row.id,

        docNo: row.doc_no ?? row.docNo ?? "",
        revision: row.revision ?? "",

        plant: row.plant ?? formData.plant ?? "",
        requestor: row.requestor ?? formData.requestor ?? "",
        department: row.department ?? formData.department ?? "",

        materialDescription:
          row.material_description ??
          formData.materialDescription ??
          "",

        materialCode:
          row.material_code ??
          formData.materialCode ??
          "",

        specType: row.spec_type || "Barang"
      };

      restoreForm(data);

      transferToPrint(data);

      loadingDocument = false;

      setStatus("Dokumen berhasil dimuat dari database");

      setTimeout(() => {
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
  // INISIALISASI
  // =====================================================

  function initialize() {
    const params = new URLSearchParams(window.location.search);
    const printId = params.get("printId");

    if (printId) {
      loadDocumentFromDatabase(printId);
      return;
    }

    const restored = restoreDraft();

    initializeDocumentInfo();

    if (!restored) {
      updateReason();
      updateDimension();
      updatePackSize();

      if (dimensionRowsContainer &&
          !dimensionRowsContainer.querySelector(".dimension-row")) {
        createDimensionRow();
      }
    }

    saveDraft();

    questionnaire.addEventListener("input", () => {
      updateReason();
      updateDimension();
      updatePackSize();
      saveDraft();
    });

    questionnaire.addEventListener("change", () => {
      updateReason();
      updateDimension();
      updatePackSize();
      saveDraft();
    });

    $("#addTechnicalBtn")?.addEventListener("click", () => {
      setTimeout(saveDraft, 0);
    });

    $("#addUniqueBtn")?.addEventListener("click", () => {
      setTimeout(saveDraft, 0);
    });
  }

  initialize();

})();
