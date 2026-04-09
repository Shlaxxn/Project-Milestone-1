document.addEventListener("DOMContentLoaded", () => {
  const loginLink = document.querySelector('a[href="/login"]');
  const psaLink = document.querySelector('a[href="/psa"]');
  const activeCustomerId = localStorage.getItem("activeCustomerId");

  if (psaLink) {
    psaLink.closest("li")?.classList.toggle("d-none", !activeCustomerId);
  }

  if (!loginLink) {
    return;
  }

  if (activeCustomerId) {
    loginLink.textContent = "Logout";
    loginLink.href = "#";
    loginLink.addEventListener("click", (event) => {
      event.preventDefault();
      localStorage.removeItem("activeCustomerId");
      window.location.href = "/login";
    });
  } else {
    loginLink.textContent = "Login";
    loginLink.href = "/login";
  }
});
