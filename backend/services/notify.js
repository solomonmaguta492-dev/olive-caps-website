/*
  Order alerts. For now they print to the server log and show in the
  admin dashboard. Plug in email (e.g. Nodemailer) or SMS (e.g. Africa's
  Talking) here later.
*/

export function notifyShopOwner(order) {
  console.log(
    `[NEW PAID ORDER] ${order.orderNumber} | KES ${order.payment.amountReceived} | ` +
      `${order.customer.name} ${order.customer.phone} | M-Pesa ${order.payment.reference}`
  );
}

export function notifyCustomer(order) {
  console.log(`[CUSTOMER CONFIRMATION] ${order.orderNumber} sent to ${order.customer.phone}`);
}
