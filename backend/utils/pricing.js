// Price per item: wholesale price once the quantity reaches the minimum.
export function unitPrice(product, quantity, wholesale) {
  const isWholesale = product.wholesalePrice && quantity >= wholesale.minQuantity;
  return isWholesale ? product.wholesalePrice : product.price;
}

export function deliveryFee(fulfilment, settings) {
  if (fulfilment.method === "pickup") return 0;
  const zone = settings.deliveryZones.find((z) => z.id === fulfilment.zoneId);
  if (!zone) throw new Error("Please choose a delivery area");
  return zone.fee;
}

/*
  Builds order lines and totals from the database prices,
  so the browser can never change what a customer pays.
*/
export function priceOrder(items, products, settings, fulfilment) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("Your cart is empty");
  }

  const lines = items.map((item) => {
    const product = products.find((p) => p.id === item.productId);
    if (!product) throw new Error("A product in your cart no longer exists");

    const quantity = Number.parseInt(item.quantity, 10);
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new Error(`Invalid quantity for ${product.name}`);
    }
    if (item.colour && !product.colours.includes(item.colour)) {
      throw new Error(`${item.colour} is not available for ${product.name}`);
    }
    // Fitted caps must have a size chosen; other caps have no sizes.
    const sizes = product.sizes || [];
    if (sizes.length && !sizes.includes(item.size)) {
      throw new Error(`Please choose a size for ${product.name}`);
    }

    const price = unitPrice(product, quantity, settings.wholesale);
    return {
      productId: product.id,
      name: product.name,
      colour: item.colour || product.colours[0],
      size: sizes.length ? item.size : null,
      quantity,
      unitPrice: price,
      wholesale: price !== product.price,
      lineTotal: price * quantity,
    };
  });

  // Stock is checked per product across all colours in the cart.
  const wanted = {};
  for (const line of lines) {
    wanted[line.productId] = (wanted[line.productId] || 0) + line.quantity;
  }
  for (const [id, qty] of Object.entries(wanted)) {
    const product = products.find((p) => p.id === id);
    if (product.stock < qty) {
      const left = product.stock === 0 ? "is sold out" : `has only ${product.stock} left`;
      throw new Error(`${product.name} ${left}`);
    }
  }

  const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
  const fee = deliveryFee(fulfilment, settings);
  return { lines, subtotal, deliveryFee: fee, total: subtotal + fee };
}

// Converts 07XX, 01XX, +2547XX or 2547XX into 2547XXXXXXXX for M-Pesa.
export function normalisePhone(input) {
  const digits = String(input || "").replace(/\D/g, "");
  let phone = digits;
  if (/^0[17]\d{8}$/.test(digits)) phone = "254" + digits.slice(1);
  if (/^[17]\d{8}$/.test(digits)) phone = "254" + digits;
  if (!/^254[17]\d{8}$/.test(phone)) return null;
  return phone;
}
