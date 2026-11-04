import { test } from "node:test";
import assert from "node:assert/strict";
import { unitPrice, deliveryFee, priceOrder, normalisePhone } from "../utils/pricing.js";

const settings = {
  wholesale: { minQuantity: 10 },
  deliveryZones: [{ id: "cbd", name: "CBD", fee: 150 }],
};
const products = [
  { id: "p1", name: "Cap", price: 900, wholesalePrice: 650, colours: ["Olive", "Black"], stock: 20 },
  { id: "p2", name: "Beanie", price: 700, wholesalePrice: null, colours: ["Grey"], stock: 2 },
];

test("uses retail price below the wholesale minimum", () => {
  assert.equal(unitPrice(products[0], 9, settings.wholesale), 900);
});

test("uses wholesale price from the minimum quantity", () => {
  assert.equal(unitPrice(products[0], 10, settings.wholesale), 650);
});

test("products without a wholesale price keep the retail price", () => {
  assert.equal(unitPrice(products[1], 50, settings.wholesale), 700);
});

test("pickup is free and delivery uses the zone fee", () => {
  assert.equal(deliveryFee({ method: "pickup" }, settings), 0);
  assert.equal(deliveryFee({ method: "delivery", zoneId: "cbd" }, settings), 150);
});

test("unknown delivery zone is rejected", () => {
  assert.throws(() => deliveryFee({ method: "delivery", zoneId: "mars" }, settings));
});

test("prices a full order with delivery", () => {
  const items = [
    { productId: "p1", colour: "Olive", quantity: 2 },
    { productId: "p2", colour: "Grey", quantity: 1 },
  ];
  const result = priceOrder(items, products, settings, { method: "delivery", zoneId: "cbd" });
  assert.equal(result.subtotal, 2500);
  assert.equal(result.deliveryFee, 150);
  assert.equal(result.total, 2650);
});

test("ignores prices sent from the browser", () => {
  const items = [{ productId: "p1", colour: "Olive", quantity: 1, unitPrice: 1 }];
  const result = priceOrder(items, products, settings, { method: "pickup" });
  assert.equal(result.total, 900);
});

test("rejects more than the stock available", () => {
  const items = [{ productId: "p2", colour: "Grey", quantity: 3 }];
  assert.throws(() => priceOrder(items, products, settings, { method: "pickup" }), /only 2 left/);
});

test("counts stock across colours of the same product", () => {
  const items = [
    { productId: "p1", colour: "Olive", quantity: 15 },
    { productId: "p1", colour: "Black", quantity: 6 },
  ];
  assert.throws(() => priceOrder(items, products, settings, { method: "pickup" }));
});

test("rejects empty carts, bad quantities and unknown colours", () => {
  const pickup = { method: "pickup" };
  assert.throws(() => priceOrder([], products, settings, pickup), /empty/);
  assert.throws(() => priceOrder([{ productId: "p1", quantity: 0 }], products, settings, pickup));
  assert.throws(() => priceOrder([{ productId: "p1", colour: "Pink", quantity: 1 }], products, settings, pickup));
});

test("normalises Kenyan phone numbers", () => {
  assert.equal(normalisePhone("0712 345 678"), "254712345678");
  assert.equal(normalisePhone("+254712345678"), "254712345678");
  assert.equal(normalisePhone("0112345678"), "254112345678");
  assert.equal(normalisePhone("712345678"), "254712345678");
  assert.equal(normalisePhone("12345"), null);
});
