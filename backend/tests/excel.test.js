import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ExcelJS from "exceljs";

const tempDir = mkdtempSync(join(tmpdir(), "olive-excel-"));
process.env.DB_FILE = join(tempDir, "db.json");
process.env.ADMIN_PASSWORD = "test-pass";
process.env.MPESA_MODE = "mock";

const { createApp } = await import("../server.js");

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

async function readWorkbook(res) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(await res.arrayBuffer()));
  return workbook;
}

test("Excel report needs the admin password", async () => {
  const res = await send("GET", "/api/admin/sales.xlsx");
  assert.equal(res.status, 401);
});

test("Excel report lists paid sales with totals, summary and stock", async () => {
  // One paid order (Send Money, confirmed) and one unpaid order.
  const paid = await (
    await send("POST", "/api/orders", {
      customer: { name: "Jane Wanjiku", phone: "0712345678" },
      items: [{ productId: "p029", colour: "Black", quantity: 2 }],
      fulfilment: { method: "pickup", pickupPointId: "cbd-moi-avenue" },
      paymentMethod: "sendMoney",
    })
  ).json();
  await send("POST", `/api/orders/${paid.orderNumber}/mpesa-code`, { code: "SKL3X2ABCD" });
  await send("PATCH", `/api/admin/orders/${paid.orderNumber}/payment`, { action: "confirm" }, true);
  await send("POST", "/api/orders", {
    customer: { name: "John Otieno", phone: "0798000111" },
    items: [{ productId: "p076", colour: "Black", quantity: 1 }],
    fulfilment: { method: "pickup", pickupPointId: "cbd-moi-avenue" },
    paymentMethod: "sendMoney",
  });

  const res = await send("GET", "/api/admin/sales.xlsx", null, true);
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-disposition"), /olive-caps-sales-.*\.xlsx/);

  const workbook = await readWorkbook(res);
  assert.deepEqual(workbook.worksheets.map((s) => s.name), ["Sales", "Summary", "Stock"]);

  const sales = workbook.getWorksheet("Sales");
  assert.equal(sales.getRow(1).getCell(2).value, "Order number");
  assert.equal(sales.getRow(2).getCell(2).value, paid.orderNumber);
  assert.equal(sales.getRow(2).getCell(10).value, 3000);
  assert.equal(sales.getRow(2).getCell(14).value, "SKL3X2ABCD");
  assert.equal(sales.getRow(3).getCell(1).value, "TOTAL");
  assert.equal(sales.getRow(3).getCell(10).value.formula, "SUM(J2:J2)");

  const summary = workbook.getWorksheet("Summary");
  assert.equal(summary.getRow(4).getCell(2).value, 1);
  assert.equal(summary.getRow(6).getCell(2).value, 3000);

  const all = await readWorkbook(await send("GET", "/api/admin/sales.xlsx?scope=all", null, true));
  assert.equal(all.getWorksheet("Sales").getRow(4).getCell(1).value, "TOTAL");
});
