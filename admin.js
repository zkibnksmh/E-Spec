
(() => {
  "use strict";

  const API_URL = "http://localhost:3000/api/documents";

  let documents = [];
  let activeType = "barang";
  let selectedDocumentIndex = null;

  const $ = (id) => document.getElementById(id);

  // =========================================
  // HELPER
  // =========================================

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    })[char]);
  }

  function normalizeType(value) {
    const type = String(value ?? "").trim().toLowerCase();
    return type.includes("jasa") ? "jasa" : "barang";
  }

  function formatDate(value) {
    if (!value) return "-";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "-";

    return date.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "long",
      year: "numeric"
    });
  }

  function showToast(message, type = "success") {
    const toast = $("toast");

    if (!toast) {
      alert(message);
      return;
    }

    toast.textContent = message;
    toast.className = `toast show ${type}`;

    clearTimeout(showToast.timer);

    showToast.timer = setTimeout(() => {
      toast.className = "toast";
    }, 3000);
  }

  function getFormData(doc) {
    let data = doc.form_data ?? doc.formData ?? {};

    if (typeof data === "string") {
      try {
        data = JSON.parse(data);
      } catch (error) {
        console.error("Format form_data tidak valid:", error);
        data = {};
      }
    }

    return data && typeof data === "object" && !Array.isArray(data)
      ? data
      : {};
  }

  // =========================================
  // NORMALIZE DOCUMENT
  // =========================================

  function normalizeDocument(doc) {
    const formData = getFormData(doc);

    const rawType =
      doc.spec_type ||
      doc.specType ||
      doc.document_type ||
      formData.specType ||
      formData.documentType ||
      formData.jenisDokumen ||
      formData.formType ||
      formData.type ||
      (
        formData.serviceName ||
        formData.serviceDescription ||
        formData.serviceGroup
          ? "jasa"
          : "barang"
      );

    return {
      ...doc,

      formData,

      id: doc.id ?? doc.document_id ?? null,

      docNo:
        doc.doc_no ||
        doc.docNo ||
        formData.docNo ||
        "-",

      revision:
        doc.revision ||
        formData.revision ||
        "-",

      plant:
        doc.plant ||
        formData.plant ||
        "-",

      requestor:
        doc.requestor ||
        formData.requestor ||
        "-",

      department:
        doc.department ||
        formData.department ||
        "-",

      materialDescription:
        doc.material_description ||
        doc.materialDescription ||
        formData.materialDescription ||
        formData.serviceDescription ||
        formData.serviceName ||
        formData.namaJasa ||
        "-",

      materialCode:
        doc.material_code ||
        doc.materialCode ||
        formData.materialCode ||
        "-",

      createdAt:
        doc.created_at ||
        doc.saved_at ||
        doc.createdAt ||
        formData.createdDate ||
        null,

      status:
        doc.status ||
        "Draft",

      specType: normalizeType(rawType)
    };
  }

  function getDocumentType(doc) {
    return normalizeType(
      doc.specType ||
      doc.spec_type ||
      doc.document_type ||
      doc.formData?.specType ||
      doc.formData?.documentType ||
      doc.formData?.jenisDokumen ||
      doc.formData?.formType ||
      doc.formData?.type ||
      ""
    );
  }

  // =========================================
  // LOAD DATA
  // =========================================

  async function loadDocuments() {
    const rows = $("documentRows");

    if (rows) {
      rows.innerHTML = `
        <tr>
          <td colspan="5" class="loading-state">
            Memuat data dokumen...
          </td>
        </tr>
      `;
    }

    try {
      const response = await fetch(API_URL);

      if (!response.ok) {
        throw new Error(`Gagal mengambil data. HTTP ${response.status}`);
      }

      const result = await response.json();

      // Mendukung beberapa format respons backend
      let rawDocuments = [];

      if (Array.isArray(result)) {
        rawDocuments = result;
      } else if (Array.isArray(result.data)) {
        rawDocuments = result.data;
      } else if (Array.isArray(result.documents)) {
        rawDocuments = result.documents;
      } else if (Array.isArray(result.rows)) {
        rawDocuments = result.rows;
      }

      documents = rawDocuments.map(normalizeDocument);

      renderDashboard();

    } catch (error) {
      console.error("Load documents error:", error);

      if (rows) {
        rows.innerHTML = `
          <tr>
            <td colspan="5" class="empty-message">
              Gagal memuat data dokumen.
            </td>
          </tr>
        `;
      }

      showToast("Gagal memuat data dari server.", "error");
    }
  }

  // =========================================
  // STATISTICS
  // =========================================

  function renderStatistics() {
    const today = new Date().toDateString();

    const total = documents.length;

    const todayTotal = documents.filter((doc) => {
      if (!doc.createdAt) return false;

      return new Date(doc.createdAt).toDateString() === today;
    }).length;

    const latest = [...documents].sort((a, b) => {
      return new Date(b.createdAt || 0) -
        new Date(a.createdAt || 0);
    })[0];

    if ($("totalCount")) {
      $("totalCount").textContent = total;
    }

    if ($("todayCount")) {
      $("todayCount").textContent = todayTotal;
    }

    if ($("latestDate")) {
      $("latestDate").textContent = latest
        ? formatDate(latest.createdAt)
        : "-";
    }

    if ($("latestName")) {
      $("latestName").textContent = latest
        ? latest.requestor
        : "-";
    }
  }

  // =========================================
  // DOCUMENT TYPE SWITCH
  // =========================================

  function getTypeButtons() {
    return document.querySelectorAll(
      "[data-document-type], [data-type]"
    );
  }

  function setActiveType(type) {
    activeType = normalizeType(type);

    getTypeButtons().forEach((button) => {
      const buttonType = normalizeType(
        button.dataset.documentType ||
        button.dataset.type
      );

      const isActive = buttonType === activeType;

      button.classList.toggle("active", isActive);
      button.setAttribute("aria-pressed", String(isActive));
    });

    const nameColumn = $("nameColumn");
    const tableDescription = $("tableDescription");
    const searchInput = $("searchInput");
    const emptyHeading = $("emptyState")?.querySelector("h3");

    if (nameColumn) {
      nameColumn.textContent = activeType === "jasa"
        ? "NAMA / JENIS JASA"
        : "MATERIAL / BARANG";
    }

    if (tableDescription) {
      tableDescription.textContent = activeType === "jasa"
        ? "Daftar dokumen spesifikasi jasa yang tersimpan."
        : "Daftar dokumen spesifikasi barang yang tersimpan.";
    }

    if (searchInput) {
      searchInput.placeholder = activeType === "jasa"
        ? "Cari jasa atau requestor..."
        : "Cari barang atau requestor...";
    }

    if (emptyHeading) {
      emptyHeading.textContent =
        `Belum ada dokumen ${activeType === "jasa" ? "Jasa" : "Barang"}`;
    }

    renderTable();
  }

  // =========================================
  // FILTER DATA
  // =========================================

  function getFilteredDocuments() {
    const search = ($("searchInput")?.value || "")
      .trim()
      .toLowerCase();

    const filter = $("filterSelect")?.value || "all";

    return documents.filter((doc) => {
      const matchesType = getDocumentType(doc) === activeType;

      const searchable = [
        doc.docNo,
        doc.requestor,
        doc.department,
        doc.plant,
        doc.materialDescription,
        doc.materialCode
      ].join(" ").toLowerCase();

      const matchesSearch = searchable.includes(search);

      const matchesDate =
        filter !== "today" ||
        (
          doc.createdAt &&
          new Date(doc.createdAt).toDateString() ===
          new Date().toDateString()
        );

      return matchesType && matchesSearch && matchesDate;
    });
  }

  // =========================================
  // STATUS BADGE
  // =========================================

  function getStatusBadge(status) {
    const normalized = String(status || "Draft").toLowerCase();

    let className = "status-draft";

    if (
      normalized.includes("approved") ||
      normalized.includes("disetujui")
    ) {
      className = "status-approved";

    } else if (
      normalized.includes("reject") ||
      normalized.includes("ditolak")
    ) {
      className = "status-rejected";

    } else if (
      normalized.includes("waiting") ||
      normalized.includes("pending") ||
      normalized.includes("menunggu")
    ) {
      className = "status-pending";
    }

    return `
      <span class="status-badge ${className}">
        ${escapeHTML(status)}
      </span>
    `;
  }

  // =========================================
  // RENDER TABLE
  // =========================================

  function renderTable() {
    const rows = $("documentRows");
    const emptyState = $("emptyState");
    const resultCount = $("resultCount");

    if (!rows) return;

    const filteredDocuments = getFilteredDocuments();

    if (resultCount) {
      resultCount.textContent =
        `${filteredDocuments.length} dokumen`;
    }

    if (!filteredDocuments.length) {
      rows.innerHTML = "";

      if (emptyState) {
        emptyState.style.display = "block";
      }

      return;
    }

    if (emptyState) {
      emptyState.style.display = "none";
    }

    rows.innerHTML = filteredDocuments.map((doc) => {
      const index = documents.indexOf(doc);

      const typeLabel = getDocumentType(doc) === "jasa"
        ? "Spesifikasi Jasa"
        : (doc.materialCode || "Spesifikasi Barang");

      return `
        <tr>
          <td>
            <strong class="doc-number">
              ${escapeHTML(doc.docNo)}
            </strong>
            <small>Rev. ${escapeHTML(doc.revision)}</small>
          </td>

          <td>
            <strong class="material-name">
              ${escapeHTML(doc.materialDescription)}
            </strong>
            <small class="secondary-text">
              ${escapeHTML(typeLabel)}
            </small>
          </td>

          <td>${escapeHTML(doc.requestor)}</td>

          <td>${formatDate(doc.createdAt)}</td>

          <td>
            <div class="table-actions">
              <button
                type="button"
                class="action-btn"
                data-action="detail"
                data-index="${index}">
                Detail
              </button>

              <button
                type="button"
                class="action-btn"
                data-action="json"
                data-index="${index}">
                JSON
              </button>

              <button
                type="button"
                class="action-btn"
                data-action="print"
                data-index="${index}">
                PDF
              </button>

              <button
                type="button"
                class="action-btn delete-action"
                data-action="delete"
                data-index="${index}">
                Hapus
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join("");
  }

  function renderDashboard() {
    renderStatistics();
    renderTable();
  }

  // =========================================
  // DETAIL DOCUMENT
  // =========================================

  function showDetail(index) {
  const doc = documents[index];

  if (!doc) return;

  const modal = $("detailModal");
  const detailContent = $("detailContent");

  if (!modal || !detailContent) return;

  selectedDocumentIndex = index;

  const documentType = getDocumentType(doc);
  const materialLabel = documentType === "jasa"
    ? "NAMA / JENIS JASA"
    : "MATERIAL / BARANG";

  if ($("detailTitle")) {
    $("detailTitle").textContent = "Detail Dokumen";
  }

  detailContent.innerHTML = `
    <div class="detail-table-wrapper">
      <table class="detail-table">
        <thead>
          <tr>
            <th>NO. DOKUMEN</th>
            <th>${materialLabel}</th>
            <th>REQUESTOR</th>
            <th>TANGGAL DISIMPAN</th>
          </tr>
        </thead>

        <tbody>
          <tr>
            <td>
              <strong>${escapeHTML(doc.docNo)}</strong>
            </td>

            <td>
              ${escapeHTML(doc.materialDescription)}
            </td>

            <td>
              ${escapeHTML(doc.requestor)}
            </td>

            <td>
              ${formatDate(doc.createdAt)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  `;

  modal.classList.add("show");
  modal.style.display = "flex";
}

  function closeDetail() {
    const modal = $("detailModal");

    if (!modal) return;

    modal.classList.remove("show");
    modal.style.display = "none";

    selectedDocumentIndex = null;
  }

  // =========================================
  // EXPORT JSON
  // =========================================

  function downloadJSON(data, filename) {
    const blob = new Blob(
      [JSON.stringify(data, null, 2)],
      { type: "application/json" }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = filename;

    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportSingleDocument(index) {
    const doc = documents[index];

    if (!doc) return;

    downloadJSON(
      doc,
      `${String(doc.docNo).replaceAll("/", "-")}.json`
    );

    showToast("Dokumen berhasil diekspor.");
  }

  function exportAllDocuments() {
    downloadJSON(documents, "e-spec-data.json");
    showToast("Semua data berhasil diekspor.");
  }

  // =========================================
  // PRINT DOCUMENT
  // =========================================

  function printDocument(index) {
    const doc = documents[index];

    if (!doc) return;

    if (!doc.id) {
      showToast("ID dokumen tidak ditemukan.", "error");
      return;
    }

    const type = getDocumentType(doc);

    const page = type === "jasa"
      ? "jasa.html"
      : "barang.html";

    const params = new URLSearchParams({
      printId: doc.id
    });

    window.open(
      `${page}?${params.toString()}`,
      "_blank"
    );
  }

  // =========================================
  // DELETE DOCUMENT
  // =========================================

  async function deleteDocument(index) {
    const doc = documents[index];

    if (!doc || !doc.id) {
      showToast("ID dokumen tidak ditemukan.", "error");
      return;
    }

    const confirmed = confirm(
      `Apakah Anda yakin ingin menghapus dokumen ${doc.docNo}?`
    );

    if (!confirmed) return;

    try {
      const response = await fetch(`${API_URL}/${encodeURIComponent(doc.id)}`, {
        method: "DELETE"
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          result.message || "Gagal menghapus dokumen."
        );
      }

      showToast("Dokumen berhasil dihapus.");

      await loadDocuments();

    } catch (error) {
      console.error("Delete document error:", error);

      showToast(
        error.message || "Gagal menghapus dokumen.",
        "error"
      );
    }
  }

  // =========================================
  // IMPORT JSON
  // =========================================

  async function importDocuments(file) {
    if (!file) return;

    try {
      const text = await file.text();
      const importedData = JSON.parse(text);

      const importedDocuments = Array.isArray(importedData)
        ? importedData
        : [importedData];

      if (!importedDocuments.length) {
        throw new Error("File JSON tidak memiliki data.");
      }

      // Import database belum diaktifkan karena
      // endpoint import belum tersedia di backend.
      showToast(
        "File JSON valid. Fitur impor ke database belum diaktifkan.",
        "warning"
      );

    } catch (error) {
      console.error("Import error:", error);
      showToast("File JSON tidak valid.", "error");
    }
  }

  // =========================================
  // EVENT LISTENERS
  // =========================================

  function initializeEvents() {

    // Tombol Barang dan Jasa
    getTypeButtons().forEach((button) => {
      button.addEventListener("click", (event) => {
        event.preventDefault();

        const type =
          button.dataset.documentType ||
          button.dataset.type;

        setActiveType(type);
      });
    });

    $("searchInput")?.addEventListener("input", renderTable);
    $("filterSelect")?.addEventListener("change", renderTable);

    $("exportOneBtn")?.addEventListener("click", () => {
      if (selectedDocumentIndex !== null) {
        exportSingleDocument(selectedDocumentIndex);
      }
    });

    $("closeModalBottom")?.addEventListener("click", closeDetail);
    $("closeModal")?.addEventListener("click", closeDetail);

    $("documentRows")?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-action]");

      if (!button) return;

      const index = Number(button.dataset.index);
      const action = button.dataset.action;

      if (action === "detail") {
        showDetail(index);

      } else if (action === "json") {
        exportSingleDocument(index);

      } else if (action === "print") {
        printDocument(index);

      } else if (action === "delete") {
        deleteDocument(index);
      }
    });

    $("detailModal")?.addEventListener("click", (event) => {
      if (event.target === $("detailModal")) {
        closeDetail();
      }
    });

    $("exportBtn")?.addEventListener("click", exportAllDocuments);

    $("importBtn")?.addEventListener("click", () => {
      $("importFile")?.click();
    });

    $("importFile")?.addEventListener("change", (event) => {
      importDocuments(event.target.files[0]);
      event.target.value = "";
    });
  }

  // =========================================
  // INITIALIZE
  // =========================================

  document.addEventListener("DOMContentLoaded", () => {
    initializeEvents();

    setActiveType("barang");

    loadDocuments();
  });

})();
