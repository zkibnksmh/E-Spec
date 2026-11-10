(() => {
  "use strict";

  const API_URL = "http://localhost:3000/api/documents";
  const STORAGE_KEY = "eSpecJasaQuestionnaire.v1";

  const questionnaire = document.getElementById("questionnaireJasaForm");
  const printForm = document.getElementById("printJasaForm");

  const pdfBtn = document.getElementById("pdfJasaBtn");
  const resetBtn = document.getElementById("resetJasaBtn");
  const saveBtn = document.getElementById("saveJasaAdminBtn");
  const draftStatus = document.getElementById("draftStatus");

  if (!questionnaire || !printForm) {
    console.error("Form kuesioner atau template cetak Jasa tidak ditemukan.");
    return;
  }

  function getFormData() {
    const data = {};
    const formData = new FormData(questionnaire);

    for (const [key, value] of formData.entries()) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        if (!Array.isArray(data[key])) {
          data[key] = [data[key]];
        }

        data[key].push(value);
      } else {
        data[key] = value;
      }
    }

    return data;
  }

  function setDraftStatus(message) {
    if (draftStatus) {
      draftStatus.textContent = message;
    }
  }

  function saveDraft() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(getFormData())
      );

      setDraftStatus("Draft tersimpan otomatis di browser");
    } catch (error) {
      console.error("Gagal menyimpan draft:", error);
      setDraftStatus("Draft tidak dapat disimpan");
    }
  }

  function restoreDraft() {
    try {
      const saved = JSON.parse(
        localStorage.getItem(STORAGE_KEY) || "null"
      );

      if (!saved) return;

      for (const [name, value] of Object.entries(saved)) {
        const fields = questionnaire.querySelectorAll(
          `[name="${CSS.escape(name)}"]`
        );

        fields.forEach((field) => {
          if (field.type === "checkbox" || field.type === "radio") {
            field.checked = Array.isArray(value)
              ? value.includes(field.value)
              : value === field.value;
          } else {
            field.value = value ?? "";
          }
        });
      }

      setDraftStatus("Draft sebelumnya berhasil dipulihkan");
    } catch (error) {
      console.error("Gagal memulihkan draft:", error);
    }
  }

  function transferToPrint(data = getFormData()) {

    printForm.querySelectorAll("[name]").forEach((target) => {
      const value = data[target.name];

      if (target.type === "checkbox" || target.type === "radio") {
        target.checked = Array.isArray(value)
          ? value.includes(target.value)
          : value === target.value;
      } else {
        target.value = value ?? "";
      }
    });
  }

  // =========================================
// CETAK DOKUMEN JASA DARI DATABASE ADMIN
// =========================================

function activateDatabasePrintMode() {
  document.body.classList.add("database-print-mode");

  const style = document.createElement("style");

  style.textContent = `
    body.database-print-mode .toolbar,
    body.database-print-mode .intro,
    body.database-print-mode .service-actions,
    body.database-print-mode #questionnaireJasaForm,
    body.database-print-mode .footnote {
      display: none !important;
    }

    body.database-print-mode #printJasaForm {
      display: block !important;
      visibility: visible !important;
    }
  `;

  document.head.appendChild(style);

  return style;
}


async function printSavedJasa(documentId) {
  const printStyle = activateDatabasePrintMode();

  try {
    const response = await fetch(
      `${API_URL}/${encodeURIComponent(documentId)}`
    );

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        result.message ||
        result.error ||
        "Gagal mengambil data dokumen Jasa."
      );
    }

    const row = result.document ?? result;
    const savedData = row.form_data || {};

    const data = {
      ...savedData,

      docNo: row.doc_no ?? savedData.docNo ?? "",
      revision: row.revision ?? savedData.revision ?? "",
      requestor: row.requestor ?? savedData.requestor ?? "",
      department: row.department ?? savedData.department ?? ""
    };

    // Masukkan data database ke template PDF Jasa.
    transferToPrint(data);

    // Tunggu template siap sebelum membuka Print.
    await new Promise(resolve => setTimeout(resolve, 300));

    window.print();

  } catch (error) {
    console.error("Gagal mencetak dokumen Jasa:", error);

    document.body.classList.remove("database-print-mode");
    printStyle.remove();

    alert(
      "Gagal membuka dokumen Jasa untuk dicetak.\n\n" +
      error.message
    );
  }
}

  // Simpan draft otomatis
  questionnaire.addEventListener("input", saveDraft);
  questionnaire.addEventListener("change", saveDraft);

  // Cetak PDF
  pdfBtn.addEventListener("click", () => {
    if (!questionnaire.reportValidity()) return;

    saveDraft();
    transferToPrint();

    window.print();
  });

// =========================================
// RESET FORM JASA
// =========================================

resetBtn.addEventListener("click", () => {

  const confirmed = confirm(
    "Yakin ingin mengosongkan seluruh formulir spesifikasi Jasa?"
  );

  if (!confirmed) return;

  // Reset form terlebih dahulu.
  questionnaire.reset();

  // Kosongkan semua input, textarea, dan select.
  questionnaire.querySelectorAll("input, textarea, select").forEach(field => {

    if (field.type === "checkbox" || field.type === "radio") {
      field.checked = false;

    } else {
      field.value = "";
    }

  });

  // Hapus draft tersimpan.
  localStorage.removeItem(STORAGE_KEY);

  // Kosongkan template PDF sesuai kondisi form terbaru.
  transferToPrint();

  // Perbarui status draft.
  setDraftStatus("Form telah dikosongkan");

  // Kembali ke bagian atas halaman.
  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });


  console.log("Form Spesifikasi Jasa berhasil dikosongkan.");

});

  // Simpan ke database dan Admin
  saveBtn.addEventListener("click", async () => {
    if (!questionnaire.reportValidity()) return;

    const formData = getFormData();

    const payload = {
      specType: "Jasa",
      formData
    };

    saveBtn.disabled = true;

    const oldText = saveBtn.textContent;
    saveBtn.textContent = "Menyimpan...";

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          result.message ||
          result.error ||
          "Gagal menyimpan data ke server."
        );
      }

      alert("Spesifikasi jasa berhasil disimpan ke Admin.");

    } catch (error) {
      console.error("Gagal menyimpan spesifikasi jasa:", error);

      alert(
        "Gagal menyimpan ke Admin. Pastikan server backend aktif.\n\n" +
        error.message
      );

    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = oldText;
    }
  });

// =========================================
// INISIALISASI HALAMAN
// =========================================

const printId = new URLSearchParams(
  window.location.search
).get("printId");

if (printId) {
  // Dibuka dari tombol Cetak PDF di Admin.
  // Ambil data berdasarkan ID database.
  printSavedJasa(printId);

} else {
  // Halaman dibuka secara normal.
  restoreDraft();
  transferToPrint();
}

})();