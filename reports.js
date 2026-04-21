// ===== REPORTS PAGE JS — API VERSION =====
let allBills = [];

async function init() {
  requireAuth();
  try {
    const [summary, bills, topProds] = await Promise.all([
      Reports.summary(),
      Bills.getAll({ limit: 200 }),
      Reports.topProducts(8)
    ]);
    allBills = bills;
    renderStats(summary);
    renderBillsTable(allBills);
    renderTopProducts(topProds);
  } catch(e) {
    showToast('Error loading reports');
  }
}

function renderStats(summary) {
  if (!summary) return;
  document.getElementById('reportStats').innerHTML = `
    <div class="stat-card stat-green"><div class="stat-label">Total Bills</div><div class="stat-value">${summary.all_time.bill_count}</div><div class="stat-sub">All time</div></div>
    <div class="stat-card stat-teal"><div class="stat-label">Total Revenue</div><div class="stat-value">₹${summary.all_time.revenue.toFixed(0)}</div><div class="stat-sub">All time earnings</div></div>
    <div class="stat-card stat-amber"><div class="stat-label">Today's Sales</div><div class="stat-value">₹${summary.today.revenue.toFixed(0)}</div><div class="stat-sub">${summary.today.bill_count} bills today</div></div>
    <div class="stat-card stat-green"><div class="stat-label">Avg Bill Value</div><div class="stat-value">₹${summary.all_time.avg_bill.toFixed(0)}</div><div class="stat-sub">Per transaction</div></div>`;
}

async function filterBills() {
  const q   = document.getElementById('billSearch').value.toLowerCase();
  const pay = document.getElementById('payFilter').value;
  let list  = allBills;
  if (q)   list = list.filter(b => (b.customer||'').toLowerCase().includes(q) || String(b.bill_no).includes(q));
  if (pay) list = list.filter(b => b.payment_mode === pay);
  renderBillsTable(list);
}

function renderBillsTable(list) {
  const tbody = document.getElementById('billsBody');
  if (!list || list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2.5rem;color:#8a8580;font-size:13px">No bills found</td></tr>`;
    return;
  }
  tbody.innerHTML = list.map(b => `
    <tr>
      <td><span style="font-weight:600;color:#3B6D11">#${String(b.bill_no).padStart(3,'0')}</span></td>
      <td>
        <div style="font-weight:500">${b.customer}</div>
        ${b.mobile ? `<div style="font-size:11px;color:#8a8580">${b.mobile}</div>` : ''}
      </td>
      <td>
        <div>${b.created_at ? new Date(b.created_at).toLocaleDateString('en-IN') : '—'}</div>
        ${b.created_at ? `<div style="font-size:11px;color:#8a8580">${new Date(b.created_at).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}</div>` : ''}
      </td>
      <td>—</td>
      <td><span style="font-size:12px;padding:3px 10px;border-radius:20px;background:${payBg(b.payment_mode)};color:${payColor(b.payment_mode)};border:1px solid ${payBorder(b.payment_mode)}">${b.payment_mode}</span></td>
      <td style="font-weight:700;color:#3B6D11">₹${parseFloat(b.total||0).toFixed(2)}</td>
    </tr>`).join('');
}

function renderTopProducts(list) {
  const container = document.getElementById('topProducts');
  if (!list || list.length === 0) {
    container.innerHTML = `<div style="text-align:center;padding:2rem;color:#8a8580;font-size:13px">No sales data yet</div>`;
    return;
  }
  const max = list[0]?.total_qty || 1;
  container.innerHTML = list.map((p, i) => `
    <div class="top-product-row">
      <div class="tp-rank">${i+1}</div>
      <div>
        <div class="tp-name">${p.name}</div>
        <div class="tp-sold">${p.total_qty} units · ₹${parseFloat(p.total_revenue).toFixed(0)}</div>
      </div>
      <div class="tp-bar"><div class="tp-bar-fill" style="width:${Math.round(p.total_qty/max*100)}%"></div></div>
    </div>`).join('');
}

function payBg(p)     { return p==='Cash'?'#f2fae6':p==='UPI'?'#E1F5EE':p==='Card'?'#faf0e6':'#FCEBEB'; }
function payColor(p)  { return p==='Cash'?'#3B6D11':p==='UPI'?'#0F6E56':p==='Card'?'#BA7517':'#A32D2D'; }
function payBorder(p) { return p==='Cash'?'#c0dd97':p==='UPI'?'#9FE1CB':p==='Card'?'#FAC775':'#f5bcbc'; }

document.addEventListener('DOMContentLoaded', init);
