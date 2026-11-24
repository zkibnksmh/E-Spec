(() => {
  "use strict";

  const escapeHTML = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    })[char]);

  const formatDate = (value) => {
    const date = value ? new Date(value) : null;

    return date && !Number.isNaN(date.getTime())
      ? date.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })
      : "-";
  };

  const typeKey = (document) => {
    const value = [
      document?.specificationTypeName,
      document?.specification_type,
      document?.specificationTypeCode,
      document?.type
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return value.includes("jasa") ? "jasa" : "barang";
  };

  const openPrintPreview = (document) => {
    const id = document?.id ?? document?.specification_id;

    if (!id) return;

    const page = typeKey(document) === "jasa" ? "jasa.html" : "barang.html";
    const url = new URL(page, window.location.href);

    url.searchParams.set("printId", id);
    window.open(url.toString(), "_blank");
  };

  window.ESpecDocumentWorkspace = {
    escapeHTML,
    formatDate,
    typeKey,
    openPrintPreview
  };
})();
