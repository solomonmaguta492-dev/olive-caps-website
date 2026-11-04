import { getSettings } from "./api.js";
import { getCart, setQuantity, removeFromCart } from "./cart.js";
import { formatKES, escapeHtml, applyShopSettings } from "./ui.js";

const itemsBox = document.getElementById("cart-items");
const checkoutSection = document.getElementById("checkout");

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
        <div class="cart-item" data-id="${item.productId}" data-colour="${escapeHtml(item.colour)}">
          <img src="${escapeHtml(item.image)}" alt="">
          <div>
            <h3>${escapeHtml(item.name)}</h3>
            <div class="meta">${escapeHtml(item.colour)} · ${formatKES(price)} each${wholesaleNote}</div>
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

function renderTotals() {
  const sub = subtotal(getCart());
  document.getElementById("sum-subtotal").textContent = formatKES(sub);
  document.getElementById("sum-total").textContent = formatKES(sub);
}

itemsBox.addEventListener("click", (event) => {
  const row = event.target.closest(".cart-item");
  if (!row) return;
  const { id, colour } = row.dataset;
  const item = getCart().find((i) => i.productId === id && i.colour === colour);

  if (event.target.closest("[data-remove]")) {
    removeFromCart(id, colour);
  } else if (event.target.closest("[data-step]")) {
    const step = Number(event.target.closest("[data-step]").dataset.step);
    setQuantity(id, colour, item.quantity + step);
  } else {
    return;
  }
  renderItems();
});

async function init() {
  renderItems();
  try {
    settings = await getSettings();
    applyShopSettings(settings);
    document.getElementById("wholesale-min").textContent = settings.wholesale.minQuantity;
    renderItems();
  } catch {
    // The cart still works; checkout will show an error if the server is down.
  }
}

init();
