import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Pretend to be in sandbox mode with fake keys and a fake Safaricom.
const tempDir = mkdtempSync(join(tmpdir(), "olive-sandbox-"));
process.env.DB_FILE = join(tempDir, "db.json");
process.env.MPESA_MODE = "sandbox";
process.env.MPESA_CONSUMER_KEY = "key";
process.env.MPESA_CONSUMER_SECRET = "secret";
process.env.MPESA_SHORTCODE = "174379";
process.env.MPESA_PASSKEY = "passkey";
process.env.MPESA_CALLBACK_URL = "https://example.com/api/mpesa/callback";

let queryAnswer = { errorCode: "500.001.1001", errorMessage: "The transaction is being processed" };
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, options) => {
  const u = String(url);
  if (!u.includes("safaricom.co.ke")) return realFetch(url, options);
  const reply = (body) => new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } });
  if (u.includes("/oauth/")) return reply({ access_token: "token" });
  if (u.includes("/stkpush/")) return reply({ ResponseCode: "0", CheckoutRequestID: "ws_CO_TEST", CustomerMessage: "Success" });
  if (u.includes("/stkpushquery/")) return reply(queryAnswer);
  return reply({});
};

const { createApp } = await import("../server.js");
const { updateDb } = await import("../db.js");
const { parseQueryResult } = await import("../services/mpesa.js");

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

function post(path, body) {
  return realFetch(base + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

// Moves the prompt time into the past so the status check runs now.
function ageThePrompt(orderNumber) {
  updateDb((db) => {
    const o = db.orders.find((x) => x.orderNumber === orderNumber);
    o.payment.requestedAt = new Date(Date.now() - 60000).toISOString();
    o.payment.lastQueryAt = undefined;
  });
}

test("query result: still processing, paid and cancelled", () => {
  assert.deepEqual(parseQueryResult({ errorCode: "500.001.1001" }), { done: false });
  assert.equal(parseQueryResult({ ResultCode: "0" }).success, true);
  assert.equal(parseQueryResult({ ResultCode: "1032", ResultDesc: "Cancelled" }).success, false);
});

test("sandbox payment is confirmed by asking Daraja when no callback arrives", async () => {
  const order = await (
    await post("/api/orders", {
      customer: { name: "Jane Wanjiku", phone: "0712345678" },
      items: [{ productId: "p029", colour: "Black", quantity: 1 }],
      fulfilment: { method: "pickup", pickupPointId: "cbd-moi-avenue" },
    })
  ).json();

  const push = await post("/api/mpesa/stkpush", { orderNumber: order.orderNumber, phone: "0712345678" });
  assert.equal(push.status, 200);

  ageThePrompt(order.orderNumber);
  let current = await (await realFetch(`${base}/api/orders/${order.orderNumber}`)).json();
  assert.equal(current.payment.status, "pending");

  queryAnswer = { ResponseCode: "0", ResultCode: "0", ResultDesc: "The service request is processed successfully." };
  ageThePrompt(order.orderNumber);
  current = await (await realFetch(`${base}/api/orders/${order.orderNumber}`)).json();
  assert.equal(current.payment.status, "paid");
  assert.equal(current.status, "processing");
});
