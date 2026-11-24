(() => {
  "use strict";

  const API_BASE_URL = window.ESPEC_CONFIG?.API_BASE_URL || "http://localhost:3000/api";
  const API_URL = `${API_BASE_URL.replace(/\/$/, "")}/specifications/my-documents`;

  const $ = (selector) => document.querySelector(selector);
  const workspace = window.ESpecDocumentWorkspace;

  let documents = [];
  let activeStatus = "all";
  const DISPLAY_STATUSES = [
    "Draft",
    "In Approval",
    "Revision Required",
    "Approved",
    "Rejected"
  ];

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

  const statusKey = (status) => String(status || "").toLowerCase().replace(/\s+/g, "-");

  const statusClass = (status) => {
    const normalized = String(status || "").toLowerCase();

    if (normalized.includes("approved")) return "status-approved";
    if (normalized.includes("rejected")) return "status-rejected";
    if (normalized.includes("approval")) return "status-pending";
    if (normalized.includes("revision")) return "status-revision";

    return "status-draft";
  };

  const matchesStatus = (document) => {
    if (!DISPLAY_STATUSES.includes(document.status)) return activeStatus === "all";
    if (activeStatus === "all") return true;
    if (activeStatus === "pending") return document.status === "In Approval";
    if (activeStatus === "revision") return document.status === "Revision Required";
    if (activeStatus === "released") return document.status === "Approved";

    return statusKey(document.status) === activeStatus;
  };

  const filteredDocuments = () => documents.filter((document) => {
    if (!matchesStatus(document)) return false;

    const search = ($("#myEspecSearch")?.value || "").trim().toLowerCase();

    if (!search) return true;

    return [
      document.documentNo,
      document.specificationTypeName,
      document.materialDescription,
      document.requestor,
      document.status
    ].some((value) => String(value || "").toLowerCase().includes(search));
  });

  const showToast = (message, type = "success") => {
    const toast = $("#toast");

    if (!toast) return;

    toast.textContent = message;
    toast.className = `toast show ${type}`;

    setTimeout(() => {
      toast.className = "toast";
    }, 3000);
  };

  const DRAFT_PAGES = {
    barang: "barang.html",
    jasa: "jasa.html"
  };

  const openDraftPage = (source, params = {}) => {
    const page = DRAFT_PAGES[source];

    if (!page) return;

    const url = new URL(page, window.location.href);

    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, String(value));
    });

    window.location.href = url.toString();
  };



  // =====================================================
  // DOCUMENT DETAIL
  // =====================================================
  const initializeDraftWorkspace = () => {
    const draftWorkspace = window.ESpecDraftWorkspace;

    if (!draftWorkspace?.mount) {
      showToast("Workspace Draft server tidak tersedia.", "error");
      return;
    }

    const sources = {
      barang: {
        panel: $("#barangDraftSource"),
        picker: $("#barangDraftPicker"),
        resumeButton: $("#resumeBarangDraftBtn"),
        newButton: $("#newBarangDraftBtn"),
        exportButton: $("#exportBarangLegacyBtn"),
        recoverButton: $("#recoverBarangLegacyBtn"),
        statusElement: $("#barangDraftStatus"),
        legacyPanel: $("#barangLegacyRecovery")
      },
      jasa: {
        panel: $("#jasaDraftSource"),
        picker: $("#jasaDraftPicker"),
        resumeButton: $("#resumeJasaDraftBtn"),
        newButton: $("#newJasaDraftBtn"),
        exportButton: $("#exportJasaLegacyBtn"),
        recoverButton: $("#recoverJasaLegacyBtn"),
        statusElement: $("#jasaDraftStatus"),
        legacyPanel: $("#jasaLegacyRecovery")
      }
    };

    Object.entries(sources).forEach(([source, elements]) => {
      draftWorkspace.mount({
        source,
        picker: elements.picker,
        resumeButton: elements.resumeButton,
        newButton: elements.newButton,
        exportButton: elements.exportButton,
        recoverButton: elements.recoverButton,
        panel: elements.legacyPanel,
        statusElement: elements.statusElement,
        onResume: (detail) => openDraftPage(source, { resumeId: detail.id }),
        onNew: () => openDraftPage(source),
        onImportLegacy: () => openDraftPage(source, { legacyImport: "1" })
      });
    });

    const sourceSelect = $("#draftSourceSelect");

    const syncVisibleSource = () => {
      const source = sourceSelect?.value === "jasa" ? "jasa" : "barang";

      Object.entries(sources).forEach(([key, elements]) => {
        if (elements.panel) elements.panel.hidden = key !== source;
      });
    };

    sourceSelect?.addEventListener("change", syncVisibleSource);
    syncVisibleSource();
  };

  const resumeDocument = (document) => {
    const page = workspace?.typeKey?.(document) === "jasa" ? "jasa.html" : "barang.html";
    const url = new URL(page, window.location.href);

    url.searchParams.set("resumeId", document.id);
    window.location.href = url.toString();
  };

  const render = () => {
    const rows = $("#myEspecRows");

    if (!rows) return;

    const visible = filteredDocuments();
    const resultCount = $("#myEspecResultCount");

    if (resultCount) resultCount.textContent = `Menampilkan ${visible.length} dokumen`;

    const emptyState = $("#myEspecEmptyState");

    if (emptyState) emptyState.style.display = visible.length ? "none" : "block";

    rows.innerHTML = visible.map((document, index) => {
      const editable = ["Draft", "Revision Required"].includes(document.status);
      const actionLabel = document.status === "Revision Required"
        ? "Revise / Resubmit"
        : editable
          ? "Resume / Edit"
          : "View / Print";

      return `
        <tr>
          <td><strong>${escapeHTML(document.documentNo)}</strong></td>
          <td>${escapeHTML(document.specificationTypeName)}</td>
          <td>${escapeHTML(document.materialDescription || document.materialCode || "-")}</td>
          <td>${escapeHTML(formatDate(document.updatedAt || document.createdAt))}</td>
          <td>
            <span class="status-badge ${statusClass(document.status)}">
              ${escapeHTML(document.status)}
            </span>
          </td>
          <td>
            <div class="table-actions">
              <button
                type="button"
                class="action-btn"
                data-action="${editable ? "resume" : "print"}"
                data-index="${index}">
                ${actionLabel}
              </button>

              ${
                editable
                  ? ""
                  : `<button type="button" class="action-btn" data-action="history" data-index="${index}">History</button>`
              }
            </div>
          </td>
        </tr>
      `;
    }).join("");

    rows.dataset.documents = JSON.stringify(visible.map((document) => document.id));
  };


  const renderWorkflowHistory = (workflow) => {
    const panel = $("#myEspecHistoryPanel");
    const container = $("#myEspecHistory");

    if (!panel || !container) return;

    panel.hidden = false;

    const cycles = Array.isArray(workflow?.cycles) ? workflow.cycles : [];

    container.innerHTML = cycles.length
      ? cycles.map((cycle) => {
        const steps = Array.isArray(cycle.steps) ? cycle.steps : [];

        return `
          <div class="approval-step">
            <strong>Cycle ${escapeHTML(cycle.cycleno)} · ${escapeHTML(cycle.approvalpatternname || "-")}</strong>
            <p>${escapeHTML(cycle.status || "-")} · ${escapeHTML(formatDate(cycle.submittedat))}</p>
            ${steps.map((step) => `
              <div class="approval-step">
                <strong>Step ${escapeHTML(step.stepno)} · ${escapeHTML(step.approverrole || "-")}</strong>
                <p>${escapeHTML(step.approvername || "-")} · ${escapeHTML(step.approvalstatus || "-")}</p>
                <p>${escapeHTML(step.comments || "")}</p>
              </div>
            `).join("")}
          </div>
        `;
      }).join("")
      : "<p>Belum ada riwayat workflow.</p>";
  };

  const loadWorkflowHistory = async (document) => {
    try {
      const response = await fetch(
        `${API_BASE_URL.replace(/\/$/, "")}/specifications/${encodeURIComponent(document.id)}/workflow`,
        { headers: getApiHeaders() }
      );
      const result = await response.json().catch(() => ({}));

      if (!response.ok || result.success !== true) {
        throw new Error(result.message || "Riwayat tidak dapat diakses.");
      }

      renderWorkflowHistory(result.data);
    } catch (error) {
      showToast(error.message || "Gagal memuat riwayat workflow.", "error");
    }
  };

  const loadDocuments = async () => {
    try {
      const response = await fetch(API_URL, { headers: getApiHeaders() });
      const result = await response.json().catch(() => ({}));

      if (!response.ok || result.success !== true) {
        throw new Error(result.message || "Gagal memuat dokumen.");
      }

      documents = Array.isArray(result.data) ? result.data : [];
      render();
    } catch (error) {
      showToast(error.message || "Gagal memuat dokumen.", "error");
      render();
    }
  };

  const initializeEvents = () => {
    document.querySelectorAll("[data-my-status]").forEach((button) => {
      button.addEventListener("click", () => {
        activeStatus = button.dataset.myStatus || "all";

        document.querySelectorAll("[data-my-status]").forEach((item) => {
          const active = item === button;

          item.classList.toggle("active", active);
          item.setAttribute("aria-pressed", String(active));
        });

        render();
      });
    });

    $("#myEspecSearch")?.addEventListener("input", render);

    $("#myEspecRows")?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-action]");

      if (!button) return;

      const ids = JSON.parse($("#myEspecRows")?.dataset.documents || "[]");
      const document = documents.find((item) => String(item.id) === String(ids[Number(button.dataset.index)]));

      if (!document) return;

      if (button.dataset.action === "resume") resumeDocument(document);
      if (button.dataset.action === "print") workspace?.openPrintPreview?.(document);
      if (button.dataset.action === "history") loadWorkflowHistory(document);
    });
  };

  document.addEventListener("DOMContentLoaded", () => {
    Promise.resolve(window.ESpecRoleNav?.ready).then(() => {
      initializeEvents();
      initializeDraftWorkspace();
      loadDocuments();
    });
  });
})();
