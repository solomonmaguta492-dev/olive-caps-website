import { Router } from "express";
import { readDb } from "../db.js";
import { paymentMethods } from "../services/payments.js";
import { mpesaMode } from "../services/mpesa.js";

const router = Router();

// Shop details, delivery zones, pickup points, wholesale rules and ways to pay.
router.get("/", (req, res) => {
  const settings = readDb().settings;
  res.json({ ...settings, paymentMethods: paymentMethods(settings), mpesaTestMode: mpesaMode() === "mock" });
});

export default router;
