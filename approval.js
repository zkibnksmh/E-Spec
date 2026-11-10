
(() => {
  "use strict";

  const API_URL = "http://localhost:3000/api/documents";

  const $ = (selector) => document.querySelector(selector);

  let documents = [];
  let selectedDocument = null;
  let loading = false;

  // =========================================
  // SIMULASI APPROVAL SEMENTARA
  // Belum disimpan ke PostgreSQL.
  // =========================================

  const approvalDemoState = {};

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

    return date.toLocaleString("id-ID", {
      dateStyle: "medium",
      timeStyle: "short"
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

    const currentStage =
      row.current_stage ||
      row.currentStage ||
      row.approval_stage ||
      formData.currentStage ||
      formData.approvalStage ||
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

      currentStage
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
      (doc.specType === "Jasa"
        ? "Tanpa nama jasa"
        : "Tanpa nama barang")
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

      renderApproval();

    } catch (error) {
      loading = false;

      console.error("Gagal memuat dokumen:", error);

      renderApproval();

      showToast(
        "Gagal memuat data. Periksa koneksi backend.",
        "error"
      );
    }
  }

  // =========================================
  // APPROVAL STATUS
  // =========================================

  function getApprovalStatus(doc) {
    const id = String(doc.id);

    // Prioritaskan status simulasi
    const demo = approvalDemoState[id];

    if (demo?.status) {
      return demo.status;
    }

    const status = normalizeText(doc.status);

    if (
      [
        "approved",
        "disetujui",
        "completed",
        "complete",
        "selesai"
      ].includes(status)
    ) {
      return "approved";
    }

    if (
      [
        "rejected",
        "reject",
        "ditolak",
        "revision",
        "perlu revisi",
        "returned",
        "dikembalikan"
      ].includes(status)
    ) {
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

    if (
      rawStage.includes("engineering")
    ) {
      return "Head Engineering";
    }

    if (rawStage.includes("manager")) {
      return "Manager";
    }

    return "Manager";
  }

  function getApprovalStage(doc) {
    const status = getApprovalStatus(doc);

    if (status === "approved") {
      return "Selesai";
    }

    if (status === "rejected") {
      return "Kembali ke Requestor";
    }

    if (status === "draft") {
      return "Belum Diajukan";
    }

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
          Disetujui
        </span>
      `,

      rejected: `
        <span class="approval-status rejected">
          Perlu Revisi
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

    const approved = documents.filter(
      (doc) => getApprovalStatus(doc) === "approved"
    ).length;

    const rejected = documents.filter(
      (doc) => getApprovalStatus(doc) === "rejected"
    ).length;

    if ($("#pendingApprovalCount")) {
      $("#pendingApprovalCount").textContent = pending;
    }

    if ($("#approvedCount")) {
      $("#approvedCount").textContent = approved;
    }

    if ($("#rejectedCount")) {
      $("#rejectedCount").textContent = rejected;
    }

    if ($("#approvalNavCount")) {
      $("#approvalNavCount").textContent = pending;
    }
  }

  // =========================================
  // FILTER DOCUMENTS
  // =========================================

  function getFilteredDocuments() {
    const search = ($("#approvalSearch")?.value || "")
      .trim()
      .toLowerCase();

    const filter = $("#approvalFilter")?.value || "all";

    return documents.filter((doc) => {
      const status = getApprovalStatus(doc);

      const searchable = [
        doc.docNo,
        doc.requestor,
        doc.plant,
        doc.department,
        doc.specType,
        getDocumentName(doc),
        doc.materialCode
      ].join(" ").toLowerCase();

      const matchesSearch = searchable.includes(search);

      const matchesStatus =
        filter === "all" || status === filter;

      return matchesSearch && matchesStatus;
    });
  }

  // =========================================
  // RENDER TABLE
  // =========================================

  function renderApproval() {
    renderStatistics();

    const rows = $("#approvalRows");
    const emptyState = $("#approvalEmptyState");
    const tableWrap = $(".approval-table-wrap");
    const footer = $(".approval-panel .panel-footer");

    if (!rows) return;

    const filteredDocuments = getFilteredDocuments();

    if (loading) {
      rows.innerHTML = `
        <tr>
          <td colspan="6" class="loading-state">
            Memuat dokumen...
          </td>
        </tr>
      `;

      if (emptyState) emptyState.style.display = "none";
      if (tableWrap) tableWrap.style.display = "block";
      if (footer) footer.style.display = "none";

      if ($("#approvalResultCount")) {
        $("#approvalResultCount").textContent =
          "Memuat dokumen...";
      }

      return;
    }

    if ($("#approvalResultCount")) {
      $("#approvalResultCount").textContent =
        `Menampilkan ${filteredDocuments.length} dokumen`;
    }

    if (!filteredDocuments.length) {
      rows.innerHTML = "";

      if (emptyState) {
        emptyState.style.display = "block";

        const heading = emptyState.querySelector("h3");
        const description = emptyState.querySelector("p");

        const hasFilter =
          ($("#approvalSearch")?.value || "").trim() !== "" ||
          ($("#approvalFilter")?.value || "all") !== "all";

        if (heading) {
          heading.textContent = hasFilter
            ? "Dokumen tidak ditemukan"
            : "Belum ada dokumen Approval";
        }

        if (description) {
          description.textContent = hasFilter
            ? "Coba kata pencarian atau filter yang berbeda."
            : "Dokumen yang masuk ke proses persetujuan akan tampil di sini.";
        }
      }

      if (tableWrap) tableWrap.style.display = "none";
      if (footer) footer.style.display = "none";

      return;
    }

    if (emptyState) emptyState.style.display = "none";
    if (tableWrap) tableWrap.style.display = "block";
    if (footer) footer.style.display = "flex";

    rows.innerHTML = filteredDocuments.map((doc) => {
      const status = getApprovalStatus(doc);
      const stage = getApprovalStage(doc);

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

          <td>
            ${escapeHTML(doc.requestor || "—")}
          </td>

          <td>
            ${escapeHTML(doc.plant || "—")}
          </td>

          <td>
            <span class="approval-stage-label">
              ${escapeHTML(stage)}
            </span>
          </td>

          <td>
            ${getApprovalBadge(status)}
          </td>

          <td>
            <button
              type="button"
              class="table-action"
              data-approval-action="detail"
              data-id="${escapeHTML(doc.id)}">
              Tinjau
            </button>
          </td>
        </tr>
      `;
    }).join("");
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

    if (status === "rejected") {
      activeIndex = 0;
    }

    return APPROVAL_STAGES.map((stage, index) => {
      let stepClass = "";
      let stepNumber = index + 1;

      if (status === "approved") {
        stepClass = "completed";
        stepNumber = "✓";

      } else if (status === "rejected") {
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

      if (status === "rejected" && index === 0) {
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
  // APPROVAL DETAIL
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

    // Informasi dokumen
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
          status === "rejected" && demo?.reason
            ? `
              <div class="approval-info-item rejection-reason">
                <small>Alasan Revisi</small>
                <strong>${escapeHTML(demo.reason)}</strong>
              </div>
            `
            : ""
        }
      `;
    }

    // Timeline
    if ($("#approvalSteps")) {
      $("#approvalSteps").innerHTML =
        renderTimeline(doc, status);
    }

    // Tombol keputusan
    const canTakeAction = status === "pending";

    const approveButton = $("#approveApprovalBtn");
    const rejectButton = $("#rejectApprovalBtn");

    if (approveButton) {
      approveButton.disabled = !canTakeAction;

      approveButton.textContent =
        status === "pending" && currentStage === "Plant Head"
          ? "✓ Approve & Selesaikan"
          : "✓ Approve & Lanjutkan";
    }

    if (rejectButton) {
      rejectButton.disabled = !canTakeAction;
    }

    // Tampilkan detail
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
  // APPROVE DOCUMENT
  // SIMULASI BERTAHAP
  // =========================================

  function approveDocument() {
    if (!selectedDocument) return;

    const id = String(selectedDocument.id);
    const status = getApprovalStatus(selectedDocument);

    if (status !== "pending") {
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

    const confirmationMessage = isFinalStage
      ? "Apakah Anda yakin ingin menyetujui dokumen ini sebagai keputusan akhir?"
      : `Apakah Anda yakin ingin menyetujui dokumen pada tahap ${currentStage} dan meneruskan ke tahap berikutnya?`;

    if (!confirm(confirmationMessage)) return;

    if (isFinalStage) {
      approvalDemoState[id] = {
        status: "approved",
        currentStage: "Selesai",
        reason: "",
        updatedAt: new Date().toISOString()
      };

      showToast(
        "Simulasi berhasil: dokumen telah disetujui."
      );

    } else {
      const nextStage = APPROVAL_STAGES[currentIndex + 1];

      approvalDemoState[id] = {
        status: "pending",
        currentStage: nextStage.key,
        reason: "",
        updatedAt: new Date().toISOString()
      };

      showToast(
        `Simulasi berhasil: dokumen diteruskan ke ${nextStage.name}.`
      );
    }

    renderApproval();
    showApprovalDetail(id);
  }

  // =========================================
  // REJECT DOCUMENT
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

    const currentStage = getCurrentStage(selectedDocument);

    const reason = prompt(
      `Masukkan alasan pengembalian dokumen oleh ${currentStage}:`
    );

    if (reason === null) return;

    if (!reason.trim()) {
      showToast("Alasan revisi wajib diisi.", "error");
      return;
    }

    approvalDemoState[id] = {
      status: "rejected",
      currentStage: "Requestor",
      reason: reason.trim(),
      updatedAt: new Date().toISOString()
    };

    renderApproval();
    showApprovalDetail(id);

    showToast(
      "Dokumen dikembalikan ke Requestor untuk diperbaiki."
    );
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
    // Pencarian
    $("#approvalSearch")?.addEventListener(
      "input",
      renderApproval
    );

    // Filter
    $("#approvalFilter")?.addEventListener(
      "change",
      renderApproval
    );

    // Tombol tinjau
    $("#approvalRows")?.addEventListener("click", (event) => {
      const button = event.target.closest(
        "[data-approval-action='detail']"
      );

      if (!button) return;

      showApprovalDetail(button.dataset.id);
    });

    // Tutup detail
    $("#closeApprovalDetail")?.addEventListener(
      "click",
      closeApprovalDetail
    );

    // Approve
    $("#approveApprovalBtn")?.addEventListener(
      "click",
      approveDocument
    );

    // Reject
    $("#rejectApprovalBtn")?.addEventListener(
      "click",
      rejectDocument
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
