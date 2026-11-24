
(() => {
  "use strict";

  // =========================================
  // E-SPEC — APPROVAL WORKSPACE
  // =========================================

  const API_BASE_URL =
    window.ESPEC_CONFIG?.API_BASE_URL || "http://localhost:3000/api";

  const API_URL =
    `${API_BASE_URL.replace(/\/$/, "")}/approvals/inbox`;

  const $ = (selector) => document.querySelector(selector);
  const workspace = window.ESpecDocumentWorkspace;

  let documents = [];

  // =========================================
  // HELPER
  // =========================================

  const escapeHTML = (value) => workspace?.escapeHTML?.(value)
    ?? String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    })[char]);

  const formatDate = (value) => workspace?.formatDate?.(value)
    ?? (
      value && !Number.isNaN(new Date(value).getTime())
        ? new Date(value).toLocaleDateString("id-ID")
        : "-"
    );

  const getApiHeaders = () => (
    window.ESpecDevAuth?.getApiHeaders?.() || {
      "Content-Type": "application/json"
    }
  );

  const showToast = (message, type = "success") => {
    const toast = $("#toast");

    if (!toast) return;

    toast.textContent = message;
    toast.className = `toast show ${type}`;

    setTimeout(() => {
      toast.className = "toast";
    }, 3000);
  };

  const statusClass = (status) => {
    const normalized = String(status || "").toLowerCase();

    if (normalized.includes("approved")) return "status-approved";
    if (normalized.includes("rejected")) return "status-rejected";
    if (normalized.includes("approval")) return "status-pending";
    if (normalized.includes("revision")) return "status-revision";

    return "status-draft";
  };

  // =========================================
  // FILTER DOCUMENTS
  // =========================================

  const filteredDocuments = () => {
    const search = ($("#approvalSearch")?.value || "")
      .trim()
      .toLowerCase();

    if (!search) return documents;

    return documents.filter((document) => [
      document.document_no,
      document.documentNo,
      document.specification_type,
      document.specificationTypeName,
      document.requestor,
      document.department,
      document.approvername
    ].some((value) =>
      String(value || "").toLowerCase().includes(search)
    ));
  };

  // =========================================
  // RENDER APPROVAL
  // =========================================

  const render = () => {
    const rows = $("#approvalRows");

    if (!rows) return;

    const visible = filteredDocuments();

    const resultCount = $("#approvalResultCount");
    const pendingCount = $("#pendingApprovalCount");
    const emptyState = $("#approvalEmptyState");

    if (resultCount) {
      resultCount.textContent =
        `Menampilkan ${visible.length} dokumen`;
    }

    if (pendingCount) {
      pendingCount.textContent = String(documents.length);
    }

    if (emptyState) {
      emptyState.style.display =
        visible.length ? "none" : "block";
    }

    const documentIds = visible.map((document) =>
      document.specification_id ?? document.id
    );

    rows.dataset.documents = JSON.stringify(documentIds);

    rows.innerHTML = visible.map((document, index) => `
      <tr>
        <td>
          <strong>${escapeHTML(
            document.document_no || document.doc_no || "-"
          )}</strong>
        </td>

        <td>
          ${escapeHTML(
            document.specification_type ||
            document.specType ||
            "-"
          )}
        </td>

        <td>
          ${escapeHTML(document.requestor || "-")}
        </td>

        <td>
          ${escapeHTML(document.department || "-")}
        </td>

        <td>
          ${escapeHTML(
            formatDate(
              document.submittedat ||
              document.submitted_at ||
              document.created_at
            )
          )}
        </td>

        <td>
          <div class="table-actions">
            <button
              type="button"
              class="action-btn"
              data-approval-action="approval"
              data-index="${index}">
              Approval
            </button>

            <button
              type="button"
              class="action-btn"
              data-approval-action="print"
              data-index="${index}">
              Print
            </button>
          </div>
        </td>
      </tr>
    `).join("");
  };

  // =========================================
  // LOAD DOCUMENTS
  // =========================================

  const loadDocuments = async () => {
    try {
      const response = await fetch(API_URL, {
        headers: getApiHeaders()
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok || result.success !== true) {
        throw new Error(
          result.message || "Gagal memuat daftar approval."
        );
      }

      documents = Array.isArray(result.data)
        ? result.data
        : [];

      render();

    } catch (error) {
      console.error("Gagal memuat approval:", error);

      documents = [];

      render();

      showToast(
        error.message || "Gagal memuat daftar approval.",
        "error"
      );
    }
  };

  // =========================================
  // OPEN APPROVAL DETAIL
  // =========================================

  const openApprovalDetail = (document) => {
    const documentId =
      document.specification_id ?? document.id;

    if (!documentId) {
      showToast("ID dokumen tidak ditemukan.", "error");
      return;
    }

    const url = new URL(
      "approval-detail.html",
      window.location.href
    );

    url.searchParams.set("id", documentId);

    window.location.href = url.toString();
  };

  // =========================================
  // INITIALIZE EVENTS
  // =========================================

  const initializeEvents = () => {
    $("#approvalSearch")?.addEventListener("input", render);

    $("#approvalRows")?.addEventListener("click", (event) => {
      const button = event.target.closest(
        "[data-approval-action]"
      );

      if (!button) return;

      const ids = JSON.parse(
        $("#approvalRows")?.dataset.documents || "[]"
      );

      const documentId = ids[Number(button.dataset.index)];

      const selectedDocument = documents.find((item) =>
        String(item.specification_id ?? item.id) ===
        String(documentId)
      );

      if (!selectedDocument) return;

      const action = button.dataset.approvalAction;

      if (action === "approval") {
        openApprovalDetail(selectedDocument);
      }

      if (action === "print") {
        workspace?.openPrintPreview?.(selectedDocument);
      }
    });
  };

  // =========================================
  // INITIALIZE
  // =========================================

  document.addEventListener("DOMContentLoaded", () => {
    Promise.resolve(window.ESpecRoleNav?.ready).then(() => {
      initializeEvents();
      loadDocuments();
    });
  });

})();
