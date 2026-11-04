import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Each test run gets its own throwaway database.
const tempDir = mkdtempSync(join(tmpdir(), "olive-caps-"));
process.env.DB_FILE = join(tempDir, "db.json");
process.env.ADMIN_PASSWORD = "test-pass";
process.env.MPESA_MODE = "mock";

const { createApp } = await import("../server.js");
const { mockCallback } = await import("../services/mpesa.js");
const { readDb } = await import("../db.js");

let server;
let base;

before(async () => {
  server = createApp().listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://localhost:${server.address().port}`;
});

after(() => {
  server.close();
  rmSync(tempDir, { recursive: true, force: true });
});

function post(path, body, headers = {}) {
  return fetch(base + path, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

const goodOrder = {
  customer: { name: "Jane Wanjiku", phone: "0712345678", email: "" },
  items: [{ productId: "p001", colour: "Olive", quantity: 2 }],
  fulfilment: { method: "pickup", pickupPointId: "cbd-moi-avenue" },
};

test("lists products and filters by category", async () => {
  const all = await (await fetch(`${base}/api/products`)).json();
  assert.ok(all.length >= 10);
  const beanies = await (await fetch(`${base}/api/products?category=Beanies`)).json();
  assert.ok(beanies.every((p) => p.category === "Beanies"));
});

test("returns shop settings", async () => {
  const settings = await (await fetch(`${base}/api/settings`)).json();
  assert.ok(settings.deliveryZones.length > 0);
  assert.ok(settings.pickupPoints.length > 0);
});

test("creates an order with server-side totals", async () => {
  const res = await post("/api/orders", goodOrder);
  assert.equal(res.status, 201);
  const order = await res.json();
  assert.match(order.orderNumber, /^OC-\d{8}-\d{4}$/);
  assert.equal(order.total, 1800);
  assert.equal(order.payment.status, "unpaid");
});

test("rejects an order with missing details", async () => {
  const res = await post("/api/orders", { ...goodOrder, customer: { name: "J", phone: "123" } });
  assert.equal(res.status, 400);
});

test("rejects delivery without an address", async () => {
  const res = await post("/api/orders", {
    ...goodOrder,
    fulfilment: { method: "delivery", zoneId: "nairobi-cbd", county: "Nairobi", town: "CBD", address: "" },
  });
  assert.equal(res.status, 400);
});

test("rejects a sold-out product", async () => {
  const res = await post("/api/orders", { ...goodOrder, items: [{ productId: "p006", colour: "Navy", quantity: 1 }] });
  assert.equal(res.status, 400);
});

test("paid callback marks the order paid and reduces stock once", async () => {
  const order = await (await post("/api/orders", goodOrder)).json();
  const stockBefore = readDb().products.find((p) => p.id === "p001").stock;

  const push = await post("/api/mpesa/stkpush", { orderNumber: order.orderNumber });
  assert.equal(push.status, 200);

  const checkoutId = readDb().orders.find((o) => o.orderNumber === order.orderNumber).payment.checkoutRequestId;
  const callback = mockCallback(checkoutId, order.total, "254712345678");
  await post("/api/mpesa/callback", callback);
  await post("/api/mpesa/callback", callback);

  const updated = await (await fetch(`${base}/api/orders/${order.orderNumber}`)).json();
  assert.equal(updated.payment.status, "paid");
  assert.equal(updated.status, "processing");

  const stockAfter = readDb().products.find((p) => p.id === "p001").stock;
  assert.equal(stockAfter, stockBefore - 2);
});

test("an underpaid callback does not mark the order paid", async () => {
  const order = await (await post("/api/orders", goodOrder)).json();
  await post("/api/mpesa/stkpush", { orderNumber: order.orderNumber });
  const checkoutId = readDb().orders.find((o) => o.orderNumber === order.orderNumber).payment.checkoutRequestId;

  await post("/api/mpesa/callback", mockCallback(checkoutId, 10, "254712345678"));
  const updated = await (await fetch(`${base}/api/orders/${order.orderNumber}`)).json();
  assert.equal(updated.payment.status, "underpaid");
});

test("admin routes need the password", async () => {
  const denied = await fetch(`${base}/api/admin/orders`);
  assert.equal(denied.status, 401);

  const allowed = await fetch(`${base}/api/admin/orders`, { headers: { "x-admin-password": "test-pass" } });
  assert.equal(allowed.status, 200);
  const orders = await allowed.json();
  assert.ok(orders[0].customer.phone);
});

test("admin can add a product and update stock", async () => {
  const headers = { "x-admin-password": "test-pass" };
  const res = await post(
    "/api/admin/products",
    { name: "Test Cap", category: "Baseball Caps", price: 500, stock: 5, colours: "Red, Blue" },
    headers
  );
  assert.equal(res.status, 201);
  const product = await res.json();
  assert.deepEqual(product.colours, ["Red", "Blue"]);

  const patch = await fetch(`${base}/api/admin/products/${product.id}/stock`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({ stock: 9 }),
  });
  assert.equal((await patch.json()).stock, 9);
});

test("fitted New Era cap needs a size and keeps it on the order", async () => {
  const item = { productId: "p012", colour: "Black/White", quantity: 1 };
  const noSize = await post("/api/orders", { ...goodOrder, items: [item] });
  assert.equal(noSize.status, 400);

  const res = await post("/api/orders", { ...goodOrder, items: [{ ...item, size: "7 1/4" }] });
  assert.equal(res.status, 201);
  const order = await res.json();
  assert.equal(order.items[0].size, "7 1/4");
  assert.equal(order.total, 3500);
});

test("New Era category lists the new caps", async () => {
  const caps = await (await fetch(`${base}/api/products?category=New%20Era`)).json();
  assert.equal(caps.length, 16);
});
