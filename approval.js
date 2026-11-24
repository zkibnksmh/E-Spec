
(() => {
  "use strict";

  // =====================================================
  // E-SPEC — MY E-SPEC
  // FRONTEND VERSION (TANPA BACKEND)
  // =====================================================

  const $ = (selector, parent = document) =>
    parent.querySelector(selector);

  const API_BASE_URL = window.ESpecDevAuth?.getApiBaseUrl?.() ||
    window.ESPEC_CONFIG?.API_BASE_URL || "http://localhost:3001/api";
  const getApiHeaders = () => window.ESpecDevAuth?.getApiHeaders?.() || {
    "Content-Type": "application/json"
  };

  let documents = [];
  let myEspecStatus = "all";

  // =====================================================
  // HELPER
  // =====================================================

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
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

  // =====================================================
  // DOCUMENT NAME
  // =====================================================

  function getDocumentName(doc) {
    const data = doc.formData || doc;

    return (
      doc.materialDescription ||
      data.materialDescription ||
      data.serviceName ||
      data.serviceDescription ||
      data.serviceTitle ||
      data.namaJasa ||
      data.namaLayanan ||
      (doc.specType === "Jasa"
        ? "Tanpa nama jasa"
        : "Tanpa nama barang")
    );
  }

  // =====================================================
  // DOCUMENT STATUS
  // =====================================================

  function getApprovalStatus(doc) {
    const status = normalizeText(
      doc.status || doc.approvalStatus || "Draft"
    );

    if ([
      "approved",
      "disetujui",
      "completed",
      "complete",
      "selesai",
      "release",
      "released"
    ].includes(status)) {
      return "released";
    }

    if ([
      "revision",
      "revision required",
      "revisi",
      "need revision",
      "perlu revisi",
      "returned",
      "dikembalikan",
      "rejected",
      "reject",
      "ditolak"
    ].includes(status)) {
      return "revision";
    }


    if (
      status.includes("waiting") ||
      status.includes("pending") ||
      status.includes("menunggu") ||
      status === "in approval" ||
      status === "submitted" ||
      status === "diajukan"
    ) {
      return "pending";
    }

    return "draft";
  }

  // =====================================================
  // STATUS BADGE
  // =====================================================

  function getApprovalBadge(status) {
    const badges = {
      draft: `
        <span class="approval-status draft">
          Draft
        </span>
      `,

      pending: `
        <span class="approval-status pending">
          Waiting Approval
        </span>
      `,

      revision: `
        <span class="approval-status rejected">
          Need Revision
        </span>
      `,

      released: `
        <span class="approval-status approved">
          Released
        </span>
      `
    };

    return badges[status] || badges.draft;
  }

  // =====================================================
  // PROGRESS APPROVER / CATATAN REVISI
  // =====================================================

  function getProgressContent(doc, status) {
    const data = doc.formData || doc;

    const revisionNote =
      doc.revisionNote ||
      doc.revision_note ||
      doc.rejectionReason ||
      doc.rejection_reason ||
      data.revisionNote ||
      data.revision_note ||
      data.rejectionReason ||
      "";

    const approvalProgress =
      doc.approvalProgress ||
      doc.approval_progress ||
      data.approvalProgress ||
      data.approval_progress ||
      "";

    if (status === "draft") {
      return `
        <div class="my-espec-progress">
          Belum diajukan
          <small>Dokumen masih dalam tahap Draft</small>
        </div>
      `;
    }

    if (status === "pending") {
      return `
        <div class="my-espec-progress">
          ${escapeHTML(approvalProgress || "Menunggu approver")}
          <small>Proses persetujuan sedang berjalan</small>
        </div>
      `;
    }

    if (status === "revision") {
      return `
        <div class="my-espec-progress revision-note">
          ${escapeHTML(revisionNote || "Belum ada catatan revisi")}
          <small>Dokumen memerlukan perbaikan</small>
        </div>
      `;
    }

    if (status === "released") {
      return `
        <div class="my-espec-progress completed-note">
          Approval selesai
          <small>Dokumen telah Released</small>
        </div>
      `;
    }

    return `
      <div class="my-espec-progress">
        —
      </div>
    `;
  }

  // =====================================================
  // FILTER DOCUMENTS
  // =====================================================

  function getFilteredMyEspec() {
    const search = normalizeText(
      $("#myEspecSearch")?.value || ""
    );

    return documents.filter(doc => {
      const status = getApprovalStatus(doc);

      const matchesStatus =
        myEspecStatus === "all" ||
        (myEspecStatus === "draft" && status === "draft") ||
        (myEspecStatus === "pending" && status === "pending") ||
        (myEspecStatus === "revision" && status === "revision");

      const searchable = normalizeText([
        doc.docNo,
        doc.doc_no,
        doc.revision,
        getDocumentName(doc),
        doc.materialCode,
        doc.material_code
      ].join(" "));

      return matchesStatus && searchable.includes(search);
    });
  }

  // =====================================================
  // RENDER STATUS TABS
  // =====================================================

  function renderStatusTabs() {
    document.querySelectorAll("[data-my-status]").forEach(button => {
      const active = button.dataset.myStatus === myEspecStatus;

      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }

  // =====================================================
  // RENDER TABLE
  // =====================================================

  
function renderMyEspec() {
  const rows = $("#myEspecRows");
  const empty = $("#myEspecEmptyState");
  const table = $(".my-espec-table-wrap");
  const footer = $(".my-espec-footer");

  if (!rows) return;

  const filtered = getFilteredMyEspec();

  if ($("#myEspecResultCount")) {
    $("#myEspecResultCount").textContent =
      `Menampilkan ${filtered.length} dokumen`;
  }

  // TABEL TETAP DITAMPILKAN
  if (table) table.style.display = "block";
  if (footer) footer.style.display = "flex";

  // EMPTY STATE
  if (filtered.length === 0) {
    rows.innerHTML = "";

    if (empty) {
      empty.style.display = "block";

      const heading = $("h3", empty);
      const description = $("p", empty);

      if (documents.length === 0) {
        if (heading) {
          heading.textContent =
            "Belum ada dokumen E-Spec yang dibuat";
        }

        if (description) {
          description.innerHTML =
            'Klik tombol <strong>+ Buat Spesifikasi</strong> ' +
            'untuk membuat pengajuan spesifikasi baru.';
        }
      } else {
        if (heading) {
          heading.textContent = "Dokumen tidak ditemukan";
        }

        if (description) {
          description.textContent =
            "Coba ubah kata pencarian atau pilih status lainnya.";
        }
      }
    }

    return;
  }

  if (empty) empty.style.display = "none";

  // RENDER DATA
  rows.innerHTML = filtered.map((doc) => {
    const status = getApprovalStatus(doc);
    const data = doc.formData || doc.form_data || doc;

    const category =
      doc.category ||
      data.category ||
      data.materialCategory ||
      data.materialGroup ||
      (normalizeText(doc.specType).includes("jasa")
        ? "Jasa"
        : "Barang");

    const requestor =
      doc.requestor ||
      data.requestor ||
      "—";

    const department =
      doc.department ||
      data.department ||
      "—";

    const documentName = getDocumentName(doc);

    return `
      <tr>
        <td>
          ${escapeHTML(category)}
        </td>

        <td>
          <span class="document-name">
            ${escapeHTML(documentName)}
          </span>
        </td>

        <td>
          ${escapeHTML(requestor)}
        </td>

        <td>
          ${escapeHTML(department)}
        </td>

        <td>
          ${getApprovalBadge(status)}
        </td>

        <td>
          ${status === "draft" || status === "revision"
            ? `<button type="button" class="table-action" data-espec-action="resume" data-espec-id="${escapeHTML(doc.id)}">Resume / Edit</button>`
            : `<button type="button" class="table-action" data-espec-action="print" data-espec-id="${escapeHTML(doc.id)}">View / Print</button>`}
          <button type="button" class="table-action" data-espec-action="history" data-espec-id="${escapeHTML(doc.id)}">History</button>
        </td>
      </tr>
    `;
  }).join("");
}


  // =====================================================
  // DOCUMENT DETAIL
  // =====================================================

  function showDocumentDetail(id) {
    const doc = documents.find(
      item => String(item.id) === String(id)
    );

    if (!doc) return;

    const status = getApprovalStatus(doc);

    const detail = [
      `Nomor Dokumen: ${doc.docNo || doc.doc_no || "—"}`,
      `Versi: ${doc.revision || "—"}`,
      `Nama Spesifikasi: ${getDocumentName(doc)}`,
      `Jenis: ${doc.specType || "—"}`,
      `Status: ${status}`,
      `Tanggal: ${formatDate(doc.savedAt || doc.createdAt || doc.created_at)}`,
      `Progress / Catatan: ${
        doc.revisionNote ||
        doc.revision_note ||
        doc.approvalProgress ||
        doc.approval_progress ||
        "—"
      }`
    ].join("\n");

    alert(detail);
  }

  async function showWorkflowHistory(doc) {
    try {
      const response = await fetch(
        `${API_BASE_URL.replace(/\/$/, "")}/specifications/${encodeURIComponent(doc.id)}/workflow`,
        { headers: getApiHeaders() }
      );
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.success !== true) {
        throw new Error(result.message || "Riwayat workflow tidak dapat dimuat.");
      }

      const workflow = result.data || {};
      const lines = [
        `Nomor Dokumen: ${doc.docNo || doc.documentNo || "—"}`,
        `Status: ${workflow.status || doc.status || "—"}`,
        "",
        "RIWAYAT APPROVAL"
      ];
      const cycles = Array.isArray(workflow.cycles) ? workflow.cycles : [];
      if (!cycles.length) lines.push("Belum ada siklus approval.");

      cycles.forEach((cycle) => {
        lines.push(`Siklus ${cycle.cycleno} — ${cycle.status}`);
        (cycle.steps || []).forEach((step) => {
          lines.push(`  Step ${step.stepno}: ${step.approverrole || step.approvername || "Approver"} — ${step.approvalstatus}`);
          if (step.comments) lines.push(`  Catatan: ${step.comments}`);
        });
        (cycle.events || []).forEach((item) => {
          if (item.comments) lines.push(`  ${item.eventtype}: ${item.comments}`);
        });
      });

      alert(lines.join("\n"));
    } catch (error) {
      alert(error.message || "Gagal memuat riwayat approval.");
    }
  }

  // =====================================================
  // EVENTS
  // =====================================================

  function initializeEvents() {
    // SEARCH
    $("#myEspecSearch")?.addEventListener(
      "input",
      renderMyEspec
    );

    // STATUS TABS
    document.querySelectorAll("[data-my-status]").forEach(button => {
      button.addEventListener("click", () => {
        myEspecStatus = button.dataset.myStatus;

        renderStatusTabs();
        renderMyEspec();
      });
    });

    // DOCUMENT ACTIONS
    $("#myEspecRows")?.addEventListener("click", async event => {
      const button = event.target.closest("[data-espec-action]");
      if (!button) return;

      const doc = documents.find((item) =>
        String(item.id) === String(button.dataset.especId)
      );
      if (!doc) return;

      const action = button.dataset.especAction;
      if (action === "resume") {
        const page = normalizeText(doc.specType).includes("jasa") ? "jasa.html" : "barang.html";
        const url = new URL(page, window.location.href);
        url.searchParams.set("resumeId", doc.id);
        window.location.href = url.toString();
        return;
      }

      if (action === "print") {
        window.ESpecDocumentWorkspace?.openPrintPreview?.(doc);
        return;
      }

      if (action === "history") {
        await showWorkflowHistory(doc);
      }
    });
  }

  // =====================================================
  // INITIALIZATION
  // =====================================================

  async function loadMyDocuments() {
    const rows = $("#myEspecRows");
    if (rows) rows.innerHTML = '<tr><td colspan="6">Memuat dokumen...</td></tr>';

    try {
      const response = await fetch(`${API_BASE_URL.replace(/\/$/, "")}/specifications/my-documents`, {
        headers: getApiHeaders()
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.success !== true) {
        throw new Error(result.message || `Gagal memuat dokumen (HTTP ${response.status}).`);
      }

      documents = (Array.isArray(result.data) ? result.data : []).map((item) => ({
        ...item,
        docNo: item.documentNo || item.document_no || "-",
        revision: item.revisionNo || item.revision_no || "-",
        specType: item.specificationTypeName || item.specification_type_name || item.specificationTypeCode || "Barang",
        materialDescription: item.materialDescription || item.material_description || "",
        materialCode: item.materialCode || item.material_code || "",
        createdAt: item.createdAt || item.created_at || null,
        submittedAt: item.submittedAt || item.submitted_at || null
      }));
      renderStatusTabs();
      renderMyEspec();
    } catch (error) {
      console.error("Gagal memuat My E-Spec:", error);
      documents = [];
      renderMyEspec();
      alert(error.message || "Gagal memuat dokumen dari server.");
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    initializeEvents();
    renderStatusTabs();
    Promise.resolve(window.ESpecRoleNav?.ready).then((profile) => {
      if (profile) loadMyDocuments();
    });
  });

})();
