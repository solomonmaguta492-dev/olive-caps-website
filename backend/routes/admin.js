import { Router } from "express";
import { readDb, updateDb } from "../db.js";
import { adminAuth } from "../middleware/adminAuth.js";

const router = Router();
router.use(adminAuth);

const ORDER_STATUSES = ["awaiting_payment", "processing", "ready_for_pickup", "dispatched", "completed", "cancelled"];

router.get("/check", (req, res) => res.json({ ok: true }));

// Newest orders first.
router.get("/orders", (req, res) => {
  const orders = [...readDb().orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  res.json(orders);
});

router.patch("/orders/:orderNumber", (req, res) => {
  const { status } = req.body;
  if (!ORDER_STATUSES.includes(status)) return res.status(400).json({ error: "Unknown status" });

  const order = updateDb((db) => {
    const o = db.orders.find((x) => x.orderNumber === req.params.orderNumber);
    if (o) {
      o.status = status;
      o.updatedAt = new Date().toISOString();
    }
    return o;
  });
  if (!order) return res.status(404).json({ error: "Order not found" });
  res.json(order);
});

function productFromBody(body, categories) {
  const name = String(body.name || "").trim();
  const price = Number(body.price);
  const stock = Number.parseInt(body.stock, 10);
  const wholesalePrice = body.wholesalePrice === "" || body.wholesalePrice == null ? null : Number(body.wholesalePrice);
  const toList = (value) =>
    (Array.isArray(value) ? value : String(value || "").split(","))
      .map((v) => String(v).trim())
      .filter(Boolean);
  const colours = toList(body.colours);
  const sizes = toList(body.sizes);

  if (!name) throw new Error("Name is required");
  if (!categories.includes(body.category)) throw new Error("Choose a valid category");
  if (!(price > 0)) throw new Error("Price must be more than 0");
  if (!(stock >= 0)) throw new Error("Stock must be 0 or more");
  if (wholesalePrice !== null && !(wholesalePrice > 0 && wholesalePrice <= price)) {
    throw new Error("Wholesale price must be between 1 and the normal price");
  }

  return {
    name,
    category: body.category,
    price,
    wholesalePrice,
    description: String(body.description || "").trim(),
    colours: colours.length ? colours : ["One colour"],
    sizes,
    imageBack: String(body.imageBack || "").trim() || undefined,
    imageBackLabel: String(body.imageBackLabel || "").trim() || undefined,
    image: String(body.image || "images/baseball-cap.svg").trim(),
    stock,
    active: body.active !== false,
  };
}

// Includes hidden products so they can be switched back on.
router.get("/products", (req, res) => res.json(readDb().products));

router.post("/products", (req, res) => {
  try {
    const product = updateDb((db) => {
      const next = db.products.reduce((max, p) => Math.max(max, Number(p.id.slice(1)) || 0), 0) + 1;
      const p = { id: "p" + String(next).padStart(3, "0"), ...productFromBody(req.body, db.settings.categories) };
      db.products.push(p);
      return p;
    });
    res.status(201).json(product);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put("/products/:id", (req, res) => {
  try {
    const product = updateDb((db) => {
      const index = db.products.findIndex((p) => p.id === req.params.id);
      if (index === -1) return null;
      db.products[index] = { id: req.params.id, ...productFromBody(req.body, db.settings.categories) };
      return db.products[index];
    });
    if (!product) return res.status(404).json({ error: "Product not found" });
    res.json(product);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Quick stock update from the dashboard.
router.patch("/products/:id/stock", (req, res) => {
  const stock = Number.parseInt(req.body.stock, 10);
  if (!(stock >= 0)) return res.status(400).json({ error: "Stock must be 0 or more" });

  const product = updateDb((db) => {
    const p = db.products.find((x) => x.id === req.params.id);
    if (p) p.stock = stock;
    return p;
  });
  if (!product) return res.status(404).json({ error: "Product not found" });
  res.json(product);
});

router.delete("/products/:id", (req, res) => {
  const removed = updateDb((db) => {
    const index = db.products.findIndex((p) => p.id === req.params.id);
    return index === -1 ? null : db.products.splice(index, 1)[0];
  });
  if (!removed) return res.status(404).json({ error: "Product not found" });
  res.status(204).end();
});

export default router;
