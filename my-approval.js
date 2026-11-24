
(() => {
  "use strict";

  // =========================================
  // E-SPEC — APPROVAL WORKSPACE
  // =========================================

  const API_BASE_URL = window.ESpecDevAuth?.getApiBaseUrl?.() ||
    window.ESPEC_CONFIG?.API_BASE_URL || "http://localhost:3001/api";

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

  const apiFetch = async (path, options = {}) => {
    const response = await fetch(`${API_BASE_URL.replace(/\/$/, "")}${path}`, {
      ...options,
      headers: {
        ...getApiHeaders(),
        ...(options.headers || {})
      }
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.success !== true) {
      throw new Error(result.message || `Permintaan gagal (HTTP ${response.status}).`);
    }
    return result.data;
  };

  const ensureApprovalDialog = () => {
    let dialog = document.getElementById("eSpecApprovalDialog");
    if (dialog) return dialog;

    const style = document.createElement("style");
    style.textContent = `
      #eSpecApprovalDialog{position:fixed;inset:0;z-index:9999;background:rgba(15,23,42,.58);display:none;align-items:center;justify-content:center;padding:20px}
      #eSpecApprovalDialog.is-open{display:flex}
      #eSpecApprovalDialog .e-spec-dialog-card{background:#fff;color:#172033;width:min(860px,100%);max-height:90vh;overflow:auto;border-radius:16px;padding:24px;box-shadow:0 20px 60px rgba(0,0,0,.25)}
      #eSpecApprovalDialog .e-spec-dialog-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:18px}
      #eSpecApprovalDialog .e-spec-dialog-close{border:0;background:#eef2f7;border-radius:8px;padding:8px 12px;cursor:pointer}
      #eSpecApprovalDialog .e-spec-detail-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:16px 0}
      #eSpecApprovalDialog .e-spec-detail-item{background:#f7f8fa;border-radius:10px;padding:12px}
      #eSpecApprovalDialog .e-spec-detail-item small{display:block;color:#64748b;margin-bottom:4px}
      #eSpecApprovalDialog .e-spec-workflow{border-top:1px solid #e5e7eb;margin-top:18px;padding-top:16px}
      #eSpecApprovalDialog .e-spec-workflow li{margin:8px 0}
      #eSpecApprovalDialog .e-spec-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:22px}
      #eSpecApprovalDialog .e-spec-actions button{border:0;border-radius:9px;padding:11px 16px;font-weight:600;cursor:pointer}
      #eSpecApprovalDialog [data-decision=approve]{background:#15803d;color:#fff}
      #eSpecApprovalDialog [data-decision=return],#eSpecApprovalDialog [data-decision=reject]{background:#b91c1c;color:#fff}
      #eSpecApprovalDialog .e-spec-dialog-message{padding:14px;background:#f8fafc;border-radius:10px;color:#475569}
      @media(max-width:600px){#eSpecApprovalDialog .e-spec-dialog-card{padding:16px}#eSpecApprovalDialog .e-spec-detail-grid{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);

    dialog = document.createElement("div");
    dialog.id = "eSpecApprovalDialog";
    dialog.innerHTML = `
      <section class="e-spec-dialog-card" role="dialog" aria-modal="true" aria-labelledby="eSpecApprovalTitle">
        <div class="e-spec-dialog-head">
          <div><small>REVIEW SPESIFIKASI</small><h2 id="eSpecApprovalTitle">Detail Approval</h2></div>
          <button type="button" class="e-spec-dialog-close" data-dialog-close>Tutup</button>
        </div>
        <div class="e-spec-dialog-body"><p class="e-spec-dialog-message">Memuat detail dokumen...</p></div>
      </section>`;
    document.body.appendChild(dialog);
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog || event.target.closest("[data-dialog-close]")) {
        dialog.classList.remove("is-open");
      }
    });
    dialog.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-decision]");
      if (!button) return;
      const decision = button.dataset.decision;
      const documentId = dialog.dataset.documentId;
      let comment = "";
      if (decision !== "approve") {
        comment = window.prompt(
          decision === "return" ? "Masukkan catatan revisi (wajib):" : "Masukkan alasan penolakan (wajib):"
        );
        if (comment === null) return;
        comment = comment.trim();
        if (!comment) {
          showToast("Catatan wajib diisi untuk keputusan ini.", "error");
          return;
        }
      } else if (!window.confirm("Setujui spesifikasi ini?")) {
        return;
      }

      button.disabled = true;
      const oldText = button.textContent;
      button.textContent = "Memproses...";
      try {
        const action = decision === "return" ? "return" : decision;
        await apiFetch(`/specifications/${encodeURIComponent(documentId)}/approval/${action}`, {
          method: "POST",
          body: JSON.stringify({ comment })
        });
        dialog.classList.remove("is-open");
        showToast("Keputusan approval berhasil disimpan.");
        await loadDocuments();
      } catch (error) {
        showToast(error.message || "Keputusan approval gagal.", "error");
      } finally {
        button.disabled = false;
        button.textContent = oldText;
      }
    });
    return dialog;
  };

  const openApprovalDetail = async (document) => {
    const documentId = document.specification_id ?? document.id;
    if (!documentId) {
      showToast("ID dokumen tidak ditemukan.", "error");
      return;
    }

    const dialog = ensureApprovalDialog();
    dialog.dataset.documentId = String(documentId);
    dialog.querySelector(".e-spec-dialog-body").innerHTML =
      '<p class="e-spec-dialog-message">Memuat detail dokumen dan riwayat approval...</p>';
    dialog.classList.add("is-open");

    try {
      const [detail, workflow] = await Promise.all([
        apiFetch(`/specifications/${encodeURIComponent(documentId)}`, { method: "GET" }),
        apiFetch(`/specifications/${encodeURIComponent(documentId)}/workflow`, { method: "GET" })
      ]);
      const formData = detail.formData || detail.form_data || {};
      const title = detail.materialDescription || formData.materialDescription ||
        formData.projectName || document.materialdescription || "Spesifikasi";
      const cycles = Array.isArray(workflow?.cycles) ? workflow.cycles : [];
      const steps = cycles.flatMap((cycle) => Array.isArray(cycle.steps) ? cycle.steps.map((step) => ({
        ...step,
        cycleNo: cycle.cycleno
      })) : []);
      const body = dialog.querySelector(".e-spec-dialog-body");
      dialog.querySelector("#eSpecApprovalTitle").textContent = detail.documentNo || document.document_no || "Detail Approval";
      body.innerHTML = `
        <h3>${escapeHTML(title)}</h3>
        <div class="e-spec-detail-grid">
          <div class="e-spec-detail-item"><small>Requestor</small><strong>${escapeHTML(detail.requestor || document.requestor || "-")}</strong></div>
          <div class="e-spec-detail-item"><small>Department</small><strong>${escapeHTML(detail.department || document.department || "-")}</strong></div>
          <div class="e-spec-detail-item"><small>Jenis</small><strong>${escapeHTML(detail.specificationTypeName || document.specification_type || "-")}</strong></div>
          <div class="e-spec-detail-item"><small>Status</small><strong>${escapeHTML(detail.status || workflow.status || "-")}</strong></div>
          <div class="e-spec-detail-item"><small>Plant</small><strong>${escapeHTML(formData.plantName || document.plant || formData.plant || "-")}</strong></div>
          <div class="e-spec-detail-item"><small>Material Group</small><strong>${escapeHTML(formData.materialGroupCode || formData.materialGroup || document.material_group || "-")}</strong></div>
        </div>
        <section class="e-spec-workflow"><h3>Riwayat Approval</h3>
          ${steps.length ? `<ol>${steps.map((step) => `<li><strong>Step ${escapeHTML(step.stepno)}</strong> · ${escapeHTML(step.approverrole || step.approvername || "Approver")} — ${escapeHTML(step.approvalstatus || "Pending")}${step.comments ? `<br><small>${escapeHTML(step.comments)}</small>` : ""}</li>`).join("")}</ol>` : '<p class="e-spec-dialog-message">Belum ada riwayat langkah approval.</p>'}
        </section>
        <div class="e-spec-actions">
          <button type="button" data-decision="approve">Setujui</button>
          <button type="button" data-decision="return">Kembalikan untuk Revisi</button>
          <button type="button" data-decision="reject">Tolak</button>
        </div>`;
    } catch (error) {
      dialog.querySelector(".e-spec-dialog-body").innerHTML =
        `<p class="e-spec-dialog-message">${escapeHTML(error.message || "Gagal memuat detail approval.")}</p>`;
    }
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
    Promise.resolve(window.ESpecRoleNav?.ready).then((profile) => {
      if (!profile) return;
      initializeEvents();
      loadDocuments();
    });
  });

})();
