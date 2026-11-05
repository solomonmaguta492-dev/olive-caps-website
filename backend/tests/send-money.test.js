import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const tempDir = mkdtempSync(join(tmpdir(), "olive-send-money-"));
process.env.DB_FILE = join(tempDir, "db.json");
process.env.ADMIN_PASSWORD = "test-pass";
process.env.MPESA_MODE = "mock";

const { createApp } = await import("../server.js");
const { readDb } = await import("../db.js");
const { normaliseMpesaCode, paymentMethods } = await import("../services/payments.js");

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

function send(method, path, body, admin = false) {
  return fetch(base + path, {
    method,
    headers: { "Content-Type": "application/json", ...(admin ? { "x-admin-password": "test-pass" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function newOrder() {
  const res = await send("POST", "/api/orders", {
    customer: { name: "Jane Wanjiku", phone: "0712345678" },
    items: [{ productId: "p029", colour: "Black", quantity: 2 }],
    fulfilment: { method: "pickup", pickupPointId: "cbd-moi-avenue" },
    paymentMethod: "sendMoney",
  });
  assert.equal(res.status, 201);
  return res.json();
}

test("M-Pesa codes are cleaned up and checked", () => {
  assert.equal(normaliseMpesaCode(" skl3x2abcd "), "SKL3X2ABCD");
  assert.equal(normaliseMpesaCode("SKL3X2"), null);
  assert.equal(normaliseMpesaCode("1234567890"), null);
});

test("mock prompts are never offered on a live site", () => {
  const settings = { sendMoney: { number: "0790868908" } };
  process.env.NODE_ENV = "production";
  assert.deepEqual(paymentMethods(settings), ["sendMoney"]);
  delete process.env.NODE_ENV;
  assert.deepEqual(paymentMethods(settings), ["sendMoney", "stk"]);
});

test("settings list the Send Money number", async () => {
  const settings = await (await send("GET", "/api/settings")).json();
  assert.equal(settings.sendMoney.number, "0790868908");
  assert.ok(settings.paymentMethods.includes("sendMoney"));
});

test("customer submits a code and the owner confirms it", async () => {
  const order = await newOrder();
  assert.equal(order.payment.type, "sendMoney");
  const stockBefore = readDb().products.find((p) => p.id === "p029").stock;

  const bad = await send("POST", `/api/orders/${order.orderNumber}/mpesa-code`, { code: "123" });
  assert.equal(bad.status, 400);

  const sent = await (await send("POST", `/api/orders/${order.orderNumber}/mpesa-code`, { code: "skl3x2abcd" })).json();
  assert.equal(sent.payment.status, "awaiting_confirmation");
  assert.equal(sent.payment.reference, "SKL3X2ABCD");

  const confirmed = await (await send("PATCH", `/api/admin/orders/${order.orderNumber}/payment`, { action: "confirm" }, true)).json();
  assert.equal(confirmed.payment.status, "paid");
  assert.equal(confirmed.status, "processing");
  assert.equal(readDb().products.find((p) => p.id === "p029").stock, stockBefore - 2);

  const again = await send("PATCH", `/api/admin/orders/${order.orderNumber}/payment`, { action: "confirm" }, true);
  assert.equal(again.status, 400);
});

test("the same M-Pesa code can't pay two orders", async () => {
  const order = await newOrder();
  const res = await send("POST", `/api/orders/${order.orderNumber}/mpesa-code`, { code: "SKL3X2ABCD" });
  assert.equal(res.status, 400);
});

test("a rejected code can be sent again", async () => {
  const order = await newOrder();
  await send("POST", `/api/orders/${order.orderNumber}/mpesa-code`, { code: "QWE1234RTY" });
  const rejected = await (await send("PATCH", `/api/admin/orders/${order.orderNumber}/payment`, { action: "reject" }, true)).json();
  assert.equal(rejected.payment.status, "rejected");

  const retry = await (await send("POST", `/api/orders/${order.orderNumber}/mpesa-code`, { code: "QWE1234RTZ" })).json();
  assert.equal(retry.payment.status, "awaiting_confirmation");
});

test("confirming less than the total marks the order underpaid", async () => {
  const order = await newOrder();
  await send("POST", `/api/orders/${order.orderNumber}/mpesa-code`, { code: "ZXC9876VBN" });
  const res = await (await send("PATCH", `/api/admin/orders/${order.orderNumber}/payment`, { action: "confirm", amount: 100 }, true)).json();
  assert.equal(res.payment.status, "underpaid");
});

test("confirming payment needs the admin password", async () => {
  const order = await newOrder();
  const res = await send("PATCH", `/api/admin/orders/${order.orderNumber}/payment`, { action: "confirm" });
  assert.equal(res.status, 401);
});
