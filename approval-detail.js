(() => {
  "use strict";

  const API_BASE_URL = (window.ESpecDevAuth?.getApiBaseUrl?.()
    || window.ESPEC_CONFIG?.API_BASE_URL
    || "http://localhost:3000/api").replace(/\/$/, "");

  const $ = (selector) => document.querySelector(selector);
  const workspace = window.ESpecDocumentWorkspace;

  const DECISION_OPTIONS = [
    { value: "approve", label: "Approval", endpoint: "/approval/approve" },
    { value: "reject", label: "Reject: Total", endpoint: "/approval/reject" },
    { value: "return", label: "Reject: Request Revisi", endpoint: "/approval/return" }
  ];

  const UNAVAILABLE_LABEL = "Tidak tersedia";

  const FIELD_LABELS = {
    version: "Version",
    createdDate: "Created Date",
    docNo: "Document Number",
    specType: "Specification Type",
    specificationType: "Specification Type",
    specificationTypeName: "Specification Type",
    plant: "Plant",
    requestor: "Requestor",
    department: "Departemen / Sub Departemen",
    materialCategory: "Material Category",
    materialGroup: "Material Group",
    materialGroupCode: "Material Group Code",
    reason: "Reason to Procure",
    reasonChoice: "Reason to Procure",
    reasonOther: "Reason (Other)",
    location: "Location",
    materialDescription: "Material Description",
    materialCode: "Material Code",
    partNumber: "Type / Model / Part Number",
    variant: "Varians",
    dimension: "Dimension",
    brand: "Brand",
    catalogue: "Catalogue",
    packSize: "Pack Size",
    uom: "UoM",
    viscosity: "Viscosity",
    concentration: "Konsentrasi",
    dimensionItems: "Dimension",
    unique1: "Accessories",
    uniqueDetail1: "Accessories Detail",
    unique2: "Unique Specification 2",
    uniqueDetail2: "Unique Specification 2 Detail",
    projectName: "Project Name",
    projectDescription: "Project Description",
    timeline: "Timeline / Duration",
    technicalSpecification: "Technical Specification",
    kpi: "KPI",
    environmentCondition: "Environment Condition",
    additionalService: "Additional Service",
    hse: "Health, Safety & Environment Standard",
    license: "License & Regulation",
    licenseRegulation: "License & Regulation",
    warranty: "Warranty / After Sales Service",
    drawingImage: "Design / Drawing / Visual / Illustration",
    requiredDocuments: "Required Documents",
    VERSION: "Version",
    CREATED_DATE: "Created Date",
    PLANT: "Plant",
    REQUESTOR: "Requestor",
    DEPARTMENT: "Department",
    MATERIAL_GROUP: "Material Group",
    MATERIAL_CATEGORY: "Material Category",
    REASON_TO_PROCURE: "Reason to Procure",
    MATERIAL_DESCRIPTION: "Material Description",
    TYPE_MODEL_PART_NUMBER: "Part Number",
    VARIANS: "Variant",
    DIMENSION: "Dimension",
    BRAND: "Brand",
    CATALOGUE: "Catalogue",
    UOM: "UOM",
    PROJECT_NAME: "Project Name",
    PROJECT_DESCRIPTION: "Project Description",
    TIMELINE: "Timeline / Duration",
    TECHNICAL_SPECIFICATION: "Technical Specification",
    KPI: "KPI",
    ATTACHMENT_DOCUMENTS: "Attachment Documents",
    REQUIRED_DOCUMENTS: "Required Documents"
  };

  const SELECT_FIELDS = new Set([
    "plant",
    "department",
    "materialCategory",
    "materialGroup",
    "reason",
    "reasonChoice",
    "uom",
    "specType",
    "version",
    "document1",
    "document2",
    "document3",
    "document4",
    "document5",
    "document6",
    "document7",
    "document8",
    "document9",
    "dimensionItems",
    "requiredDocuments"
  ]);

  const HIDDEN_FIELDS = new Set([
    "category",
    "document1",
    "document2",
    "document3",
    "document4",
    "document5",
    "document6",
    "document7",
    "document8",
    "document9",
    "drawingImage",
    "electricalAttributes",
    "materialGroupCode",
    "mechanicalAttributes",
    "persistedDocumentNo",
    "showHiddenAttribute",
    "technical1",
    "technical2",
    "technical3",
    "technical4",
    "technical5",
    "technicalUnit1",
    "technicalUnit2",
    "technicalUnit3",
    "technicalUnit4",
    "technicalUnit5",
    "uniqueAttributes"
  ]);

  const FORM_SECTIONS = [
    {
      title: "Version & Identity",
      keys: [
        "version",
        "createdDate",
        "docNo",
        "specType",
        "plant",
        "requestor",
        "department",
        "materialCategory",
        "materialGroup"
      ]
    },
    {
      title: "Purchase Objective",
      keys: ["reasonChoice", "reason", "reasonOther", "location"]
    },
    {
      title: "Specification",
      subsections: [
        {
          title: "General Specification",
          keys: [
            "materialDescription",
            "materialCode",
            "partNumber",
            "variant",
            "dimension",
            "dimensionItems",
            "brand",
            "catalogue",
            "packSize",
            "uom",
            "viscosity",
            "concentration",
            "projectName",
            "projectDescription",
            "timeline",
            "technicalSpecification",
            "kpi",
            "environmentCondition"
          ]
        },
        {
          title: "Technical Specification",
          keys: []
        },
        {
          title: "Unique Specification",
          keys: ["unique1", "uniqueDetail1", "unique2", "uniqueDetail2"]
        }
      ]
    },
    {
      title: "Scope",
      keys: [
        "additionalService",
        "hse",
        "license",
        "licenseRegulation",
        "warranty"
      ]
    },
    {
      title: "Required Documents",
      keys: ["requiredDocuments"]
    }
  ];

  const LOOKUP_KEYS = {
    plant: { endpoint: "plants", keys: ["id", "plantid"], label: (item) => (
      item.plantid && item.plantname
        ? `${item.plantid} - ${item.plantname}`
        : item.plantname || item.plantid || item.id
    ) },
    PLANT: { endpoint: "plants", keys: ["id", "plantid"], label: (item) => (
      item.plantid && item.plantname
        ? `${item.plantid} - ${item.plantname}`
        : item.plantname || item.plantid || item.id
    ) },
    department: { endpoint: "departments", keys: ["id", "departmentname"], label: (item) => item.departmentname },
    DEPARTMENT: { endpoint: "departments", keys: ["id", "departmentname"], label: (item) => item.departmentname },
    materialCategory: { endpoint: "material-categories", keys: ["id", "categoryname"], label: (item) => item.categoryname },
    MATERIAL_CATEGORY: { endpoint: "material-categories", keys: ["id", "categoryname"], label: (item) => item.categoryname },
    materialGroup: { endpoint: "material-groups", keys: ["id", "sapgroupcode", "dashboardgroupname"], label: (item) => (
      item.sapgroupcode || item.dashboardgroupname || item.description || item.categoryname || item.id
    ) },
    MATERIAL_GROUP: { endpoint: "material-groups", keys: ["id", "sapgroupcode", "dashboardgroupname"], label: (item) => (
      item.sapgroupcode || item.dashboardgroupname || item.description || item.categoryname || item.id
    ) },
    reason: { endpoint: "reasons", keys: ["id", "optionname"], label: (item) => item.optionname, textFallback: true },
    reasonChoice: { endpoint: "reasons", keys: ["id", "optionname"], label: (item) => item.optionname, textFallback: true },
    REASON_TO_PROCURE: { endpoint: "reasons", keys: ["id", "optionname"], label: (item) => item.optionname, textFallback: true }
  };

  const escapeHTML = (value) => workspace?.escapeHTML?.(value)
    ?? String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    })[char]);

  const formatDate = (value) => workspace?.formatDate?.(value)
    ?? (value && !Number.isNaN(new Date(value).getTime())
      ? new Date(value).toLocaleDateString("id-ID")
      : "-");

  const getApiHeaders = () => (
    window.ESpecDevAuth?.getApiHeaders?.() || { "Content-Type": "application/json" }
  );

  const specId = new URLSearchParams(window.location.search).get("id");

  const showToast = (message, type = "error") => {
    const toast = $("#toast");

    if (!toast) return;

    toast.textContent = message;
    toast.className = `toast show ${type}`;

    setTimeout(() => {
      toast.className = "toast";
    }, 4000);
  };

  const labelFor = (key) => FIELD_LABELS[key]
    || String(key).replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ");

  const displayValue = (value) => {
    if (value === null || value === undefined || value === "") return "-";
    if (Array.isArray(value)) return value.map(displayValue).join(", ");
    if (typeof value === "object") {
      const label = value.label ?? value.name ?? value.documentname ?? value.optionname ?? value.value;
      return label === undefined ? JSON.stringify(value) : String(label);
    }
    if (typeof value === "boolean") return value ? "Ya" : "Tidak";

    return String(value);
  };

  const fetchLookup = async (path) => {
    try {
      const response = await fetch(`${API_BASE_URL}/${path}`, { headers: getApiHeaders() });
      const result = await response.json().catch(() => ({}));

      if (!response.ok || result.success !== true) return [];

      if (Array.isArray(result.data)) return result.data;
      if (result.data && typeof result.data === "object") return [result.data];
      return [];
    } catch {
      return [];
    }
  };

  const loadLookups = async (detail) => {
    const [plants, departments, materialCategories, materialGroups] = await Promise.all([
      fetchLookup("plants"),
      fetchLookup("departments"),
      fetchLookup("material-categories"),
      fetchLookup("material-groups")
    ]);

    const reasonIds = new Set();
    const values = [
      detail.formData?.reason,
      detail.formData?.reasonChoice,
      detail.attributeValues?.REASON_TO_PROCURE
    ];

    values.forEach((value) => {
      const candidates = Array.isArray(value) ? value : [value];
      candidates.forEach((candidate) => {
        const text = String(candidate ?? "").trim();

        if (/^\d+$/.test(text)) reasonIds.add(text);
      });
    });

    const reasonLists = await Promise.all(
      [...reasonIds].map((id) => fetchLookup(`reason-to-procure/${encodeURIComponent(id)}`))
    );

    return {
      plants,
      departments,
      "material-categories": materialCategories,
      "material-groups": materialGroups,
      reasons: reasonLists.flat()
    };
  };

  const lookupDisplay = (key, value, lookups) => {
    const config = LOOKUP_KEYS[key];

    if (!config) return null;

    const text = String(value ?? "").trim();

    if (!text) return null;

    const item = (lookups[config.endpoint] || []).find((candidate) => (
      config.keys.some((field) => String(candidate?.[field] ?? "") === text)
    ));

    if (item) {
      const label = config.label(item);
      return label === undefined || label === null || label === "" ? UNAVAILABLE_LABEL : String(label);
    }

    if (config.textFallback && !/^\d+$/.test(text)) return text;
    return UNAVAILABLE_LABEL;
  };

  const displayFieldValue = (key, value, lookups) => {
    if (Array.isArray(value)) {
      const values = value.map((item) => lookupDisplay(key, item, lookups) ?? displayValue(item));
      return values.length ? values.join(", ") : "-";
    }

    return lookupDisplay(key, value, lookups) ?? displayValue(value);
  };

  const isMeaningful = (value) => {
    if (value === null || value === undefined || value === "") return false;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === "object") return Object.keys(value).length > 0;
    return true;
  };

  const readOnlyField = (key, value, lookups, labelOverride) => {
    const label = escapeHTML(labelOverride || labelFor(key));
    const text = escapeHTML(displayFieldValue(key, value, lookups) ?? displayValue(value));

    if (typeof value === "boolean") {
      return `
        <div class="readonly-field">
          <label>${label}</label>
          <input type="checkbox" disabled ${value ? "checked" : ""}>
        </div>
      `;
    }

    if (SELECT_FIELDS.has(key) || Array.isArray(value)) {
      return `
        <div class="readonly-field">
          <label>${label}</label>
          <select disabled>
            <option selected>${text}</option>
          </select>
        </div>
      `;
    }

    return `
      <div class="readonly-field">
        <label>${label}</label>
        <input type="text" value="${text}" disabled>
      </div>
    `;
  };

  const entriesForKeys = (keys, entries, used) => {
    const map = new Map(entries);

    return keys
      .filter((key) => map.has(key) && !used.has(key))
      .map((key) => {
        used.add(key);
        return [key, map.get(key)];
      })
      .filter(([, value]) => isMeaningful(value));
  };

  const renderSection = (title, entries, lookups) => {
    if (!entries.length) return "";

    return `
      <section class="approval-form-section">
        <h3 class="approval-section-title">${escapeHTML(title)}</h3>
        <div class="approval-form-grid">
          ${entries.map(([key, value, label]) => readOnlyField(key, value, lookups, label)).join("")}
        </div>
      </section>
    `;
  };

  const renderSpecificationSection = (entries, technicalRows, lookups, used) => {
    const blocks = FORM_SECTIONS[2].subsections.map((subsection) => {
      const subsectionEntries = entriesForKeys(subsection.keys, entries, used);

      if (subsection.title === "Technical Specification") {
        subsectionEntries.push(...technicalRows);
      }

      if (!subsectionEntries.length) return "";

      return `
        <h4 class="approval-subsection-title">${escapeHTML(subsection.title)}</h4>
        <div class="approval-form-grid">
          ${subsectionEntries.map(([key, value, label]) => readOnlyField(key, value, lookups, label)).join("")}
        </div>
      `;
    }).filter(Boolean).join("");

    if (!blocks) return "";

    return `
      <section class="approval-form-section">
        <h3 class="approval-section-title">Specification</h3>
        ${blocks}
      </section>
    `;
  };

  const renderDocument = async (detail) => {
    const lookups = await loadLookups(detail);
    const title = $("#documentTitle");
    const subtitle = $("#documentSubtitle");

    if (title) title.textContent = detail.documentNo || `Dokumen #${detail.id}`;
    if (subtitle) {
      subtitle.textContent = `${detail.specificationTypeName || "-"} · ${detail.status || "-"}`;
    }

    const summary = $("#documentSummary");

    if (summary) {
      summary.innerHTML = `
        <div class="readonly-field"><label>Document Number</label><input value="${escapeHTML(detail.documentNo)}" disabled></div>
        <div class="readonly-field"><label>Revision</label><input value="${escapeHTML(detail.revisionNo)}" disabled></div>
        <div class="readonly-field"><label>Requestor</label><input value="${escapeHTML(detail.requestor)}" disabled></div>
        <div class="readonly-field"><label>Department</label><input value="${escapeHTML(detail.department)}" disabled></div>
        <div class="readonly-field"><label>Submitted</label><input value="${escapeHTML(formatDate(detail.submittedAt))}" disabled></div>
        <div class="readonly-field"><label>Status</label><input value="${escapeHTML(detail.status)}" disabled></div>
      `;
    }

    const formData = detail.formData || {};
    const fields = $("#documentFields");
    const entries = Object.entries(formData)
      .filter(([key]) => key !== "technicalAttributes" && !HIDDEN_FIELDS.has(key));
    const hasReasonChoice = entries.some(([key]) => key === "reasonChoice");

    if (hasReasonChoice) {
      const reasonIndex = entries.findIndex(([key]) => key === "reason");
      if (reasonIndex >= 0) entries.splice(reasonIndex, 1);
    }
    const technical = Array.isArray(formData.technicalAttributes)
      ? formData.technicalAttributes
      : [];
    const attributeValues = detail.attributeValues || {};
    const technicalRows = [
      ...technical
        .filter((item) => isMeaningful(item?.value))
        .map((item) => [
          "TECHNICAL_ATTRIBUTE",
          item.value,
          item.label || item.category || "Technical Attribute"
        ]),
      ...Object.entries(attributeValues)
        .filter(([, value]) => isMeaningful(value))
        .map(([key, value]) => [key, value, labelFor(key)])
    ];

    if (fields) {
      const used = new Set();
      const sections = [
        renderSection(
          FORM_SECTIONS[0].title,
          entriesForKeys(FORM_SECTIONS[0].keys, entries, used),
          lookups
        ),
        renderSection(
          FORM_SECTIONS[1].title,
          entriesForKeys(FORM_SECTIONS[1].keys, entries, used),
          lookups
        ),
        renderSpecificationSection(entries, technicalRows, lookups, used),
        renderSection(
          FORM_SECTIONS[3].title,
          entriesForKeys(FORM_SECTIONS[3].keys, entries, used),
          lookups
        ),
        renderSection(
          FORM_SECTIONS[4].title,
          entriesForKeys(FORM_SECTIONS[4].keys, entries, used),
          lookups
        )
      ];

      fields.innerHTML = sections.filter(Boolean).join("");
    }
  };

  const renderHistory = (workflow) => {
    const container = $("#approvalHistory");

    if (!container) return;

    const cycles = Array.isArray(workflow?.cycles) ? workflow.cycles : [];

    if (!cycles.length) {
      container.innerHTML = "<p>Belum ada riwayat workflow.</p>";
      return;
    }

    container.innerHTML = cycles.map((cycle) => {
      const steps = Array.isArray(cycle.steps) ? cycle.steps : [];

      return `
        <div class="approval-step">
          <strong>Cycle ${escapeHTML(cycle.cycleno)} · ${escapeHTML(cycle.approvalpatternname || "-")}</strong>
          <p>Status: ${escapeHTML(cycle.status || "-")} · Submitted: ${escapeHTML(formatDate(cycle.submittedat))}</p>
          ${steps.map((step) => `
            <div class="approval-step">
              <strong>Step ${escapeHTML(step.stepno)} · ${escapeHTML(step.approverrole || "-")}</strong>
              <p>
                ${escapeHTML(step.approvername || "-")} ·
                ${escapeHTML(step.approvalstatus || "-")} ·
                ${escapeHTML(formatDate(step.actionat))}
              </p>
              <p>${escapeHTML(step.comments || "")}</p>
            </div>
          `).join("")}
        </div>
      `;
    }).join("");
  };

  const load = async () => {
    if (!/^[1-9]\d*$/.test(String(specId))) {
      showToast("ID dokumen tidak valid.");
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE_URL}/specifications/my-documents/${encodeURIComponent(specId)}`,
        { headers: getApiHeaders() }
      );
      const result = await response.json().catch(() => ({}));

      if (!response.ok || result.success !== true) {
        throw new Error(result.message || "Dokumen tidak dapat diakses.");
      }

      await renderDocument(result.data);

      const select = $("#decisionSelect");

      if (select) {
        select.innerHTML = `
          <option value="">Pilih keputusan</option>
          ${DECISION_OPTIONS.map((option) => (
            `<option value="${option.value}">${option.label}</option>`
          )).join("")}
        `;
        select.disabled = false;
      }

      const submit = $("#submitDecisionBtn");

      if (submit) submit.disabled = false;

      const workflowResponse = await fetch(
        `${API_BASE_URL}/specifications/${encodeURIComponent(specId)}/workflow`,
        { headers: getApiHeaders() }
      );
      const workflowResult = await workflowResponse.json().catch(() => ({}));

      if (workflowResponse.ok && workflowResult.success === true) {
        renderHistory(workflowResult.data);
      }
    } catch (error) {
      showToast(error.message || "Gagal memuat dokumen.");
    }
  };

  const submitDecision = async () => {
    const select = $("#decisionSelect");
    const comment = $("#decisionComment");
    const button = $("#submitDecisionBtn");
    const choice = DECISION_OPTIONS.find((option) => option.value === select?.value);

    if (!choice) {
      showToast("Pilih keputusan terlebih dahulu.");
      return;
    }

    const commentValue = (comment?.value || "").trim();

    if (choice.value !== "approve" && !commentValue) {
      showToast("Catatan keputusan wajib diisi.");
      return;
    }

    if (!confirm(`Kirim keputusan "${choice.label}" untuk dokumen ini?`)) return;

    try {
      if (button) button.disabled = true;

      const response = await fetch(
        `${API_BASE_URL}/specifications/${encodeURIComponent(specId)}${choice.endpoint}`,
        {
          method: "POST",
          headers: getApiHeaders(),
          body: JSON.stringify({ comment: commentValue || null })
        }
      );
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        const messages = {
          401: "Sesi berakhir. Silakan login kembali.",
          403: "Anda tidak berhak memproses dokumen ini.",
          409: "Dokumen sudah diproses atau statusnya berubah.",
          422: "Catatan keputusan wajib diisi."
        };

        throw new Error(result.message || messages[response.status] || "Gagal mengirim keputusan.");
      }

      window.location.href = "my-approval.html";
    } catch (error) {
      showToast(error.message || "Gagal mengirim keputusan.");

      if (button) button.disabled = false;
    }
  };

  document.addEventListener("DOMContentLoaded", () => {
    Promise.resolve(window.ESpecRoleNav?.ready).then(() => {
      $("#decisionSelect")?.addEventListener("change", (event) => {
        const comment = $("#decisionComment");

        if (!comment) return;

        const required = ["reject", "return"].includes(event.target.value);

        comment.hidden = !required;
        comment.disabled = !required;
        comment.required = required;

        if (!required) comment.value = "";
      });

      $("#submitDecisionBtn")?.addEventListener("click", submitDecision);
      load();
    });
  });
})();
