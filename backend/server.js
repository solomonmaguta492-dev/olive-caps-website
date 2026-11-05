import "dotenv/config";
import express from "express";
import cors from "cors";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import settingsRoutes from "./routes/settings.js";
import productRoutes from "./routes/products.js";
import orderRoutes from "./routes/orders.js";
import mpesaRoutes from "./routes/mpesa.js";
import adminRoutes from "./routes/admin.js";
import { mpesaMode } from "./services/mpesa.js";

const here = dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "100kb" }));

  app.use("/api/settings", settingsRoutes);
  app.use("/api/products", productRoutes);
  app.use("/api/orders", orderRoutes);
  app.use("/api/mpesa", mpesaRoutes);
  app.use("/api/admin", adminRoutes);

  app.get("/api/health", (req, res) => res.json({ ok: true, mpesa: mpesaMode() }));
  app.use("/api", (req, res) => res.status(404).json({ error: "Not found" }));

  // The same server hosts the website.
  const site = join(here, "..", "frontend");
  app.use(express.static(site));
  app.use((req, res) => res.status(404).sendFile(join(site, "404.html")));

  return app;
}

// Start listening only when run directly (not in tests).
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = process.env.PORT || 3000;
  createApp().listen(port, () => {
    console.log(`Olive Caps running on http://localhost:${port} (M-Pesa: ${mpesaMode()})`);
    if (mpesaMode() === "mock") {
      console.log("M-Pesa is in test mode: no real prompts are sent. See docs/MPESA-SETUP.md to switch.");
    } else {
      const needed = ["MPESA_CONSUMER_KEY", "MPESA_CONSUMER_SECRET", "MPESA_SHORTCODE", "MPESA_PASSKEY", "MPESA_CALLBACK_URL"];
      const missing = needed.filter((name) => !process.env[name]);
      if (missing.length) console.warn(`M-Pesa will not work until you set these in backend/.env: ${missing.join(", ")}`);
    }
  });
}
