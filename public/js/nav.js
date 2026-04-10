document.addEventListener("DOMContentLoaded", () => {
  const loginLink = document.querySelector('a[href="/login"]');
  const psaLink = document.querySelector('a[href="/psa"]');
  const logoutNavItem = document.getElementById("logoutNavItem");
  const customerIdNavItem = document.getElementById("customerIdNavItem");
  const customerIdDisplay = document.getElementById("customerIdDisplay");
  const customerId = localStorage.getItem("customerId");

  if (psaLink) {
    psaLink.closest("li")?.classList.toggle("d-none", !customerId);
  }

  if (loginLink) {
    if (customerId) {
      loginLink.textContent = "Logout";
      loginLink.href = "#";
      loginLink.addEventListener("click", (event) => {
        event.preventDefault();
        localStorage.removeItem("customerId");
        window.location.href = "/logout";
      });
    } else {
      loginLink.textContent = "Login";
      loginLink.href = "/login";
    }
  }

  if (logoutNavItem) {
    logoutNavItem.style.display = customerId ? "" : "none";
  }

  if (customerIdNavItem && customerIdDisplay) {
    if (customerId) {
      customerIdNavItem.style.display = "";
      customerIdDisplay.textContent = `Customer ID: ${customerId}`;
    } else {
      customerIdNavItem.style.display = "none";
    }
  }
});
