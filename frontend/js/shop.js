import { getProducts, getSettings } from "./api.js";
import { formatKES, escapeHtml, stockLabel, applyShopSettings } from "./ui.js";

const grid = document.getElementById("product-grid");

const state = {
  products: [],
  settings: null,
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

async function init() {
  try {
    const [products, settings] = await Promise.all([getProducts(), getSettings()]);
    state.products = products;
    state.settings = settings;
    applyShopSettings(settings);
    render(products);
  } catch (err) {
    grid.innerHTML = `<p class="notice notice-error">We couldn't load the caps. Please refresh the page.</p>`;
  }
}

init();
