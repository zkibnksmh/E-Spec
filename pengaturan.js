(() => {
  "use strict";

  const API_BASE_URL = window.ESpecDevAuth?.getApiBaseUrl?.() ||
    window.ESPEC_CONFIG?.API_BASE_URL || "http://localhost:3001/api";
  const API_URL = `${API_BASE_URL.replace(/\/$/, "")}/specifications/my-documents`;

  const getApiHeaders = () => (
    window.ESpecDevAuth?.getApiHeaders?.() || { "Content-Type": "application/json" }
  );

  const $ = selector => document.querySelector(selector);

  function showStatus(message) {
    $("#statusMessage").textContent = message;
  }

  function downloadJSON(filename, data) {
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

    URL.revokeObjectURL(url);
  }

  // EKSPOR SELURUH DATA
  $("#exportBtn").addEventListener("click", async () => {
    const button = $("#exportBtn");

    button.disabled = true;
    showStatus("Sedang mengambil data dari database...");

    try {
      const response = await fetch(API_URL, { headers: getApiHeaders() });

      if (!response.ok) {
        throw new Error("Gagal mengambil data.");
      }

      const result = await response.json();
      const documents = Array.isArray(result.data) ? result.data : [];
      const details = await Promise.all(documents.map(async (document) => {
        const detailResponse = await fetch(
          `${API_BASE_URL.replace(/\/$/, "")}/specifications/my-documents/${encodeURIComponent(document.id)}`,
          { headers: getApiHeaders() }
        );
        const detailResult = await detailResponse.json().catch(() => ({}));
        if (!detailResponse.ok || detailResult.success !== true) {
          throw new Error(detailResult.message || `Gagal mengekspor dokumen ${document.id}.`);
        }
        return detailResult.data;
      }));

      downloadJSON("e-spec-backup.json", {
        app: "E-Spec",
        exportedAt: new Date().toISOString(),
        documents: details
      });

      showStatus(`${details.length} dokumen berhasil diekspor.`);

    } catch (error) {
      console.error(error);
      showStatus("Ekspor gagal. Periksa koneksi backend.");

    } finally {
      button.disabled = false;
    }
  });

  // MEMBUKA PILIHAN FILE
  $("#importBtn").addEventListener("click", () => {
    $("#importFile").click();
  });

  // Backend belum menyediakan endpoint import. Validasi file tanpa mengirim
  // payload yang tidak sesuai kontrak API atau membuat draft tanpa pemilik.
  $("#importFile").addEventListener("change", async event => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const parsed = JSON.parse(await file.text());
      const incoming = Array.isArray(parsed) ? parsed : parsed.documents;
      if (!Array.isArray(incoming)) {
        throw new Error("Format JSON tidak sesuai.");
      }

      showStatus(
        `File JSON valid (${incoming.length} dokumen), tetapi impor ke database belum tersedia pada backend.`
      );
    } catch (error) {
      console.error(error);
      showStatus("Impor gagal. File JSON tidak valid.");
    } finally {
      event.target.value = "";
    }
  });

})();