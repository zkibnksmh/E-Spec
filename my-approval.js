
(() => {
  "use strict";

  // =========================================
  // E-SPEC — MY APPROVAL
  // =========================================

  const API_URL = "http://localhost:3000/api/documents";
  const $ = (selector) => document.querySelector(selector);

  let documents = [];
  let selectedDocument = null;
  let loading = false;

  // Simulasi sementara di browser.
  // Belum tersimpan ke PostgreSQL.
  const approvalDemoState = {};

  // Pilihan checkbox per dokumen.
  const decisionSelections = {};

  const APPROVAL_STAGES = [
    {
      key: "Requestor",
      name: "Requestor",
      description: "Pengajuan dan perbaikan dokumen"
    },
    {
      key: "Manager",
      name: "Manager",
      description: "Persetujuan Manager Plant"
    },
    {
      key: "Head Engineering",
      name: "Head Engineering",
      description: "Persetujuan Engineering Plant"
    },
    {
      key: "Plant Head",
      name: "Plant Head",
      description: "Persetujuan akhir Plant"
    }
  ];

  // =========================================
  // HELPER
  // =========================================

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);
  }

  function normalizeText(value) {
    return String(value ?? "")
      .trim()
      .toLowerCase()
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ");
  }

  function formatDate(value) {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "—";

    return date.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
  }

  function showToast(message, type = "success") {
    const toast = $("#toast");

    if (!toast) {
      console.log(message);
      return;
    }

    toast.textContent = message;
    toast.className = `toast show ${type}`;

    clearTimeout(showToast.timer);

    showToast.timer = setTimeout(() => {
      toast.className = "toast";
    }, 3000);
  }

  function parseFormData(value) {
    if (!value) return {};

    if (typeof value === "string") {
      try {
        const parsed = JSON.parse(value);

        return parsed && typeof parsed === "object"
          ? parsed
          : {};
      } catch (error) {
        console.error("Gagal membaca form_data:", error);
        return {};
      }
    }

    return typeof value === "object" && !Array.isArray(value)
      ? value
      : {};
  }

  function getResponseRows(result) {
    if (Array.isArray(result)) return result;
    if (Array.isArray(result?.data)) return result.data;
    if (Array.isArray(result?.documents)) return result.documents;
    if (Array.isArray(result?.rows)) return result.rows;

    if (Array.isArray(result?.data?.documents)) {
      return result.data.documents;
    }

    return [];
  }

  // =========================================
  // NORMALIZE DOCUMENT
  // =========================================

  function normalizeDocument(row) {
    const formData = parseFormData(
      row.form_data ?? row.formData
    );

    const specType =
      row.spec_type ||
      row.specType ||
      row.document_type ||
      formData.specType ||
      formData.documentType ||
      formData.jenisDokumen ||
      formData.formType ||
      (
        formData.serviceName ||
        formData.serviceDescription ||
        formData.namaJasa ||
        formData.namaLayanan
          ? "Jasa"
          : "Barang"
      );

    const documentId =
      row.id ??
      row.document_id ??
      row.documentId ??
      "";

    return {
      ...formData,
      ...row,

      id: String(documentId),
      formData,

      docNo:
        row.doc_no ||
        row.docNo ||
        formData.docNo ||
        "",

      revision:
        row.revision ||
        formData.revision ||
        "",

      plant:
        row.plant ||
        formData.plant ||
        "",

      requestor:
        row.requestor ||
        formData.requestor ||
        "",

      department:
        row.department ||
        formData.department ||
        "",

      materialDescription:
        row.material_description ||
        row.materialDescription ||
        formData.materialDescription ||
        formData.serviceName ||
        formData.serviceTitle ||
        formData.serviceDescription ||
        formData.namaJasa ||
        formData.namaLayanan ||
        "",

      materialCode:
        row.material_code ||
        row.materialCode ||
        formData.materialCode ||
        "",

      savedAt:
        row.created_at ||
        row.saved_at ||
        row.savedAt ||
        formData.createdDate ||
        "",

      status:
        row.status ||
        formData.status ||
        "Draft",

      specType:
        normalizeText(specType).includes("jasa")
          ? "Jasa"
          : "Barang",

      currentStage:
        row.current_stage ||
        row.currentStage ||
        row.approval_stage ||
        formData.currentStage ||
        formData.approvalStage ||
        ""
    };
  }

  function getDocumentName(doc) {
    return (
      doc.materialDescription ||
      doc.formData?.materialDescription ||
      doc.formData?.serviceName ||
      doc.formData?.serviceDescription ||
      doc.formData?.namaJasa ||
      doc.formData?.namaLayanan ||
      (
        doc.specType === "Jasa"
          ? "Tanpa nama jasa"
          : "Tanpa nama barang"
      )
    );
  }

  // =========================================
  // LOAD DOCUMENTS
  // =========================================

  async function loadDocuments() {
    loading = true;
    renderApproval();

    try {
      const response = await fetch(API_URL);

      if (!response.ok) {
        throw new Error(
          `Gagal mengambil data. HTTP ${response.status}`
        );
      }

      const result = await response.json();

      documents = getResponseRows(result)
        .map(normalizeDocument)
        .filter((doc) => doc.id && doc.id !== "undefined");

      loading = false;
      renderAll();

    } catch (error) {
      loading = false;

      console.error("Gagal memuat dokumen:", error);

      renderAll();

      showToast(
        "Gagal memuat data. Periksa koneksi backend.",
        "error"
      );
    }
  }

  // =========================================
  // DOCUMENT STATUS
  // =========================================

  function getApprovalStatus(doc) {
    const demo = approvalDemoState[String(doc.id)];

    if (demo?.status) {
      return demo.status;
    }

    const status = normalizeText(doc.status);

    if ([
      "approved",
      "disetujui",
      "completed",
      "complete",
      "selesai",
      "release",
      "released"
    ].includes(status)) {
      return "approved";
    }

    if ([
      "revision",
      "revisi",
      "perlu revisi",
      "returned",
      "dikembalikan"
    ].includes(status)) {
      return "revision";
    }

    if ([
      "rejected",
      "reject",
      "ditolak"
    ].includes(status)) {
      return "rejected";
    }

    if (
      status.includes("waiting") ||
      status.includes("pending") ||
      status.includes("menunggu") ||
      status === "submitted" ||
      status === "diajukan"
    ) {
      return "pending";
    }

    return "draft";
  }

  function getCurrentStage(doc) {
    const demo = approvalDemoState[String(doc.id)];

    if (demo?.currentStage) {
      return demo.currentStage;
    }

    const rawStage = normalizeText(
      doc.currentStage || doc.status
    );

    if (
      rawStage.includes("plant head") ||
      rawStage.includes("planthead")
    ) {
      return "Plant Head";
    }

    if (rawStage.includes("engineering")) {
      return "Head Engineering";
    }

    if (rawStage.includes("manager")) {
      return "Manager";
    }

    return "Manager";
  }

  function getApprovalStage(doc) {
    const status = getApprovalStatus(doc);

    if (status === "approved") return "Selesai";
    if (status === "revision") return "Kembali ke Requestor";
    if (status === "rejected") return "Ditolak";
    if (status === "draft") return "Belum Diajukan";

    return `Menunggu ${getCurrentStage(doc)}`;
  }

  // =========================================
  // STATUS BADGE
  // =========================================

  function getApprovalBadge(status) {
    const badges = {
      pending: `
        <span class="approval-status pending">
          Menunggu Approval
        </span>
      `,

      approved: `
        <span class="approval-status approved">
          Release
        </span>
      `,

      revision: `
        <span class="approval-status rejected">
          Revision
        </span>
      `,

      rejected: `
        <span class="approval-status rejected">
          Rejected
        </span>
      `,

      draft: `
        <span class="approval-status draft">
          Draft
        </span>
      `
    };

    return badges[status] || badges.draft;
  }

  // =========================================
  // STATISTICS
  // =========================================

  function renderStatistics() {
    const pending = documents.filter(
      (doc) => getApprovalStatus(doc) === "pending"
    ).length;

    if ($("#pendingApprovalCount")) {
      $("#pendingApprovalCount").textContent = pending;
    }

    if ($("#approvalNavCount")) {
      $("#approvalNavCount").textContent = pending;
    }
  }

  // =========================================
  // MY APPROVAL FILTER
  // =========================================

  function getFilteredApproval() {
    const search = (
      $("#approvalSearch")?.value || ""
    ).trim().toLowerCase();

    const filter =
      $("#approvalFilter")?.value || "all";

    return documents.filter((doc) => {
      const status = getApprovalStatus(doc);

      const searchable = [
        doc.docNo,
        doc.requestor,
        doc.plant,
        doc.department,
        doc.specType,
        getDocumentName(doc)
      ].join(" ").toLowerCase();

      const matchesSearch = searchable.includes(search);

      const matchesStatus =
        filter === "all" ||
        (
          filter === "approved" &&
          status === "approved"
        ) ||
        (
          filter === "revision" &&
          status === "revision"
        ) ||
        (
          filter === "rejected" &&
          status === "rejected"
        ) ||
        status === filter;

      // Hanya dokumen pending yang dapat diproses.
      return (
        status === "pending" &&
        matchesSearch &&
        matchesStatus
      );
    });
  }

  // =========================================
  // APPROVAL CHECKBOX
  // =========================================

  function renderDecisionCheckbox(doc, decision, label) {
    const selected =
      decisionSelections[String(doc.id)] === decision;

    return `
      <label class="decision-checkbox ${decision}">
        <input
          type="checkbox"
          data-decision="${decision}"
          data-id="${escapeHTML(doc.id)}"
          ${selected ? "checked" : ""}
        >
        <span>${label}</span>
      </label>
    `;
  }

  // =========================================
  // RENDER MY APPROVAL
  // =========================================

  function renderApproval() {
    const rows = $("#approvalRows");
    const empty = $("#approvalEmptyState");
    const table = $(".approval-table-wrap");
    const footer = $(".approval-panel .panel-footer");

    if (!rows) return;

    if (loading) {
      rows.innerHTML = `
        <tr>
          <td colspan="8" class="loading-state">
            Memuat dokumen...
          </td>
        </tr>
      `;

      if (empty) empty.style.display = "none";
      if (table) table.style.display = "block";
      if (footer) footer.style.display = "none";

      if ($("#approvalResultCount")) {
        $("#approvalResultCount").textContent =
          "Memuat dokumen...";
      }

      return;
    }

    const filtered = getFilteredApproval();

    if ($("#approvalResultCount")) {
      $("#approvalResultCount").textContent =
        `Menampilkan ${filtered.length} dokumen`;
    }

    if (!filtered.length) {
      rows.innerHTML = "";

      if (table) table.style.display = "none";
      if (footer) footer.style.display = "none";

      if (empty) {
        empty.style.display = "block";

        const heading = empty.querySelector("h3");
        const description = empty.querySelector("p");

        const hasSearch =
          ($("#approvalSearch")?.value || "").trim() !== "";

        if (heading) {
          heading.textContent = hasSearch
            ? "Dokumen tidak ditemukan"
            : "Belum ada dokumen yang perlu di-approve";
        }

        if (description) {
          description.textContent = hasSearch
            ? "Coba kata pencarian yang berbeda."
            : "Dokumen yang membutuhkan keputusan persetujuan akan muncul di bagian ini.";
        }
      }

      return;
    }

    if (empty) empty.style.display = "none";
    if (table) table.style.display = "block";
    if (footer) footer.style.display = "flex";

    rows.innerHTML = filtered.map((doc) => {
      const id = String(doc.id);

      return `
        <tr>
          <td>
            <span class="doc-number">
              ${escapeHTML(doc.docNo || "Belum ada nomor")}
            </span>

            <div class="secondary-text">
              ${escapeHTML(doc.specType)}
            </div>
          </td>

          <td>${escapeHTML(doc.requestor || "—")}</td>

          <td>${escapeHTML(doc.plant || "—")}</td>

          <td>${escapeHTML(formatDate(doc.savedAt))}</td>

          <td>
            ${renderDecisionCheckbox(doc, "approve", "Approve")}
          </td>

          <td>
            ${renderDecisionCheckbox(doc, "reject", "Reject")}
          </td>

          <td>
            ${renderDecisionCheckbox(doc, "revision", "Revision")}
          </td>

          <td>
            <div class="approval-row-actions">

              <button
                type="button"
                class="table-action"
                data-approval-action="detail"
                data-id="${escapeHTML(id)}">
                Detail
              </button>

              <button
                type="button"
                class="table-action"
                data-approval-action="submit"
                data-id="${escapeHTML(id)}">
                Proses
              </button>

            </div>
          </td>
        </tr>
      `;
    }).join("");
  }

  // =========================================
  // RENDER ALL
  // =========================================

  function renderAll() {
    renderStatistics();
    renderApproval();
  }

  // =========================================
  // APPROVAL TIMELINE
  // =========================================

  function renderTimeline(doc, status) {
    const currentStage = getCurrentStage(doc);

    let activeIndex = 0;

    if (status === "pending") {
      activeIndex = APPROVAL_STAGES.findIndex(
        (stage) => stage.key === currentStage
      );

      if (activeIndex < 1) activeIndex = 1;
    }

    if (status === "approved") {
      activeIndex = APPROVAL_STAGES.length;
    }

    if (
      status === "revision" ||
      status === "rejected"
    ) {
      activeIndex = 0;
    }

    return APPROVAL_STAGES.map((stage, index) => {
      let stepClass = "";
      let stepNumber = index + 1;

      if (status === "approved") {
        stepClass = "completed";
        stepNumber = "✓";

      } else if (
        status === "revision" ||
        status === "rejected"
      ) {
        if (index === 0) {
          stepClass = "current";
          stepNumber = "↻";
        }

      } else if (status === "draft") {
        if (index === 0) {
          stepClass = "current";
        }

      } else if (index < activeIndex) {
        stepClass = "completed";
        stepNumber = "✓";

      } else if (index === activeIndex) {
        stepClass = "current";
      }

      let description = stage.description;

      if (
        (status === "revision" || status === "rejected") &&
        index === 0
      ) {
        description = "Dokumen dikembalikan untuk diperbaiki";
      }

      return `
        <div class="approval-step ${stepClass}">
          <div class="step-number">${stepNumber}</div>

          <div>
            <strong>${escapeHTML(stage.name)}</strong>
            <small>${escapeHTML(description)}</small>
          </div>
        </div>
      `;
    }).join("");
  }

  // =========================================
  // DOCUMENT DETAIL
  // =========================================

  function showApprovalDetail(id) {
    const doc = documents.find(
      (item) => String(item.id) === String(id)
    );

    if (!doc) {
      showToast("Dokumen tidak ditemukan.", "error");
      return;
    }

    selectedDocument = doc;

    const status = getApprovalStatus(doc);
    const demo = approvalDemoState[String(doc.id)];
    const currentStage = getCurrentStage(doc);

    if ($("#approvalDetailSubtitle")) {
      $("#approvalDetailSubtitle").textContent =
        `${doc.docNo || "Dokumen"} • ${doc.specType}`;
    }

    const info = $("#approvalDocumentInfo");

    if (info) {
      info.innerHTML = `
        <div class="approval-info-item">
          <small>Nomor Dokumen</small>
          <strong>${escapeHTML(doc.docNo || "—")}</strong>
        </div>

        <div class="approval-info-item">
          <small>Requestor</small>
          <strong>${escapeHTML(doc.requestor || "—")}</strong>
        </div>

        <div class="approval-info-item">
          <small>Plant</small>
          <strong>${escapeHTML(doc.plant || "—")}</strong>
        </div>

        <div class="approval-info-item">
          <small>Departemen</small>
          <strong>${escapeHTML(doc.department || "—")}</strong>
        </div>

        <div class="approval-info-item">
          <small>Jenis Dokumen</small>
          <strong>${escapeHTML(doc.specType)}</strong>
        </div>

        <div class="approval-info-item">
          <small>Nama / Deskripsi</small>
          <strong>${escapeHTML(getDocumentName(doc))}</strong>
        </div>

        <div class="approval-info-item">
          <small>Status</small>
          <strong>${getApprovalBadge(status)}</strong>
        </div>

        <div class="approval-info-item">
          <small>Tanggal Disimpan</small>
          <strong>${escapeHTML(formatDate(doc.savedAt))}</strong>
        </div>

        ${
          status === "pending"
            ? `
              <div class="approval-info-item">
                <small>Menunggu Persetujuan</small>
                <strong>${escapeHTML(currentStage)}</strong>
              </div>
            `
            : ""
        }

        ${
          demo?.reason
            ? `
              <div class="approval-info-item rejection-reason">
                <small>Catatan Keputusan</small>
                <strong>${escapeHTML(demo.reason)}</strong>
              </div>
            `
            : ""
        }
      `;
    }

    if ($("#approvalSteps")) {
      $("#approvalSteps").innerHTML =
        renderTimeline(doc, status);
    }

    const canTakeAction = status === "pending";

    const approveButton = $("#approveApprovalBtn");
    const rejectButton = $("#rejectApprovalBtn");
    const revisionButton = $("#revisionApprovalBtn");

    if (approveButton) {
      approveButton.disabled = !canTakeAction;

      approveButton.textContent =
        currentStage === "Plant Head"
          ? "✓ Approve & Release"
          : "✓ Approve & Lanjutkan";
    }

    if (rejectButton) {
      rejectButton.disabled = !canTakeAction;
    }

    if (revisionButton) {
      revisionButton.disabled = !canTakeAction;
    }

    const panel = $("#approvalDetailPanel");

    if (panel) {
      panel.hidden = false;

      panel.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }
  }

  // =========================================
  // APPROVE
  // =========================================

  function approveDocument() {
    if (!selectedDocument) return;

    const id = String(selectedDocument.id);

    if (getApprovalStatus(selectedDocument) !== "pending") {
      showToast(
        "Dokumen tidak sedang menunggu approval.",
        "warning"
      );
      return;
    }

    const currentStage = getCurrentStage(selectedDocument);

    const currentIndex = APPROVAL_STAGES.findIndex(
      (stage) => stage.key === currentStage
    );

    if (currentIndex < 1) {
      showToast("Tahapan approval tidak valid.", "error");
      return;
    }

    const isFinalStage =
      currentStage === "Plant Head";

    const message = isFinalStage
      ? "Setujui dokumen ini sebagai keputusan akhir dan Release?"
      : `Setujui dokumen pada tahap ${currentStage} dan teruskan ke tahap berikutnya?`;

    if (!confirm(message)) return;

    if (isFinalStage) {
      approvalDemoState[id] = {
        status: "approved",
        currentStage: "Selesai",
        reason: "",
        updatedAt: new Date().toISOString()
      };

      showToast("Dokumen berhasil di-release.");

    } else {
      const nextStage = APPROVAL_STAGES[currentIndex + 1];

      approvalDemoState[id] = {
        status: "pending",
        currentStage: nextStage.key,
        reason: "",
        updatedAt: new Date().toISOString()
      };

      showToast(
        `Dokumen diteruskan ke ${nextStage.name}.`
      );
    }

    delete decisionSelections[id];

    renderAll();
    showApprovalDetail(id);
  }

  // =========================================
  // REJECT
  // =========================================

  function rejectDocument() {
    if (!selectedDocument) return;

    const id = String(selectedDocument.id);

    if (getApprovalStatus(selectedDocument) !== "pending") {
      showToast(
        "Dokumen tidak sedang menunggu approval.",
        "warning"
      );
      return;
    }

    const reason = prompt(
      "Masukkan alasan penolakan dokumen:"
    );

    if (reason === null) return;

    if (!reason.trim()) {
      showToast("Alasan Reject wajib diisi.", "error");
      return;
    }

    if (!confirm("Apakah kamu yakin ingin Reject dokumen ini?")) {
      return;
    }

    approvalDemoState[id] = {
      status: "rejected",
      currentStage: "Ditolak",
      reason: reason.trim(),
      updatedAt: new Date().toISOString()
    };

    delete decisionSelections[id];

    renderAll();
    showApprovalDetail(id);

    showToast("Dokumen berhasil ditolak.");
  }

  // =========================================
  // REVISION
  // =========================================

  function revisionDocument() {
    if (!selectedDocument) return;

    const id = String(selectedDocument.id);

    if (getApprovalStatus(selectedDocument) !== "pending") {
      showToast(
        "Dokumen tidak sedang menunggu approval.",
        "warning"
      );
      return;
    }

    const reason = prompt(
      "Masukkan catatan revisi untuk Requestor:"
    );

    if (reason === null) return;

    if (!reason.trim()) {
      showToast("Catatan revisi wajib diisi.", "error");
      return;
    }

    if (!confirm("Kembalikan dokumen kepada Requestor untuk direvisi?")) {
      return;
    }

    approvalDemoState[id] = {
      status: "revision",
      currentStage: "Requestor",
      reason: reason.trim(),
      updatedAt: new Date().toISOString()
    };

    delete decisionSelections[id];

    renderAll();
    showApprovalDetail(id);

    showToast("Dokumen dikembalikan untuk revisi.");
  }

  // =========================================
  // PROCESS ROW DECISION
  // =========================================

  function processRowDecision(id) {
    const doc = documents.find(
      (item) => String(item.id) === String(id)
    );

    if (!doc) return;

    const decision = decisionSelections[String(id)];

    if (!decision) {
      showToast(
        "Pilih Approve, Reject, atau Revision terlebih dahulu.",
        "warning"
      );
      return;
    }

    selectedDocument = doc;

    if (decision === "approve") {
      approveDocument();
    } else if (decision === "reject") {
      rejectDocument();
    } else if (decision === "revision") {
      revisionDocument();
    }
  }

  // =========================================
  // CLOSE DETAIL
  // =========================================

  function closeApprovalDetail() {
    selectedDocument = null;

    const panel = $("#approvalDetailPanel");

    if (panel) {
      panel.hidden = true;
    }
  }

  // =========================================
  // EVENT LISTENERS
  // =========================================

  function initializeEvents() {

    // Search
    $("#approvalSearch")?.addEventListener(
      "input",
      renderApproval
    );

    // Filter
    $("#approvalFilter")?.addEventListener(
      "change",
      renderApproval
    );

    // Checkbox keputusan
    $("#approvalRows")?.addEventListener("change", (event) => {
      const checkbox = event.target.closest(
        "input[data-decision]"
      );

      if (!checkbox) return;

      const id = String(checkbox.dataset.id);
      const decision = checkbox.dataset.decision;

      if (checkbox.checked) {
        decisionSelections[id] = decision;
      } else if (decisionSelections[id] === decision) {
        delete decisionSelections[id];
      }

      renderApproval();
    });

    // Tombol Detail dan Proses
    $("#approvalRows")?.addEventListener("click", (event) => {
      const detailButton = event.target.closest(
        "[data-approval-action='detail']"
      );

      if (detailButton) {
        showApprovalDetail(detailButton.dataset.id);
        return;
      }

      const submitButton = event.target.closest(
        "[data-approval-action='submit']"
      );

      if (submitButton) {
        processRowDecision(submitButton.dataset.id);
      }
    });

    // Tutup detail
    $("#closeApprovalDetail")?.addEventListener(
      "click",
      closeApprovalDetail
    );

    // Tombol keputusan di detail
    $("#approveApprovalBtn")?.addEventListener(
      "click",
      approveDocument
    );

    $("#rejectApprovalBtn")?.addEventListener(
      "click",
      rejectDocument
    );

    $("#revisionApprovalBtn")?.addEventListener(
      "click",
      revisionDocument
    );
  }

  // =========================================
  // INITIALIZATION
  // =========================================

  document.addEventListener("DOMContentLoaded", () => {
    initializeEvents();
    loadDocuments();
  });

})();
