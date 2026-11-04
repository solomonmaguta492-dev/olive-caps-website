/*
  When a customer taps any WhatsApp link, ask which app to open:
  WhatsApp (also WhatsApp Beta) or WhatsApp Business.
  On Android we can open the exact app; on iPhone and computers
  the phone or browser decides, so both choices use wa.me.
*/

const APPS = {
  whatsapp: { label: "WhatsApp", note: "Also opens WhatsApp Beta", androidPackage: "com.whatsapp" },
  business: { label: "WhatsApp Business", note: "For WhatsApp Business users", androidPackage: "com.whatsapp.w4b" },
};

function isAndroid() {
  return /Android/i.test(navigator.userAgent);
}

// Builds the link that opens one specific app, falling back to wa.me if it isn't installed.
export function appLink(waUrl, app) {
  if (!isAndroid()) return waUrl;

  const url = new URL(waUrl);
  const phone = url.pathname.replace(/\D/g, "");
  const text = url.searchParams.get("text") || "";
  const query = `phone=${phone}&text=${encodeURIComponent(text)}`;
  const fallback = encodeURIComponent(waUrl);
  return `intent://send/?${query}#Intent;scheme=whatsapp;package=${APPS[app].androidPackage};S.browser_fallback_url=${fallback};end`;
}

let dialog;

function buildDialog() {
  dialog = document.createElement("dialog");
  dialog.className = "wa-chooser";
  dialog.setAttribute("aria-labelledby", "wa-chooser-title");
  dialog.innerHTML = `
    <h2 id="wa-chooser-title">Open chat with</h2>
    <a class="wa-option" data-app="whatsapp" href="#">
      <strong>${APPS.whatsapp.label}</strong><small>${APPS.whatsapp.note}</small>
    </a>
    <a class="wa-option wa-option-business" data-app="business" href="#">
      <strong>${APPS.business.label}</strong><small>${APPS.business.note}</small>
    </a>
    <button type="button" class="btn btn-outline btn-block" data-close>Cancel</button>`;
  document.body.append(dialog);

  dialog.addEventListener("click", (event) => {
    // A tap on the dark area outside the box closes it.
    if (event.target === dialog || event.target.closest("[data-close]")) dialog.close();
    if (event.target.closest(".wa-option")) setTimeout(() => dialog.close(), 300);
  });
}

function openChooser(waUrl) {
  if (!dialog) buildDialog();
  const newTab = !isAndroid();
  dialog.querySelectorAll(".wa-option").forEach((a) => {
    a.href = appLink(waUrl, a.dataset.app);
    a.target = newTab ? "_blank" : "";
    a.rel = newTab ? "noopener" : "";
  });
  if (typeof dialog.showModal === "function") {
    dialog.showModal();
  } else {
    // Very old browsers without <dialog>: go straight to WhatsApp.
    window.location.href = waUrl;
  }
}

// One listener catches every WhatsApp link on the page, including ones added later.
document.addEventListener("click", (event) => {
  const link = event.target.closest('a[href^="https://wa.me/"]');
  if (!link || link.closest(".wa-chooser")) return;
  event.preventDefault();
  openChooser(link.href);
});
