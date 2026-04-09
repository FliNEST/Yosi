/* =========================================
   CIGARETTE INVENTORY — SCRIPT.JS
   Modular vanilla JS: calculations, DOM, API
   ========================================= */

'use strict';

// ─── CONFIG ────────────────────────────────
const API_BASE = '/api';

// ─── STATE ─────────────────────────────────
let products = [];   // { _id, name, price, stock }
let history  = [];   // submitted records

// ─── INIT ───────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  setTodayDate();
  updateRecordDateBadge();
  await loadProducts();
  await loadHistory();
  bindHeaderActions();
});

// ─── DATE HELPERS ───────────────────────────
function setTodayDate() {
  const dp = document.getElementById('datePicker');
  dp.value = new Date().toISOString().split('T')[0];
  dp.addEventListener('change', updateRecordDateBadge);
}

function updateRecordDateBadge() {
  const dp  = document.getElementById('datePicker');
  const el  = document.getElementById('recordDate');
  const val = dp.value;
  el.textContent = val ? formatDate(val) : '—';
}

function formatDate(iso) {
  const [y, m, d] = iso.split('-');
  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  return `${d} ${months[parseInt(m,10)-1]} ${y}`;
}

// ─── API LAYER ──────────────────────────────
async function apiFetch(url, options = {}) {
  const res = await fetch(API_BASE + url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// ─── PRODUCTS API ───────────────────────────
async function loadProducts() {
  try {
    products = await apiFetch('/products');
    renderInventoryTable();
  } catch (err) {
    notify('Failed to load products: ' + err.message, 'error');
    // Fallback: use local defaults so UI is usable offline / before backend
    products = getDefaultProducts();
    renderInventoryTable();
  }
}

function getDefaultProducts() {
  const items = [
    { _id: '1', name: 'MARLBORO RED',   price: 176, stock: 0 },
    { _id: '2', name: 'MARLBORO LIGHT', price: 176, stock: 0 },
    { _id: '3', name: 'MARLBORO BLUE',  price: 176, stock: 0 },
    { _id: '4', name: 'MARLBORO BLACK', price: 176, stock: 0 },
    { _id: '5', name: 'CRAFTED BLUE',   price: 164, stock: 0 },
    { _id: '6', name: 'FORTUNE WHITE',  price: 164, stock: 0 },
    { _id: '7', name: 'FORTUNE LIGHT',  price: 164, stock: 0 },
    { _id: '8', name: 'CHESTER RED',    price: 145, stock: 0 },
    { _id: '9', name: 'CHESTER WHITE',  price: 145, stock: 0 },
    { _id:'10', name: 'CHESTER REMIX',  price: 145, stock: 0 },
  ];
  return items;
}

// ─── RENDER INVENTORY TABLE ─────────────────
function renderInventoryTable() {
  const tbody = document.getElementById('tableBody');
  tbody.innerHTML = '';

  products.forEach((p) => {
    const tr = document.createElement('tr');
    tr.dataset.id = p._id;

    const stockClass = p.stock === 0 ? 'out' : p.stock <= 5 ? 'low' : 'ok';

    tr.innerHTML = `
      <td class="product-name">${escHtml(p.name)}</td>
      <td class="price-cell">₱${p.price.toLocaleString()}</td>
      <td class="align-center">
        <span class="stock-badge ${stockClass}" id="stock_${p._id}">${p.stock}</span>
      </td>
      <td class="align-center">
        <input
          type="number"
          class="qty-input"
          id="sold_${p._id}"
          min="0"
          max="${p.stock}"
          value="0"
          data-price="${p.price}"
          data-stock="${p.stock}"
          oninput="onSoldInput(this, '${p._id}')"
        />
      </td>
      <td class="subtotal-cell" id="sub_${p._id}">₱0</td>
    `;
    tbody.appendChild(tr);
  });

  recalcTotals();
}

// ─── CALCULATIONS ───────────────────────────
function calcSubtotal(sold, price) {
  return Math.max(0, parseInt(sold, 10) || 0) * price;
}

function onSoldInput(input, id) {
  const sold  = parseInt(input.value, 10) || 0;
  const price = parseFloat(input.dataset.price);
  const stock = parseInt(input.dataset.stock, 10);

  // Validate
  if (sold > stock) {
    input.classList.add('error');
  } else {
    input.classList.remove('error');
  }

  const sub = calcSubtotal(sold, price);
  document.getElementById(`sub_${id}`).textContent = '₱' + sub.toLocaleString();
  recalcTotals();
}

function recalcTotals() {
  let totalSales = 0;
  let totalStock = 0;

  products.forEach((p) => {
    const soldInput = document.getElementById(`sold_${p._id}`);
    const sold  = parseInt(soldInput?.value, 10) || 0;
    totalSales += calcSubtotal(sold, p.price);
    totalStock += p.stock * p.price;
  });

  document.getElementById('totalSales').textContent      = '₱' + totalSales.toLocaleString();
  document.getElementById('totalStockValue').textContent = '₱' + totalStock.toLocaleString();
}

// ─── SAVE INVENTORY ──────────────────────────
async function saveInventory() {
  const date = document.getElementById('datePicker').value;
  if (!date) { notify('Please select a date.', 'error'); return; }

  // Build sold items list
  const items = [];
  let hasError = false;

  products.forEach((p) => {
    const input = document.getElementById(`sold_${p._id}`);
    const sold  = parseInt(input.value, 10) || 0;
    if (sold < 0) { hasError = true; return; }
    if (sold > p.stock) { hasError = true; input.classList.add('error'); return; }
    if (sold > 0) items.push({ productId: p._id, sold });
  });

  if (hasError) {
    notify('Error: One or more sold quantities exceed current stock.', 'error');
    return;
  }
  if (items.length === 0) {
    notify('No items to save — enter at least one sold quantity.', 'error');
    return;
  }

  const btn = document.getElementById('btnSave');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> SAVING…';

  try {
    await apiFetch('/submit', {
      method: 'POST',
      body: JSON.stringify({ date, items }),
    });
    notify('Inventory saved successfully!', 'success');
    await loadProducts();
    await loadHistory();
  } catch (err) {
    notify('Save failed: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
      SAVE`;
  }
}

// ─── RESET FORM ──────────────────────────────
function resetForm() {
  products.forEach((p) => {
    const input = document.getElementById(`sold_${p._id}`);
    if (input) {
      input.value = 0;
      input.classList.remove('error');
    }
    const sub = document.getElementById(`sub_${p._id}`);
    if (sub) sub.textContent = '₱0';
  });
  recalcTotals();
  notify('Form reset.', 'info');
}

// ─── HISTORY API ─────────────────────────────
async function loadHistory() {
  try {
    history = await apiFetch('/history');
    renderHistory();
  } catch (err) {
    // silently fail — table shows empty
    renderHistory();
  }
}

function renderHistory() {
  const tbody = document.getElementById('historyBody');
  if (!history.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="empty-row">No history records found.</td></tr>';
    return;
  }

  tbody.innerHTML = '';
  history.forEach((rec) => {
    const tr = document.createElement('tr');
    const totalSold  = rec.totalSoldPrice  ? '₱' + rec.totalSoldPrice.toLocaleString()  : '—';
    const totalStock = rec.totalStockPrice ? '₱' + rec.totalStockPrice.toLocaleString() : '—';
    tr.innerHTML = `
      <td class="history-date">${formatDate(rec.date)}</td>
      <td class="history-amount" style="color:var(--accent)">${totalSold}</td>
      <td class="history-amount" style="color:var(--text-muted)">${totalStock}</td>
      <td>
        <div class="actions-cell">
          <button class="btn btn-ghost btn-sm" onclick="viewRecord('${rec._id}')">VIEW</button>
          <button class="btn btn-danger btn-sm" onclick="deleteRecord('${rec._id}', this)">DEL</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

async function deleteRecord(id, btn) {
  if (!confirm('Delete this record?')) return;
  btn.disabled = true;
  try {
    await apiFetch(`/history?id=${id}`, { method: 'DELETE' });
    history = history.filter(r => r._id !== id);
    renderHistory();
    notify('Record deleted.', 'info');
  } catch (err) {
    notify('Delete failed: ' + err.message, 'error');
    btn.disabled = false;
  }
}

function viewRecord(id) {
  const rec = history.find(r => r._id === id);
  if (!rec) return;

  document.getElementById('modalTitle').textContent = 'RECORD — ' + formatDate(rec.date);
  const tbody = document.getElementById('modalBody');

  if (!rec.items || !rec.items.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="empty-row">No item data.</td></tr>';
  } else {
    tbody.innerHTML = rec.items.map(item => `
      <tr>
        <td class="product-name">${escHtml(item.productName || item.productId)}</td>
        <td class="align-center price-cell">₱${(item.price||0).toLocaleString()}</td>
        <td class="align-center"><span class="stock-badge ok">${item.sold}</span></td>
        <td class="subtotal-cell">₱${(item.subtotal||0).toLocaleString()}</td>
      </tr>
    `).join('');
  }

  document.getElementById('modal').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modal').classList.add('hidden');
}

// Close modal on overlay click
document.getElementById('modal').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeModal();
});

// ─── EXPORT CSV ──────────────────────────────
function exportCSV() {
  if (!history.length) { notify('No history to export.', 'error'); return; }

  const rows = [['Date', 'Product', 'Price', 'Sold', 'Subtotal', 'Total Sold Price', 'Total Stock Price']];

  history.forEach(rec => {
    if (rec.items && rec.items.length) {
      rec.items.forEach((item, i) => {
        rows.push([
          formatDate(rec.date),
          item.productName || item.productId,
          item.price || '',
          item.sold,
          item.subtotal || '',
          i === 0 ? rec.totalSoldPrice  || '' : '',
          i === 0 ? rec.totalStockPrice || '' : '',
        ]);
      });
    } else {
      rows.push([formatDate(rec.date), '', '', '', '', rec.totalSoldPrice||'', rec.totalStockPrice||'']);
    }
  });

  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `cigarette-inventory-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  notify('CSV exported!', 'success');
}

// ─── BIND HEADER BUTTONS ─────────────────────
function bindHeaderActions() {
  document.getElementById('btnSave').addEventListener('click', saveInventory);
  document.getElementById('btnReset').addEventListener('click', resetForm);
  document.getElementById('btnDownload').addEventListener('click', exportCSV);
}

// ─── NOTIFICATIONS ───────────────────────────
let notifyTimer = null;
function notify(msg, type = 'info') {
  const el = document.getElementById('notification');
  el.textContent = msg;
  el.className   = `notification ${type}`;
  if (notifyTimer) clearTimeout(notifyTimer);
  notifyTimer = setTimeout(() => { el.classList.add('hidden'); }, 4000);
}

// ─── UTILS ───────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}
