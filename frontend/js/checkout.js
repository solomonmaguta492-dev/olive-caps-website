import { getSettings, createOrder, startMpesaPayment } from "./api.js";
import { getCart, setQuantity, removeFromCart, clearCart } from "./cart.js";
import { formatKES, escapeHtml, applyShopSettings, whatsappLink } from "./ui.js";

const itemsBox = document.getElementById("cart-items");
const checkoutSection = document.getElementById("checkout");
const form = document.getElementById("checkout-form");
const pickupFields = document.getElementById("pickup-fields");
const deliveryFields = document.getElementById("delivery-fields");
const formError = document.getElementById("form-error");
const submitButton = document.getElementById("place-order");

let settings = null;

// Matches the server rule: wholesale price from the minimum quantity.
function linePrice(item) {
  const min = settings?.wholesale?.minQuantity || 10;
  return item.wholesalePrice && item.quantity >= min ? item.wholesalePrice : item.price;
}

function subtotal(items) {
  return items.reduce((sum, item) => sum + linePrice(item) * item.quantity, 0);
}

function renderItems() {
  const items = getCart();

  if (items.length === 0) {
    itemsBox.innerHTML = `
      <div class="empty-cart">
        <img src="images/baseball-cap.svg" alt="">
        <p>Your cart is empty.</p>
        <a class="btn btn-primary" href="index.html#shop">Browse caps</a>
      </div>`;
    checkoutSection.classList.add("hidden");
    renderTotals();
    return;
  }

  checkoutSection.classList.remove("hidden");
  itemsBox.innerHTML = items
    .map((item) => {
      const price = linePrice(item);
      const wholesaleNote = price !== item.price ? " · wholesale price" : "";
      return `
        <div class="cart-item" data-id="${item.productId}" data-colour="${escapeHtml(item.colour)}" data-size="${escapeHtml(item.size || "")}">
          <img src="${escapeHtml(item.image)}" alt="">
          <div>
            <h3>${escapeHtml(item.name)}</h3>
            <div class="meta">${escapeHtml(item.colour)}${item.size ? ` · Size ${escapeHtml(item.size)}` : ""} · ${formatKES(price)} each${wholesaleNote}</div>
            <div class="qty-control">
              <button type="button" data-step="-1" aria-label="Fewer">−</button>
              <span>${item.quantity}</span>
              <button type="button" data-step="1" aria-label="More">+</button>
            </div>
            <button type="button" class="link-button" data-remove>Remove</button>
          </div>
          <div class="line-total">${formatKES(price * item.quantity)}</div>
        </div>`;
    })
    .join("");
  renderTotals();
}

function selectedMethod() {
  return form.querySelector("input[name=method]:checked").value;
}

function currentDeliveryFee() {
  if (!settings || selectedMethod() === "pickup") return 0;
  const zone = settings.deliveryZones.find((z) => z.id === form.zoneId.value);
  return zone ? zone.fee : 0;
}

// Writes the cart as a WhatsApp message for customers who prefer to chat.
function updateWhatsappOrderLink() {
  const items = getCart();
  if (!settings || items.length === 0) return;
  const lines = items.map((i) => `- ${i.quantity} x ${i.name} (${i.colour}${i.size ? `, size ${i.size}` : ""})`).join("\n");
  const message = `Hi Olive Caps, I'd like to order:\n${lines}\nSubtotal: ${formatKES(subtotal(items))}`;
  document.querySelectorAll("#checkout [data-whatsapp]").forEach((a) => {
    a.href = whatsappLink(message, settings.whatsappNumber);
  });
}

function renderTotals() {
  updateWhatsappOrderLink();
  const sub = subtotal(getCart());
  const fee = currentDeliveryFee();
  const deliveryText = selectedMethod() === "pickup" ? "Free pickup" : formatKES(fee);
  document.getElementById("sum-subtotal").textContent = formatKES(sub);
  document.getElementById("sum-delivery").textContent = deliveryText;
  document.getElementById("sum-total").textContent = formatKES(sub + fee);
}

function fillDeliveryOptions() {
  form.pickupPointId.innerHTML = settings.pickupPoints
    .map((p) => `<option value="${p.id}">${escapeHtml(p.name)} (${escapeHtml(p.hours)})</option>`)
    .join("");
  form.zoneId.innerHTML = settings.deliveryZones
    .map((z) => `<option value="${z.id}">${escapeHtml(z.name)}: ${formatKES(z.fee)}, ${escapeHtml(z.days)}</option>`)
    .join("");
}

// Show only the fields for pickup or for delivery.
function toggleMethod() {
  const isPickup = selectedMethod() === "pickup";
  pickupFields.classList.toggle("hidden", !isPickup);
  deliveryFields.classList.toggle("hidden", isPickup);
  renderTotals();
}

form.addEventListener("change", (event) => {
  if (event.target.name === "method") toggleMethod();
  if (event.target.name === "paymentMethod") togglePayment();
  if (event.target.name === "zoneId") renderTotals();
});

itemsBox.addEventListener("click", (event) => {
  const row = event.target.closest(".cart-item");
  if (!row) return;
  const { id, colour } = row.dataset;
  const size = row.dataset.size || null;
  const item = getCart().find((i) => i.productId === id && i.colour === colour && (i.size || null) === size);

  if (event.target.closest("[data-remove]")) {
    removeFromCart(id, colour, size);
  } else if (event.target.closest("[data-step]")) {
    const step = Number(event.target.closest("[data-step]").dataset.step);
    setQuantity(id, colour, size, item.quantity + step);
  } else {
    return;
  }
  renderItems();
});

function markField(input, ok) {
  input.closest(".field").classList.toggle("invalid", !ok);
  return ok;
}

// Quick checks in the browser; the server checks everything again.
function validate() {
  const phoneDigits = form.phone.value.replace(/\D/g, "");
  const checks = [
    markField(form.name, form.name.value.trim().length >= 2),
    markField(form.phone, /^(?:254|0)?[17]\d{8}$/.test(phoneDigits)),
    markField(form.email, !form.email.value || form.email.checkValidity()),
    markField(form.mpesaPhone, !form.mpesaPhone.value.trim() || /^(?:254|0)?[17]\d{8}$/.test(form.mpesaPhone.value.replace(/\D/g, ""))),
  ];
  if (selectedMethod() === "delivery") {
    checks.push(markField(form.county, form.county.value.trim() !== ""));
    checks.push(markField(form.town, form.town.value.trim() !== ""));
    checks.push(markField(form.address, form.address.value.trim().length >= 5));
  }
  return checks.every(Boolean);
}

function showError(message) {
  formError.textContent = message;
  formError.classList.toggle("hidden", !message);
}

// Ways to pay come from the shop settings: Send Money, and the prompt when it's set up.
function renderPaymentOptions() {
  const methods = settings?.paymentMethods?.length ? settings.paymentMethods : ["sendMoney"];
  const number = settings?.sendMoney?.displayNumber || "our M-Pesa number";
  const labels = {
    sendMoney: ["M-Pesa Send Money", `Send to ${number}, then enter the code from your SMS`],
    stk: ["M-Pesa prompt", settings?.mpesaTestMode ? "Test mode: approved automatically" : "A PIN prompt pops up on your phone"],
  };
  document.getElementById("payment-options").innerHTML = methods
    .map(
      (m, i) => `
      <label class="choice">
        <input type="radio" name="paymentMethod" value="${m}" ${i === 0 ? "checked" : ""}>
        <span><strong>${labels[m][0]}</strong><small>${escapeHtml(labels[m][1])}</small></span>
      </label>`
    )
    .join("");
  togglePayment();
}

function selectedPayment() {
  return form.querySelector("input[name=paymentMethod]:checked")?.value || "sendMoney";
}

// The M-Pesa number field is only needed for the automatic prompt.
function togglePayment() {
  const stk = selectedPayment() === "stk";
  document.getElementById("mpesaPhone-field").classList.toggle("hidden", !stk);
  submitButton.textContent = stk ? "Place order & pay with M-Pesa" : "Place order";
}

function buildOrder() {
  const method = selectedMethod();
  const fulfilment =
    method === "pickup"
      ? { method, pickupPointId: form.pickupPointId.value }
      : {
          method,
          zoneId: form.zoneId.value,
          county: form.county.value,
          town: form.town.value,
          address: form.address.value,
        };

  return {
    customer: { name: form.name.value, phone: form.phone.value, email: form.email.value },
    items: getCart().map(({ productId, colour, size, quantity }) => ({ productId, colour, size, quantity })),
    fulfilment,
    notes: form.notes.value,
    paymentMethod: selectedPayment(),
  };
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  showError("");

  if (!validate()) {
    showError("Please check the highlighted fields.");
    form.querySelector(".invalid input, .invalid textarea")?.focus();
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = "Placing order...";
  try {
    const order = await createOrder(buildOrder());
    clearCart();

    let next = `order.html?no=${encodeURIComponent(order.orderNumber)}`;

    // With the prompt, send it straight away to the M-Pesa number or the phone number.
    if (selectedPayment() === "stk") {
      submitButton.textContent = "Sending M-Pesa prompt...";
      const payPhone = form.mpesaPhone.value.trim() || form.phone.value;
      try {
        await startMpesaPayment(order.orderNumber, payPhone);
      } catch {
        next += "&prompt=failed";
      }
    }
    window.location.href = next;
  } catch (err) {
    showError(err.message);
    submitButton.disabled = false;
    togglePayment();
  }
});

async function init() {
  renderItems();
  try {
    settings = await getSettings();
    applyShopSettings(settings);
    document.getElementById("wholesale-min").textContent = settings.wholesale.minQuantity;
    fillDeliveryOptions();
    renderPaymentOptions();
    toggleMethod();
    renderItems();
  } catch {
    // The cart still works; checkout will show an error if the server is down.
  }
}

init();
