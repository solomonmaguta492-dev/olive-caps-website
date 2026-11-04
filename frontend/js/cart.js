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

// Same cap in the same colour is one line with a bigger quantity.
export function addToCart(product, colour, quantity = 1) {
  const items = read();
  const line = items.find((i) => i.productId === product.id && i.colour === colour);
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
      quantity,
    });
  }
  save(items);
}

export function setQuantity(productId, colour, quantity) {
  let items = read();
  if (quantity <= 0) {
    items = items.filter((i) => !(i.productId === productId && i.colour === colour));
  } else {
    const line = items.find((i) => i.productId === productId && i.colour === colour);
    if (line) line.quantity = quantity;
  }
  save(items);
}

export function removeFromCart(productId, colour) {
  setQuantity(productId, colour, 0);
}

export function clearCart() {
  save([]);
}

export function cartCount() {
  return read().reduce((sum, i) => sum + i.quantity, 0);
}
