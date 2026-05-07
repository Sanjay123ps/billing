// ===== INVENTORY PAGE JS — API VERSION =====
let products = [];

async function init() {
  requireAuth();
  products = await Products.getAll();
  renderStats();
  populateCatFilter();
  renderInvTable(products);
}

function renderStats() {
  const total    = products.length;
  const lowStock = products.filter(p => p.stock > 0 && p.stock <= 10).length;
  const outStock = products.filter(p => p.stock === 0).length;
  const value    = products.reduce((s, p) => s + p.price * p.stock, 0);
  document.getElementById('invStats').innerHTML = `
    <div class="stat-card stat-green"><div class="stat-label">Total Products</div><div class="stat-value">${total}</div><div class="stat-sub">Across all categories</div></div>
    <div class="stat-card stat-teal"><div class="stat-label">Stock Value</div><div class="stat-value">₹${(value/1000).toFixed(1)}k</div><div class="stat-sub">Total inventory worth</div></div>
    <div class="stat-card stat-amber"><div class="stat-label">Low Stock</div><div class="stat-value">${lowStock}</div><div class="stat-sub">Needs restocking soon</div></div>
    <div class="stat-card stat-red"><div class="stat-label">Out of Stock</div><div class="stat-value">${outStock}</div><div class="stat-sub">Requires immediate action</div></div>`;
}

function populateCatFilter() {
  const cats = [...new Set(products.map(p => p.category))];
  const sel  = document.getElementById('catFilter');
  sel.innerHTML = '<option value="">All Categories</option>';
  cats.forEach(c => { const o = document.createElement('option'); o.value = c; o.textContent = c; sel.appendChild(o); });
}

function filterInv() {
  const q   = document.getElementById('invSearch').value.toLowerCase();
  const cat = document.getElementById('catFilter').value;
  const st  = document.getElementById('stockFilter').value;
  let list  = products;
  if (q)   list = list.filter(p => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q));
  if (cat) list = list.filter(p => p.category === cat);
  if (st === 'low') list = list.filter(p => p.stock > 0 && p.stock <= 10);
  else if (st === 'out') list = list.filter(p => p.stock === 0);
  else if (st === 'ok')  list = list.filter(p => p.stock > 10);
  renderInvTable(list);
}

function renderInvTable(list) {
  const tbody = document.getElementById('invBody');
  if (!list || list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:2.5rem;color:#8a8580;font-size:13px">No products found</td></tr>`;
    return;
  }
  tbody.innerHTML = list.map(p => `
    <tr id="row-${p.id}">
      <td style="font-weight:800;color:#1a5c35;font-size:13px;text-align:center">${p.code || '—'}</td>
      <td style="font-weight:500">${p.name}</td>
      <td><span style="font-size:12px;background:#f2fae6;color:#3B6D11;padding:3px 10px;border-radius:20px;border:1px solid #c0dd97">${p.category}</span></td>
      <td>₹${p.price}</td>
      <td style="font-weight:600;color:${p.stock===0?'#A32D2D':p.stock<=10?'#BA7517':'#3B6D11'}">${p.stock}</td>
      <td><span class="stock-badge ${stockClass(p.stock)}">${stockLabel(p.stock)}</span></td>
      <td>
        <div style="display:flex;align-items:center;gap:6px">
          <button class="qty-btn" onclick="adjStock(${p.id},-5)" title="-5" style="width:28px;height:28px;border-radius:6px;font-size:11px">-5</button>
          <button class="qty-btn" onclick="adjStock(${p.id},-1)" style="width:28px;height:28px;border-radius:6px">−</button>
          <button class="qty-btn" onclick="adjStock(${p.id},1)"  style="width:28px;height:28px;border-radius:6px">+</button>
          <button class="qty-btn" onclick="adjStock(${p.id},10)" title="+10" style="width:28px;height:28px;border-radius:6px;font-size:11px">+10</button>
        </div>
      </td>
      <td>
        <button class="icon-btn edit" onclick="openEditProduct(${p.id})" title="Edit">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="icon-btn delete" onclick="deleteProduct(${p.id})" title="Delete">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
        </button>
      </td>
    </tr>`).join('');
}

async function adjStock(id, delta) {
  try {
    const updated = await Products.adjustStock(id, delta);
    const p = products.find(x => x.id === id);
    if (p) p.stock = updated.stock;
    filterInv();
    renderStats();
  } catch(e) { showToast('Error updating stock'); }
}

function openAddProduct() {
  document.getElementById('prodModalTitle').textContent = 'Add New Product';
  document.getElementById('editId').value    = '';
  document.getElementById('editCode').value  = '';
  document.getElementById('editName').value  = '';
  document.getElementById('editPrice').value = '';
  document.getElementById('editStock').value = '';
  document.getElementById('editCat').value   = 'Masala Items';
  document.getElementById('editUnit').value  = 'pack';
  document.getElementById('productModal').classList.add('open');
}

function openEditProduct(id) {
  const p = products.find(x => x.id === id);
  if (!p) return;
  document.getElementById('prodModalTitle').textContent = 'Edit Product';
  document.getElementById('editId').value    = p.id;
  document.getElementById('editCode').value  = p.code || '';
  document.getElementById('editName').value  = p.name;
  document.getElementById('editPrice').value = p.price;
  document.getElementById('editStock').value = p.stock;
  document.getElementById('editCat').value   = p.category;
  document.getElementById('editUnit').value  = p.unit;
  document.getElementById('productModal').classList.add('open');
}

async function saveProduct() {
  const name  = document.getElementById('editName').value.trim();
  const price = parseFloat(document.getElementById('editPrice').value);
  const stock = parseInt(document.getElementById('editStock').value);
  const cat   = document.getElementById('editCat').value;
  const unit  = document.getElementById('editUnit').value;
  const code  = parseInt(document.getElementById('editCode').value) || null;
  const id    = parseInt(document.getElementById('editId').value);
  if (!name || isNaN(price) || isNaN(stock)) { showToast('Please fill all fields'); return; }

  try {
    if (id) {
      const updated = await Products.update(id, { code, name, category: cat, price, stock, unit });
      const idx = products.findIndex(x => x.id === id);
      if (idx !== -1) products[idx] = updated;
    } else {
      const newProd = await Products.create({ code, name, category: cat, price, stock, unit });
      products.push(newProd);
      populateCatFilter();
    }
    closeProdModal();
    renderStats();
    filterInv();
    showToast(id ? 'Product updated!' : 'Product added!');
  } catch(e) { showToast('Error: ' + e.message); }
}

async function deleteProduct(id) {
  if (!confirm('Delete this product? This cannot be undone.')) return;
  try {
    await Products.delete(id);
    products = products.filter(x => x.id !== id);
    renderStats();
    filterInv();
    showToast('Product deleted');
  } catch(e) { showToast('Error deleting product'); }
}

function closeProdModal() {
  document.getElementById('productModal').classList.remove('open');
}

/* ── EDIT BY CODE ──────────────────────────── */
function openEditByCode() {
  document.getElementById('searchCode').value = '';
  document.getElementById('codeSearchMsg').textContent = '';
  document.getElementById('editByCodeModal').classList.add('open');
  setTimeout(() => document.getElementById('searchCode').focus(), 100);
}

function closeEditByCode() {
  document.getElementById('editByCodeModal').classList.remove('open');
}

function findAndEdit() {
  const code = parseInt(document.getElementById('searchCode').value);
  const msg  = document.getElementById('codeSearchMsg');
  if (!code) { msg.innerHTML = '<span style="color:#c0392b">Please enter a code number</span>'; return; }
  const p = products.find(x => x.code === code);
  if (!p) {
    msg.innerHTML = `<span style="color:#c0392b">❌ No product found with code <strong>${code}</strong></span>`;
    return;
  }
  // Found — close this modal and open edit modal with product pre-filled
  closeEditByCode();
  openEditProduct(p.id);
}

document.addEventListener('DOMContentLoaded', init);
