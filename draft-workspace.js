(() => {
  "use strict";

  const LEGACY_KEYS = {
    barang: [
      "eSpecBarangQuestionnaire.v2",
      "eSpecBarangQuestionnaire.v1",
      "eSpecBarangPersistedDraftId.v1",
      "eSpecBarangPersistedDraftOwner.v1",
      "eSpecBarangPersistedDocumentNo.v1",
      "eSpecBarangPreviousDocumentNo.v1",
      "eSpecBarangTransactions.v1"
    ],
    jasa: [
      "eSpecJasaQuestionnaire.v1",
      "eSpecJasaPersistedDraftId.v1",
      "eSpecJasaPersistedDocumentNo.v1"
    ]
  };

  const FORM_KEYS = {
    barang: ["eSpecBarangQuestionnaire.v2", "eSpecBarangQuestionnaire.v1"],
    jasa: ["eSpecJasaQuestionnaire.v1"]
  };

  const safeParse = (raw) => {
    if (typeof raw !== "string") return raw;

    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  };

  const isObject = (value) =>
    Boolean(value) && typeof value === "object" && !Array.isArray(value);

  const selectLegacyFormData = (source, entries) => {
    for (const key of FORM_KEYS[source] || []) {
      const entry = entries.find((item) => item.key === key);
      if (entry && isObject(entry.value)) return entry.value;
    }

    if (source === "barang") {
      const history = entries.find(
        (item) => item.key === "eSpecBarangTransactions.v1"
      );

      if (Array.isArray(history?.value)) {
        for (let index = history.value.length - 1; index >= 0; index -= 1) {
          const formData = history.value[index]?.formData;
          if (isObject(formData)) return formData;
        }
      }
    }

    return null;
  };

  const readLegacy = (source) => {
    const keys = LEGACY_KEYS[source] || [];
    const entries = [];

    keys.forEach((key) => {
      let raw = null;
      try {
        raw = window.localStorage.getItem(key);
      } catch {
        return;
      }

      if (raw === null) return;
      entries.push({ key, value: safeParse(raw) });
    });

    if (!entries.length) return null;

    return {
      source,
      exportedAt: new Date().toISOString(),
      entries,
      formData: selectLegacyFormData(source, entries)
    };
  };

  const hasLegacy = (source) => Boolean(readLegacy(source));

  const downloadLegacy = (source) => {
    const snapshot = readLegacy(source);
    if (!snapshot) return false;

    const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
      type: "application/json"
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `e-spec-legacy-${source}-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    return true;
  };

  const clearLegacy = (source) => {
    (LEGACY_KEYS[source] || []).forEach((key) => {
      try {
        window.localStorage.removeItem(key);
      } catch {
        return;
      }
    });
  };

  const getApiBaseUrl = () => {
    const configured = window.ESpecDevAuth?.getApiBaseUrl?.();
    const fallback = window.ESPEC_CONFIG?.API_BASE_URL || "http://localhost:3000/api";
    return String(configured || fallback).replace(/\/$/, "");
  };

  const getApiHeaders = () => {
    if (window.ESpecDevAuth?.getApiHeaders) return window.ESpecDevAuth.getApiHeaders();

    const headers = { "Content-Type": "application/json" };
    const identity = String(window.ESPEC_CONFIG?.DEV_IDENTITY || "").trim().toLowerCase();

    if (identity) headers["X-ESpec-Dev-Identity"] = identity;
    return headers;
  };

  const fetchJson = async (path) => {
    const response = await fetch(`${getApiBaseUrl()}${path}`, {
      headers: getApiHeaders()
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(result.message || `Gagal memuat data server (HTTP ${response.status}).`);
    }

    return result;
  };

  const fetchDrafts = async () => {
    const result = await fetchJson("/specifications/my-drafts");
    return Array.isArray(result.data) ? result.data : [];
  };

  const fetchDraft = async (id) => {
    const result = await fetchJson(
      `/specifications/my-drafts/${encodeURIComponent(id)}`
    );
    return result.data;
  };

  const formatUpdatedAt = (value) => {
    if (!value) return "-";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);

    return date.toLocaleString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const mounts = new Set();

  const mount = ({
    source,
    picker,
    resumeButton,
    newButton,
    exportButton,
    recoverButton,
    panel,
    statusElement,
    setStatus,
    onResume,
    onNew,
    onImportLegacy
  }) => {
    let drafts = [];

    const report = (message, warning = false) => {
      if (setStatus) setStatus(message, warning);
      else if (statusElement) statusElement.textContent = message;
    };

    const syncLegacy = () => {
      if (panel) panel.hidden = !hasLegacy(source);
    };

    const setPickerMessage = (message) => {
      if (!picker) return;

      picker.innerHTML = "";
      const option = document.createElement("option");
      option.value = "";
      option.textContent = message;
      picker.appendChild(option);
      picker.disabled = true;
    };

    const render = () => {
      if (!picker) return;

      picker.innerHTML = "";

      if (!drafts.length) {
        setPickerMessage("Belum ada Draft server untuk identitas ini.");
        if (resumeButton) resumeButton.disabled = true;
        return;
      }

      const placeholder = document.createElement("option");
      placeholder.value = "";
      placeholder.textContent = "Pilih Draft untuk dilanjutkan";
      picker.appendChild(placeholder);

      drafts.forEach((draft) => {
        const option = document.createElement("option");
        option.value = String(draft.id);
        option.textContent = `${draft.documentNo || `Draft ${draft.id}`} · ${
          draft.specificationTypeName || draft.specificationTypeCode || "-"
        } · ${draft.status || "-"} · ${formatUpdatedAt(draft.updatedAt)}`;
        picker.appendChild(option);
      });

      picker.disabled = false;
      if (resumeButton) resumeButton.disabled = false;
    };

    const refresh = async ({ announce = true } = {}) => {
      syncLegacy();

      if (announce) report("Memuat daftar Draft dari server...");
      setPickerMessage("Memuat Draft...");
      if (resumeButton) resumeButton.disabled = true;

      try {
        drafts = await fetchDrafts();
        render();

        if (announce) {
          report(
            drafts.length
              ? `${drafts.length} Draft server tersedia untuk identitas ini.`
              : "Belum ada Draft server untuk identitas ini. Buat Draft baru untuk memulai."
          );
        }
      } catch (error) {
        drafts = [];
        setPickerMessage("Gagal memuat Draft dari server.");
        if (resumeButton) resumeButton.disabled = true;
        report(`Gagal memuat Draft dari server: ${error.message}`, true);
      }
    };

    resumeButton?.addEventListener("click", async () => {
      const id = String(picker?.value || "").trim();

      if (!id) {
        report("Pilih Draft terlebih dahulu untuk dilanjutkan.", true);
        return;
      }

      resumeButton.disabled = true;

      try {
        report("Memuat Draft dari server...");
        const detail = await fetchDraft(id);
        await onResume?.(detail);
      } catch (error) {
        report(`Gagal memuat Draft: ${error.message}`, true);
      } finally {
        resumeButton.disabled = false;
      }
    });

    newButton?.addEventListener("click", () => {
      onNew?.();
    });

    exportButton?.addEventListener("click", () => {
      if (!downloadLegacy(source)) {
        report("Tidak ada data Draft lama di browser untuk diekspor.", true);
        return;
      }

      report("Data Draft lama berhasil diekspor sebagai JSON.");
    });

    recoverButton?.addEventListener("click", () => {
      const legacy = readLegacy(source);

      if (!legacy) {
        report("Tidak ada data Draft lama di browser untuk dipulihkan.", true);
        return;
      }

      if (!legacy.formData) {
        report("Data Draft lama tidak memuat formulir yang dapat dipulihkan.", true);
        return;
      }

      onImportLegacy?.(legacy);
    });

    const api = { refresh, getDrafts: () => drafts };
    mounts.add(api);

    refresh();
    return api;
  };

  const refreshActive = () => {
    mounts.forEach((api) => api.refresh({ announce: false }));
  };

  window.ESpecDraftWorkspace = {
    LEGACY_KEYS,
    readLegacy,
    hasLegacy,
    downloadLegacy,
    clearLegacy,
    fetchDrafts,
    fetchDraft,
    formatUpdatedAt,
    mount,
    refreshActive
  };
})();
