
(() => {
  "use strict";

  // =====================================================
  // E-SPEC JASA — QUESTIONNAIRE CONTROLLER
  // =====================================================

  const API_BASE_URL =
    window.ESPEC_CONFIG?.API_BASE_URL ||
    "http://localhost:3000/api";
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

  const questionnaire = document.getElementById("questionnaireJasaForm");
  const printForm = document.getElementById("printJasaForm");

  const resetBtn = document.getElementById("resetJasaBtn");
  const saveBtn = document.getElementById("saveJasaAdminBtn");
  const submitBtn = document.getElementById("submitJasaBtn");
  const draftStatus = document.getElementById("draftStatus");

  if (!questionnaire || !printForm) {
    console.error("Form kuesioner atau template cetak Jasa tidak ditemukan.");
    return;
  }

  // =====================================================
  // DATA DEPARTMENT — SAMA DENGAN BARANG
  // =====================================================

  const plantSelect = questionnaire.querySelector('[name="plant"]');
  const deptSelect = questionnaire.querySelector('[name="department"]');
  const reasonChoice = questionnaire.querySelector('[name="reasonChoice"]');
  const materialGroupSelect = questionnaire.querySelector('[name="materialGroup"]');
  let plants = [];
  let departmentRequestId = 0;
  let jasaSpecificationTypeId = null;
  let persistedDraftId = null;
  let persistedDocumentNo = null;
  let loadingDocument = false;
  let hasUnsavedChanges = false;
  let legacyPendingClear = false;
  let submitting = false;
  let jasaMaterialCategoryId = null;
  let jasaMaterialGroups = [];

  // =====================================================
  // UTILITAS
  // =====================================================

  function $(selector, parent = document) {
    return parent.querySelector(selector);
  }

  function setDraftStatus(message, warning = false) {
    if (!draftStatus) return;

    draftStatus.textContent = message;
    draftStatus.classList.toggle("warning", Boolean(warning));
  }

  function confirmDiscardChanges() {
    return !hasUnsavedChanges || confirm(
      "Perubahan belum disimpan ke server akan hilang. Lanjutkan?"
    );
  }

  function parseDetailFormData(detail) {
    let formData = detail?.formData || detail?.form_data || {};

    if (typeof formData === "string") {
      try {
        formData = JSON.parse(formData);
      } catch {
        formData = {};
      }
    }

    if (!formData || typeof formData !== "object" || Array.isArray(formData)) {
      formData = {};
    }

    return {
      ...formData,
      persistedDocumentNo: detail?.documentNo || formData.persistedDocumentNo || ""
    };
  }

  function normalizeServerFormData(detail) {
    const data = parseDetailFormData(detail);
    const group = jasaMaterialGroups.find((item) =>
      String(item.id) === String(data.materialGroup)
    );

    if (data.materialCategoryLabel) {
      data.materialCategory = data.materialCategoryLabel;
    } else if (
      jasaMaterialCategoryId !== null &&
      String(data.materialCategory) === String(jasaMaterialCategoryId)
    ) {
      data.materialCategory = "Expense Jasa";
    }

    if (data.materialGroupCode) {
      data.materialGroup = data.materialGroupCode;
    } else if (group?.sapgroupcode) {
      data.materialGroup = group.sapgroupcode;
    }

    if (data.reasonToProcure) {
      data.reasonChoice = data.reasonToProcure;
    }

    return data;
  }

  function getToday() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  function normalizeName(name) {
    return name.replace(/\[\]$/, "");
  }

  function getFieldValue(data, name) {
    if (Object.prototype.hasOwnProperty.call(data, name)) {
      return data[name];
    }

    const normalized = normalizeName(name);

    if (Object.prototype.hasOwnProperty.call(data, normalized)) {
      return data[normalized];
    }

    return "";
  }

    // =====================================================
  // DYNAMIC OTHERS / LAINNYA UNTUK SEMUA DROPDOWN
  // =====================================================

  function isOthersOption(option) {
    const value = (option.value || "").trim().toLowerCase();
    const text = (option.textContent || "").trim().toLowerCase();

    return (
      value === "others" ||
      value === "lainnya" ||
      text === "others" ||
      text === "lainnya"
    );
  }

  function setupOthersField(select) {
    if (!select || select.tagName !== "SELECT") return;

    let wrapper = select.nextElementSibling;

    if (
      !wrapper ||
      !wrapper.classList.contains("others-input-wrapper")
    ) {
      wrapper = document.createElement("div");
      wrapper.className = "others-input-wrapper";

      const label = document.createElement("label");
      label.textContent = "Isi keterangan lainnya";

      const input = document.createElement("input");
      input.type = "text";
      input.name = `other_${select.name}`;
      input.placeholder = "Masukkan keterangan lainnya...";

      label.appendChild(input);
      wrapper.appendChild(label);

      select.insertAdjacentElement("afterend", wrapper);
    }

    const input = wrapper.querySelector("input");

    if (!input.name) {
      input.name = `other_${select.name}`;
    }

    const selectedOption = select.options[select.selectedIndex];
    const show = selectedOption && isOthersOption(selectedOption);

    wrapper.style.display = show ? "block" : "none";
    input.required = Boolean(show);

    if (!show) {
      input.required = false;
    }
  }

  // Inisialisasi semua dropdown yang sudah memiliki Others/Lainnya.
  questionnaire.querySelectorAll("select").forEach((select) => {
    setupOthersField(select);
  });

  // Pantau perubahan seluruh dropdown, termasuk dropdown dinamis.
  questionnaire.addEventListener("change", (event) => {
    if (event.target.matches("select")) {
      setupOthersField(event.target);

      saveDraft();
      transferToPrint();
    }
  });

  // =====================================================
  // VERSION DAN CREATED DATE
  // =====================================================

  function initializeDocumentInfo() {
    const versionField = questionnaire.querySelector('[name="version"]');
    const createdDateField = questionnaire.querySelector('[name="createdDate"]');

    if (versionField && !versionField.value) {
      versionField.value = "00";
    }

    if (versionField) {
      versionField.readOnly = true;
    }

    if (createdDateField && !createdDateField.value) {
      createdDateField.value = getToday();
    }

    if (createdDateField) {
      createdDateField.readOnly = true;
    }
  }

  // =====================================================
  // DROPDOWN DEPARTMENT BERDASARKAN PLANT
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

  function setSelectedOption(select, value) {
    if (!value) return;

    const option = [...select.options].find((item) =>
      item.value === String(value) || item.textContent === String(value)
    );

    if (option) {
      select.value = option.value;
      return;
    }

    const legacyOption = document.createElement("option");
    legacyOption.value = String(value);
    legacyOption.textContent = String(value);
    legacyOption.dataset.legacy = "true";
    select.appendChild(legacyOption);
    select.value = legacyOption.value;
  }

  async function populateDepartments(selectedDepartment = "") {
    if (!plantSelect || !deptSelect) return;

    const plant = findPlant(plantSelect.value);
    const requestId = ++departmentRequestId;

    if (!plant) {
      setSelectMessage(deptSelect, "Pilih Plant terlebih dahulu");
      return;
    }

    setSelectMessage(deptSelect, "Memuat Departemen...");
    deptSelect.disabled = true;

    try {
      const departments = await fetchMasterData(`/plants/${plant.id}/departments`);

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

      setSelectedOption(deptSelect, selectedDepartment);
    } catch (error) {
      if (requestId !== departmentRequestId) return;

      console.error("Gagal memuat department:", error);
      setSelectMessage(deptSelect, "Gagal memuat Departemen");
      setDraftStatus("Gagal memuat Departemen dari server");
    } finally {
      if (requestId === departmentRequestId) {
        deptSelect.disabled = false;
      }
    }
  }

  if (plantSelect && deptSelect) {
    plantSelect.addEventListener("change", () => {
      populateDepartments();

      saveDraft();
      transferToPrint();
    });
  }

  async function loadMasterData() {
    try {
      const [types, plantRows, categoryRows, groupRows] = await Promise.all([
        fetchMasterData("/specification-types"),
        fetchMasterData("/plants"),
        fetchMasterData("/material-categories"),
        fetchMasterData("/material-groups")
      ]);

      const jasaType = types.find((type) =>
        String(type.typename).toLowerCase() === "jasa" ||
        String(type.typecode).toLowerCase() === "jasa"
      );

      if (!jasaType) {
        throw new Error("Tipe spesifikasi Jasa tidak ditemukan.");
      }

      jasaSpecificationTypeId = jasaType.id;
      plants = plantRows;
      jasaMaterialCategoryId = categoryRows.find((category) =>
        Number(category.specificationtypeid) === Number(jasaSpecificationTypeId) &&
        category.categoryname === "OPEX - JASA"
      )?.id || null;
      jasaMaterialGroups = groupRows.filter((group) =>
        String(group.categoryname).toUpperCase() === "OPEX - JASA"
      );

      const savedPlant = plantSelect?.value || "";
      const savedDepartment = deptSelect?.value || "";
      const savedReason = reasonChoice?.value || "";
      const savedMaterialGroup = materialGroupSelect?.value || "";

      if (materialGroupSelect) {
        const availableGroups = new Set(
          jasaMaterialGroups.map((group) => group.sapgroupcode)
        );

        [...materialGroupSelect.options].forEach((option) => {
          if (!option.value) return;

          option.disabled = !availableGroups.has(option.value);
          option.textContent = option.disabled
            ? `${option.value} (belum tersedia)`
            : option.value;
        });

        if (savedMaterialGroup) {
          const savedOption = [...materialGroupSelect.options].find(
            (option) => option.value === savedMaterialGroup
          );

          if (savedOption) {
            savedOption.disabled = !availableGroups.has(savedMaterialGroup);
            materialGroupSelect.value = savedMaterialGroup;
          }
        }
      }

      if (plantSelect) {
        setSelectMessage(plantSelect, "Pilih Plant");

        plants.forEach((plant) => {
          const option = document.createElement("option");
          option.value = String(plant.id);
          option.textContent = `${plant.plantid} - ${plant.plantname}`;
          plantSelect.appendChild(option);
        });

        setSelectedOption(plantSelect, savedPlant);
      }

      if (reasonChoice) {
        setSelectMessage(reasonChoice, "Pilih alasan pengadaan");

        const reasons = await fetchMasterData(
          `/reason-to-procure/specification-types/${jasaType.id}`
        );

        reasons.forEach((reason) => {
          const option = document.createElement("option");
          option.value = String(reason.id);
          option.textContent = reason.optionname;
          reasonChoice.appendChild(option);
        });

        const matchingReason = reasons.find((reason) =>
          String(reason.id) === String(savedReason) ||
          reason.optionname === savedReason
        );

        setSelectedOption(reasonChoice, matchingReason?.id || savedReason);
      }

      await populateDepartments(savedDepartment);
    } catch (error) {
      console.error("Gagal memuat master data Jasa:", error);
      setDraftStatus("Gagal memuat master data dari server. Coba muat ulang halaman.");
    }
  }

  // =====================================================
  // AMBIL DATA FORM
  // =====================================================

  function getFormData() {
    const data = {};
    const formData = new FormData(questionnaire);

    for (const [key, value] of formData.entries()) {
      // File tidak dapat disimpan melalui JSON.
      if (value instanceof File) continue;

      if (Object.prototype.hasOwnProperty.call(data, key)) {
        if (!Array.isArray(data[key])) {
          data[key] = [data[key]];
        }

        data[key].push(value);
      } else {
        data[key] = value;
      }
    }

    // Simpan nama file lampiran berdasarkan nama field.
    const fileNames = {};

    questionnaire.querySelectorAll('input[type="file"]').forEach((field) => {
      if (field.files && field.files.length > 0) {
        if (!fileNames[field.name]) {
          fileNames[field.name] = [];
        }

        fileNames[field.name].push(
          ...Array.from(field.files).map((file) => file.name)
        );
      }
    });

    data._attachmentFileNames = fileNames;
    data.attachmentDocuments = getScopeDocumentData(
      attachmentDocumentList,
      "attachmentDocumentType[]",
      "other_attachmentDocumentType[]",
      "attachmentDocumentFile[]"
    );
    data.requiredDocuments = getScopeDocumentData(
      requiredDocumentList,
      "requiredDocumentType[]",
      "other_requiredDocumentType[]"
    );

    return data;
  }

  function getScopeDocumentData(container, typeName, otherName, fileName) {
    return getScopeRows(container).map((row) => {
      const type = row.querySelector(`[name="${CSS.escape(typeName)}"]`);
      const other = row.querySelector(`[name="${CSS.escape(otherName)}"]`);
      const file = fileName
        ? row.querySelector(`[name="${CSS.escape(fileName)}"]`)
        : null;

      return {
        type: type?.value || "",
        other: other?.value || "",
        fileName: file?.files?.[0]?.name || ""
      };
    }).filter((item) => item.type || item.other || item.fileName);
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
    add("REASON_TO_PROCURE", formData.reasonChoice);
    add("PROJECT_NAME", formData.projectName);
    add("PROJECT_DESCRIPTION", formData.projectDescription);
    add("TIMELINE", formData.timeline);

    if (formData.attachmentDocuments?.length) {
      add("ATTACHMENT_DOCUMENTS", formData.attachmentDocuments);
    }

    if (formData.requiredDocuments?.length) {
      add("REQUIRED_DOCUMENTS", formData.requiredDocuments);
    }

    return values;
  }

  function getDraftDocumentNumber(formData) {
    return String(persistedDocumentNo || formData.persistedDocumentNo || "").trim() ||
      `${formData.docNo || "F/SJ-001"}-${Date.now()}`;
  }

  async function saveDraftToServer() {
    if (!jasaSpecificationTypeId) {
      throw new Error("Tipe spesifikasi Jasa belum tersedia.");
    }

    const userId = String(window.ESpecDevAuth?.getProfile()?.userId || "").trim();

    if (!userId) {
      throw new Error("Identitas development tidak tersedia untuk menyimpan Draft.");
    }

    const formData = getFormData();
    const documentNo = getDraftDocumentNumber(formData);
    persistedDocumentNo = documentNo;
    formData.persistedDocumentNo = documentNo;
    const selectedCategory = Array.isArray(formData.materialCategory)
      ? formData.materialCategory[0]
      : formData.materialCategory;
    const materialGroupId = jasaMaterialGroups.find((group) =>
      group.sapgroupcode === formData.materialGroup
    )?.id;

    if (selectedCategory !== "Expense Jasa" || !jasaMaterialCategoryId) {
      throw new Error(
        "Asset Jasa belum memiliki master-data category yang didukung. Pilih Expense Jasa atau lengkapi master data terlebih dahulu."
      );
    }

    if (!materialGroupId) {
      throw new Error(
        "Material Group Jasa tidak memiliki mapping master data yang valid."
      );
    }

    const payloadFormData = {
      ...formData,
      materialCategory: jasaMaterialCategoryId,
      materialCategoryLabel: selectedCategory,
      materialGroup: materialGroupId,
      materialGroupCode: formData.materialGroup,
      reasonToProcure: formData.reasonChoice,
    };
    const isUpdate = Boolean(persistedDraftId);

    setDraftStatus(
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
          ...(isUpdate ? {} : { specificationTypeId: jasaSpecificationTypeId }),
          documentNo,
          formData: payloadFormData,
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
        setDraftStatus(
          "Server menolak pembaruan karena Draft bukan milik identitas ini. Pilih Draft yang dimiliki atau buat Draft baru.",
          true
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

    if (legacyPendingClear) {
      window.ESpecDraftWorkspace?.clearLegacy?.("jasa");
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

  // =====================================================
  // AUTO SAVE DRAFT
  // =====================================================

  function saveDraft() {
    if (loadingDocument) return;

    hasUnsavedChanges = true;
    setDraftStatus("Perubahan belum disimpan");
  }

  function applyFormDataToQuestionnaire(data) {
    loadingDocument = true;

    try {
      if (plantSelect && data.plant !== undefined) {
        plantSelect.value = data.plant;
      }

      Object.entries(data).forEach(([name, value]) => {
        if (name === "_attachmentFileNames") return;

        const fields = questionnaire.querySelectorAll(
          `[name="${CSS.escape(name)}"]`
        );

        fields.forEach((field) => {
          if (field.type === "file") return;

          if (field.type === "checkbox" || field.type === "radio") {
            field.checked = Array.isArray(value)
              ? value.includes(field.value)
              : value === field.value;

          } else if (field.name === "department") {
            return;

          } else if (field.name.endsWith("[]")) {
            const values = Array.isArray(value) ? value : [value];
            field.value = values[0] ?? "";

          } else {
            field.value = Array.isArray(value)
              ? value.join("\n")
              : value ?? "";
          }
        });
      });

      restoreDynamicQuestions(data);
      restoreScopeDocumentRows(data);
      enforceSingleMaterialCategory();
      initializeDocumentInfo();
      transferToPrint();

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

    const data = normalizeServerFormData(detail);

    if (!applyFormDataToQuestionnaire(data)) {
      setDraftStatus("Draft server gagal dipulihkan ke formulir.", true);
      return;
    }

    persistedDraftId = detail?.id || null;
    persistedDocumentNo = detail?.documentNo || null;
    hasUnsavedChanges = false;

    setDraftStatus(
      `Draft ${detail?.documentNo || detail?.id || ""} dimuat dari server. Terakhir diperbarui ${
        window.ESpecDraftWorkspace?.formatUpdatedAt?.(detail?.updatedAt) || "-"
      }.`
    );
  }

  async function resumeDraftFromQuery(id) {
    if (!/^[1-9]\d*$/.test(String(id))) {
      setDraftStatus("ID Draft tidak valid.", true);
      return;
    }

    try {
      setDraftStatus("Memuat Draft dari server...");

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
      setDraftStatus(error.message || "Gagal memuat Draft dari server.", true);
    }
  }

  function importLegacyJasa(legacy) {
    if (!legacy?.formData) {
      setDraftStatus("Tidak ada data Draft lama di browser untuk dipulihkan.", true);
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

    const data = normalizeServerFormData({
      formData: legacyFormData,
      documentNo: ""
    });

    if (!applyFormDataToQuestionnaire(data)) {
      legacyPendingClear = false;
      setDraftStatus("Data Draft lama gagal dipulihkan ke formulir.", true);
      return;
    }

    hasUnsavedChanges = true;

    setDraftStatus(
      "Data Draft lama dimuat sebagai Draft baru. Klik Save As Draft untuk menyimpannya ke server."
    );
  }



// =====================================================
// SINKRONISASI KUESIONER KE TEMPLATE CETAK
// =====================================================

function transferToPrint(data = getFormData()) {
  // Sinkronisasi field biasa ke template cetak.
  printForm.querySelectorAll("[name]").forEach((target) => {
    const value = getFieldValue(data, target.name);

    if (target.type === "checkbox" || target.type === "radio") {
      target.checked = Array.isArray(value)
        ? value.includes(target.value)
        : value === target.value;

    } else if (target.type !== "file") {
      target.value = Array.isArray(value)
        ? value.join("\n")
        : value ?? "";
    }
  });

  // =====================================================
  // REQUIRED DOCUMENTS — DROPDOWN KE CHECKBOX PDF
  // =====================================================

  const requiredValues = data["requiredDocumentType[]"] || [];

  const selectedDocuments = Array.isArray(requiredValues)
    ? requiredValues
    : [requiredValues];

  const printRequiredList = document.getElementById(
    "printRequiredDocumentList"
  );

  if (printRequiredList) {
    printRequiredList.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
      checkbox.checked = selectedDocuments.includes(checkbox.value);
    });
  }

  // =====================================================
  // OTHER REQUIRED DOCUMENTS
  // =====================================================

  const otherValues = data["other_requiredDocumentType[]"] || [];

  const otherDetails = Array.isArray(otherValues)
    ? otherValues.filter(Boolean)
    : [otherValues].filter(Boolean);

  const otherInput = printForm.querySelector(
    '[name="vendorDocumentsOther"]'
  );

  const otherWrapper = document.getElementById(
    "printVendorDocumentsOtherWrapper"
  );

  if (otherInput) {
    otherInput.value = otherDetails.join(", ");
  }

  if (otherWrapper) {
    otherWrapper.style.display = otherDetails.length > 0
      ? ""
      : "none";
  }

  // =====================================================
  // TAMPILKAN NAMA FILE LAMPIRAN
  // =====================================================

  const fileNames = data._attachmentFileNames || {};

  Object.entries(fileNames).forEach(([name, names]) => {
    const target = printForm.querySelector(
      `[name="${CSS.escape(name)}"]`
    );

    if (target) {
      target.value = Array.isArray(names)
        ? names.join(", ")
        : names;
    }
  });
}


  // =====================================================
  // TAMBAH TECHNICAL SPECIFICATION DAN KPI
  // =====================================================

  function addQuestion(container, name, placeholder) {
    if (!container) return;

    const wrapper = document.createElement("div");
    wrapper.className = "dynamic-question-item";

    const textarea = document.createElement("textarea");
    textarea.name = name;
    textarea.placeholder = placeholder;
    textarea.rows = 3;

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "remove-question-btn";
    removeButton.textContent = "Hapus";

    removeButton.addEventListener("click", () => {
      wrapper.remove();

      saveDraft();
      transferToPrint();
    });

    textarea.addEventListener("input", () => {
      saveDraft();
      transferToPrint();
    });

    wrapper.appendChild(textarea);
    wrapper.appendChild(removeButton);

    container.appendChild(wrapper);
  }

  const technicalList = $("#technicalSpecificationList", questionnaire);
  const kpiList = $("#kpiList", questionnaire);

  const addTechnicalBtn = $("#addTechnicalSpecificationBtn", questionnaire);
  const addKpiBtn = $("#addKpiBtn", questionnaire);

  if (addTechnicalBtn) {
    addTechnicalBtn.addEventListener("click", () => {
      addQuestion(
        technicalList,
        "technicalSpecification[]",
        "Masukkan technical specification..."
      );
    });
  }

  if (addKpiBtn) {
    addKpiBtn.addEventListener("click", () => {
      addQuestion(
        kpiList,
        "kpi[]",
        "Masukkan KPI..."
      );
    });
  }

  // =====================================================
  // RESTORE FIELD DINAMIS
  // =====================================================

  function restoreDynamicQuestions(saved) {
    if (!saved) return;

    const dynamicFields = [
      {
        container: technicalList,
        key: "technicalSpecification[]",
        name: "technicalSpecification[]",
        placeholder: "Masukkan technical specification..."
      },
      {
        container: kpiList,
        key: "kpi[]",
        name: "kpi[]",
        placeholder: "Masukkan KPI..."
      }
    ];

    dynamicFields.forEach((item) => {
      if (!item.container) return;

      const values = saved[item.key];

      if (!values) return;

      const list = Array.isArray(values) ? values : [values];

      // Hapus field awal yang sudah ada di HTML.
      item.container.innerHTML = "";

      list.forEach((value) => {
        addQuestion(
          item.container,
          item.name,
          item.placeholder
        );

        const fields = item.container.querySelectorAll(
          `[name="${CSS.escape(item.name)}"]`
        );

        fields[fields.length - 1].value = value ?? "";
      });
    });
  }

  // =====================================================
  // SCOPE — PARAMETER & DYNAMIC DOCUMENT ROWS
  // =====================================================

  const attachmentDocumentList = $(
    "#attachmentDocumentList",
    questionnaire
  );

  const requiredDocumentList = $(
    "#requiredDocumentList",
    questionnaire
  );

  const addAttachmentDocumentBtn = $(
    "#addAttachmentDocumentBtn",
    questionnaire
  );

  const addRequiredDocumentBtn = $(
    "#addRequiredDocumentBtn",
    questionnaire
  );

  const scopeDocumentGroups = [
    {
      container: attachmentDocumentList,
      button: addAttachmentDocumentBtn,
      fieldName: "attachmentDocumentType[]"
    },
    {
      container: requiredDocumentList,
      button: addRequiredDocumentBtn,
      fieldName: "requiredDocumentType[]"
    }
  ];

  // Ambil semua baris dokumen pada suatu kelompok.
  function getScopeRows(container) {
    if (!container) return [];

    return Array.from(
      container.querySelectorAll(".scope-document-row")
    );
  }

  // Kosongkan isi baris.
  function clearScopeRow(row) {
    row.querySelectorAll("input, select, textarea").forEach((field) => {
      if (field.type === "file") {
        field.value = "";

      } else if (field.type === "checkbox" || field.type === "radio") {
        field.checked = false;

      } else if (field.tagName === "SELECT") {
        field.selectedIndex = 0;

      } else {
        field.value = "";
      }
    });
  }

  // Buat tombol hapus untuk baris tambahan.
  function createScopeRemoveButton(row) {
    if (!row || row.querySelector(".scope-remove-btn")) return;

    const removeButton = document.createElement("button");

    removeButton.type = "button";
    removeButton.className = "scope-remove-btn";
    removeButton.textContent = "Hapus";

    removeButton.addEventListener("click", () => {
      row.remove();

      saveDraft();
      transferToPrint();
    });

    row.appendChild(removeButton);
  }

  // Tambah satu baris dokumen.
  function addScopeDocumentRow(container, shouldSave = true) {
    if (!container) return null;

    const firstRow = getScopeRows(container)[0];

    if (!firstRow) {
      console.warn(
        "Baris awal Scope tidak ditemukan:",
        container.id
      );

      return null;
    }

    const newRow = firstRow.cloneNode(true);

    // Bersihkan nilai pada baris baru.
    clearScopeRow(newRow);

    // Hindari tombol hapus terduplikasi.
    const oldRemoveButton = newRow.querySelector(
      ".scope-remove-btn"
    );

    if (oldRemoveButton) {
      oldRemoveButton.remove();
    }

    createScopeRemoveButton(newRow);

    container.appendChild(newRow);

        newRow.querySelectorAll("select").forEach((select) => {
      setupOthersField(select);
    });

    if (shouldSave) {
      saveDraft();
      transferToPrint();
    }

    return newRow;
  }

  // Tombol tambah Attachment Documents.
  if (addAttachmentDocumentBtn) {
    addAttachmentDocumentBtn.addEventListener("click", () => {
      addScopeDocumentRow(attachmentDocumentList);
    });
  }

  // Tombol tambah Required Documents.
  if (addRequiredDocumentBtn) {
    addRequiredDocumentBtn.addEventListener("click", () => {
      addScopeDocumentRow(requiredDocumentList);
    });
  }

  // Pulihkan jumlah baris dan pilihan dropdown Scope.
  function restoreScopeDocumentRows(saved) {
    if (!saved) return;

    scopeDocumentGroups.forEach((group) => {
      const container = group.container;

      if (!container) return;

      const savedValue = saved[group.fieldName];

      if (savedValue === undefined || savedValue === null) {
        return;
      }

      const values = Array.isArray(savedValue)
        ? savedValue
        : [savedValue];

      if (values.length === 0) return;

      let rows = getScopeRows(container);

      if (rows.length === 0) return;

      // Kembali ke satu baris awal.
      rows.slice(1).forEach((row) => row.remove());

      // Tambahkan baris sesuai jumlah data tersimpan.
      while (getScopeRows(container).length < values.length) {
        const newRow = addScopeDocumentRow(
          container,
          false
        );

        if (!newRow) break;
      }

      rows = getScopeRows(container);

      // Pulihkan pilihan dropdown.
      rows.forEach((row, index) => {
        const select = row.querySelector("select");

        if (select) {
          select.value = values[index] ?? "";
          setupOthersField(select);

          const otherName = `other_${group.fieldName}`;
          const otherValues = saved[otherName];
          const otherInput = row.querySelector(
            `[name="${CSS.escape(otherName)}"]`
          );

          if (otherInput) {
            otherInput.value = Array.isArray(otherValues)
              ? otherValues[index] || ""
              : otherValues || "";
          }
        }

        // Baris tambahan harus memiliki tombol hapus.
        if (index > 0) {
          createScopeRemoveButton(row);
        }
      });
    });
  }

  // Reset Attachment dan Required Documents.
  function resetScopeDocumentRows() {
    scopeDocumentGroups.forEach((group) => {
      const container = group.container;

      if (!container) return;

      const rows = getScopeRows(container);

      // Hapus seluruh baris tambahan.
      rows.slice(1).forEach((row) => row.remove());

      // Kosongkan baris pertama.
      const firstRow = getScopeRows(container)[0];

      if (firstRow) {
        clearScopeRow(firstRow);

        const removeButton = firstRow.querySelector(
          ".scope-remove-btn"
        );

        if (removeButton) {
          removeButton.remove();
        }
      }
    });
  }

    // =====================================================
  // VALIDASI ATTACHMENT DOCUMENTS — PDF ONLY
  // =====================================================

  async function isValidPDF(file) {
    if (!file) return false;

    // Periksa ekstensi file.
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      return false;
    }

    // Periksa signature PDF (%PDF-).
    try {
      const header = await file.slice(0, 5).arrayBuffer();
      const signature = new TextDecoder().decode(header);

      return signature === "%PDF-";
    } catch (error) {
      console.error("Gagal memeriksa file PDF:", error);
      return false;
    }
  }

  questionnaire.addEventListener("change", async (event) => {
    const input = event.target;

    if (
      !input.matches('input[name="attachmentDocumentFile[]"]') ||
      !input.files.length
    ) {
      return;
    }

    const file = input.files[0];
    const valid = await isValidPDF(file);

    if (!valid) {
      alert(
        "File tidak valid!\n\n" +
        "Attachment Documents hanya menerima file PDF yang valid."
      );

      input.value = "";
    }

    saveDraft();
    transferToPrint();
  });

  // =====================================================
  // MODE CETAK DOKUMEN DARI DATABASE ADMIN
  // =====================================================

  let databasePrintStyle = null;

  function cleanupDatabasePrintMode() {
    document.body.classList.remove("database-print-mode");

    if (databasePrintStyle) {
      databasePrintStyle.remove();
      databasePrintStyle = null;
    }
  }

  function activateDatabasePrintMode() {
    cleanupDatabasePrintMode();

    document.body.classList.add("database-print-mode");

    databasePrintStyle = document.createElement("style");

    databasePrintStyle.textContent = `
      body.database-print-mode .toolbar,
      body.database-print-mode .intro,
      body.database-print-mode .service-actions,
      body.database-print-mode #questionnaireJasaForm,
      body.database-print-mode .footnote {
        display: none !important;
      }

      body.database-print-mode #printJasaForm {
        display: block !important;
        visibility: visible !important;
      }
    `;

    document.head.appendChild(databasePrintStyle);
  }

  window.addEventListener("afterprint", () => {
    cleanupDatabasePrintMode();
  });

  // =====================================================
  // CETAK DOKUMEN JASA DARI DATABASE ADMIN
  // =====================================================

  async function printSavedJasa(documentId) {
    activateDatabasePrintMode();

    try {
      const response = await fetch(
        `${API_BASE_URL}/specifications/my-documents/${encodeURIComponent(documentId)}`,
        { headers: getApiHeaders() }
      );

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          result.message ||
          result.error ||
          "Gagal mengambil data dokumen Jasa."
        );
      }

      const row = result.data ?? result.document ?? result;
      const savedData = row.formData || row.form_data || {};

      const data = {
        ...savedData,

        docNo: row.documentNo ?? row.document_no ?? savedData.docNo ?? "",
        revision: row.revisionNo ?? row.revision ?? savedData.revision ?? "",
        requestor: row.requestor ?? savedData.requestor ?? "",
        department: row.department ?? savedData.department ?? ""
      };

      transferToPrint(data);

      await new Promise((resolve) => {
        setTimeout(resolve, 300);
      });

      window.print();

    } catch (error) {
      console.error("Gagal mencetak dokumen Jasa:", error);

      cleanupDatabasePrintMode();

      alert(
        "Gagal membuka dokumen Jasa untuk dicetak.\n\n" +
        error.message
      );
    }
  }

  // =====================================================
  // AUTO SAVE SAAT INPUT BERUBAH
  // =====================================================

  questionnaire.addEventListener("input", () => {
    saveDraft();
    transferToPrint();
  });

  questionnaire.addEventListener("change", () => {
    saveDraft();
    transferToPrint();
  });

  // =====================================================
  // RESET FORM JASA
  // =====================================================

  function clearFormForNewDraft() {
    questionnaire.reset();
    resetScopeDocumentRows();

    if (technicalList) {
      const first = technicalList.querySelector(
        '[name="technicalSpecification[]"]'
      );

      technicalList.innerHTML = "";

      if (first) {
        addQuestion(
          technicalList,
          "technicalSpecification[]",
          "Masukkan technical specification..."
        );
      }
    }

    if (kpiList) {
      const first = kpiList.querySelector('[name="kpi[]"]');

      kpiList.innerHTML = "";

      if (first) {
        addQuestion(
          kpiList,
          "kpi[]",
          "Masukkan KPI..."
        );
      }
    }

    if (plantSelect && deptSelect) {
      populateDepartments();
    }

    persistedDraftId = null;
    persistedDocumentNo = null;
    hasUnsavedChanges = false;

    initializeDocumentInfo();
    transferToPrint({});
  }

  function startNewDraft() {
    if (!confirmDiscardChanges()) return;

    clearFormForNewDraft();
    setDraftStatus("Draft baru siap dibuat. Klik Save As Draft untuk menyimpannya ke server.");
  }

  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      const confirmed = confirm(
        "Yakin ingin mengosongkan seluruh formulir spesifikasi Jasa?"
      );

      if (!confirmed) return;

      clearFormForNewDraft();
      setDraftStatus("Form telah dikosongkan");

      window.scrollTo({
        top: 0,
        behavior: "smooth"
      });
    });
  }

    // =====================================================
  // VALIDASI MATERIAL CATEGORY
  // HANYA BOLEH MEMILIH SATU
  // =====================================================

  const materialCategoryFields = questionnaire.querySelectorAll(
    'input[name="materialCategory"]'
  );

  // Jika satu checkbox dipilih, lepaskan pilihan lainnya.
  materialCategoryFields.forEach((checkbox) => {
    checkbox.addEventListener("change", function () {
      if (this.checked) {
        materialCategoryFields.forEach((otherCheckbox) => {
          if (otherCheckbox !== this) {
            otherCheckbox.checked = false;
          }
        });
      }

      saveDraft();
      transferToPrint();
    });
  });

  // Pastikan draft lama tidak memulihkan dua pilihan sekaligus.
  function enforceSingleMaterialCategory() {
    const checkedCategories = Array.from(materialCategoryFields)
      .filter((checkbox) => checkbox.checked);

    checkedCategories.slice(1).forEach((checkbox) => {
      checkbox.checked = false;
    });
  }

  // Validasi sebelum menyimpan.
  function validateMaterialCategory() {
    const categories = questionnaire.querySelectorAll(
      'input[name="materialCategory"]:checked'
    );

    if (categories.length === 0) {
      alert("Silakan pilih salah satu Material Category.");
      return false;
    }

    if (categories.length > 1) {
      alert("Material Category hanya boleh memilih satu pilihan.");
      return false;
    }

    if (categories[0].value !== "Expense Jasa") {
      alert(
        "Asset Jasa belum memiliki mapping master data yang didukung dan belum dapat disimpan."
      );
      return false;
    }

    return true;
  }

  function validateScopeDocuments() {
    for (const row of getScopeRows(attachmentDocumentList)) {
      const type = row.querySelector('[name="attachmentDocumentType[]"]');
      const file = row.querySelector('[name="attachmentDocumentFile[]"]');

      if (type?.value && !file?.files?.length) {
        alert("Attachment Document yang dipilih wajib memiliki file PDF.");
        file?.focus();
        return false;
      }

      if (!type?.value && file?.files?.length) {
        alert("Pilih kategori untuk file Attachment Document.");
        type?.focus();
        return false;
      }
    }

    return true;
  }

  function validateForm() {
    if (!questionnaire.reportValidity()) return false;
    if (!validateMaterialCategory()) return false;
    return validateScopeDocuments();
  }

  // =====================================================
  // SIMPAN KE DATABASE ADMIN
  // =====================================================

  if (saveBtn) {
    saveBtn.addEventListener("click", async () => {
      if (!validateForm()) return;

      saveBtn.disabled = true;

      const oldText = saveBtn.textContent;
      saveBtn.textContent = "Menyimpan...";

      try {
        saveDraft();
        setDraftStatus("Menyimpan draft ke server...");

        const { isUpdate } = await saveDraftToServer();

        alert(
          isUpdate
            ? "Draft spesifikasi Jasa berhasil diperbarui di server."
            : "Draft spesifikasi Jasa berhasil disimpan di server."
        );
        setDraftStatus(
          isUpdate
            ? "Draft berhasil diperbarui di server"
            : "Draft berhasil disimpan di server"
        );

      } catch (error) {
        console.error("Gagal menyimpan spesifikasi Jasa:", error);

        setDraftStatus("Perubahan belum tersimpan, penyimpanan server gagal", true);
        alert(
          "Gagal menyimpan draft ke server.\n\n" +
          error.message
        );

      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = oldText;
      }
    });
  }

  // =====================================================
  // SUBMIT BUTTON
  // =====================================================

  if (submitBtn) {
    submitBtn.addEventListener("click", async () => {
      if (submitting) return;
      if (!validateForm()) return;

      submitting = true;
      const oldText = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.textContent = "Mengajukan...";

      try {
        setDraftStatus("Menyimpan draft dan memeriksa status dokumen...");

        await saveDraftToServer();
        const action = await getSubmissionAction(persistedDraftId);

        const response = await fetch(
          `${API_BASE_URL}/specifications/${encodeURIComponent(persistedDraftId)}/${action}`,
          { method: "POST", headers: getApiHeaders(), body: JSON.stringify({}) }
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

        setDraftStatus(message);
        alert(message);
      } catch (error) {
        console.error("Gagal mengajukan spesifikasi Jasa:", error);
        setDraftStatus("Perubahan belum tersimpan, tetapi pengajuan gagal", true);
        alert(`Gagal mengajukan spesifikasi.\n\n${error.message}`);
      } finally {
        submitting = false;
        submitBtn.disabled = false;
        submitBtn.textContent = oldText;
      }
    });
  }

  Promise.resolve(window.ESpecRoleNav?.ready).then(() => {
    const params = new URLSearchParams(window.location.search);
    const printId = params.get("printId");
    const legacyImport = params.get("legacyImport");

    if (printId) {
      printSavedJasa(printId);
    } else {
      initializeDocumentInfo();
      enforceSingleMaterialCategory();
      transferToPrint();

      loadMasterData().then(async () => {
        if (legacyImport) {
          importLegacyJasa(window.ESpecDraftWorkspace?.readLegacy?.("jasa"));
        }

        const resumeId = params.get("resumeId");

        if (resumeId) await resumeDraftFromQuery(resumeId);
      });
    }
  });
})();
