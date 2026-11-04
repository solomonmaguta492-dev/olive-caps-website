import { admin } from "./api.js";
import { formatKES, escapeHtml, statusText, showToast } from "./ui.js";

const KEY = "oliveCapsAdmin";
const loginPanel = document.getElementById("login-panel");
const dashboard = document.getElementById("dashboard");
const loginForm = document.getElementById("login-form");
const loginError = document.getElementById("login-error");
const logoutButton = document.getElementById("logout");

const ordersBody = document.getElementById("orders-body");
const orderFilter = document.getElementById("order-filter");
const statsBox = document.getElementById("stats");

const ORDER_STATUSES = ["awaiting_payment", "processing", "ready_for_pickup", "dispatched", "completed", "cancelled"];

// The password is kept only for this browser tab.
let password = sessionStorage.getItem(KEY) || "";
let orders = [];

function showDashboard(show) {
  loginPanel.classList.toggle("hidden", show);
  dashboard.classList.toggle("hidden", !show);
  logoutButton.classList.toggle("hidden", !show);
}

function formatDate(iso) {
  return iso ? new Date(iso).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" }) : "";
}

function renderStats() {
  const paid = orders.filter((o) => o.payment.status === "paid");
  const revenue = paid.reduce((sum, o) => sum + o.payment.amountReceived, 0);
  const toPrepare = orders.filter((o) => o.status === "processing").length;
  const today = new Date().toDateString();
  const todayCount = orders.filter((o) => new Date(o.createdAt).toDateString() === today).length;

  statsBox.innerHTML = `
    <div class="stat"><span>Orders today</span><strong>${todayCount}</strong></div>
    <div class="stat"><span>Paid orders</span><strong>${paid.length}</strong></div>
    <div class="stat"><span>To prepare</span><strong>${toPrepare}</strong></div>
    <div class="stat"><span>Revenue received</span><strong>${formatKES(revenue)}</strong></div>`;
}

function filteredOrders() {
  const filter = orderFilter.value;
  if (filter === "paid") return orders.filter((o) => o.payment.status === "paid");
  if (filter === "unpaid") return orders.filter((o) => o.payment.status !== "paid");
  if (filter === "processing") return orders.filter((o) => o.status === "processing");
  return orders;
}

function orderRow(o) {
  const f = o.fulfilment;
  const place = f.method === "pickup" ? `Pickup: ${escapeHtml(f.pickupPoint)}` : `Delivery: ${escapeHtml(f.zone)}<br>${escapeHtml(f.town)}, ${escapeHtml(f.county)}<br>${escapeHtml(f.address)}`;
  const items = o.items.map((i) => `${i.quantity} × ${escapeHtml(i.name)} (${escapeHtml(i.colour)})`).join("<br>");
  const options = ORDER_STATUSES.map((s) => `<option value="${s}" ${s === o.status ? "selected" : ""}>${statusText(s)}</option>`).join("");
  const reference = o.payment.reference ? `<br>Ref: <strong>${escapeHtml(o.payment.reference)}</strong>` : "";
  const paidAt = o.payment.paidAt ? `<br>${formatDate(o.payment.paidAt)}` : "";

  return `
    <tr>
      <td><strong>${o.orderNumber}</strong><br>${formatDate(o.createdAt)}</td>
      <td>${escapeHtml(o.customer.name)}<br><a href="tel:+${o.customer.phone}">+${o.customer.phone}</a>${o.customer.email ? `<br>${escapeHtml(o.customer.email)}` : ""}${o.notes ? `<br><em>${escapeHtml(o.notes)}</em>` : ""}</td>
      <td>${items}</td>
      <td>${place}</td>
      <td>${formatKES(o.total)}<br><small>Delivery ${formatKES(o.deliveryFee)}</small></td>
      <td><span class="status-badge status-${o.payment.status}">${statusText(o.payment.status)}</span><br>${formatKES(o.payment.amountReceived)}${reference}${paidAt}</td>
      <td><select data-order="${o.orderNumber}" aria-label="Status of ${o.orderNumber}">${options}</select></td>
    </tr>`;
}

function renderOrders() {
  const list = filteredOrders();
  ordersBody.innerHTML = list.length
    ? list.map(orderRow).join("")
    : `<tr><td colspan="7">No orders yet.</td></tr>`;
}

async function loadOrders() {
  try {
    orders = await admin.orders(password);
    renderStats();
    renderOrders();
  } catch (err) {
    ordersBody.innerHTML = `<tr><td colspan="7">${escapeHtml(err.message)}</td></tr>`;
  }
}

orderFilter.addEventListener("change", renderOrders);
document.getElementById("refresh-orders").addEventListener("click", loadOrders);

ordersBody.addEventListener("change", async (event) => {
  const select = event.target.closest("[data-order]");
  if (!select) return;
  try {
    await admin.setOrderStatus(password, select.dataset.order, select.value);
    showToast(`${select.dataset.order}: ${statusText(select.value)}`);
    await loadOrders();
  } catch (err) {
    showToast(err.message);
  }
});

async function loadDashboard() {
  await loadOrders();
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
