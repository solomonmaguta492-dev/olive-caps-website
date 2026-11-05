import { saleRow } from "./sales.js";

/*
  Sends each paid order to a Google Sheet through a small Apps Script
  web app (see docs/GOOGLE-SHEETS.md). Does nothing until
  SHEETS_WEBHOOK_URL is set, and never stops an order if Google is down.
*/
export async function sendSaleToSheet(order) {
  const url = process.env.SHEETS_WEBHOOK_URL;
  if (!url) return "skipped";

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret: process.env.SHEETS_SECRET || "", row: saleRow(order) }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok === false) throw new Error(data.error || `status ${res.status}`);
    return "sent";
  } catch (err) {
    console.error(`Google Sheet: couldn't add ${order.orderNumber}: ${err.message}`);
    return "failed";
  }
}
