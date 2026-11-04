import { getSettings } from "./api.js";
import { formatKES, escapeHtml, applyShopSettings } from "./ui.js";

// Fills delivery fees, pickup points and contacts from the shop settings.
async function init() {
  try {
    const settings = await getSettings();
    applyShopSettings(settings);

    document.getElementById("zones-table").innerHTML = settings.deliveryZones
      .map((z) => `<tr><td>${escapeHtml(z.name)}</td><td>${formatKES(z.fee)}</td><td>${escapeHtml(z.days)}</td></tr>`)
      .join("");

    document.getElementById("pickup-list").innerHTML = settings.pickupPoints
      .map((p) => `<li><strong>${escapeHtml(p.name)}</strong><br>${escapeHtml(p.hours)}</li>`)
      .join("");

    if (settings.wholesale?.note) {
      document.getElementById("wholesale-note").textContent = settings.wholesale.note;
    }
  } catch {
    document.getElementById("zones-table").innerHTML = `<tr><td colspan="3">Please contact us for delivery fees.</td></tr>`;
    document.getElementById("pickup-list").innerHTML = `<li>Please contact us for pickup points.</li>`;
  }
}

init();
