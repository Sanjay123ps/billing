// ===== BILLING PAGE JS — API VERSION =====
let allProducts = [];
let billItems   = [];
let activeCat   = '';
let currentBillNo = 1;

// ── UPI CONFIG — change to your actual UPI ID ──
const UPI_ID   = '7397130039@upi';
const UPI_NAME = 'Ayini Home Products';

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
  const item = billItems.find(x => x.id === pid);
  const prod = allProducts.find(x => x.id === pid);
  if (!item) return;
  const newQty = item.qty + delta;
  if (newQty < 1) { removeItem(pid); return; }
  if (newQty > prod.stock) { showToast(`Max stock: ${prod.stock}`); return; }
  item.qty = newQty;
  renderBill();
}

function removeItem(pid) {
  billItems = billItems.filter(x => x.id !== pid);
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
        <div class="item-cat">${item.category}</div>
      </td>
      <td class="item-price">₹${item.price}</td>
      <td>
        <div class="qty-ctrl">
          <button class="qty-btn" onclick="changeQty(${item.id},-1)">−</button>
          <span class="qty-num">${item.qty}</span>
          <button class="qty-btn" onclick="changeQty(${item.id},1)">+</button>
        </div>
      </td>
      <td class="item-total">₹${(item.price * item.qty).toFixed(2)}</td>
      <td>
        <button class="del-btn" onclick="removeItem(${item.id})" title="Remove">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </td>
    </tr>`).join('');
  recalc();
}

function recalc() {
  const sub    = billItems.reduce((s, i) => s + i.price * i.qty, 0);
  const gst    = parseFloat(document.getElementById('gstRate').value) || 0;
  const discEl = document.getElementById('discount');
  let disc     = parseFloat(discEl?.value) || 0;

  // Cap discount — can't exceed subtotal
  if (disc > sub) { disc = sub; if (discEl) discEl.value = sub.toFixed(2); }
  if (disc < 0)   { disc = 0;   if (discEl) discEl.value = 0; }

  const gstAmt = sub * gst / 100;
  const cgst   = gstAmt / 2;
  const sgst   = gstAmt / 2;
  const total  = Math.max(0, sub + gstAmt - disc);

  document.getElementById('subtotal').textContent   = fmt(sub);
  document.getElementById('gstLabel').textContent   = gst > 0 ? `GST (${gst}%)` : 'GST (0%)';
  document.getElementById('gstAmt').textContent     = fmt(gstAmt);
  document.getElementById('discAmt').textContent    = `− ₹${disc.toFixed(2)}`;
  document.getElementById('grandTotal').textContent = fmt(total);

  // CGST / SGST split rows (only present on billing page)
  const splitRow = document.getElementById('gstSplitRow');
  const sgstRow  = document.getElementById('sgstRow');
  if (splitRow && sgstRow) {
    if (gst > 0) {
      splitRow.style.display = '';
      sgstRow.style.display  = '';
      document.getElementById('cgstLabel').textContent = `  ↳ CGST (${gst/2}%)`;
      document.getElementById('cgstAmt').textContent   = fmt(cgst);
      document.getElementById('sgstLabel').textContent = `  ↳ SGST (${gst/2}%)`;
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
  const gst    = parseFloat(document.getElementById('gstRate').value) || 0;
  const disc   = parseFloat(document.getElementById('discount').value) || 0;
  const mode   = document.getElementById('payMode').value;
  const sub    = billItems.reduce((s, i) => s + i.price * i.qty, 0);
  const gstAmt = sub * gst / 100;
  const cgst   = gstAmt / 2;
  const sgst   = gstAmt / 2;
  const total  = Math.max(0, sub + gstAmt - disc);
  const now    = new Date();
  const istOpts = { timeZone: 'Asia/Kolkata' };
  const dateStr = now.toLocaleDateString('en-IN', { ...istOpts, day: 'numeric', month: 'long', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-IN', { ...istOpts, hour: '2-digit', minute: '2-digit' });
  const sep    = '─'.repeat(36);
  let lines = [
    '      AYINI HOME PRODUCTS',
    '    Coimbatore, Tamil Nadu',
    '      +91 7397130039',
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
    lines.push(`CGST (${gst/2}%)          : ₹${cgst.toFixed(2)}`);
    lines.push(`SGST (${gst/2}%)          : ₹${sgst.toFixed(2)}`);
    lines.push(`GST Total (${gst}%)    : ₹${gstAmt.toFixed(2)}`);
  }
  if (disc > 0) lines.push(`Discount          : -₹${disc.toFixed(2)}`);
  lines.push(`TOTAL PAYABLE     : ₹${total.toFixed(2)}`);
  lines.push(sep);
  lines.push('  Thank you for shopping with us!');
  lines.push('  Ayini — Pure. Natural. Homemade.');
  return lines.join('\n');
}

// ── HTML RECEIPT — bilingual (Tamil+English) + UPI QR code ──
function buildReceiptHTML() {
  const custName   = document.getElementById('custName').value || 'Walk-in Customer';
  const custMobile = document.getElementById('custMobile').value || '—';
  const gst    = parseFloat(document.getElementById('gstRate').value) || 0;
  const disc   = parseFloat(document.getElementById('discount').value) || 0;
  const mode   = document.getElementById('payMode').value;
  const sub    = billItems.reduce((s, i) => s + i.price * i.qty, 0);
  const gstAmt = sub * gst / 100;
  const cgst   = gstAmt / 2;
  const sgst   = gstAmt / 2;
  const total  = Math.max(0, sub + gstAmt - disc);
  const now    = new Date();
  const ist    = { timeZone: 'Asia/Kolkata' };
  const dateStr = now.toLocaleDateString('en-IN', { ...ist, day:'numeric', month:'long', year:'numeric' });
  const timeStr = now.toLocaleTimeString('en-IN', { ...ist, hour:'2-digit', minute:'2-digit' });

  // UPI QR — scan to pay exact bill amount
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
<html>
<head>
<meta charset="UTF-8"/>
<title>Bill — Ayini</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Courier New',monospace; font-size:13px; color:#1c1a16; background:#fff; max-width:320px; margin:0 auto; padding:16px; }
  .center { text-align:center; }
  .sep { border:none; border-top:1px dashed #999; margin:8px 0; }
  .sep-solid { border:none; border-top:2px solid #1a5c35; margin:8px 0; }
  .brand-en { font-size:17px; font-weight:700; color:#1a5c35; letter-spacing:1px; }
  .brand-ta { font-size:13px; color:#2d7a4f; margin-top:2px; font-family:sans-serif; }
  .addr { font-size:11px; color:#666; margin-top:4px; }
  .meta-table { width:100%; margin:8px 0; }
  .meta-table td { font-size:12px; padding:2px 0; vertical-align:top; }
  .meta-table td:first-child { color:#555; width:110px; }
  .meta-table td:last-child { font-weight:600; }
  .items-table { width:100%; border-collapse:collapse; margin:8px 0; }
  .items-table th { font-size:11px; text-transform:uppercase; border-bottom:2px solid #1a5c35; padding:5px 4px; text-align:left; color:#444; }
  .items-table th:nth-child(2) { text-align:center; }
  .items-table th:nth-child(3), .items-table th:nth-child(4) { text-align:right; }
  .totals { margin-top:6px; }
  .total-row { display:flex; justify-content:space-between; font-size:13px; padding:2px 0; }
  .total-row.grand { font-size:15px; font-weight:700; color:#1a5c35; border-top:2px solid #1a5c35; margin-top:6px; padding-top:6px; }
  .qr-section { text-align:center; margin:12px 0 6px; }
  .footer-line { font-size:11px; color:#555; margin-top:3px; }
  .footer-green { font-size:11px; color:#1a5c35; font-weight:600; margin-top:4px; }
  @media print { body { padding:4px; } }
</style>
</head>
<body>

<div class="center">
  <div class="brand-en">🌿 AYINI HOME PRODUCTS</div>
  <div class="brand-ta">அயினி வீட்டு பொருட்கள்</div>
  <div class="addr">Coimbatore, Tamil Nadu &nbsp;|&nbsp; +91 7397130039</div>
</div>

<hr class="sep-solid"/>

<table class="meta-table">
  <tr><td>Bill No / பில் எண்</td>  <td>#${String(currentBillNo).padStart(3,'0')}</td></tr>
  <tr><td>Date / தேதி</td>          <td>${dateStr}</td></tr>
  <tr><td>Time / நேரம்</td>          <td>${timeStr}</td></tr>
  <tr><td>Customer / வாடிக்கையாளர்</td><td>${custName}</td></tr>
  <tr><td>Mobile / தொலைபேசி</td>    <td>${custMobile}</td></tr>
  <tr><td>Payment / கட்டணம்</td>    <td>${mode}</td></tr>
</table>

<hr class="sep"/>

<table class="items-table">
  <thead>
    <tr>
      <th>Item / பொருள்</th>
      <th style="text-align:center">Qty</th>
      <th style="text-align:right">Rate</th>
      <th style="text-align:right">Total</th>
    </tr>
  </thead>
  <tbody>${itemRows}</tbody>
</table>

<hr class="sep"/>

<div class="totals">
  <div class="total-row"><span>Subtotal / மொத்தம்</span><span>₹${sub.toFixed(2)}</span></div>
  ${gst > 0 ? `
  <div class="total-row" style="color:#555;font-size:12px"><span>&nbsp;↳ CGST (${gst/2}%)</span><span>₹${cgst.toFixed(2)}</span></div>
  <div class="total-row" style="color:#555;font-size:12px"><span>&nbsp;↳ SGST (${gst/2}%)</span><span>₹${sgst.toFixed(2)}</span></div>
  <div class="total-row"><span>GST Total (${gst}%)</span><span>₹${gstAmt.toFixed(2)}</span></div>` : ''}
  ${disc > 0 ? `
  <div class="total-row" style="color:#c0392b"><span>Discount / தள்ளுபடி</span><span>−₹${disc.toFixed(2)}</span></div>` : ''}
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
  <div class="footer-line">Thank you for shopping with us!</div>
  <div class="footer-line" style="font-family:sans-serif">எங்களிடம் வாங்கியதற்கு நன்றி!</div>
  <div class="footer-green">Ayini — Pure. Natural. Homemade.</div>
  <div class="footer-green" style="font-family:sans-serif">தூய்மையான · இயற்கையான · வீட்டில் தயாரிக்கப்பட்டது</div>
</div>

</body>
</html>`;
}

function processPayment() {
  if (billItems.length === 0) { showToast('Add products to the bill first'); return; }
  // Print HTML receipt with QR + bilingual
  const w = window.open('', '_blank', 'width=400,height=720');
  w.document.write(buildReceiptHTML());
  w.document.close();
  setTimeout(() => w.print(), 500);
  // Show confirm modal to save
  document.getElementById('receiptPreview').textContent = buildReceiptText();
  document.getElementById('payModal').classList.add('open');
}

function closeModal() {
  document.getElementById('payModal').classList.remove('open');
}

async function confirmPayment() {
  const btn    = document.getElementById('confirmBtn');
  const gst    = parseFloat(document.getElementById('gstRate').value);
  const disc   = parseFloat(document.getElementById('discount').value) || 0;
  const mode   = document.getElementById('payMode').value;
  const sub    = billItems.reduce((s, i) => s + i.price * i.qty, 0);
  const gstAmt = sub * gst / 100;
  const total  = Math.max(0, sub + gstAmt - disc);

  btn.textContent = 'Saving...'; btn.disabled = true;
  try {
    await Bills.create({
      customer:     document.getElementById('custName').value || 'Walk-in Customer',
      mobile:       document.getElementById('custMobile').value || '',
      payment_mode: mode,
      gst_rate:     gst,
      subtotal:     sub,
      gst_amount:   gstAmt,
      cgst_amount:  gstAmt / 2,
      sgst_amount:  gstAmt / 2,
      discount:     disc,
      total:        total,
      items: billItems.map(i => ({ product_id: i.id, name: i.name, price: i.price, qty: i.qty, total: i.price * i.qty }))
    });

    // Refresh product stock from server
    allProducts = await Products.getAll();
    currentBillNo++;
    closeModal();
    resetBill();
    showToast('✓ Payment confirmed! Bill saved.');
  } catch(e) {
    showToast('Error saving bill: ' + e.message);
  } finally {
    btn.textContent = '✓ Confirm & Save'; btn.disabled = false;
  }
}

function printBill() {
  if (billItems.length === 0) { showToast('Add products to the bill first'); return; }
  const w = window.open('', '_blank', 'width=400,height=720');
  w.document.write(buildReceiptHTML());
  w.document.close();
  setTimeout(() => w.print(), 500);
}

function sendWhatsApp() {
  if (billItems.length === 0) { showToast('Add products to the bill first'); return; }
  const mobile = document.getElementById('custMobile').value.replace(/\D/g,'');
  if (!mobile || mobile.length < 10) { showToast('Enter a valid mobile number first'); return; }
  const msg = encodeURIComponent(buildReceiptText());
  const num = mobile.startsWith('91') ? mobile : '91' + mobile;
  window.open(`https://wa.me/${num}?text=${msg}`, '_blank');
}

function resetBill() {
  billItems = [];
  document.getElementById('custName').value   = '';
  document.getElementById('custMobile').value = '';
  document.getElementById('discount').value   = 0;
  document.getElementById('gstRate').value    = '5';
  document.getElementById('payMode').value    = 'Cash';
  document.getElementById('billNo').textContent = `Bill #${String(currentBillNo).padStart(3,'0')}`;
  renderBill();
  renderProducts(allProducts);
}

document.addEventListener('DOMContentLoaded', init);
