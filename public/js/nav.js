document.addEventListener("DOMContentLoaded", () => {
  const loginLink = document.querySelector('a[href="/login"]');
  if (!loginLink) {
    return;
  }

  const activeCustomerId = localStorage.getItem("activeCustomerId");
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
