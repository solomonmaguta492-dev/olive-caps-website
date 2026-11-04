import { updateDb } from "../db.js";
import { notifyShopOwner, notifyCustomer } from "./notify.js";

// Order numbers look like OC-20261104-4821.
export function createOrderNumber(existingOrders, date = new Date()) {
  const day = date.toISOString().slice(0, 10).replace(/-/g, "");
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
    if (order.payment.status === "paid") return "duplicate";

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
    order.payment.reference = result.receipt;
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
