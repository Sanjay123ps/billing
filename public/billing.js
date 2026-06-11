// ===== BILLING PAGE JS — API VERSION =====
let allProducts   = [];
let billItems     = [];
let activeCat     = '';
let currentBillNo = 1;
let whatsappSent  = false; // WhatsApp must be sent before Process Payment / Print

// ── Business details ──────────────────────────────────────────────────────────
const SHOP_NAME    = 'AYINI HOME PRODUCTS';
const SHOP_ADDR1   = '13/236, Ranganathapuram';
const SHOP_ADDR2   = 'Periyanaicken Palayam, Coimbatore - 641020';
const SHOP_PHONE   = '+91 7397130039';
const SHOP_CATALOG = 'https://wa.me/c/917397130039';
const UPI_ID       = '7397130039@upi';
const UPI_NAME     = 'Ayini Home Products';

// ── Grinding Rates ───────────────────────────────────────────────────────────
function getGrindingRate() {
  return parseFloat(localStorage.getItem('grinding_idly_maavu_rate')) || 10;
}
function setGrindingRate(r) {
  localStorage.setItem('grinding_idly_maavu_rate', r);
}

const GRINDING_RATES = {
  idly_maavu: {
    label: 'Idly Maavu Grinding',
    get rate() { return getGrindingRate(); },
    unit: 'kg'
  },
};

function addGrindingService(type, weightKg) {
  const service = GRINDING_RATES[type];

  if (!service) {
    showToast('Invalid grinding service');
    return;
  }

  const weight = parseFloat(weightKg);

  if (!weight || weight <= 0) {
    showToast('Enter valid weight');
    return;
  }

  const existing = billItems.find(i => i.id === `grinding_${type}`);

  const total = service.rate * weight;

  if (existing) {
    existing.qty = weight;
    existing.price = service.rate;
    existing.total = total;
  } else {
    billItems.push({
      id: `grinding_${type}`,
      name: service.label,
      category: 'Services',
      price: service.rate,
      qty: weight,
      stock: 9999,
      unit: service.unit,
      is_service: true,
      total
    });
  }

  renderBill();
}



// Load GST rate from settings
async function loadGstRateFromSettings() {
  try {
    // First try localStorage for instant update (set by settings page on save)
    const cachedRate = localStorage.getItem('ayini_gst_rate');
    
    const token = getToken();
    const response = await fetch('/api/settings', {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    const data = await response.json();
    if (data.success && data.settings) {
      const gstRate = data.settings.gst_rate;
      // Keep localStorage in sync
      localStorage.setItem('ayini_gst_rate', String(gstRate));
      applyGstRateToUI(gstRate);
    } else if (cachedRate !== null) {
      applyGstRateToUI(parseFloat(cachedRate));
    }
  } catch (e) {
    console.error('Failed to load GST from settings:', e);
    // Fallback to localStorage
    const cachedRate = localStorage.getItem('ayini_gst_rate');
    if (cachedRate !== null) applyGstRateToUI(parseFloat(cachedRate));
  }
}

function applyGstRateToUI(gstRate) {
  const gstDropdown = document.getElementById('gstRate');
  if (!gstDropdown) return;
  const hasOption = Array.from(gstDropdown.options).some(o => o.value === String(gstRate));
  if (hasOption) {
    gstDropdown.value = String(gstRate);
  } else {
    gstDropdown.value = 'custom';
    const customInput = document.getElementById('customGst');
    if (customInput) {
      customInput.value = gstRate;
      customInput.style.display = 'block';
    }
  }
  if (typeof recalc === 'function') recalc();
}

async function init() {
  requireAuth();
  try {
    allProducts = await Products.getAll();
    populateQuickSelect();
    renderCatFilters();
    renderProducts(allProducts);
    // Get bill number from the DB counter (accurate even after deletions)
    const summary = await Reports.summary();
    currentBillNo = summary?.next_bill_no || 1;
    document.getElementById('billNo').textContent = `Bill #${String(currentBillNo).padStart(3,'0')}`;
    document.getElementById('billDt').textContent = new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day:'numeric', month:'long', year:'numeric' });
    document.getElementById('codeInput')?.focus();
    setActionLock(true); // lock Process Payment & Print until WhatsApp sent
    initGrindingPanel();
    await loadGstRateFromSettings();
  } catch(e) {
    showToast('Failed to load products');
  }
}

function populateQuickSelect() {
  const sel = document.getElementById('quickProduct');
  sel.innerHTML = '<option value="">Choose product...</option>';
  allProducts.forEach(p => {
    const o = document.createElement('option');
    o.value = p.id;
    o.textContent = `${p.code ? `[${p.code}] ` : ''}${p.name} — ₹${p.price}`;
    sel.appendChild(o);
  });
}

function renderCatFilters() {
  const cats = [...new Set(allProducts.map(p => p.category))];
  const wrap = document.getElementById('catFilters');
  wrap.innerHTML = `<span class="cat-chip ${activeCat===''?'active':''}" onclick="setCat('')">All</span>` +
    cats.map(c => `<span class="cat-chip ${activeCat===c?'active':''}" onclick="setCat('${c}')">${c.replace(/'/g,"&#39;")}</span>`).join('');
}

function setCat(c) { activeCat = c; renderCatFilters(); filterProducts(); }

function filterProducts() {
  const q = document.getElementById('searchInput').value.toLowerCase();
  let list = allProducts;
  if (activeCat) list = list.filter(p => p.category === activeCat);
  if (q) list = list.filter(p => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q));
  renderProducts(list);
}

function renderProducts(list) {
  const g = document.getElementById('productGrid');
  if (!list || list.length === 0) { g.innerHTML = `<div style="text-align:center;padding:2rem;color:#8a8580;font-size:13px">No products found</div>`; return; }
  g.innerHTML = list.map(p => `
    <div class="product-card" onclick="addToBill(${p.id})" title="Click to add to bill">
      <div class="pc-left">
        <div class="pc-name">
          ${p.code ? `<span style="display:inline-block;background:#e6f5ec;color:#1a5c35;font-size:10px;font-weight:800;padding:1px 6px;border-radius:4px;margin-right:5px;letter-spacing:0.5px">#${p.code}</span>` : ''}
          ${p.name}
        </div>
        <div class="pc-meta">
          <span>${p.category}</span>
          <span class="stock-badge ${stockClass(p.stock)}">${stockLabel(p.stock)}</span>
        </div>
      </div>
      <div class="pc-price">₹${p.price}</div>
    </div>`).join('');
}

/* ── FAST CODE ENTRY ─────────────────────────── */
function previewCode() {
  const code = parseInt(document.getElementById('codeInput').value);
  const el   = document.getElementById('codePreview');
  if (!el) return;
  if (!code) { el.textContent = ''; return; }
  const p = allProducts.find(x => x.code === code);
  el.textContent = p ? `→ ${p.name} (₹${p.price})` : `Code ${code} not found`;
  el.style.color = p ? '#2d7a4f' : '#c0392b';
}

function addToBillByCode() {
  const codeEl = document.getElementById('codeInput');
  const qtyEl  = document.getElementById('codeQty');
  const code   = parseInt(codeEl.value);
  const qty    = parseInt(qtyEl.value) || 1;
  if (!code) { showToast('Enter a product code'); codeEl.focus(); return; }
  const p = allProducts.find(x => x.code === code);
  if (!p) { showToast(`⚠ No product with code ${code}`); codeEl.select(); return; }
  addToBill(p.id, qty);
  showToast(`✓ ${p.name} × ${qty} added`);
  codeEl.value = '';
  qtyEl.value  = 1;
  document.getElementById('codePreview').textContent = '';
  codeEl.focus();
}

function quickAdd() {
  const id  = parseInt(document.getElementById('quickProduct').value);
  const qty = parseInt(document.getElementById('quickQty').value) || 1;
  if (!id) { showToast('Please select a product'); return; }
  addToBill(id, qty);
  document.getElementById('quickQty').value = 1;
}

function addToBill(pid, qty = 1) {
  const p = allProducts.find(x => x.id === pid);
  if (!p) return;
  if (p.stock <= 0) { showToast('⚠ Product is out of stock'); return; }
  const existing = billItems.find(x => x.id === pid);
  if (existing) {
    const newQty = existing.qty + qty;
    if (newQty > p.stock) { showToast(`Only ${p.stock} in stock`); existing.qty = p.stock; }
    else existing.qty = newQty;
  } else {
    billItems.push({ id: p.id, name: p.name, category: p.category, price: p.price, stock: p.stock, qty: Math.min(qty, p.stock), unit: p.unit });
  }
  renderBill();
}

function changeQty(pid, delta) {
  // pid may be numeric (product) or string (service like 'grinding_idly_maavu')
  const idMatch = x => String(x.id) === String(pid);
  const item = billItems.find(idMatch);
  if (!item) return;
  if (item.is_service) return; // services edited via grinding panel only
  const prod = allProducts.find(x => x.id === item.id);
  const newQty = item.qty + delta;
  if (newQty < 1) { removeItem(pid); return; }
  if (prod && newQty > prod.stock) { showToast(`Max stock: ${prod.stock}`); return; }
  item.qty = newQty;
  renderBill();
}

function removeItem(pid) {
  billItems = billItems.filter(x => String(x.id) !== String(pid));
  renderBill();
}

function renderBill() {
  const tbody = document.getElementById('billBody');
  if (billItems.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty-state">
      <div class="empty-icon">🛒</div>
      <div class="empty-text">No items added yet</div>
      <div class="empty-sub">Search or select a product from the left panel</div>
    </td></tr>`;
    recalc(); return;
  }
  tbody.innerHTML = billItems.map(item => `
    <tr>
      <td>
        <div class="item-name">${item.name}</div>
        <div class="item-cat">${item.category}${item.is_service ? ` · ₹${item.price}/kg` : ''}</div>
      </td>
      <td class="item-price">${item.is_service ? `${item.qty} kg` : `₹${item.price}`}</td>
      <td>
        <div class="qty-ctrl">
          ${item.is_service
            ? `<button class="qty-btn" onclick="removeItem('${item.id}')" title="Remove service" style="padding:0 8px;font-size:11px">✕</button>`
            : `<button class="qty-btn" onclick="changeQty('${item.id}',-1)">−</button>
          <span class="qty-num">${item.qty}</span>
          <button class="qty-btn" onclick="changeQty('${item.id}',1)">+</button>`}
        </div>
      </td>
      <td class="item-total">₹${(item.price * item.qty).toFixed(2)}</td>
      <td>
        <button class="del-btn" onclick="removeItem('${item.id}')" title="Remove">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </td>
    </tr>`).join('');
  recalc();
}

function recalc() {
  const sub = billItems.reduce((s, i) => {
    const qty = parseFloat(i.qty) || 0;
    const price = parseFloat(i.price) || 0;
    return s + (price * qty);
  }, 0);

  let gst = document.getElementById('gstRate').value;

  if (gst === 'custom') {
    gst = parseFloat(document.getElementById('customGst')?.value) || 0;
  } else {
    gst = parseFloat(gst) || 0;
  }

  const discEl = document.getElementById('discount');
  let discPct = parseFloat(discEl?.value) || 0;

  if (discPct > 100) {
    discPct = 100;
    if (discEl) discEl.value = 100;
  }

  if (discPct < 0) {
    discPct = 0;
    if (discEl) discEl.value = 0;
  }

  const discAmt = sub * discPct / 100;
  const gstAmt  = sub * gst / 100;
  const cgst    = gstAmt / 2;
  const sgst    = gstAmt / 2;
  const total   = Math.max(0, sub + gstAmt - discAmt);

  document.getElementById('subtotal').textContent   = fmt(sub);
  document.getElementById('gstLabel').textContent   = `GST (${gst}%)`;
  document.getElementById('gstAmt').textContent     = fmt(gstAmt);
  document.getElementById('discAmt').textContent    = discPct > 0
    ? `− ₹${discAmt.toFixed(2)} (${discPct}%)`
    : '− ₹0.00';

  document.getElementById('grandTotal').textContent = fmt(total);

  const splitRow = document.getElementById('gstSplitRow');
  const sgstRow  = document.getElementById('sgstRow');

  if (splitRow && sgstRow) {
    if (gst > 0) {
      splitRow.style.display = '';
      sgstRow.style.display  = '';

      document.getElementById('cgstLabel').textContent = `↳ CGST (${gst / 2}%)`;
      document.getElementById('cgstAmt').textContent   = fmt(cgst);

      document.getElementById('sgstLabel').textContent = `↳ SGST (${gst / 2}%)`;
      document.getElementById('sgstAmt').textContent   = fmt(sgst);
    } else {
      splitRow.style.display = 'none';
      sgstRow.style.display  = 'none';
    }
  }
}

function buildReceiptText() {
  const custName   = document.getElementById('custName').value || 'Walk-in Customer';
  const custMobile = document.getElementById('custMobile').value || '—';
  let gst = document.getElementById('gstRate').value;
  if (gst === 'custom') {
    gst = parseFloat(document.getElementById('customGst')?.value) || 0;
  } else {
    gst = parseFloat(gst) || 0;
  }
  const discPct = parseFloat(document.getElementById('discount').value) || 0;
  const mode    = document.getElementById('payMode').value;
  const sub     = billItems.reduce((s, i) => s + i.price * i.qty, 0);
  const gstAmt  = sub * gst / 100;
  const cgst    = gstAmt / 2;
  const sgst    = gstAmt / 2;
  const discAmt = sub * discPct / 100;
  const total   = Math.max(0, sub + gstAmt - discAmt);
  const now     = new Date();
  const istOpts = { timeZone: 'Asia/Kolkata' };
  const dateStr = now.toLocaleDateString('en-IN',  { ...istOpts, day:'numeric', month:'long', year:'numeric' });
  const timeStr = now.toLocaleTimeString('en-IN',  { ...istOpts, hour:'2-digit', minute:'2-digit' });
  const sep     = '─'.repeat(36);
  let lines = [
    `      ${SHOP_NAME}`,
    `  ${SHOP_ADDR1}`,
    `  ${SHOP_ADDR2}`,
    `        ${SHOP_PHONE}`,
    sep,
    `Bill No  : #${String(currentBillNo).padStart(3,'0')}`,
    `Date     : ${dateStr}`,
    `Time     : ${timeStr}`,
    `Customer : ${custName}`,
    `Mobile   : ${custMobile}`,
    `Payment  : ${mode}`,
    sep,
    'Product                   Qty   Amount',
    sep,
  ];
  billItems.forEach(item => {
    const nm  = (item.name.length > 22 ? item.name.substring(0,20)+'..' : item.name).padEnd(22);
    const amt = `₹${(item.price * item.qty).toFixed(2)}`;
    lines.push(`${nm}  ${String(item.qty).padStart(3)}  ${amt.padStart(7)}`);
  });
  lines.push(sep);
  lines.push(`Subtotal          : ₹${sub.toFixed(2)}`);
  if (gst > 0) {
    lines.push(`CGST (${gst/2}%)       : ₹${cgst.toFixed(2)}`);
    lines.push(`SGST (${gst/2}%)       : ₹${sgst.toFixed(2)}`);
    lines.push(`GST Total (${gst}%)  : ₹${gstAmt.toFixed(2)}`);
  }
  if (discPct > 0) lines.push(`Discount (${discPct}%)    : -₹${discAmt.toFixed(2)}`);
  lines.push(`TOTAL PAYABLE     : ₹${total.toFixed(2)}`);
  lines.push(sep);
  lines.push('  Thank you! / நன்றி!');
  lines.push('  ✦ VISIT AGAIN ✦');
  lines.push('  Ayini — Pure. Natural. Homemade.');
  lines.push(`  Catalogue: ${SHOP_CATALOG}`);
  return lines.join('\n');
}

function buildReceiptHTML() {
  const custName   = document.getElementById('custName').value || 'Walk-in Customer';
  const custMobile = document.getElementById('custMobile').value || '—';
  let gst = document.getElementById('gstRate').value;
  if (gst === 'custom') {
    gst = parseFloat(document.getElementById('customGst')?.value) || 0;
  } else {
    gst = parseFloat(gst) || 0;
  }
  const discPct = parseFloat(document.getElementById('discount').value) || 0;
  const mode    = document.getElementById('payMode').value;
  const sub     = billItems.reduce((s, i) => s + i.price * i.qty, 0);
  const gstAmt  = sub * gst / 100;
  const cgst    = gstAmt / 2;
  const sgst    = gstAmt / 2;
  const discAmt = sub * discPct / 100;
  const total   = Math.max(0, sub + gstAmt - discAmt);
  const now     = new Date();
  const ist     = { timeZone: 'Asia/Kolkata' };
  const dateStr = now.toLocaleDateString('en-IN', { ...ist, day:'numeric', month:'long', year:'numeric' });
  const timeStr = now.toLocaleTimeString('en-IN', { ...ist, hour:'2-digit', minute:'2-digit' });

  const upiStr = `upi://pay?pa=${UPI_ID}&pn=${encodeURIComponent(UPI_NAME)}&am=${total.toFixed(2)}&cu=INR`;
  const qrURL  = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(upiStr)}`;

  const itemRows = billItems.map(item => `
    <tr>
      <td style="padding:7px 4px;border-bottom:1px dashed #ddd;font-size:12px">${item.name}</td>
      <td style="padding:7px 4px;border-bottom:1px dashed #ddd;text-align:center;font-size:12px">${item.qty}</td>
      <td style="padding:7px 4px;border-bottom:1px dashed #ddd;text-align:right;font-size:12px">₹${item.price}</td>
      <td style="padding:7px 4px;border-bottom:1px dashed #ddd;text-align:right;font-size:12px;font-weight:600">₹${(item.price*item.qty).toFixed(2)}</td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"/>
<title>Bill — Ayini</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Courier New',monospace; font-size:13px; color:#1c1a16; background:#fff; max-width:320px; margin:0 auto; padding:16px; }
  #close-btn {
    position:fixed; top:12px; right:12px;
    width:36px; height:36px;
    background:#1a5c35; color:#fff;
    border:none; border-radius:50%;
    font-size:20px; line-height:1;
    cursor:pointer; z-index:999;
    display:flex; align-items:center; justify-content:center;
    box-shadow:0 2px 8px rgba(0,0,0,0.25);
  }
  @media print { #close-btn { display:none; } }
  .center { text-align:center; }
  .sep       { border:none; border-top:1px dashed #999; margin:8px 0; }
  .sep-solid { border:none; border-top:2px solid #1a5c35; margin:8px 0; }
  .brand-en  { font-size:17px; font-weight:700; color:#1a5c35; letter-spacing:1px; }
  .brand-ta  { font-size:13px; color:#2d7a4f; margin-top:2px; font-family:sans-serif; }
  .addr      { font-size:11px; color:#555; margin-top:3px; line-height:1.5; }
  .meta-table { width:100%; margin:8px 0; }
  .meta-table td { font-size:12px; padding:2px 0; vertical-align:top; }
  .meta-table td:first-child { color:#555; width:115px; }
  .meta-table td:last-child  { font-weight:600; }
  .items-table { width:100%; border-collapse:collapse; margin:8px 0; }
  .items-table th { font-size:11px; text-transform:uppercase; border-bottom:2px solid #1a5c35; padding:5px 4px; text-align:left; color:#444; }
  .items-table th:nth-child(n+2) { text-align:right; }
  .items-table th:nth-child(2)   { text-align:center; }
  .totals { margin-top:6px; }
  .total-row { display:flex; justify-content:space-between; font-size:13px; padding:2px 0; }
  .total-row.grand { font-size:15px; font-weight:700; color:#1a5c35; border-top:2px solid #1a5c35; margin-top:6px; padding-top:6px; }
  .qr-section { text-align:center; margin:10px 0 6px; }
  .footer-line  { font-size:11px; color:#555; margin-top:3px; }
  .footer-green { font-size:11px; color:#1a5c35; font-weight:600; margin-top:3px; }
  .visit-again  { font-size:14px; font-weight:700; color:#1a5c35; letter-spacing:2px; margin:6px 0; }
  .catalog-link { font-size:11px; color:#2980b9; margin-top:4px; word-break:break-all; }
  @media print { body { padding:4px; } }
</style></head><body>

<button id="close-btn" onclick="window.close()" title="Close">&#x2715;</button>

<div class="center">
  <div class="brand-en">🌿 ${SHOP_NAME}</div>
  <div class="brand-ta">அயினி ஹோம்  ப்ராடக்ட்ஸ்</div>
  <div class="addr">${SHOP_ADDR1}<br>${SHOP_ADDR2}</div>
  <div class="addr">${SHOP_PHONE}</div>
</div>

<hr class="sep-solid"/>

<table class="meta-table">
  <tr><td>Bill No / பில் எண்</td>      <td>#${String(currentBillNo).padStart(3,'0')}</td></tr>
  <tr><td>Date / தேதி</td>              <td>${dateStr}</td></tr>
  <tr><td>Time / நேரம்</td>              <td>${timeStr}</td></tr>
  <tr><td>Customer / வாடிக்கையாளர்</td><td>${custName}</td></tr>
  <tr><td>Mobile / தொலைபேசி</td>        <td>${custMobile}</td></tr>
  <tr><td>Payment / கட்டணம்</td>        <td>${mode}</td></tr>
</table>

<hr class="sep"/>

<table class="items-table">
  <thead><tr>
    <th>Item / பொருள்</th>
    <th style="text-align:center">Qty</th>
    <th style="text-align:right">Rate</th>
    <th style="text-align:right">Total</th>
  </tr></thead>
  <tbody>${itemRows}</tbody>
</table>

<hr class="sep"/>

<div class="totals">
  <div class="total-row"><span>Subtotal / மொத்தம்</span><span>₹${sub.toFixed(2)}</span></div>
  ${gst > 0 ? `
  <div class="total-row" style="color:#555;font-size:12px"><span>&nbsp;↳ CGST (${gst/2}%)</span><span>₹${cgst.toFixed(2)}</span></div>
  <div class="total-row" style="color:#555;font-size:12px"><span>&nbsp;↳ SGST (${gst/2}%)</span><span>₹${sgst.toFixed(2)}</span></div>
  <div class="total-row"><span>GST (${gst}%)</span><span>₹${gstAmt.toFixed(2)}</span></div>` : ''}
  ${discPct > 0 ? `
  <div class="total-row" style="color:#c0392b">
    <span>Discount / தள்ளுபடி (${discPct}%)</span><span>−₹${discAmt.toFixed(2)}</span>
  </div>` : ''}
  <div class="total-row grand">
    <span>TOTAL / செலுத்த வேண்டியது</span>
    <span>₹${total.toFixed(2)}</span>
  </div>
</div>

${mode !== 'Credit' ? `
<hr class="sep"/>
<div class="qr-section">
  <div class="footer-line" style="font-weight:600;margin-bottom:6px">📱 Scan to Pay / ஸ்கேன் செய்து பணம் செலுத்துங்கள்</div>
  <img src="${qrURL}" width="120" height="120" alt="UPI QR" style="border:2px solid #1a5c35;border-radius:6px;padding:3px"/>
  <div class="footer-line" style="margin-top:4px">UPI: ${UPI_ID}</div>
</div>` : `
<hr class="sep"/>
<div style="text-align:center;background:#fff3e0;padding:8px;border-radius:4px;font-size:12px;color:#a04000;font-family:sans-serif">
  ⏳ Credit Due / கடன் நிலுவை — ₹${total.toFixed(2)}
</div>`}

<hr class="sep-solid"/>
<div class="center">
  <div class="visit-again">✦ VISIT AGAIN ✦</div>
  <div class="footer-line">Thank you! / எங்களிடம் வாங்கியதற்கு நன்றி!</div>
  <div class="footer-green">Ayini — Pure. Natural. Homemade.</div>
  <div class="footer-green" style="font-family:sans-serif">தூய்மையான · இயற்கையான · வீட்டில் தயாரிக்கப்பட்டது</div>
  <div class="catalog-link">📦 Our Catalogue: ${SHOP_CATALOG}</div>
</div>

</body></html>`;
}

// ── Helper: open receipt in new window using Blob URL (fixes Electron popup) ──
function openReceiptWindow() {
  const html = buildReceiptHTML();
  const blob = new Blob([html], { type: 'text/html' });
  const url  = URL.createObjectURL(blob);
  const w    = window.open(url, '_blank', 'width=420,height=720');
  if (!w) { showToast('⚠ Pop-up blocked — allow pop-ups and try again'); return; }
  setTimeout(() => {
    try { w.print(); } catch(e) {}
    URL.revokeObjectURL(url);
  }, 600);
}

// ── WhatsApp lock: disable Process Payment & Print until WhatsApp is sent ────
function setActionLock(locked) {
  const btnProcess = document.getElementById('btnProcess');
  const btnPrint   = document.getElementById('btnPrint');
  if (!btnProcess || !btnPrint) return;
  if (locked) {
    btnProcess.disabled = true;
    btnPrint.disabled   = true;
    btnProcess.title    = 'Send WhatsApp first';
    btnPrint.title      = 'Send WhatsApp first';
    btnProcess.style.opacity = '0.45';
    btnPrint.style.opacity   = '0.45';
  } else {
    btnProcess.disabled = false;
    btnPrint.disabled   = false;
    btnProcess.title    = '';
    btnPrint.title      = '';
    btnProcess.style.opacity = '1';
    btnPrint.style.opacity   = '1';
  }
}

function processPayment() {
  if (billItems.length === 0) { showToast('Add products to the bill first'); return; }
  if (!whatsappSent) { showToast('📱 Please send WhatsApp first'); return; }
  openReceiptWindow();
  document.getElementById('receiptPreview').textContent = buildReceiptText();
  document.getElementById('payModal').classList.add('open');
}

function closeModal() {
  document.getElementById('payModal').classList.remove('open');
}

async function confirmPayment() {
  const btn = document.getElementById('confirmBtn');

  let gst = document.getElementById('gstRate').value;

  if (gst === 'custom') {
    gst = parseFloat(document.getElementById('customGst')?.value) || 0;
  } else {
    gst = parseFloat(gst) || 0;
  }

  const discPct = parseFloat(document.getElementById('discount').value) || 0;
  const mode    = document.getElementById('payMode').value;

  const sub = billItems.reduce((s, i) => {
    const qty = parseFloat(i.qty) || 0;
    const price = parseFloat(i.price) || 0;
    return s + (price * qty);
  }, 0);

  const gstAmt  = sub * gst / 100;
  const discAmt = sub * discPct / 100;
  const total   = Math.max(0, sub + gstAmt - discAmt);

  btn.textContent = 'Saving...';
  btn.disabled = true;

  try {
    await Bills.create({
      customer: document.getElementById('custName').value || 'Walk-in Customer',
      mobile: document.getElementById('custMobile').value || '',
      payment_mode: mode,
      gst_rate: gst,
      subtotal: sub,
      gst_amount: gstAmt,
      cgst_amount: gstAmt / 2,
      sgst_amount: gstAmt / 2,
      discount: discAmt,
      total,
      items: billItems.map(i => ({
        product_id: i.id,
        name: i.name,
        price: i.price,
        qty: i.qty,
        total: i.price * i.qty
      }))
    });

    allProducts = await Products.getAll();

    populateQuickSelect();
    renderProducts(allProducts);

    currentBillNo++;

    closeModal();
    resetBill();

    showToast('✓ Payment confirmed! Bill saved.');
  } catch (e) {
    showToast('Error saving bill: ' + e.message);
  } finally {
    btn.textContent = '✓ Confirm & Save';
    btn.disabled = false;
  }
}

function printBill() {
  if (billItems.length === 0) { showToast('Add products to the bill first'); return; }
  if (!whatsappSent) { showToast('📱 Please send WhatsApp first'); return; }
  openReceiptWindow();
}

function sendWhatsApp() {
  if (billItems.length === 0) { showToast('Add products to the bill first'); return; }
  const mobile = document.getElementById('custMobile').value.replace(/\D/g,'');
  if (!mobile || mobile.length < 10) { showToast('Enter a valid mobile number first'); return; }
  const msg = encodeURIComponent(buildReceiptText());
  const num = mobile.startsWith('91') ? mobile : '91' + mobile;
  window.open(`https://wa.me/${num}?text=${msg}`, '_blank');
  // Unlock Process Payment and Print after WhatsApp is sent
  whatsappSent = true;
  setActionLock(false);
  showToast('✓ WhatsApp opened — you can now process payment');
}

function resetBill() {
  billItems    = [];
  whatsappSent = false;
  setActionLock(true); // lock again for next bill
  document.getElementById('custName').value   = '';
  document.getElementById('custMobile').value = '';
  document.getElementById('discount').value   = 0;
  document.getElementById('gstRate').value    = '0';
  document.getElementById('payMode').value    = 'Cash';
  document.getElementById('billNo').textContent = `Bill #${String(currentBillNo).padStart(3,'0')}`;
  renderBill();
  renderProducts(allProducts);
}


// ── Idly Maavu Grinding Panel ─────────────────────────────────────────────────
function initGrindingPanel() {
  const panel = document.getElementById('grindingPanel');
  if (!panel) return;
  // Populate saved rate
  document.getElementById('grindRatePer').value = getGrindingRate();
}

function saveGrindingRate() {
  const r = parseFloat(document.getElementById('grindRatePer').value);
  if (!r || r <= 0) { showToast('Enter valid rate per kg'); return; }
  setGrindingRate(r);
  showToast(`✓ Grinding rate saved: ₹${r}/kg`);
}

function addGrindingToBill() {
  const weightEl = document.getElementById('grindWeightKg');
  const weight   = parseFloat(weightEl?.value);
  if (!weight || weight <= 0) { showToast('Enter valid weight in kg'); weightEl?.focus(); return; }
  addGrindingService('idly_maavu', weight);
  if (weightEl) weightEl.value = '';
  showToast(`✓ Idly Maavu Grinding ${weight} kg added`);
}

document.addEventListener('DOMContentLoaded', init);

// ===== EVENT LISTENERS FOR SETTINGS SYNC =====

// Listen for GST rate changes from settings page
window.addEventListener('storage', (e) => {
  if (e.key === 'ayini_gst_rate_updated' || e.key === 'ayini_gst_rate') {
    loadGstRateFromSettings();
  }
  if (e.key === 'ayini_theme') {
    const newTheme = e.newValue || 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
  }
  if (e.key === 'ayini_theme_sync') {
    const savedTheme = localStorage.getItem('ayini_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
  }
  if (e.key === 'ayini_view_updated') {
    const savedView = localStorage.getItem('ayini_view') || 'list';
    const grid = document.getElementById('productGrid');
    if (grid) {
      if (savedView === 'list') {
        grid.classList.add('list-view');
      } else {
        grid.classList.remove('list-view');
      }
    }
  }
});

// Apply theme on page load
(function() {
  const savedTheme = localStorage.getItem('ayini_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
})();
