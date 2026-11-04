import { getProducts, getSettings } from "./api.js";
import { addToCart } from "./cart.js";
import { formatKES, escapeHtml, stockLabel, applyShopSettings, showToast } from "./ui.js";

const grid = document.getElementById("product-grid");
const filters = document.getElementById("filters");
const searchInput = document.getElementById("search");
const resultNote = document.getElementById("result-note");

const state = {
  products: [],
  settings: null,
  category: "All",
  search: "",
};

function productCard(product) {
  const stock = stockLabel(product.stock);
  const soldOut = product.stock <= 0;
  const minQty = state.settings?.wholesale?.minQuantity || 10;
  const wholesale = product.wholesalePrice
    ? `<span class="wholesale-price">${formatKES(product.wholesalePrice)} each for ${minQty}+</span>`
    : "";

  return `
    <article class="product-card ${soldOut ? "sold-out" : ""}" data-id="${product.id}">
      <img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" loading="lazy" width="400" height="300">
      <div class="product-body">
        <span class="product-category">${escapeHtml(product.category)}</span>
        <h3 class="product-name">${escapeHtml(product.name)}</h3>
        <p class="product-desc">${escapeHtml(product.description)}</p>
        <div class="price-row">
          <span class="price">${formatKES(product.price)}</span>
          <span class="stock ${stock.cls}">${stock.text}</span>
        </div>
        ${wholesale}
        <div class="card-options">
          <label class="visually-hidden" for="colour-${product.id}">Colour</label>
          <select id="colour-${product.id}" data-colour ${soldOut ? "disabled" : ""}>
            ${product.colours.map((c) => `<option>${escapeHtml(c)}</option>`).join("")}
          </select>
          <label class="visually-hidden" for="qty-${product.id}">Quantity</label>
          <input id="qty-${product.id}" data-qty type="number" min="1" max="${product.stock}" value="1" inputmode="numeric" ${soldOut ? "disabled" : ""}>
        </div>
        <div class="card-actions">
          <button type="button" class="btn btn-primary btn-small" data-add ${soldOut ? "disabled" : ""}>
            ${soldOut ? "Sold out" : "Add to cart"}
          </button>
        </div>
      </div>
    </article>`;
}

function render(products) {
  if (products.length === 0) {
    grid.innerHTML = `<p class="notice">No caps match your search. Try another word or category.</p>`;
    return;
  }
  grid.innerHTML = products.map(productCard).join("");
}

function filteredProducts() {
  const term = state.search.trim().toLowerCase();
  return state.products.filter((p) => {
    const inCategory = state.category === "All" || p.category === state.category;
    const text = [p.name, p.description, p.category, ...p.colours].join(" ").toLowerCase();
    return inCategory && (!term || text.includes(term));
  });
}

function update() {
  const list = filteredProducts();
  render(list);
  const label = state.category === "All" ? "caps" : state.category.toLowerCase();
  resultNote.textContent = `Showing ${list.length} ${label}`;
}

function renderFilters(categories) {
  const all = ["All", ...categories];
  filters.innerHTML = all
    .map((c) => `<button type="button" class="chip" data-category="${escapeHtml(c)}" aria-pressed="${c === state.category}">${escapeHtml(c)}</button>`)
    .join("");
}

filters.addEventListener("click", (event) => {
  const chip = event.target.closest("[data-category]");
  if (!chip) return;
  state.category = chip.dataset.category;
  filters.querySelectorAll(".chip").forEach((c) => c.setAttribute("aria-pressed", c === chip));
  update();
});

// Wait for a short pause in typing before filtering.
let searchTimer;
searchInput.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    state.search = searchInput.value;
    update();
  }, 200);
});

grid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-add]");
  if (!button) return;

  const card = button.closest(".product-card");
  const product = state.products.find((p) => p.id === card.dataset.id);
  const colour = card.querySelector("[data-colour]").value;
  const quantity = Math.max(1, Number.parseInt(card.querySelector("[data-qty]").value, 10) || 1);

  if (quantity > product.stock) {
    showToast(`Only ${product.stock} available`);
    return;
  }
  addToCart(product, colour, quantity);
  showToast(`Added ${quantity} × ${product.name}`);
});

async function init() {
  try {
    const [products, settings] = await Promise.all([getProducts(), getSettings()]);
    state.products = products;
    state.settings = settings;
    applyShopSettings(settings);
    renderFilters(settings.categories);
    update();
  } catch (err) {
    grid.innerHTML = `<p class="notice notice-error">We couldn't load the caps. Please refresh the page.</p>`;
  }
}

init();
