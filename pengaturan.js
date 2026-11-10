(() => {
  "use strict";

  const API_URL = "http://localhost:3000/api/documents";

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
      const response = await fetch(API_URL);

      if (!response.ok) {
        throw new Error("Gagal mengambil data.");
      }

      const result = await response.json();
      const documents = result.documents || [];

      downloadJSON("e-spec-backup.json", {
        app: "E-Spec",
        exportedAt: new Date().toISOString(),
        documents
      });

      showStatus(
        `${documents.length} dokumen berhasil diekspor.`
      );

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

  // IMPOR DATA KE DATABASE
  $("#importFile").addEventListener("change", async event => {
    const file = event.target.files?.[0];

    if (!file) return;

    const button = $("#importBtn");
    button.disabled = true;

    try {
      const parsed = JSON.parse(await file.text());

      const incoming = Array.isArray(parsed)
        ? parsed
        : parsed.documents;

      if (!Array.isArray(incoming)) {
        throw new Error("Format JSON tidak sesuai.");
      }

      const confirmed = confirm(
        `Impor ${incoming.length} dokumen ke database E-Spec?`
      );

      if (!confirmed) return;

      let imported = 0;
      let failed = 0;

      for (const doc of incoming) {
        const formData = doc.formData || doc;

        const specType =
          doc.specType ||
          formData.specType ||
          "Barang";

        if (
          specType.toLowerCase() !== "jasa" &&
          !formData.materialDescription
        ) {
          failed++;
          continue;
        }

        try {
          const response = await fetch(API_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              specType,
              formData
            })
          });

          if (response.ok) {
            imported++;
          } else {
            failed++;
          }

        } catch (error) {
          failed++;
        }
      }

      showStatus(
        `${imported} dokumen berhasil diimpor. ${failed} dokumen gagal.`
      );

    } catch (error) {
      console.error(error);
      showStatus("Impor gagal. Periksa format file JSON.");

    } finally {
      button.disabled = false;
      event.target.value = "";
    }
  });

})();