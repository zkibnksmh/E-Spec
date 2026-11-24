(() => {
  "use strict";

  const form = document.getElementById("loginForm");
  const errorBox = document.getElementById("loginError");
  const submitButton = document.getElementById("loginSubmit");

  const showError = (message) => {
    if (!errorBox) return;
    errorBox.textContent = message;
    errorBox.classList.add("visible");
  };

  const clearError = () => {
    if (!errorBox) return;
    errorBox.textContent = "";
    errorBox.classList.remove("visible");
  };

  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearError();

    const auth = window.ESpecDevAuth;
    if (!auth) {
      showError("Helper autentikasi development tidak tersedia.");
      return;
    }

    const selected = form.querySelector('input[name="devIdentity"]:checked');
    if (!selected) {
      showError("Pilih salah satu identitas development terlebih dahulu.");
      return;
    }

    const originalText = submitButton?.textContent;

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "Signing in...";
    }

    try {
      await auth.authenticate(selected.value);
      window.location.assign("admin.html");
    } catch (error) {
      showError(error.message || "Login gagal. Silakan coba lagi.");

      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = originalText;
      }
    }
  });
})();
