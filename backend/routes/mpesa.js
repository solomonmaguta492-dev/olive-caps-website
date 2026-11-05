import { Router } from "express";
import { readDb, updateDb } from "../db.js";
import { normalisePhone } from "../utils/pricing.js";
import { sendStkPush, parseCallback, mockCallback, mpesaMode } from "../services/mpesa.js";
import { recordPaymentResult } from "../services/orders.js";
import { paymentMethods } from "../services/payments.js";

const router = Router();

// POST /api/mpesa/stkpush { orderNumber, phone }
router.post("/stkpush", async (req, res) => {
  const order = readDb().orders.find((o) => o.orderNumber === req.body.orderNumber);
  if (!order) return res.status(404).json({ error: "Order not found" });
  if (order.payment.status === "paid") return res.status(400).json({ error: "This order is already paid" });
  if (order.status === "cancelled") return res.status(400).json({ error: "This order was cancelled" });

  if (!paymentMethods(readDb().settings).includes("stk")) {
    return res.status(400).json({ error: "The M-Pesa prompt isn't available yet. Please use Send Money." });
  }

  const phone = normalisePhone(req.body.phone || order.customer.phone);
  if (!phone) return res.status(400).json({ error: "Please enter a valid Safaricom number" });

  try {
    const result = await sendStkPush({ phone, amount: order.total, orderNumber: order.orderNumber });

    updateDb((db) => {
      const o = db.orders.find((x) => x.orderNumber === order.orderNumber);
      o.payment.status = "pending";
      o.payment.type = "stk";
      o.payment.method = "M-Pesa prompt";
      o.payment.checkoutRequestId = result.checkoutRequestId;
      o.payment.requestedAt = new Date().toISOString();
      o.payment.lastQueryAt = undefined;
      o.payment.failureReason = undefined;
      o.updatedAt = new Date().toISOString();
    });

    // In mock mode, pretend Safaricom confirmed the payment after 4 seconds.
    if (mpesaMode() === "mock") {
      setTimeout(() => {
        recordPaymentResult(parseCallback(mockCallback(result.checkoutRequestId, order.total, phone)));
      }, 4000);
    }

    res.json({ message: result.customerMessage || "Check your phone and enter your M-Pesa PIN" });
  } catch (err) {
    console.error("STK push failed:", err.message);
    res.status(502).json({ error: "We couldn't reach M-Pesa. Please try again." });
  }
});

/*
  Safaricom calls this URL with the payment result.
  Always answer 200 so Safaricom does not keep retrying.
*/
router.post("/callback", (req, res) => {
  const result = parseCallback(req.body);
  if (result) {
    const outcome = recordPaymentResult(result);
    console.log(`M-Pesa callback ${result.checkoutRequestId}: ${outcome}`);
  }
  res.json({ ResultCode: 0, ResultDesc: "Accepted" });
});

export default router;
