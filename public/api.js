// ===== AYINI — API CLIENT =====
const API_BASE = (() => {
  // Electron desktop app — use local Express server
  if (window.location.hostname === 'localhost') {
    return window.location.origin + '/api';   // e.g. http://localhost:5757/api
  }
  // Capacitor Android app — update this URL if you redeploy a backend
  if (window.location.protocol === 'capacitor:') {
    return 'https://billing-production-64f7.up.railway.app/api';
  }
  // Browser/web deployment
  return window.location.origin + '/api';
})();
// ===== TOKEN MANAGEMENT =====
function getToken()       { return localStorage.getItem('ayini_token'); }
function setToken(t)      { localStorage.setItem('ayini_token', t); }
function clearToken()     { localStorage.removeItem('ayini_token'); localStorage.removeItem('ayini_user'); }
function getUser()        { try { return JSON.parse(localStorage.getItem('ayini_user')||'null'); } catch { return null; } }
function setUser(u)       { localStorage.setItem('ayini_user', JSON.stringify(u)); }
function isLoggedIn()     { return !!getToken(); }

// ===== BASE FETCH =====
async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  try {
    const res = await fetch(API_BASE + path, { ...options, headers: { ...headers, ...options.headers } });
    if (res.status === 401) { clearToken(); window.location.href = '/login.html'; return null; }
   let data = null;
try {
  data = await res.json();
} catch {
  data = {};
}
   if (!res.ok) {
  throw new Error(
    data?.error ||
    data?.message ||
    `Request failed (${res.status})`
  );
}
    return data;
  } catch (e) {
    console.error('API error:', e.message);
    throw e;
  }
}

// ===== AUTH =====
const Auth = {
  async login(username, password) {
    const data = await apiFetch('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });
    if (data) { setToken(data.token); setUser(data.user); }
    return data;
  },
  logout() { clearToken(); window.location.href = '/login.html'; },
  async changePassword(currentPassword, newPassword) {
    return apiFetch('/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) });
  }
};

// ===== PRODUCTS =====
const Products = {
  getAll(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return apiFetch('/products' + (qs ? '?' + qs : ''));
  },
  getCategories() { return apiFetch('/products/categories'); },
  getById(id)     { return apiFetch(`/products/${id}`); },
  create(data)    { return apiFetch('/products', { method: 'POST', body: JSON.stringify(data) }); },
  update(id, data){ return apiFetch(`/products/${id}`, { method: 'PUT', body: JSON.stringify(data) }); },
  adjustStock(id, delta) { return apiFetch(`/products/${id}/stock`, { method: 'PATCH', body: JSON.stringify({ delta }) }); },
  setStock(id, stock)    { return apiFetch(`/products/${id}/stock`, { method: 'PATCH', body: JSON.stringify({ stock }) }); },
  delete(id)      { return apiFetch(`/products/${id}`, { method: 'DELETE' }); },
};

// ===== BILLS =====
const Bills = {
  getAll(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return apiFetch('/bills' + (qs ? '?' + qs : ''));
  },
  getById(id) { return apiFetch(`/bills/${id}`); },
  create(data){ return apiFetch('/bills', { method: 'POST', body: JSON.stringify(data) }); },
  delete(id)  { return apiFetch(`/bills/${id}`, { method: 'DELETE' }); },
};

// ===== REPORTS =====
const Reports = {
  summary()            { return apiFetch('/reports/summary'); },
  daily(days = 30)     { return apiFetch(`/reports/daily?days=${days}`); },
  topProducts(limit=10){ return apiFetch(`/reports/top-products?limit=${limit}`); },
  paymentBreakdown()   { return apiFetch('/reports/payment-breakdown'); },
  categorySales()      { return apiFetch('/reports/category-sales'); },
};

// ===== UTILITY HELPERS (kept for compatibility) =====
function stockClass(s) { return s > 10 ? 's-ok' : s > 0 ? 's-low' : 's-out'; }
function stockLabel(s) { return s > 10 ? `${s} in stock` : s > 0 ? `Low: ${s}` : 'Out of stock'; }
function fmt(n)        { return '₹' + parseFloat(n||0).toFixed(2); }

// Convert UTC DB timestamp → IST display string (fixes Railway UTC vs India time bug)
function toIST(utcStr, opts = {}) {
  if (!utcStr) return '—';
  const d = new Date(utcStr);
  const defaults = { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' };
  return d.toLocaleString('en-IN', { ...defaults, ...opts });
}
function toISTDate(utcStr) {
  return toIST(utcStr, { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric' });
}
function toISTTime(utcStr) {
  return toIST(utcStr, { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' });
}

function showToast(msg, duration = 2500) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), duration);
}

function setNavDate() {
  const el = document.getElementById('navDate');
  if (el) el.textContent = new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

// Guard: redirect to login if not authenticated
function requireAuth() {
  if (!isLoggedIn()) { window.location.href = '/login.html'; }
}

document.addEventListener('DOMContentLoaded', () => {
  setNavDate();
  // Show logged-in user in navbar if element exists
  const userEl = document.getElementById('navUser');
  if (userEl) { const u = getUser(); if (u) userEl.textContent = u.username; }
});
