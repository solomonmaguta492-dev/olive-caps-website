import { Router } from "express";
import { readDb, updateDb } from "../db.js";
import { priceOrder, normalisePhone } from "../utils/pricing.js";
import { createOrderNumber, checkPendingPayment, submitMpesaCode } from "../services/orders.js";
import { paymentMethods, normaliseMpesaCode } from "../services/payments.js";

const router = Router();

function clean(value, max = 200) {
  return String(value ?? "").trim().slice(0, max);
}

function validateCustomer(input = {}) {
  const name = clean(input.name, 80);
  const phone = normalisePhone(input.phone);
  const email = clean(input.email, 120);

  if (name.length < 2) throw new Error("Please enter your full name");
  if (!phone) throw new Error("Please enter a valid Kenyan phone number, e.g. 0712 345 678");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Please enter a valid email address or leave it empty");
  }
  return { name, phone, email };
}

function validateFulfilment(input = {}, settings) {
  if (input.method === "pickup") {
    const point = settings.pickupPoints.find((p) => p.id === input.pickupPointId);
    if (!point) throw new Error("Please choose a pickup point");
    return { method: "pickup", pickupPointId: point.id, pickupPoint: point.name };
  }

  if (input.method === "delivery") {
    const zone = settings.deliveryZones.find((z) => z.id === input.zoneId);
    const county = clean(input.county, 60);
    const town = clean(input.town, 60);
    const address = clean(input.address, 250);
    if (!zone) throw new Error("Please choose a delivery area");
    if (!county || !town) throw new Error("Please enter your county and town");
    if (address.length < 5) throw new Error("Please enter a delivery address or landmark");
    return { method: "delivery", zoneId: zone.id, zone: zone.name, county, town, address };
  }

  throw new Error("Please choose delivery or pickup");
}

// Hides personal details when an order is viewed by order number.
export function publicOrder(order) {
  return {
    orderNumber: order.orderNumber,
    createdAt: order.createdAt,
    status: order.status,
    customerName: order.customer.name.split(" ")[0],
    phone: order.customer.phone.replace(/^(\d{6})\d{3}/, "$1***"),
    items: order.items,
    subtotal: order.subtotal,
    deliveryFee: order.deliveryFee,
    total: order.total,
    fulfilment: {
      method: order.fulfilment.method,
      place: order.fulfilment.pickupPoint || `${order.fulfilment.town}, ${order.fulfilment.county}`,
    },
    payment: {
      type: order.payment.type || "stk",
      method: order.payment.method,
      status: order.payment.status,
      reference: order.payment.reference,
      amountReceived: order.payment.amountReceived,
      paidAt: order.payment.paidAt,
      failureReason: order.payment.failureReason,
    },
  };
}

// POST /api/orders: creates an unpaid order with prices worked out on the server.
router.post("/", (req, res) => {
  try {
    const order = updateDb((db) => {
      const customer = validateCustomer(req.body.customer);
      const fulfilment = validateFulfilment(req.body.fulfilment, db.settings);
      const priced = priceOrder(req.body.items, db.products, db.settings, fulfilment);
      const available = paymentMethods(db.settings);
      const type = req.body.paymentMethod || available[0];
      if (!available.includes(type)) throw new Error("Please choose a way to pay");
      const now = new Date().toISOString();

      const newOrder = {
        orderNumber: createOrderNumber(db.orders),
        createdAt: now,
        updatedAt: now,
        status: "awaiting_payment",
        customer,
        items: priced.lines,
        subtotal: priced.subtotal,
        deliveryFee: priced.deliveryFee,
        total: priced.total,
        fulfilment,
        notes: clean(req.body.notes, 300),
        payment: {
          type,
          method: type === "sendMoney" ? "M-Pesa Send Money" : "M-Pesa prompt",
          status: "unpaid",
          reference: null,
          amountReceived: 0,
          paidAt: null,
        },
      };
      db.orders.push(newOrder);
      return newOrder;
    });

    res.status(201).json(publicOrder(order));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/orders/:orderNumber/mpesa-code { code }: Send Money confirmation code.
router.post("/:orderNumber/mpesa-code", (req, res) => {
  const code = normaliseMpesaCode(req.body.code);
  if (!code) return res.status(400).json({ error: "Enter the 10-character M-Pesa code from your SMS, e.g. SKL3X2ABCD" });
  try {
    res.json(publicOrder(submitMpesaCode(req.params.orderNumber, code)));
  } catch (err) {
    const status = err.message === "Order not found" ? 404 : 400;
    res.status(status).json({ error: err.message });
  }
});

router.get("/:orderNumber", async (req, res) => {
  const { orderNumber } = req.params;
  if (!readDb().orders.some((o) => o.orderNumber === orderNumber)) {
    return res.status(404).json({ error: "Order not found" });
  }
  await checkPendingPayment(orderNumber);
  const order = readDb().orders.find((o) => o.orderNumber === orderNumber);
  res.json(publicOrder(order));
});

export default router;
