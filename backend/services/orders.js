import { readDb, updateDb } from "../db.js";
import { mpesaMode, queryStkStatus } from "./mpesa.js";
import { notifyShopOwner, notifyCustomer } from "./notify.js";

// Order numbers look like OC-20261104-4821.
export function createOrderNumber(existingOrders, date = new Date()) {
  // Uses the date in Kenya, not UTC, so late-night orders get the right day.
  const day = date.toLocaleDateString("en-CA", { timeZone: "Africa/Nairobi" }).replace(/-/g, "");
  let number;
  do {
    number = `OC-${day}-${Math.floor(1000 + Math.random() * 9000)}`;
  } while (existingOrders.some((o) => o.orderNumber === number));
  return number;
}

/*
  Applies an M-Pesa result to its order. Safe to call twice for the
  same payment: a paid order is never paid again or charged stock twice.
*/
export function recordPaymentResult(result) {
  let paidOrder = null;

  const outcome = updateDb((db) => {
    const order = db.orders.find((o) => o.payment.checkoutRequestId === result.checkoutRequestId);
    if (!order) return "unknown";
    if (order.payment.status === "paid") {
      // A late callback can still fill in the receipt number.
      if (!order.payment.reference && result.receipt) order.payment.reference = result.receipt;
      return "duplicate";
    }

    const now = new Date().toISOString();

    if (!result.success) {
      order.payment.status = "failed";
      order.payment.failureReason = result.resultDesc;
      order.updatedAt = now;
      return "failed";
    }

    if (Number(result.amount) < order.total) {
      order.payment.status = "underpaid";
      order.payment.amountReceived = Number(result.amount);
      order.payment.reference = result.receipt;
      order.updatedAt = now;
      return "underpaid";
    }

    order.payment.status = "paid";
    order.payment.amountReceived = Number(result.amount);
    order.payment.reference = result.receipt || null;
    order.payment.payerPhone = result.phone;
    order.payment.paidAt = now;
    order.status = "processing";
    order.updatedAt = now;

    for (const line of order.items) {
      const product = db.products.find((p) => p.id === line.productId);
      if (product) product.stock = Math.max(0, product.stock - line.quantity);
    }

    paidOrder = order;
    return "paid";
  });

  if (paidOrder) {
    notifyShopOwner(paidOrder);
    notifyCustomer(paidOrder);
  }
  return outcome;
}

/*
  Called while the order page waits. If Safaricom's callback hasn't
  arrived, ask Daraja directly (at most every 10 seconds).
*/
export async function checkPendingPayment(orderNumber) {
  if (mpesaMode() === "mock") return;
  const order = readDb().orders.find((o) => o.orderNumber === orderNumber);
  const payment = order?.payment;
  if (!payment || payment.status !== "pending" || !payment.checkoutRequestId) return;

  const now = Date.now();
  const startedAt = Date.parse(payment.requestedAt || order.updatedAt);
  const lastQuery = payment.lastQueryAt ? Date.parse(payment.lastQueryAt) : 0;
  if (now - startedAt < 15000 || now - lastQuery < 10000) return;

  updateDb((db) => {
    const o = db.orders.find((x) => x.orderNumber === orderNumber);
    o.payment.lastQueryAt = new Date(now).toISOString();
  });

  try {
    const result = await queryStkStatus(payment.checkoutRequestId);
    if (result?.done) {
      recordPaymentResult({
        checkoutRequestId: payment.checkoutRequestId,
        success: result.success,
        resultDesc: result.resultDesc,
        amount: order.total,
        receipt: null,
      });
    }
  } catch (err) {
    console.error("M-Pesa status check failed:", err.message);
  }
}
