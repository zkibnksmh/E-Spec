(() => {
  "use strict";

  const SESSION_KEY = "eSpecDevIdentity";
  const ALIASES = ["requestor", "manager", "head-engineering"];
  const LABELS = {
    requestor: { name: "Requestor", role: "Requestor" },
    manager: { name: "Manager", role: "Manager" },
    "head-engineering": { name: "Head Engineering", role: "HeadEngineering" }
  };
  const DEFAULT_API_BASE_URL = "http://localhost:3000/api";

  let configValue = window.ESPEC_CONFIG && typeof window.ESPEC_CONFIG === "object"
    ? { ...window.ESPEC_CONFIG }
    : { API_BASE_URL: DEFAULT_API_BASE_URL };

  const readSession = () => {
    try {
      const raw = window.sessionStorage.getItem(SESSION_KEY);
      if (!raw) return null;

      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
      if (typeof parsed === "string") return { alias: parsed };
      return null;
    } catch {
      return null;
    }
  };

  const getAlias = () => {
    const session = readSession();
    const alias = typeof session?.alias === "string"
      ? session.alias.trim().toLowerCase()
      : "";

    return ALIASES.includes(alias) ? alias : "";
  };

  const getProfile = () => {
    if (!getAlias()) return null;
    const session = readSession();
    return session?.profile && typeof session.profile === "object"
      ? session.profile
      : null;
  };

  const publicConfig = () => ({
    ...configValue,
    API_BASE_URL: configValue.API_BASE_URL || DEFAULT_API_BASE_URL,
    DEV_IDENTITY: getAlias()
  });

  Object.defineProperty(window, "ESPEC_CONFIG", {
    configurable: true,
    enumerable: true,
    get: publicConfig,
    set(value) {
      configValue = value && typeof value === "object"
        ? { ...value }
        : { API_BASE_URL: DEFAULT_API_BASE_URL };
    }
  });

  const getApiBaseUrl = () => (
    String(window.ESPEC_CONFIG?.API_BASE_URL || DEFAULT_API_BASE_URL).replace(/\/$/, "")
  );

  const getApiHeaders = () => {
    const headers = { "Content-Type": "application/json" };
    const alias = getAlias();

    if (alias) headers["X-ESpec-Dev-Identity"] = alias;

    return headers;
  };

  const validateIdentity = async (alias) => {
    const normalized = typeof alias === "string" ? alias.trim().toLowerCase() : "";

    if (!ALIASES.includes(normalized)) {
      throw new Error("Pilih identitas development yang valid.");
    }

    let response;
    try {
      response = await fetch(`${getApiBaseUrl()}/auth/me`, {
        headers: { "X-ESpec-Dev-Identity": normalized }
      });
    } catch {
      throw new Error("Tidak dapat menghubungi backend development. Pastikan server berjalan.");
    }

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(result.message || `Login gagal (HTTP ${response.status}).`);
    }

    if (result.success !== true) {
      throw new Error(result.message || "Respons login tidak valid.");
    }

    if (!result.data || typeof result.data !== "object") {
      throw new Error("Respons login tidak memuat profil identitas.");
    }

    if (result.data.identitySource !== "development") {
      throw new Error("Identitas yang dipilih bukan development identity.");
    }

    return { alias: normalized, profile: result.data };
  };

  const authenticate = async (alias) => {
    const validated = await validateIdentity(alias);

    try {
      window.sessionStorage.setItem(SESSION_KEY, JSON.stringify({
        alias: validated.alias,
        profile: validated.profile,
        signedInAt: new Date().toISOString()
      }));
    } catch {
      throw new Error("Sesi development tidak dapat disimpan pada browser ini.");
    }

    return validated.profile;
  };

  const clearSession = () => {
    try {
      window.sessionStorage.removeItem(SESSION_KEY);
    } catch {
      return;
    }
  };

  const signOut = () => {
    clearSession();
    window.location.replace("login.html");
  };

  const identityName = (alias) => LABELS[alias]?.name || alias;
  const identityRole = (alias) => LABELS[alias]?.role || alias;

  const hydrateIdentity = () => {
    const alias = getAlias();
    if (!alias) return;

    const profile = getProfile();
    const name = profile?.displayName || identityName(alias);
    const role = Array.isArray(profile?.roles)
      ? profile.roles.join(", ")
      : identityRole(alias);

    document.querySelectorAll("[data-dev-identity-name]").forEach((element) => {
      element.textContent = name;
    });

    document.querySelectorAll("[data-dev-identity-role]").forEach((element) => {
      element.textContent = `${role} · Development`;
    });
  };

  document.addEventListener("click", (event) => {
    const target = typeof event.target?.closest === "function"
      ? event.target.closest("[data-dev-logout]")
      : null;

    if (!target) return;

    event.preventDefault();
    signOut();
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", hydrateIdentity);
  } else {
    hydrateIdentity();
  }

  const currentPage = String(window.location.pathname || "")
    .split("/")
    .pop()
    .toLowerCase() || "index.html";

  if (currentPage !== "login.html" && !getAlias()) {
    window.location.replace("login.html");
  }

  window.ESpecDevAuth = {
    SESSION_KEY,
    ALIASES,
    getAlias,
    getProfile,
    isAuthenticated: () => Boolean(getAlias()),
    getApiBaseUrl,
    getApiHeaders,
    validateIdentity,
    authenticate,
    clearSession,
    signOut,
    identityName,
    identityRole
  };
})();
