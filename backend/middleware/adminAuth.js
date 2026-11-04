import { timingSafeEqual } from "node:crypto";

// Admin requests must send the password in the x-admin-password header.
export function adminAuth(req, res, next) {
  const expected = process.env.ADMIN_PASSWORD || "";
  const given = req.get("x-admin-password") || "";

  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  const ok = expected.length > 0 && a.length === b.length && timingSafeEqual(a, b);

  if (!ok) return res.status(401).json({ error: "Wrong admin password" });
  next();
}
