import { test } from "node:test";
import assert from "node:assert/strict";
import { createOrderNumber } from "../services/orders.js";

test("order number uses the Kenya date", () => {
  // 22:30 UTC on 4 Nov is 01:30 on 5 Nov in Nairobi.
  const number = createOrderNumber([], new Date("2026-11-04T22:30:00Z"));
  assert.match(number, /^OC-20261105-\d{4}$/);
});

test("order numbers are not repeated", () => {
  const date = new Date("2026-11-04T09:00:00Z");
  const existing = [];
  for (let i = 0; i < 200; i++) {
    existing.push({ orderNumber: createOrderNumber(existing, date) });
  }
  const unique = new Set(existing.map((o) => o.orderNumber));
  assert.equal(unique.size, existing.length);
});
