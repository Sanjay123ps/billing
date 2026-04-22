// ===== SAVED BILLS PAGE JS =====
let allBills = [];
let currentPopupBill = null;

async function init() {
  requireAuth();
  try {
    allBills = await Bills.getAll({ limit: 99999 });
    renderStats();
    renderBillsGrid(allBills);
  } catch(e) {
    showToast('Error loading bills');
  }
}

function renderStats() {
  const total   = allBills.length;
  const revenue = allBills.reduce((s, b) => s + parseFloat(b.total || 0), 0);
  const today   = new Date().toLocaleDateString('en-IN');
  const todayBills = allBills.filter(b => b.created_at && new Date(b.created_at).toLocaleDateString('en-IN') === today);
  const cash    = allBills.filter(b => b.payment_mode === 'Cash').length;
  document.getElementById('billStats').innerHTML = `
    <div class="stat-card stat-green"><div class="stat-label">Total Bills</div><div class="stat-value">${total}</div><div class="stat-sub">All time</div></div>
    <div class="stat-card stat-teal"><div class="stat-label">Total Revenue</div><div class="stat-value">₹${revenue.toFixed(0)}</div><div class="stat-sub">All time earnings</div></div>
    <div class="stat-card stat-amber"><div class="stat-label">Today's Bills</div><div class="stat-value">${todayBills.length}</div><div class="stat-sub">${todayBills.reduce((s,b)=>s+parseFloat(b.total||0),0).toFixed(0)} today</div></div>
    <div class="stat-card stat-green"><div class="stat-label">Cash Bills</div><div class="stat-value">${cash}</div><div class="stat-sub">${total - cash} digital</div></div>`;
}

function filterBills() {
  const q   = document.getElementById('billSearch').value.toLowerCase();
  const pay = document.getElementById('payFilter').value;
  let list  = allBills;
  if (q)   list = list.filter(b => (b.customer||'').toLowerCase().includes(q) || String(b.bill_no).includes(q) || (b.mobile||'').includes(q));
  if (pay) list = list.filter(b => b.payment_mode === pay);
  renderBillsGrid(list);
}

function payBg(p)     { return p==='Cash'?'#f2fae6':p==='UPI'?'#E1F5EE':p==='Card'?'#faf0e6':'#FCEBEB'; }
function payColor(p)  { return p==='Cash'?'#3B6D11':p==='UPI'?'#0F6E56':p==='Card'?'#BA7517':'#A32D2D'; }
function payBorder(p) { return p==='Cash'?'#c0dd97':p==='UPI'?'#9FE1CB':p==='Card'?'#FAC775':'#f5bcbc'; }

function renderBillsGrid(list) {
  const grid = document.getElementById('billsGrid');
  if (!list || list.length === 0) {
    grid.innerHTML = `
      <div class="empty-bills" style="grid-column:1/-1">
        <div class="empty-bills-icon">🧾</div>
        <div class="empty-bills-text">No bills found</div>
        <div class="empty-bills-sub">Bills you create will appear here</div>
      </div>`;
    return;
  }
  grid.innerHTML = list.map(b => {
    const dt = b.created_at ? new Date(b.created_at) : null;
    return `
    <div class="bill-card-item" onclick="openBill(${b.id})">
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div class="bill-card-no">Bill #${String(b.bill_no).padStart(3,'0')}</div>
        <span style="font-size:11px;padding:3px 9px;border-radius:20px;background:${payBg(b.payment_mode)};color:${payColor(b.payment_mode)};border:1px solid ${payBorder(b.payment_mode)};font-weight:500">${b.payment_mode}</span>
      </div>
      <div class="bill-card-customer">${b.customer || 'Walk-in Customer'}</div>
      ${b.mobile ? `<div class="bill-card-mobile">📞 ${b.mobile}</div>` : ''}
      <div class="bill-card-meta">
        <div>
          <div class="bill-card-date">${dt ? dt.toLocaleDateString('en-IN', {day:'numeric',month:'short',year:'numeric'}) : '—'}</div>
          <div class="bill-card-date">${dt ? dt.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'}) : ''}</div>
        </div>
        <div class="bill-card-amount">₹${parseFloat(b.total||0).toFixed(2)}</div>
      </div>
    </div>`; 
  }).join('');
}

async function openBill(id) {
  try {
    const bill = await Bills.getById(id);
    currentPopupBill = bill;

    const dt = bill.created_at ? new Date(bill.created_at) : null;

    // Populate header meta
    document.getElementById('popupMeta').innerHTML = `
      <div class="bill-popup-meta-item">
        <label>Bill No</label>
        <span>#${String(bill.bill_no).padStart(3,'0')}</span>
      </div>
      <div class="bill-popup-meta-item">
        <label>Customer</label>
        <span>${bill.customer || 'Walk-in Customer'}</span>
      </div>
      <div class="bill-popup-meta-item">
        <label>Mobile</label>
        <span>${bill.mobile || '—'}</span>
      </div>
      <div class="bill-popup-meta-item">
        <label>Date</label>
        <span>${dt ? dt.toLocaleDateString('en-IN') : '—'}</span>
      </div>
      <div class="bill-popup-meta-item">
        <label>Payment</label>
        <span>${bill.payment_mode}</span>
      </div>`;

    // Populate items
    const items = bill.items || [];
    document.getElementById('popupItems').innerHTML = items.length === 0
      ? '<tr><td colspan="4" style="text-align:center;color:#8a8580;padding:1rem">No item details available</td></tr>'
      : items.map(item => `
        <tr>
          <td style="font-weight:500">${item.name}</td>
          <td>₹${parseFloat(item.price).toFixed(2)}</td>
          <td style="text-align:center;font-weight:600">${item.qty}</td>
          <td style="font-weight:600;color:var(--green-700)">₹${parseFloat(item.total).toFixed(2)}</td>
        </tr>`).join('');

    // Populate totals
    document.getElementById('popupTotals').innerHTML = `
      <div class="bill-total-row"><span>Subtotal</span><span>₹${parseFloat(bill.subtotal||0).toFixed(2)}</span></div>
      ${bill.gst_rate > 0 ? `<div class="bill-total-row"><span>GST (${bill.gst_rate}%)</span><span>₹${parseFloat(bill.gst_amount||0).toFixed(2)}</span></div>` : ''}
      ${bill.discount > 0 ? `<div class="bill-total-row" style="color:var(--amber-600)"><span>Discount</span><span>− ₹${parseFloat(bill.discount||0).toFixed(2)}</span></div>` : ''}
      <div class="bill-total-row grand"><span>Total Paid</span><span>₹${parseFloat(bill.total||0).toFixed(2)}</span></div>`;

    document.getElementById('billPopup').classList.add('open');
  } catch(e) {
    showToast('Error loading bill details');
  }
}

function closePopup() {
  document.getElementById('billPopup').classList.remove('open');
  currentPopupBill = null;
}

// Close popup on overlay click
document.getElementById('billPopup').addEventListener('click', function(e) {
  if (e.target === this) closePopup();
});

function buildReceiptFromBill(bill) {
  const sep = '─'.repeat(36);
  const dt  = bill.created_at ? new Date(bill.created_at) : new Date();
  let lines = [
    '      AYINI HOME PRODUCTS',
    '    Coimbatore, Tamil Nadu',
    '      +91 7397130039',
    sep,
    `Bill No  : #${String(bill.bill_no).padStart(3,'0')}`,
    `Date     : ${dt.toLocaleDateString('en-IN')}`,
    `Time     : ${dt.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}`,
    `Customer : ${bill.customer || 'Walk-in Customer'}`,
    `Mobile   : ${bill.mobile || '—'}`,
    `Payment  : ${bill.payment_mode}`,
    sep,
    'Product                   Qty   Amount',
    sep,
  ];
  (bill.items || []).forEach(item => {
    const nm  = (item.name.length > 22 ? item.name.substring(0,20)+'..' : item.name).padEnd(22);
    const amt = `₹${parseFloat(item.total).toFixed(2)}`;
    lines.push(`${nm}  ${String(item.qty).padStart(3)}  ${amt.padStart(7)}`);
  });
  lines.push(sep);
  lines.push(`Subtotal          : ₹${parseFloat(bill.subtotal||0).toFixed(2)}`);
  if (bill.gst_rate > 0) lines.push(`GST (${bill.gst_rate}%)          : ₹${parseFloat(bill.gst_amount||0).toFixed(2)}`);
  if (bill.discount > 0) lines.push(`Discount          : -₹${parseFloat(bill.discount||0).toFixed(2)}`);
  lines.push(`TOTAL PAYABLE     : ₹${parseFloat(bill.total||0).toFixed(2)}`);
  lines.push(sep);
  lines.push('  Thank you for shopping with us!');
  lines.push('  Ayini — Pure. Natural. Homemade.');
  return lines.join('\n');
}

function printPopupBill() {
  if (!currentPopupBill) return;
  const txt = buildReceiptFromBill(currentPopupBill).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const w = window.open('', '_blank', 'width=420,height=640');
  w.document.write(`<!DOCTYPE html><html><head><title>Bill #${currentPopupBill.bill_no} - Ayini</title>
  <style>body{font-family:'Courier New',monospace;font-size:13px;padding:24px;line-height:1.7;color:#1c1a16;background:#fff;white-space:pre}</style>
  </head><body>${txt}</body></html>`);
  w.document.close();
  setTimeout(() => w.print(), 300);
}

function whatsappPopupBill() {
  if (!currentPopupBill) return;
  const mobile = (currentPopupBill.mobile || '').replace(/\D/g,'');
  if (!mobile || mobile.length < 10) { showToast('No mobile number for this bill'); return; }
  const msg = encodeURIComponent(buildReceiptFromBill(currentPopupBill));
  const num = mobile.startsWith('91') ? mobile : '91' + mobile;
  window.open(`https://wa.me/${num}?text=${msg}`, '_blank');
}

async function deletePopupBill() {
  if (!currentPopupBill) return;
  if (!confirm(`Delete Bill #${String(currentPopupBill.bill_no).padStart(3,'0')}? This cannot be undone.`)) return;
  try {
    await Bills.delete(currentPopupBill.id);
    allBills = allBills.filter(b => b.id !== currentPopupBill.id);
    closePopup();
    renderStats();
    filterBills();
    showToast(`Bill #${String(currentPopupBill.bill_no).padStart(3,'0')} deleted`);
  } catch(e) {
    showToast('Error deleting bill');
  }
}

document.addEventListener('DOMContentLoaded', init);
