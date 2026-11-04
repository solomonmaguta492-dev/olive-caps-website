import { Router } from "express";
import { readDb } from "../db.js";

const router = Router();

// Shop details, delivery zones, pickup points and wholesale rules.
router.get("/", (req, res) => {
  res.json(readDb().settings);
});

export default router;
