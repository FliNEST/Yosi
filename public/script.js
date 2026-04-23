/* =========================================
   CIGARETTE INVENTORY — SCRIPT.JS
   Features: Stats, Restock Countdown,
             History Filters, Low Stock Alert
   ========================================= */
'use strict';

const API_BASE = '/api';
let products = [];
let history  = [];
let currentFilter = 'all';

// ─── INIT ───────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  setTodayDate();
  updateRecordDateBadge();
  loadRestockDate();
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
  const dp = document.getElementById('datePicker');
  document.getElementById('recordDate').textContent = dp.value ? formatDate(dp.value) : '—';
}

function formatDate(iso) {
  const [y, m, d] = iso.split('-');
  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  return `${d} ${months[parseInt(m,10)-1]} ${y}`;
}

function toIsoDate(d) {
  return d.toISOString().split('T')[0];
}

// ─── API ────────────────────────────────────
async function apiFetch(url, options = {}) {
  const res = await fetch(API_BASE + url, {
    headers: { 'Content-Type': 'application/json' }, ...options,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// ─── PRODUCTS ───────────────────────────────
async function loadProducts() {
  try {
    products = await apiFetch('/products');
    renderInventoryTable();
    checkLowStock();
  } catch (err) {
    notify('Failed to load products: ' + err.message, 'error');
    products = getDefaultProducts();
    renderInventoryTable();
  }
}

function getDefaultProducts() {
  return [
    { _id:'1', name:'MARLBORO RED',   price:176, stock:0 },
    { _id:'2', name:'MARLBORO LIGHT', price:176, stock:0 },
    { _id:'3', name:'MARLBORO BLUE',  price:176, stock:0 },
    { _id:'4', name:'MARLBORO BLACK', price:176, stock:0 },
    { _id:'5', name:'CRAFTED BLUE',   price:164, stock:0 },
    { _id:'6', name:'FORTUNE WHITE',  price:164, stock:0 },
    { _id:'7', name:'FORTUNE LIGHT',  price:164, stock:0 },
    { _id:'8', name:'CHESTER RED',    price:145, stock:0 },
    { _id:'9', name:'CHESTER WHITE',  price:145, stock:0 },
    { _id:'10',name:'CHESTER REMIX',  price:145, stock:0 },
  ];
}

// ─── LOW STOCK ALERT ────────────────────────
function checkLowStock() {
  const low = products.filter(p => p.stock > 0 && p.stock <= 5).map(p => p.name);
  const out = products.filter(p => p.stock === 0).map(p => p.name);
  const alertBar = document.getElementById('lowStockAlert');
  const alertMsg = document.getElementById('lowStockMsg');

  if (out.length || low.length) {
    alertBar.classList.remove('hidden');
    let msg = '';
    if (out.length) msg += `OUT OF STOCK: ${out.join(', ')}. `;
    if (low.length) msg += `LOW STOCK (≤5): ${low.join(', ')}.`;
    alertMsg.textContent = msg;
  } else {
    alertBar.classList.add('hidden');
  }
}

// ─── RENDER TABLE ───────────────────────────
function renderInventoryTable() {
  const tbody = document.getElementById('tableBody');
  tbody.innerHTML = '';
  products.forEach((p) => {
    const tr = document.createElement('tr');
    tr.dataset.id = p._id;
    const stockClass = p.stock === 0 ? 'out' : p.stock <= 5 ? 'low' : 'ok';
    tr.innerHTML = `
      <td class="product-name">${escHtml(p.name)}</td>
      <td class="price-cell">&#8369;${p.price.toLocaleString()}</td>
      <td class="align-center">
        <span class="stock-badge ${stockClass}" id="stock_${p._id}"
          onclick="promptRestock('${p._id}','${escHtml(p.name)}',${p.stock})"
          style="cursor:pointer" title="Click to restock">
          ${p.stock}
        </span>
      </td>
      <td class="align-center">
        <input type="number" class="qty-input" id="sold_${p._id}"
          min="0" max="${p.stock}" value="0"
          data-price="${p.price}" data-stock="${p.stock}"
          oninput="onSoldInput(this,'${p._id}')" />
      </td>
      <td class="subtotal-cell" id="sub_${p._id}">&#8369;0</td>`;
    tbody.appendChild(tr);
  });
  recalcTotals();
}

// ─── RESTOCK PROMPT ─────────────────────────
async function promptRestock(id, name, currentStock) {
  const input = prompt(`RESTOCK: ${name}\nCurrent stock: ${currentStock}\n\nEnter NEW stock total:`);
  if (input === null) return;
  const newStock = parseInt(input, 10);
  if (isNaN(newStock) || newStock < 0) { notify('Invalid amount.', 'error'); return; }
  try {
    await apiFetch(`/products/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ stock: newStock }),
    });
    notify(`${name} restocked to ${newStock} units!`, 'success');
    await loadProducts();
  } catch (err) {
    notify('Restock failed: ' + err.message, 'error');
  }
}

// ─── CALCULATIONS ───────────────────────────
function calcSubtotal(sold, price) {
  return Math.max(0, parseInt(sold, 10) || 0) * price;
}

function onSoldInput(input, id) {
  const sold  = parseInt(input.value, 10) || 0;
  const price = parseFloat(input.dataset.price);
  const stock = parseInt(input.dataset.stock, 10);
  input.classList.toggle('error', sold > stock);
  document.getElementById(`sub_${id}`).textContent = '\u20B1' + calcSubtotal(sold, price).toLocaleString();
  recalcTotals();
}

function recalcTotals() {
  let totalSales = 0, totalStock = 0;
  products.forEach((p) => {
    const soldInput = document.getElementById(`sold_${p._id}`);
    const sold = parseInt(soldInput?.value, 10) || 0;
    totalSales += calcSubtotal(sold, p.price);
    totalStock += p.stock * p.price;
  });
  document.getElementById('totalSales').textContent      = '\u20B1' + totalSales.toLocaleString();
  document.getElementById('totalStockValue').textContent = '\u20B1' + totalStock.toLocaleString();
}

// ─── SAVE ───────────────────────────────────
async function saveInventory() {
  const date = document.getElementById('datePicker').value;
  if (!date) { notify('Please select a date.', 'error'); return; }

  const items = [];
  let hasError = false;
  products.forEach((p) => {
    const input = document.getElementById(`sold_${p._id}`);
    const sold  = parseInt(input.value, 10) || 0;
    if (sold > p.stock) { hasError = true; input.classList.add('error'); return; }
    if (sold > 0) items.push({ productId: p._id, sold });
  });

  if (hasError) { notify('Sold qty exceeds stock for one or more items.', 'error'); return; }
  if (items.length === 0) { notify('Enter at least one sold quantity.', 'error'); return; }

  const btn = document.getElementById('btnSave');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> SAVING\u2026';

  try {
    await apiFetch('/submit', { method: 'POST', body: JSON.stringify({ date, items }) });
    notify('Inventory saved successfully!', 'success');
    await loadProducts();
    await loadHistory();
  } catch (err) {
    notify('Save failed: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> SAVE`;
  }
}

// ─── RESET ──────────────────────────────────
function resetForm() {
  products.forEach((p) => {
    const input = document.getElementById(`sold_${p._id}`);
    if (input) { input.value = 0; input.classList.remove('error'); }
    const sub = document.getElementById(`sub_${p._id}`);
    if (sub) sub.textContent = '\u20B10';
  });
  recalcTotals();
  notify('Form reset.', 'info');
}

// ─── RESTOCK COUNTDOWN ──────────────────────
function setRestockDate() {
  const val = document.getElementById('restockDatePicker').value;
  if (!val) { notify('Please pick a restock date.', 'error'); return; }
  localStorage.setItem('restockDate', val);
  loadRestockDate();
  notify('Restock date set!', 'success');
}

function clearRestockDate() {
  localStorage.removeItem('restockDate');
  document.getElementById('restockDateDisplay').textContent = 'Not set';
  document.getElementById('countdownDays').textContent = '—';
  document.getElementById('countdownDays').className = 'countdown-num';
  document.getElementById('restockDatePicker').value = '';
}

function loadRestockDate() {
  const saved = localStorage.getItem('restockDate');
  if (!saved) return;
  document.getElementById('restockDatePicker').value = saved;
  document.getElementById('restockDateDisplay').textContent = formatDate(saved);
  updateCountdown(saved);
}

function updateCountdown(isoDate) {
  const today    = new Date(); today.setHours(0,0,0,0);
  const restock  = new Date(isoDate + 'T00:00:00');
  const diffMs   = restock - today;
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const el       = document.getElementById('countdownDays');

  if (diffDays < 0) {
    el.textContent = 'OVERDUE';
    el.className = 'countdown-num urgent';
  } else if (diffDays === 0) {
    el.textContent = 'TODAY';
    el.className = 'countdown-num urgent';
  } else if (diffDays <= 2) {
    el.textContent = diffDays;
    el.className = 'countdown-num soon';
  } else {
    el.textContent = diffDays;
    el.className = 'countdown-num';
  }
}

// ─── HISTORY ────────────────────────────────
async function loadHistory() {
  try {
    history = await apiFetch('/history');
    filterHistory(currentFilter, null);
    updateDashboardStats();
  } catch (err) {
    renderHistoryRows([]);
  }
}

// ─── FILTER HELPERS ─────────────────────────
function getWeekRange(offset = 0) {
  const now = new Date(); now.setHours(0,0,0,0);
  const day = now.getDay(); // 0=Sun
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - day + offset * 7);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  return { from: toIsoDate(startOfWeek), to: toIsoDate(endOfWeek) };
}

function getMonthRange(offset = 0) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + offset;
  const from = new Date(y, m, 1);
  const to   = new Date(y, m + 1, 0);
  return { from: toIsoDate(from), to: toIsoDate(to) };
}

function filterHistory(type, btnEl) {
  currentFilter = type;

  // Update active button
  if (btnEl) {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btnEl.classList.add('active');
  }

  let filtered = [...history];
  const today = toIsoDate(new Date());

  if (type === 'today') {
    filtered = history.filter(r => r.date === today);
  } else if (type === 'week') {
    const { from, to } = getWeekRange(0);
    filtered = history.filter(r => r.date >= from && r.date <= to);
  } else if (type === 'lastweek') {
    const { from, to } = getWeekRange(-1);
    filtered = history.filter(r => r.date >= from && r.date <= to);
  } else if (type === 'month') {
    const { from, to } = getMonthRange(0);
    filtered = history.filter(r => r.date >= from && r.date <= to);
  } else if (type === 'lastmonth') {
    const { from, to } = getMonthRange(-1);
    filtered = history.filter(r => r.date >= from && r.date <= to);
  } else if (type === 'custom') {
    const from = document.getElementById('filterFrom').value;
    const to   = document.getElementById('filterTo').value;
    if (!from || !to) { notify('Please select both From and To dates.', 'error'); return; }
    filtered = history.filter(r => r.date >= from && r.date <= to);
    // Remove active from filter buttons for custom
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  }

  renderHistoryRows(filtered);
  updateHistorySummary(filtered);
}

function renderHistoryRows(rows) {
  const tbody = document.getElementById('historyBody');
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="empty-row">No records for this period.</td></tr>';
    return;
  }
  tbody.innerHTML = '';
  rows.forEach((rec) => {
    const tr = document.createElement('tr');
    const totalSold  = rec.totalSoldPrice  ? '\u20B1' + rec.totalSoldPrice.toLocaleString()  : '—';
    const totalStock = rec.totalStockPrice ? '\u20B1' + rec.totalStockPrice.toLocaleString() : '—';
    tr.innerHTML = `
      <td class="history-date">${formatDate(rec.date)}</td>
      <td class="history-amount" style="color:var(--accent)">${totalSold}</td>
      <td class="history-amount" style="color:var(--text-muted)">${totalStock}</td>
      <td>
        <div class="actions-cell">
          <button class="btn btn-ghost btn-sm" onclick="viewRecord('${rec._id}')">VIEW</button>
          <button class="btn btn-danger btn-sm" onclick="deleteRecord('${rec._id}', this)">DEL</button>
        </div>
      </td>`;
    tbody.appendChild(tr);
  });
}

function updateHistorySummary(rows) {
  const summary = document.getElementById('historySummary');
  if (!rows.length) { summary.style.display = 'none'; return; }
  summary.style.display = 'flex';
  const total = rows.reduce((acc, r) => acc + (r.totalSoldPrice || 0), 0);
  const avg   = Math.round(total / rows.length);
  document.getElementById('summaryCount').textContent = rows.length;
  document.getElementById('summaryTotal').textContent = '\u20B1' + total.toLocaleString();
  document.getElementById('summaryAvg').textContent   = '\u20B1' + avg.toLocaleString();
}

// ─── DASHBOARD STATS ────────────────────────
function updateDashboardStats() {
  // This week
  const { from: wFrom, to: wTo } = getWeekRange(0);
  const weekRecs  = history.filter(r => r.date >= wFrom && r.date <= wTo);
  const weekTotal = weekRecs.reduce((a, r) => a + (r.totalSoldPrice || 0), 0);
  document.getElementById('statWeekSales').textContent = '\u20B1' + weekTotal.toLocaleString();
  document.getElementById('statWeekDays').textContent  = `${weekRecs.length} day${weekRecs.length !== 1 ? 's' : ''} recorded`;

  // This month
  const { from: mFrom, to: mTo } = getMonthRange(0);
  const monthRecs  = history.filter(r => r.date >= mFrom && r.date <= mTo);
  const monthTotal = monthRecs.reduce((a, r) => a + (r.totalSoldPrice || 0), 0);
  document.getElementById('statMonthSales').textContent = '\u20B1' + monthTotal.toLocaleString();
  document.getElementById('statMonthDays').textContent  = `${monthRecs.length} day${monthRecs.length !== 1 ? 's' : ''} recorded`;

  // Daily average (all time)
  const allTotal = history.reduce((a, r) => a + (r.totalSoldPrice || 0), 0);
  const dailyAvg = history.length ? Math.round(allTotal / history.length) : 0;
  document.getElementById('statDailyAvg').textContent = '\u20B1' + dailyAvg.toLocaleString();
  document.getElementById('statTotalDays').textContent = `${history.length} total days`;

  // Best seller this week
  const soldMap = {};
  weekRecs.forEach(rec => {
    (rec.items || []).forEach(item => {
      const name = item.productName || 'Unknown';
      soldMap[name] = (soldMap[name] || 0) + item.sold;
    });
  });
  const entries = Object.entries(soldMap);
  if (entries.length) {
    entries.sort((a, b) => b[1] - a[1]);
    const [bestName, bestQty] = entries[0];
    document.getElementById('statBestSeller').textContent    = bestName;
    document.getElementById('statBestSellerQty').textContent = `${bestQty} pcs sold this week`;
  } else {
    document.getElementById('statBestSeller').textContent    = '—';
    document.getElementById('statBestSellerQty').textContent = 'no data this week';
  }
}

// ─── DELETE / VIEW ──────────────────────────
async function deleteRecord(id, btn) {
  if (!confirm('Delete this record?')) return;
  btn.disabled = true;
  try {
    await apiFetch(`/history?id=${id}`, { method: 'DELETE' });
    history = history.filter(r => r._id !== id);
    filterHistory(currentFilter, null);
    updateDashboardStats();
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
        <td class="align-center price-cell">&#8369;${(item.price||0).toLocaleString()}</td>
        <td class="align-center"><span class="stock-badge ok">${item.sold}</span></td>
        <td class="subtotal-cell">&#8369;${(item.subtotal||0).toLocaleString()}</td>
      </tr>`).join('');
  }
  document.getElementById('modal').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modal').classList.add('hidden');
}
document.getElementById('modal').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeModal();
});

// ─── EXPORT CSV ─────────────────────────────
function exportCSV() {
  if (!history.length) { notify('No history to export.', 'error'); return; }
  const rows = [['Date','Product','Price','Sold','Subtotal','Total Sold Price','Total Stock Price']];
  history.forEach(rec => {
    if (rec.items && rec.items.length) {
      rec.items.forEach((item, i) => {
        rows.push([formatDate(rec.date), item.productName||item.productId, item.price||'', item.sold, item.subtotal||'',
          i === 0 ? rec.totalSoldPrice||'' : '', i === 0 ? rec.totalStockPrice||'' : '']);
      });
    } else {
      rows.push([formatDate(rec.date),'','','','', rec.totalSoldPrice||'', rec.totalStockPrice||'']);
    }
  });
  const csv  = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `cigarette-inventory-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  notify('CSV exported!', 'success');
}

// ─── BIND ───────────────────────────────────
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
  notifyTimer = setTimeout(() => el.classList.add('hidden'), 4000);
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}