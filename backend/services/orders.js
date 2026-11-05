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

// Marks an order paid and takes its caps out of stock.
function markPaid(db, order, { amount, reference, phone }) {
  const now = new Date().toISOString();
  order.payment.status = "paid";
  order.payment.amountReceived = Number(amount);
  order.payment.reference = reference || null;
  if (phone) order.payment.payerPhone = phone;
  order.payment.paidAt = now;
  order.status = "processing";
  order.updatedAt = now;

  for (const line of order.items) {
    const product = db.products.find((p) => p.id === line.productId);
    if (product) product.stock = Math.max(0, product.stock - line.quantity);
  }
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

    markPaid(db, order, { amount: result.amount, reference: result.receipt, phone: result.phone });
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

/*
  Send Money: the customer enters the M-Pesa code from their SMS.
  The order waits until the shop owner checks the code and confirms.
*/
export function submitMpesaCode(orderNumber, code) {
  return updateDb((db) => {
    const order = db.orders.find((o) => o.orderNumber === orderNumber);
    if (!order) throw new Error("Order not found");
    if (order.payment.status === "paid") throw new Error("This order is already paid");
    if (order.status === "cancelled") throw new Error("This order was cancelled");

    const usedElsewhere = db.orders.some((o) => o.orderNumber !== orderNumber && o.payment.reference === code);
    if (usedElsewhere) throw new Error("This M-Pesa code was already used for another order");

    const now = new Date().toISOString();
    order.payment.type = "sendMoney";
    order.payment.method = "M-Pesa Send Money";
    order.payment.status = "awaiting_confirmation";
    order.payment.reference = code;
    order.payment.submittedAt = now;
    order.payment.failureReason = undefined;
    order.updatedAt = now;
    return order;
  });
}

// The shop owner confirms (money received) or rejects (code not found) a Send Money payment.
export function reviewManualPayment(orderNumber, action, amount) {
  let paidOrder = null;
  const order = updateDb((db) => {
    const o = db.orders.find((x) => x.orderNumber === orderNumber);
    if (!o) throw new Error("Order not found");
    if (o.payment.status === "paid") throw new Error("This order is already paid");

    if (action === "confirm") {
      const received = amount === undefined || amount === "" ? o.total : Number(amount);
      if (!(received > 0)) throw new Error("Enter the amount you received");
      if (received < o.total) {
        o.payment.status = "underpaid";
        o.payment.amountReceived = received;
        o.updatedAt = new Date().toISOString();
        return o;
      }
      markPaid(db, o, { amount: received, reference: o.payment.reference });
      paidOrder = o;
      return o;
    }

    if (action === "reject") {
      o.payment.status = "rejected";
      o.payment.failureReason = "We couldn't find this M-Pesa payment. Check the code or send the money again.";
      o.updatedAt = new Date().toISOString();
      return o;
    }

    throw new Error("Unknown action");
  });

  if (paidOrder) {
    notifyShopOwner(paidOrder);
    notifyCustomer(paidOrder);
  }
  return order;
}
