/*
  All calls to the backend. When the site is served by the backend
  the API is on the same address, so the base is empty.
*/
const API_BASE = window.OLIVE_API_BASE || "";

async function request(path, options = {}) {
  const res = await fetch(API_BASE + path, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  if (res.status === 204) return null;

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong. Please try again.");
  return data;
}

export function getSettings() {
  return request("/api/settings");
}

export function getProducts() {
  return request("/api/products");
}

export function createOrder(order) {
  return request("/api/orders", { method: "POST", body: JSON.stringify(order) });
}

export function getHealth() {
  return request("/api/health");
}

export function getOrder(orderNumber) {
  return request(`/api/orders/${encodeURIComponent(orderNumber)}`);
}

export function submitMpesaCode(orderNumber, code) {
  return request(`/api/orders/${encodeURIComponent(orderNumber)}/mpesa-code`, { method: "POST", body: JSON.stringify({ code }) });
}

export function startMpesaPayment(orderNumber, phone) {
  return request("/api/mpesa/stkpush", { method: "POST", body: JSON.stringify({ orderNumber, phone }) });
}

// Admin calls send the password saved for this browser tab.
function adminRequest(path, password, options = {}) {
  return request(path, { ...options, headers: { "x-admin-password": password } });
}

export const admin = {
  check: (pw) => adminRequest("/api/admin/check", pw),
  orders: (pw) => adminRequest("/api/admin/orders", pw),
  setOrderStatus: (pw, orderNumber, status) =>
    adminRequest(`/api/admin/orders/${orderNumber}`, pw, { method: "PATCH", body: JSON.stringify({ status }) }),
  products: (pw) => adminRequest("/api/admin/products", pw),
  addProduct: (pw, product) =>
    adminRequest("/api/admin/products", pw, { method: "POST", body: JSON.stringify(product) }),
  updateProduct: (pw, id, product) =>
    adminRequest(`/api/admin/products/${id}`, pw, { method: "PUT", body: JSON.stringify(product) }),
  setStock: (pw, id, stock) =>
    adminRequest(`/api/admin/products/${id}/stock`, pw, { method: "PATCH", body: JSON.stringify({ stock }) }),
  deleteProduct: (pw, id) => adminRequest(`/api/admin/products/${id}`, pw, { method: "DELETE" }),
  reviewPayment: (pw, orderNumber, action) =>
    adminRequest(`/api/admin/orders/${orderNumber}/payment`, pw, { method: "PATCH", body: JSON.stringify({ action }) }),
};
