import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCallback, mockCallback, darajaTimestamp } from "../services/mpesa.js";

test("timestamp uses Kenya time in YYYYMMDDHHmmss", () => {
  // 21:30 UTC is 00:30 the next day in Nairobi.
  const ts = darajaTimestamp(new Date("2026-11-04T21:30:05Z"));
  assert.equal(ts, "20261105003005");
});

test("parses a successful callback", () => {
  const result = parseCallback(mockCallback("ws_CO_1", 1050, "254712345678"));
  assert.equal(result.success, true);
  assert.equal(result.checkoutRequestId, "ws_CO_1");
  assert.equal(result.amount, 1050);
  assert.equal(result.phone, "254712345678");
  assert.match(result.receipt, /^MOCK/);
});

test("parses a cancelled payment", () => {
  const body = {
    Body: {
      stkCallback: {
        CheckoutRequestID: "ws_CO_2",
        ResultCode: 1032,
        ResultDesc: "Request cancelled by user",
      },
    },
  };
  const result = parseCallback(body);
  assert.equal(result.success, false);
  assert.equal(result.resultCode, 1032);
});

test("returns null for a body that is not a callback", () => {
  assert.equal(parseCallback({ hello: "world" }), null);
});
