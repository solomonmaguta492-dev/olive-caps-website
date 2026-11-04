import { Router } from "express";
import { readDb } from "../db.js";

const router = Router();

// GET /api/products?category=Beanies&search=olive
router.get("/", (req, res) => {
  const { category, search } = req.query;
  let products = readDb().products.filter((p) => p.active !== false);

  if (category) {
    products = products.filter((p) => p.category === category);
  }
  if (search) {
    const term = String(search).toLowerCase();
    products = products.filter((p) =>
      [p.name, p.description, p.category, ...p.colours].join(" ").toLowerCase().includes(term)
    );
  }
  res.json(products);
});

router.get("/:id", (req, res) => {
  const product = readDb().products.find((p) => p.id === req.params.id && p.active !== false);
  if (!product) return res.status(404).json({ error: "Product not found" });
  res.json(product);
});

export default router;
