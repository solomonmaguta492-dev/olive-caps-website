// The cart lives in localStorage so it survives a page refresh.
const KEY = "oliveCapsCart";

function read() {
  try {
    const items = JSON.parse(localStorage.getItem(KEY));
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

function save(items) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    // Storage can be blocked in private browsing; the cart then lasts for this page only.
  }
  window.dispatchEvent(new CustomEvent("cart:changed", { detail: items }));
}

export function getCart() {
  return read();
}

// One cart line per cap, colour and size.
function sameLine(item, productId, colour, size) {
  return item.productId === productId && item.colour === colour && (item.size || null) === (size || null);
}

// Same cap in the same colour and size is one line with a bigger quantity.
export function addToCart(product, colour, quantity = 1, size = null) {
  const items = read();
  const line = items.find((i) => sameLine(i, product.id, colour, size));
  if (line) {
    line.quantity += quantity;
  } else {
    items.push({
      productId: product.id,
      name: product.name,
      image: product.image,
      price: product.price,
      wholesalePrice: product.wholesalePrice,
      colour,
      size,
      quantity,
    });
  }
  save(items);
}

export function setQuantity(productId, colour, size, quantity) {
  let items = read();
  if (quantity <= 0) {
    items = items.filter((i) => !sameLine(i, productId, colour, size));
  } else {
    const line = items.find((i) => sameLine(i, productId, colour, size));
    if (line) line.quantity = quantity;
  }
  save(items);
}

export function removeFromCart(productId, colour, size) {
  setQuantity(productId, colour, size, 0);
}

export function clearCart() {
  save([]);
}

export function cartCount() {
  return read().reduce((sum, i) => sum + i.quantity, 0);
}
