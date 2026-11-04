import { getOrder, getSettings } from "./api.js";
import { formatKES, escapeHtml, applyShopSettings, statusText } from "./ui.js";

const view = document.getElementById("order-view");
const orderNumber = new URLSearchParams(window.location.search).get("no");

let order = null;

function itemsList() {
  return `
    <ul class="order-items">
      ${order.items
        .map((i) => `<li><span>${i.quantity} × ${escapeHtml(i.name)} (${escapeHtml(i.colour)})</span><span>${formatKES(i.lineTotal)}</span></li>`)
        .join("")}
    </ul>
    <div class="summary-row"><span>Subtotal</span><span>${formatKES(order.subtotal)}</span></div>
    <div class="summary-row"><span>${order.fulfilment.method === "pickup" ? "Pickup" : "Delivery"}</span><span>${order.deliveryFee ? formatKES(order.deliveryFee) : "Free"}</span></div>
    <div class="summary-row total"><span>Total</span><span>${formatKES(order.total)}</span></div>`;
}

function orderDetails() {
  const where = order.fulfilment.method === "pickup" ? "Pickup at" : "Deliver to";
  return `
    <section class="panel mt-lg">
      <h2>Order ${escapeHtml(order.orderNumber)}</h2>
      <p>
        <span class="status-badge status-${order.status}">${statusText(order.status)}</span>
        <span class="status-badge status-${order.payment.status}">Payment: ${statusText(order.payment.status)}</span>
      </p>
      <p>${where}: <strong>${escapeHtml(order.fulfilment.place)}</strong></p>
      ${itemsList()}
    </section>`;
}

function render() {
  view.innerHTML = `<div id="pay-area"></div>${orderDetails()}`;
}

async function init() {
  if (!orderNumber) {
    view.innerHTML = `<p class="notice notice-error">No order number given. <a href="index.html">Back to the shop</a>.</p>`;
    return;
  }
  try {
    const [loaded, settings] = await Promise.all([getOrder(orderNumber), getSettings()]);
    order = loaded;
    applyShopSettings(settings);
    render();
  } catch (err) {
    view.innerHTML = `<p class="notice notice-error">${escapeHtml(err.message)}</p>`;
  }
}

init();
