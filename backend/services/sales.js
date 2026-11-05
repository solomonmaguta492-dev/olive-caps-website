// One row per sale, used by the Excel report.
export const SALES_HEADERS = [
  "Date",
  "Order number",
  "Customer",
  "Phone",
  "Email",
  "Items",
  "Caps",
  "Subtotal (KES)",
  "Delivery (KES)",
  "Total (KES)",
  "Amount paid (KES)",
  "Payment method",
  "Payment status",
  "M-Pesa reference",
  "Pickup / delivery",
  "Order status",
];

function kenyaTime(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-GB", { timeZone: "Africa/Nairobi", hour12: false }).replace(",", "");
}

export function saleRow(order) {
  const f = order.fulfilment;
  const place = f.method === "pickup" ? `Pickup: ${f.pickupPoint}` : `Delivery: ${f.town}, ${f.county} - ${f.address}`;
  const items = order.items
    .map((i) => `${i.quantity} x ${i.name} (${i.colour}${i.size ? `, size ${i.size}` : ""})`)
    .join("; ");

  return [
    kenyaTime(order.payment.paidAt || order.createdAt),
    order.orderNumber,
    order.customer.name,
    `+${order.customer.phone}`,
    order.customer.email || "",
    items,
    order.items.reduce((sum, i) => sum + i.quantity, 0),
    order.subtotal,
    order.deliveryFee,
    order.total,
    order.payment.amountReceived || 0,
    order.payment.method || "",
    order.payment.status,
    order.payment.reference || "",
    place,
    order.status,
  ];
}
