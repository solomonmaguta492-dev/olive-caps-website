import { cartCount } from "./cart.js";
import "./whatsapp-chooser.js";

const DEFAULT_WHATSAPP = "254790868908";

export function formatKES(amount) {
  return "KES " + Number(amount || 0).toLocaleString("en-KE");
}

// Escapes text before it goes into innerHTML.
export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function whatsappLink(message, number = DEFAULT_WHATSAPP) {
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

export function updateCartBadge() {
  document.querySelectorAll("[data-cart-count]").forEach((el) => {
    el.textContent = cartCount();
  });
}

let toastTimer;
export function showToast(message) {
  let toast = document.querySelector(".toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.className = "toast";
    toast.setAttribute("role", "status");
    document.body.append(toast);
  }
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2200);
}

export function stockLabel(stock) {
  if (stock <= 0) return { text: "Sold out", cls: "stock-out" };
  if (stock <= 5) return { text: `Only ${stock} left`, cls: "stock-low" };
  return { text: "In stock", cls: "stock-in" };
}

export function statusText(status) {
  return String(status || "").replace(/_/g, " ");
}

// Fills shop contacts (WhatsApp, phone, email) in the header and footer.
export function applyShopSettings(settings) {
  const number = settings.whatsappNumber || DEFAULT_WHATSAPP;
  document.querySelectorAll("[data-whatsapp]").forEach((el) => {
    el.href = whatsappLink(el.dataset.whatsapp || "Hi Olive Caps, I'd like to ask about your caps.", number);
  });
  // Icon buttons keep their icon; plain text links show the number or address.
  document.querySelectorAll("[data-shop-phone]").forEach((el) => {
    if (!el.children.length) el.textContent = settings.phone;
    el.href = "tel:" + settings.phone.replace(/\s/g, "");
  });
  document.querySelectorAll("[data-shop-email]").forEach((el) => {
    if (!el.children.length) el.textContent = settings.email;
    el.href = "mailto:" + settings.email;
  });
  if (settings.instagram) {
    document.querySelectorAll("[data-shop-instagram]").forEach((el) => {
      el.href = `https://www.instagram.com/${settings.instagram}/`;
      const label = el.querySelector("[data-ig-text]") || (el.children.length ? null : el);
      if (label) label.textContent = `@${settings.instagram}`;
    });
  }
  document.querySelectorAll("[data-year]").forEach((el) => {
    el.textContent = new Date().getFullYear();
  });
}

updateCartBadge();
window.addEventListener("cart:changed", updateCartBadge);
window.addEventListener("storage", updateCartBadge);
