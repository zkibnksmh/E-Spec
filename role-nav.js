(() => {
  "use strict";

  const REQUESTOR_PAGES = new Set([
    "approval.html",
    "pilih-spesifikasi.html",
    "barang.html",
    "jasa.html"
  ]);
  const APPROVER_PAGES = new Set(["my-approval.html", "approval-detail.html"]);
  const HREF_ROLES = {
    "approval.html": "requestor",
    "pilih-spesifikasi.html": "requestor",
    "barang.html": "requestor",
    "jasa.html": "requestor",
    "my-approval.html": "approver",
    "approval-detail.html": "approver"
  };

  const currentPage = window.location.pathname.split("/").pop() || "admin.html";
  const isPrintPage = ["barang.html", "jasa.html"].includes(currentPage)
    && new URLSearchParams(window.location.search).has("printId");

  const roleFromProfile = (profile) => {
    const roles = Array.isArray(profile?.roles) ? profile.roles : [];

    if (roles.includes("Requestor")) return "requestor";
    if (roles.includes("Manager") || roles.includes("HeadEngineering")) return "approver";

    return null;
  };

  const applyNavigation = (role) => {
    document.querySelectorAll("a[href]").forEach((link) => {
      const page = new URL(link.getAttribute("href"), window.location.href).pathname
        .split("/")
        .pop();
      const requiredRole = HREF_ROLES[page];

      if (!requiredRole) return;

      link.hidden = requiredRole !== role;
    });

    document.querySelectorAll(".status-nav-group").forEach((group) => {
      const visibleLinks = [...group.querySelectorAll("a[href]")].filter(
        (link) => !link.hidden
      );

      group.hidden = visibleLinks.length === 0;
    });
  };

  applyNavigation(null);

  const deny = () => window.location.replace("admin.html");

  const verify = async () => {
    const auth = window.ESpecDevAuth;

    if (!auth?.isAuthenticated?.()) {
      window.location.replace("login.html");
      return null;
    }

    let profile;

    try {
      const response = await fetch(`${auth.getApiBaseUrl()}/auth/me`, {
        headers: auth.getApiHeaders()
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok || result.success !== true || result.data?.identitySource !== "development") {
        throw new Error("Sesi pengembangan tidak valid.");
      }

      profile = result.data;
    } catch {
      auth.clearSession?.();
      window.location.replace("login.html");
      return null;
    }

    const role = roleFromProfile(profile);

    if (!role) {
      deny();
      return null;
    }

    applyNavigation(role);

    if (!isPrintPage && REQUESTOR_PAGES.has(currentPage) && role !== "requestor") {
      deny();
      return null;
    }

    if (APPROVER_PAGES.has(currentPage) && role !== "approver") {
      deny();
      return null;
    }

    window.ESpecRoleNav.profile = profile;
    window.ESpecRoleNav.role = role;

    return profile;
  };

  window.ESpecRoleNav = {
    role: null,
    profile: null,
    ready: verify(),
    roleFromProfile,
    applyNavigation
  };
})();
