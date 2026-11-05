import { getOrder, getSettings, startMpesaPayment, getHealth } from "./api.js";
import { formatKES, escapeHtml, applyShopSettings, statusText } from "./ui.js";

const view = document.getElementById("order-view");
const params = new URLSearchParams(window.location.search);
const orderNumber = params.get("no");
const promptFailed = params.get("prompt") === "failed";

let order = null;
let pollTimer = null;
let testMode = false;

// Warns that no real prompt is sent while M-Pesa is in mock (test) mode.
function testModeNotice() {
  return testMode
    ? `<p class="notice">Test mode: no M-Pesa prompt is sent to your phone. The payment is approved automatically in a few seconds.</p>`
    : "";
}

function itemsList() {
  return `
    <ul class="order-items">
      ${order.items
        .map((i) => `<li><span>${i.quantity} × ${escapeHtml(i.name)} (${escapeHtml(i.colour)}${i.size ? `, size ${escapeHtml(i.size)}` : ""})</span><span>${formatKES(i.lineTotal)}</span></li>`)
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

function payForm(message = "") {
  return `
    <section class="panel pay-box">
      <h2>Pay with M-Pesa</h2>
      <div class="amount">${formatKES(order.total)}</div>
      ${testModeNotice()}
      ${message}
      <form id="pay-form" class="form-grid">
        <div class="field">
          <label for="pay-phone">M-Pesa phone number</label>
          <input id="pay-phone" type="tel" inputmode="tel" placeholder="0712 345 678">
          <span class="hint">Number on your order: ${escapeHtml(order.phone)}. Leave empty to use it.</span>
        </div>
        <button class="btn btn-primary btn-block" type="submit">Send M-Pesa prompt</button>
      </form>
      <ol class="mpesa-steps">
        <li>Tap the button above.</li>
        <li>A prompt appears on your phone.</li>
        <li>Enter your M-Pesa PIN to pay.</li>
        <li>This page confirms your payment automatically.</li>
      </ol>
    </section>`;
}

function waiting() {
  return `
    <section class="panel pay-box" aria-live="polite">
      <div class="spinner"></div>
      <h2>${testMode ? "Approving test payment" : "Check your phone"}</h2>
      ${testMode ? testModeNotice() : `<p>Enter your M-Pesa PIN to pay <strong>${formatKES(order.total)}</strong>. We're waiting for confirmation...</p>
      <p class="summary-note">The prompt usually arrives within 10 seconds. Keep your phone unlocked. No prompt after a minute? Go back and send it again.</p>`}
    </section>`;
}

function paid() {
  return `
    <section class="panel pay-box" aria-live="polite">
      <div class="success-icon" aria-hidden="true">✓</div>
      <h2>Payment received. Thank you!</h2>
      <p>M-Pesa reference <strong>${escapeHtml(order.payment.reference)}</strong>, ${formatKES(order.payment.amountReceived)}.</p>
      <p>We're preparing your order and will contact you on your phone number.</p>
      <a class="btn btn-outline" href="index.html#shop">Continue shopping</a>
    </section>`;
}

function payArea() {
  const status = order.payment.status;
  if (status === "paid") return paid();
  if (status === "pending") return waiting();
  if (status === "failed") {
    const reason = order.payment.failureReason ? ` (${escapeHtml(order.payment.failureReason)})` : "";
    return payForm(`<p class="notice notice-error">The payment didn't go through${reason}. Please try again.</p>`);
  }
  if (status === "underpaid") {
    return `<p class="notice notice-error">We received ${formatKES(order.payment.amountReceived)}, less than the total. Please contact us on WhatsApp.</p>`;
  }
  if (promptFailed) {
    return payForm(`<p class="notice notice-error">Your order is saved, but we couldn't send the M-Pesa prompt. Check the number and tap the button to try again.</p>`);
  }
  return payForm();
}

function render() {
  view.innerHTML = `<div id="pay-area">${order.status === "cancelled" ? "" : payArea()}</div>${orderDetails()}`;
}

// Checks every 4 seconds for up to 2 minutes while waiting for M-Pesa.
function pollPayment(triesLeft = 30) {
  clearTimeout(pollTimer);
  pollTimer = setTimeout(async () => {
    try {
      order = await getOrder(orderNumber);
    } catch {
      // Network blip: keep trying.
    }
    if (order.payment.status === "pending" && triesLeft > 1) {
      pollPayment(triesLeft - 1);
    } else if (order.payment.status === "pending") {
      order.payment.status = "failed";
      order.payment.failureReason = "no confirmation received";
      render();
    } else {
      render();
    }
  }, 4000);
}

view.addEventListener("submit", async (event) => {
  if (event.target.id !== "pay-form") return;
  event.preventDefault();
  const button = event.target.querySelector("button");
  button.disabled = true;
  button.textContent = "Sending prompt...";

  try {
    await startMpesaPayment(orderNumber, event.target.querySelector("#pay-phone").value);
    order.payment.status = "pending";
    render();
    pollPayment();
  } catch (err) {
    view.querySelector("#pay-area").innerHTML = payForm(`<p class="notice notice-error">${escapeHtml(err.message)}</p>`);
  }
});

async function init() {
  if (!orderNumber) {
    view.innerHTML = `<p class="notice notice-error">No order number given. <a href="index.html">Back to the shop</a>.</p>`;
    return;
  }
  try {
    const [loaded, settings, health] = await Promise.all([
      getOrder(orderNumber),
      getSettings(),
      getHealth().catch(() => ({})),
    ]);
    order = loaded;
    testMode = health.mpesa === "mock";
    applyShopSettings(settings);
    render();
    if (order.payment.status === "pending") pollPayment();
  } catch (err) {
    view.innerHTML = `<p class="notice notice-error">${escapeHtml(err.message)}</p>`;
  }
}

init();
