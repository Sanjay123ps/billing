// ===== BILLING PAGE JS — API VERSION =====
let allProducts = [];
let billItems   = [];
let activeCat   = '';
let currentBillNo = 1;

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
    document.getElementById('billDt').textContent = new Date().toLocaleDateString('en-IN', {day:'numeric',month:'long',year:'numeric'});
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
    o.textContent = `${p.name} — ₹${p.price}`;
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
        <div class="pc-name">${p.name}</div>
        <div class="pc-meta">
          <span>${p.category}</span>
          <span class="stock-badge ${stockClass(p.stock)}">${stockLabel(p.stock)}</span>
        </div>
      </div>
      <div class="pc-price">₹${p.price}</div>
    </div>`).join('');
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
  const gst    = parseFloat(document.getElementById('gstRate').value);
  const disc   = parseFloat(document.getElementById('discount').value) || 0;
  const gstAmt = sub * gst / 100;
  const total  = Math.max(0, sub + gstAmt - disc);
  document.getElementById('subtotal').textContent   = fmt(sub);
  document.getElementById('gstLabel').textContent   = `GST (${gst}%)`;
  document.getElementById('gstAmt').textContent     = fmt(gstAmt);
  document.getElementById('discAmt').textContent    = `− ₹${disc.toFixed(2)}`;
  document.getElementById('grandTotal').textContent = fmt(total);
}

function buildReceiptText() {
  const custName   = document.getElementById('custName').value || 'Walk-in Customer';
  const custMobile = document.getElementById('custMobile').value || '—';
  const gst    = parseFloat(document.getElementById('gstRate').value);
  const disc   = parseFloat(document.getElementById('discount').value) || 0;
  const mode   = document.getElementById('payMode').value;
  const sub    = billItems.reduce((s, i) => s + i.price * i.qty, 0);
  const gstAmt = sub * gst / 100;
  const total  = Math.max(0, sub + gstAmt - disc);
  const now    = new Date();
  const sep    = '─'.repeat(36);
  let lines = [
    '      AYINI HOME PRODUCTS',
    '    Coimbatore, Tamil Nadu',
    '      +91 7397130039',
    sep,
    `Bill No  : #${String(currentBillNo).padStart(3,'0')}`,
    `Date     : ${now.toLocaleDateString('en-IN')}`,
    `Time     : ${now.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}`,
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
  if (gst > 0)  lines.push(`GST (${gst}%)          : ₹${gstAmt.toFixed(2)}`);
  if (disc > 0) lines.push(`Discount          : -₹${disc.toFixed(2)}`);
  lines.push(`TOTAL PAYABLE     : ₹${total.toFixed(2)}`);
  lines.push(sep);
  lines.push('  Thank you for shopping with us!');
  lines.push('  Ayini — Pure. Natural. Homemade.');
  return lines.join('\n');
}

function processPayment() {
  if (billItems.length === 0) { showToast('Add products to the bill first'); return; }
  // Step 1: Print the bill first
  const txt = buildReceiptText().replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const w = window.open('', '_blank', 'width=420,height=640');
  w.document.write(`<!DOCTYPE html><html><head><title>Bill - Ayini</title>
  <style>body{font-family:'Courier New',monospace;font-size:13px;padding:24px;line-height:1.7;color:#1c1a16;background:#fff;white-space:pre}</style>
  </head><body>${txt}</body></html>`);
  w.document.close();
  setTimeout(() => w.print(), 300);
  // Step 2: Show confirm modal to save the bill
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
  const txt = buildReceiptText().replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const w = window.open('', '_blank', 'width=420,height=640');
  w.document.write(`<!DOCTYPE html><html><head><title>Bill - Ayini</title>
  <style>body{font-family:'Courier New',monospace;font-size:13px;padding:24px;line-height:1.7;color:#1c1a16;background:#fff;white-space:pre}</style>
  </head><body>${txt}</body></html>`);
  w.document.close(); setTimeout(() => w.print(), 300);
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
