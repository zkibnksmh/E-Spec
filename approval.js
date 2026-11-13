
(() => {
  "use strict";

  // =========================================
  // E-SPEC — MY E-SPEC
  // =========================================

  const API_URL = "http://localhost:3000/api/documents";
  const $ = (selector) => document.querySelector(selector);

  let documents = [];
  let loading = false;
  let myEspecStatus = "all";

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
        return parsed && typeof parsed === "object" ? parsed : {};
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

      materialCode:
        row.material_code ||
        row.materialCode ||
        formData.materialCode ||
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
          : "Barang"
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
  // DOCUMENT STATUS
  // =========================================

  function getApprovalStatus(doc) {
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
  // LOAD DOCUMENTS
  // =========================================

  async function loadDocuments() {
    loading = true;
    renderMyEspec();

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
  // STATISTICS
  // =========================================

  function renderStatistics() {
    const approved = documents.filter(
      (doc) => getApprovalStatus(doc) === "approved"
    ).length;

    const revision = documents.filter((doc) =>
      ["revision", "rejected"].includes(getApprovalStatus(doc))
    ).length;

    if ($("#myEspecListCount")) {
      $("#myEspecListCount").textContent = documents.length;
    }

    if ($("#myEspecReleaseCount")) {
      $("#myEspecReleaseCount").textContent = approved;
    }

    if ($("#myEspecRevisionCount")) {
      $("#myEspecRevisionCount").textContent = revision;
    }
  }

  // =========================================
  // FILTER MY E-SPEC
  // =========================================

  function getFilteredMyEspec() {
    const search = (
      $("#myEspecSearch")?.value || ""
    ).trim().toLowerCase();

    const typeFilter =
      $("#myEspecTypeFilter")?.value || "all";

    return documents.filter((doc) => {
      const status = getApprovalStatus(doc);

      const matchesStatus =
        myEspecStatus === "all" ||
        (
          myEspecStatus === "release" &&
          status === "approved"
        ) ||
        (
          myEspecStatus === "revision" &&
          ["revision", "rejected"].includes(status)
        );

      const matchesType =
        typeFilter === "all" ||
        doc.specType === typeFilter;

      const searchable = [
        doc.docNo,
        getDocumentName(doc),
        doc.specType,
        doc.materialCode
      ].join(" ").toLowerCase();

      return (
        matchesStatus &&
        matchesType &&
        searchable.includes(search)
      );
    });
  }

  // =========================================
  // RENDER MY E-SPEC
  // =========================================

  function renderMyEspec() {
    const rows = $("#myEspecRows");
    const empty = $("#myEspecEmptyState");
    const table = $(".my-espec-panel .table-wrap");
    const footer = $(".my-espec-panel .panel-footer");

    if (!rows) return;

    if (loading) {
      rows.innerHTML = `
        <tr>
          <td colspan="6" class="loading-state">
            Memuat dokumen...
          </td>
        </tr>
      `;

      if (empty) empty.style.display = "none";
      if (table) table.style.display = "block";
      if (footer) footer.style.display = "none";

      if ($("#myEspecResultCount")) {
        $("#myEspecResultCount").textContent = "Memuat dokumen...";
      }

      return;
    }

    const filtered = getFilteredMyEspec();

    if ($("#myEspecResultCount")) {
      $("#myEspecResultCount").textContent =
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

        if (heading) {
          heading.textContent = documents.length
            ? "Dokumen tidak ditemukan"
            : "Belum ada dokumen E-Spec";
        }

        if (description) {
          description.textContent = documents.length
            ? "Coba ubah pencarian atau filter status."
            : "Dokumen spesifikasi yang kamu buat akan ditampilkan di bagian ini.";
        }
      }

      return;
    }

    if (empty) empty.style.display = "none";
    if (table) table.style.display = "block";
    if (footer) footer.style.display = "flex";

    rows.innerHTML = filtered.map((doc) => {
      const status = getApprovalStatus(doc);

      return `
        <tr>
          <td>
            <span class="doc-number">
              ${escapeHTML(doc.docNo || "Belum ada nomor")}
            </span>

            <div class="secondary-text">
              ${escapeHTML(doc.revision || "—")}
            </div>
          </td>

          <td>${escapeHTML(doc.specType)}</td>

          <td>
            <span class="document-name">
              ${escapeHTML(getDocumentName(doc))}
            </span>
          </td>

          <td>${escapeHTML(formatDate(doc.savedAt))}</td>

          <td>${getApprovalBadge(status)}</td>

          <td>
            <button
              type="button"
              class="table-action"
              data-espec-detail="${escapeHTML(doc.id)}">
              Detail
            </button>
          </td>
        </tr>
      `;
    }).join("");
  }

  // =========================================
  // DETAIL MY E-SPEC
  // =========================================

  function showDocumentDetail(id) {
    const doc = documents.find(
      (item) => String(item.id) === String(id)
    );

    if (!doc) {
      showToast("Dokumen tidak ditemukan.", "error");
      return;
    }

    const detail = [
      `Nomor Dokumen: ${doc.docNo || "—"}`,
      `Jenis: ${doc.specType}`,
      `Nama Spesifikasi: ${getDocumentName(doc)}`,
      `Plant: ${doc.plant || "—"}`,
      `Requestor: ${doc.requestor || "—"}`,
      `Departemen: ${doc.department || "—"}`,
      `Tanggal: ${formatDate(doc.savedAt)}`,
      `Status: ${getApprovalStatus(doc)}`
    ].join("\n");

    alert(detail);
  }

  // =========================================
  // RENDER ALL
  // =========================================

  function renderAll() {
    renderStatistics();
    renderMyEspec();
  }

  // =========================================
  // EVENT LISTENERS
  // =========================================

  function initializeEvents() {
    $("#myEspecSearch")?.addEventListener(
      "input",
      renderMyEspec
    );

    $("#myEspecTypeFilter")?.addEventListener(
      "change",
      renderMyEspec
    );

    document.querySelectorAll("[data-my-status]").forEach((button) => {
      button.addEventListener("click", () => {
        myEspecStatus = button.dataset.myStatus;

        document.querySelectorAll("[data-my-status]").forEach((tab) => {
          const active = tab === button;

          tab.classList.toggle("active", active);
          tab.setAttribute("aria-pressed", String(active));
        });

        renderMyEspec();
      });
    });

    $("#myEspecRows")?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-espec-detail]");

      if (!button) return;

      showDocumentDetail(button.dataset.especDetail);
    });
  }

  // =========================================
  // INITIALIZATION
  // =========================================

  document.addEventListener("DOMContentLoaded", () => {
    initializeEvents();
    loadDocuments();
  });

})();
