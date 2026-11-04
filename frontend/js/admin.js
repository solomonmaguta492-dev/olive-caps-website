import { admin } from "./api.js";
import { formatKES, escapeHtml, statusText, showToast } from "./ui.js";

const KEY = "oliveCapsAdmin";
const loginPanel = document.getElementById("login-panel");
const dashboard = document.getElementById("dashboard");
const loginForm = document.getElementById("login-form");
const loginError = document.getElementById("login-error");
const logoutButton = document.getElementById("logout");

// The password is kept only for this browser tab.
let password = sessionStorage.getItem(KEY) || "";

function showDashboard(show) {
  loginPanel.classList.toggle("hidden", show);
  dashboard.classList.toggle("hidden", !show);
  logoutButton.classList.toggle("hidden", !show);
}

async function loadDashboard() {
  // Filled in by the orders and products sections.
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const attempt = document.getElementById("password").value;
  try {
    await admin.check(attempt);
    password = attempt;
    sessionStorage.setItem(KEY, password);
    loginError.classList.add("hidden");
    showDashboard(true);
    loadDashboard();
  } catch (err) {
    loginError.textContent = err.message;
    loginError.classList.remove("hidden");
  }
});

logoutButton.addEventListener("click", () => {
  sessionStorage.removeItem(KEY);
  password = "";
  showDashboard(false);
});

async function init() {
  if (!password) return;
  try {
    await admin.check(password);
    showDashboard(true);
    loadDashboard();
  } catch {
    sessionStorage.removeItem(KEY);
  }
}

init();
