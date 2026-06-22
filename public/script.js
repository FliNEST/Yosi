/* =========================================
   CIGARETTE INVENTORY — SCRIPT.JS
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
  initFund();
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
function toIsoDate(d) { return d.toISOString().split('T')[0]; }

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
    { _id:'1',  name:'MARLBORO RED',   price:176, stock:0 },
    { _id:'2',  name:'MARLBORO LIGHT', price:176, stock:0 },
    { _id:'3',  name:'MARLBORO BLUE',  price:176, stock:0 },
    { _id:'4',  name:'MARLBORO BLACK', price:176, stock:0 },
    { _id:'5',  name:'CRAFTED BLUE',   price:164, stock:0 },
    { _id:'6',  name:'FORTUNE WHITE',  price:164, stock:0 },
    { _id:'7',  name:'FORTUNE LIGHT',  price:164, stock:0 },
    { _id:'8',  name:'CHESTER RED',    price:145, stock:0 },
    { _id:'9',  name:'CHESTER WHITE',  price:145, stock:0 },
    { _id:'10', name:'CHESTER REMIX',  price:145, stock:0 },
  ];
}

function checkLowStock() {
  const low = products.filter(p => p.stock > 0 && p.stock <= 5).map(p => p.name);
  const out = products.filter(p => p.stock === 0).map(p => p.name);
  const bar = document.getElementById('lowStockAlert');
  if (out.length || low.length) {
    bar.classList.remove('hidden');
    let msg = '';
    if (out.length) msg += `OUT OF STOCK: ${out.join(', ')}. `;
    if (low.length) msg += `LOW STOCK (≤5): ${low.join(', ')}.`;
    document.getElementById('lowStockMsg').textContent = msg;
  } else {
    bar.classList.add('hidden');
  }
}

// ─── RENDER TABLE ───────────────────────────
function renderInventoryTable() {
  const tbody = document.getElementById('tableBody');
  tbody.innerHTML = '';
  products.forEach((p) => {
    const tr = document.createElement('tr');
    const stockClass = p.stock === 0 ? 'out' : p.stock <= 5 ? 'low' : 'ok';
    tr.innerHTML = `
      <td class="product-name">${escHtml(p.name)}</td>
      <td class="price-cell">&#8369;${p.price.toLocaleString()}</td>
      <td class="align-center">
        <span class="stock-badge ${stockClass}" id="stock_${p._id}"
          onclick="promptRestock('${p._id}','${escHtml(p.name)}',${p.stock})"
          style="cursor:pointer" title="Click to restock">${p.stock}</span>
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

async function promptRestock(id, name, currentStock) {
  const input = prompt(`RESTOCK: ${name}\nCurrent stock: ${currentStock}\n\nEnter NEW stock total:`);
  if (input === null) return;
  const newStock = parseInt(input, 10);
  if (isNaN(newStock) || newStock < 0) { notify('Invalid amount.', 'error'); return; }
  try {
    await apiFetch(`/products/${id}`, { method: 'PATCH', body: JSON.stringify({ stock: newStock }) });
    notify(`${name} restocked to ${newStock} units!`, 'success');
    await loadProducts();
  } catch (err) {
    notify('Restock failed: ' + err.message, 'error');
  }
}

function onSoldInput(input, id) {
  const sold  = parseInt(input.value, 10) || 0;
  const price = parseFloat(input.dataset.price);
  const stock = parseInt(input.dataset.stock, 10);
  input.classList.toggle('error', sold > stock);
  document.getElementById(`sub_${id}`).textContent = '\u20B1' + calcSubtotal(sold, price).toLocaleString();
  recalcTotals();
}
function calcSubtotal(sold, price) { return Math.max(0, parseInt(sold,10)||0) * price; }
function recalcTotals() {
  let totalSales = 0, totalStock = 0;
  products.forEach((p) => {
    const s = parseInt(document.getElementById(`sold_${p._id}`)?.value, 10) || 0;
    totalSales += calcSubtotal(s, p.price);
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
  let hasError = false, totalAmount = 0;
  products.forEach((p) => {
    const input = document.getElementById(`sold_${p._id}`);
    const sold  = parseInt(input.value, 10) || 0;
    if (sold > p.stock) { hasError = true; input.classList.add('error'); return; }
    if (sold > 0) { items.push({ productId: p._id, sold }); totalAmount += sold * p.price; }
  });

  if (hasError) { notify('Sold qty exceeds stock.', 'error'); return; }
  if (items.length === 0) { notify('Enter at least one sold quantity.', 'error'); return; }

  const btn = document.getElementById('btnSave');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> SAVING\u2026';

  try {
    await apiFetch('/submit', { method: 'POST', body: JSON.stringify({ date, items }) });
    // ✅ Auto-add sales to fund
    addFundTransaction('deposit', totalAmount, `Sales — ${formatDate(date)}`);
    notify(`Saved! ₱${totalAmount.toLocaleString()} added to Cash Fund.`, 'success');
    await loadProducts();
    await loadHistory();
  } catch (err) {
    notify('Save failed: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> SAVE`;
  }
}

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
  updateFundUI();
  notify('Restock date set!', 'success');
}
function clearRestockDate() {
  localStorage.removeItem('restockDate');
  document.getElementById('restockDateDisplay').textContent = 'Not set';
  document.getElementById('countdownDays').textContent = '—';
  document.getElementById('countdownDays').className = 'countdown-num';
  document.getElementById('restockDatePicker').value = '';
  updateFundUI();
}
function loadRestockDate() {
  const saved = localStorage.getItem('restockDate');
  if (!saved) return;
  document.getElementById('restockDatePicker').value = saved;
  document.getElementById('restockDateDisplay').textContent = formatDate(saved);
  updateCountdown(saved);
}
function getDaysUntilRestock() {
  const saved = localStorage.getItem('restockDate');
  if (!saved) return null;
  const today   = new Date(); today.setHours(0,0,0,0);
  const restock = new Date(saved + 'T00:00:00');
  return Math.ceil((restock - today) / (1000*60*60*24));
}
function updateCountdown(isoDate) {
  const days = getDaysUntilRestock();
  const el   = document.getElementById('countdownDays');
  if (days === null) return;
  if (days < 0)      { el.textContent = 'OVERDUE'; el.className = 'countdown-num urgent'; }
  else if (days === 0) { el.textContent = 'TODAY';  el.className = 'countdown-num urgent'; }
  else if (days <= 2)  { el.textContent = days;     el.className = 'countdown-num soon'; }
  else                 { el.textContent = days;     el.className = 'countdown-num'; }
}

// ══════════════════════════════════════════════
//  💰 CASH FUND MANAGER
// ══════════════════════════════════════════════

// Fund stored in localStorage:
// fund_transactions: [{id, type:'deposit'|'withdraw', amount, note, date}]
// fund_target: number

function getFundTransactions() {
  try { return JSON.parse(localStorage.getItem('fund_transactions') || '[]'); } catch { return []; }
}
function saveFundTransactions(txs) {
  localStorage.setItem('fund_transactions', JSON.stringify(txs));
}
function getFundTarget() {
  return parseFloat(localStorage.getItem('fund_target') || '0');
}
function getFundBalance() {
  return getFundTransactions().reduce((acc, tx) => {
    return tx.type === 'deposit' ? acc + tx.amount : acc - tx.amount;
  }, 0);
}
function getDailyAvgFromHistory() {
  if (!history.length) return 0;
  const total = history.reduce((a, r) => a + (r.totalSoldPrice||0), 0);
  return total / history.length;
}

function initFund() {
  const target = getFundTarget();
  if (target) document.getElementById('fundTargetInput').value = target;
  renderFundUI();
}

function setFundTarget() {
  const val = parseFloat(document.getElementById('fundTargetInput').value);
  if (isNaN(val) || val <= 0) { notify('Enter a valid budget amount.', 'error'); return; }
  localStorage.setItem('fund_target', val);
  updateFundUI();
  notify(`Restock budget set to ₱${val.toLocaleString()}`, 'success');
}

function addFundTransaction(type, amount, note) {
  const txs = getFundTransactions();
  txs.unshift({
    id:     Date.now().toString(),
    type,
    amount: parseFloat(amount),
    note:   note || '',
    date:   new Date().toISOString(),
  });
  saveFundTransactions(txs);
  renderFundUI();
}

function manualDeposit() {
  const amount = parseFloat(document.getElementById('depositAmount').value);
  const note   = document.getElementById('depositNote').value.trim() || 'Manual deposit';
  if (isNaN(amount) || amount <= 0) { notify('Enter a valid amount.', 'error'); return; }
  addFundTransaction('deposit', amount, note);
  document.getElementById('depositAmount').value = '';
  document.getElementById('depositNote').value   = '';
  notify(`₱${amount.toLocaleString()} added to fund!`, 'success');
}

function withdraw() {
  const amount = parseFloat(document.getElementById('withdrawAmount').value);
  const note   = document.getElementById('withdrawNote').value.trim() || 'Stock purchase';
  if (isNaN(amount) || amount <= 0) { notify('Enter a valid amount.', 'error'); return; }
  const balance = getFundBalance();
  if (amount > balance) {
    if (!confirm(`Fund balance is only ₱${balance.toLocaleString()}. Deduct anyway?`)) return;
  }
  addFundTransaction('withdraw', amount, note);
  document.getElementById('withdrawAmount').value = '';
  document.getElementById('withdrawNote').value   = '';
  notify(`₱${amount.toLocaleString()} deducted from fund.`, 'info');
}

function deleteFundTx(id) {
  if (!confirm('Remove this transaction?')) return;
  const txs = getFundTransactions().filter(t => t.id !== id);
  saveFundTransactions(txs);
  renderFundUI();
  notify('Transaction removed.', 'info');
}

function confirmResetFund() {
  if (!confirm('Reset entire cash fund? All transactions will be deleted.')) return;
  localStorage.removeItem('fund_transactions');
  renderFundUI();
  notify('Cash fund reset.', 'info');
}

function toggleFundHistory() {
  const wrap = document.getElementById('fundHistoryWrap');
  wrap.classList.toggle('hidden');
}

function renderFundUI() {
  updateFundUI();
  renderFundTransactions();
}

function updateFundUI() {
  const balance  = getFundBalance();
  const target   = getFundTarget();
  const daysLeft = getDaysUntilRestock();
  const dailyAvg = getDailyAvgFromHistory();

  // Balance
  document.getElementById('fundBalance').textContent = '\u20B1' + Math.max(0,balance).toLocaleString();

  // Target
  document.getElementById('fundTarget').textContent = target ? '\u20B1' + target.toLocaleString() : '₱0';

  // Projection
  let projected = balance;
  if (daysLeft !== null && daysLeft > 0 && dailyAvg > 0) {
    projected = balance + (dailyAvg * daysLeft);
  }
  document.getElementById('fundProjected').textContent = '\u20B1' + Math.round(Math.max(0,projected)).toLocaleString();

  if (daysLeft !== null && dailyAvg > 0) {
    document.getElementById('fundProjectedSub').textContent =
      `+₱${Math.round(dailyAvg).toLocaleString()}/day × ${daysLeft} days`;
  } else if (daysLeft === null) {
    document.getElementById('fundProjectedSub').textContent = 'Set restock date first';
  } else {
    document.getElementById('fundProjectedSub').textContent = 'No sales history yet';
  }

  // Progress bar
  const pct   = target > 0 ? Math.min(100, Math.round((balance / target) * 100)) : 0;
  const projPct = target > 0 ? Math.min(100, Math.round((projected / target) * 100)) : 0;
  const fill  = document.getElementById('fundProgressFill');
  const pctEl = document.getElementById('fundProgressPct');

  fill.style.width  = pct + '%';
  pctEl.textContent = pct + '%';
  fill.className = 'fund-progress-fill';
  if (pct >= 100)     fill.classList.add('ok');
  else if (pct >= 60) fill.classList.add('warn');
  else                fill.classList.add('bad');

  // Need more
  const needMoreEl = document.getElementById('fundNeedMore');
  const daysInfoEl = document.getElementById('fundDaysInfo');
  if (target > 0) {
    const diff = target - balance;
    if (diff <= 0) {
      needMoreEl.textContent = `✅ Budget reached! Extra: ₱${Math.abs(diff).toLocaleString()}`;
      needMoreEl.style.color = 'var(--success)';
    } else {
      needMoreEl.textContent = `Need ₱${diff.toLocaleString()} more (${pct}% reached)`;
      needMoreEl.style.color = 'var(--text-dim)';
    }
    if (daysLeft !== null) {
      daysInfoEl.textContent = `${daysLeft} day${daysLeft !== 1 ? 's' : ''} until ahente`;
      daysInfoEl.style.color = daysLeft <= 2 ? 'var(--danger)' : 'var(--text-dim)';
    }
  } else {
    needMoreEl.textContent = 'Set a restock budget to track progress';
    needMoreEl.style.color = 'var(--text-dim)';
  }

  // Status box
  const statusIcon = document.getElementById('fundStatusIcon');
  const statusText = document.getElementById('fundStatusText');
  statusText.className = 'fund-status-text';

  if (!target) {
    statusIcon.textContent = '⏳';
    statusText.textContent = 'Set budget & date';
  } else if (balance >= target) {
    statusIcon.textContent = '✅';
    statusText.textContent = 'READY TO BUY!';
    statusText.classList.add('ok');
  } else if (projected >= target) {
    statusIcon.textContent = '📈';
    statusText.textContent = "YOU'LL MAKE IT!";
    statusText.classList.add('warn');
  } else {
    const shortfall = Math.round(target - projected);
    statusIcon.textContent = '⚠️';
    statusText.textContent = `SHORT ₱${shortfall.toLocaleString()}`;
    statusText.classList.add('bad');
  }
}

function renderFundTransactions() {
  const txs   = getFundTransactions();
  const list  = document.getElementById('fundTxList');
  const count = document.getElementById('fundTxCount');
  count.textContent = `${txs.length} transaction${txs.length !== 1 ? 's' : ''}`;

  if (!txs.length) {
    list.innerHTML = '<div style="padding:20px 24px;text-align:center;color:var(--text-dim);font-family:var(--font-cond);font-size:.85rem">No transactions yet. Save a sale to start!</div>';
    return;
  }

  list.innerHTML = txs.map(tx => {
    const d   = new Date(tx.date);
    const dStr = `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
    const sign = tx.type === 'deposit' ? '+' : '−';
    return `<div class="fund-tx-item">
      <div class="fund-tx-dot ${tx.type}"></div>
      <div class="fund-tx-date">${dStr}</div>
      <div class="fund-tx-note">${escHtml(tx.note)}</div>
      <div class="fund-tx-amount ${tx.type}">${sign}₱${tx.amount.toLocaleString()}</div>
      <button class="fund-tx-del" onclick="deleteFundTx('${tx.id}')" title="Remove">✕</button>
    </div>`;
  }).join('');
}

// ─── HISTORY ────────────────────────────────
async function loadHistory() {
  try {
    history = await apiFetch('/history');
    filterHistory(currentFilter, null);
    updateDashboardStats();
    updateFundUI(); // refresh projection after history loads
  } catch { renderHistoryRows([]); }
}

function getWeekRange(offset=0) {
  const now = new Date(); now.setHours(0,0,0,0);
  const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - now.getDay() + offset*7);
  const endOfWeek   = new Date(startOfWeek); endOfWeek.setDate(startOfWeek.getDate() + 6);
  return { from: toIsoDate(startOfWeek), to: toIsoDate(endOfWeek) };
}
function getMonthRange(offset=0) {
  const now = new Date(); const y = now.getFullYear(); const m = now.getMonth()+offset;
  return { from: toIsoDate(new Date(y,m,1)), to: toIsoDate(new Date(y,m+1,0)) };
}

function filterHistory(type, btnEl) {
  currentFilter = type;
  if (btnEl) {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btnEl.classList.add('active');
  }
  let filtered = [...history];
  const today  = toIsoDate(new Date());
  if (type === 'today')     filtered = history.filter(r => r.date === today);
  else if (type === 'week') { const {from,to} = getWeekRange(0);  filtered = history.filter(r => r.date>=from && r.date<=to); }
  else if (type === 'lastweek') { const {from,to} = getWeekRange(-1); filtered = history.filter(r => r.date>=from && r.date<=to); }
  else if (type === 'month') { const {from,to} = getMonthRange(0);  filtered = history.filter(r => r.date>=from && r.date<=to); }
  else if (type === 'lastmonth') { const {from,to} = getMonthRange(-1); filtered = history.filter(r => r.date>=from && r.date<=to); }
  else if (type === 'custom') {
    const from = document.getElementById('filterFrom').value;
    const to   = document.getElementById('filterTo').value;
    if (!from || !to) { notify('Select both From and To dates.', 'error'); return; }
    filtered = history.filter(r => r.date>=from && r.date<=to);
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  }
  renderHistoryRows(filtered);
  updateHistorySummary(filtered);
}

function renderHistoryRows(rows) {
  const tbody = document.getElementById('historyBody');
  if (!rows.length) { tbody.innerHTML = '<tr><td colspan="4" class="empty-row">No records for this period.</td></tr>'; return; }
  tbody.innerHTML = '';
  rows.forEach((rec) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="history-date">${formatDate(rec.date)}</td>
      <td class="history-amount" style="color:var(--accent)">${rec.totalSoldPrice ? '\u20B1'+rec.totalSoldPrice.toLocaleString() : '—'}</td>
      <td class="history-amount" style="color:var(--text-muted)">${rec.totalStockPrice ? '\u20B1'+rec.totalStockPrice.toLocaleString() : '—'}</td>
      <td><div class="actions-cell">
        <button class="btn btn-ghost btn-sm" onclick="viewRecord('${rec._id}')">VIEW</button>
        <button class="btn btn-danger btn-sm" onclick="deleteRecord('${rec._id}',this)">DEL</button>
      </div></td>`;
    tbody.appendChild(tr);
  });
}
function updateHistorySummary(rows) {
  const s = document.getElementById('historySummary');
  if (!rows.length) { s.style.display='none'; return; }
  s.style.display='flex';
  const total = rows.reduce((a,r)=>a+(r.totalSoldPrice||0),0);
  const avg   = Math.round(total/rows.length);
  document.getElementById('summaryCount').textContent = rows.length;
  document.getElementById('summaryTotal').textContent = '\u20B1'+total.toLocaleString();
  document.getElementById('summaryAvg').textContent   = '\u20B1'+avg.toLocaleString();
}

function updateDashboardStats() {
  const {from:wFrom,to:wTo} = getWeekRange(0);
  const weekRecs  = history.filter(r=>r.date>=wFrom&&r.date<=wTo);
  const weekTotal = weekRecs.reduce((a,r)=>a+(r.totalSoldPrice||0),0);
  document.getElementById('statWeekSales').textContent = '\u20B1'+weekTotal.toLocaleString();
  document.getElementById('statWeekDays').textContent  = `${weekRecs.length} day${weekRecs.length!==1?'s':''} recorded`;

  const {from:mFrom,to:mTo} = getMonthRange(0);
  const monthRecs  = history.filter(r=>r.date>=mFrom&&r.date<=mTo);
  const monthTotal = monthRecs.reduce((a,r)=>a+(r.totalSoldPrice||0),0);
  document.getElementById('statMonthSales').textContent = '\u20B1'+monthTotal.toLocaleString();
  document.getElementById('statMonthDays').textContent  = `${monthRecs.length} day${monthRecs.length!==1?'s':''} recorded`;

  const allTotal = history.reduce((a,r)=>a+(r.totalSoldPrice||0),0);
  const dailyAvg = history.length ? Math.round(allTotal/history.length) : 0;
  document.getElementById('statDailyAvg').textContent = '\u20B1'+dailyAvg.toLocaleString();
  document.getElementById('statTotalDays').textContent = `${history.length} total days`;

  const soldMap = {};
  weekRecs.forEach(rec=>{(rec.items||[]).forEach(item=>{const n=item.productName||'?'; soldMap[n]=(soldMap[n]||0)+item.sold;});});
  const entries = Object.entries(soldMap).sort((a,b)=>b[1]-a[1]);
  if (entries.length) {
    document.getElementById('statBestSeller').textContent    = entries[0][0];
    document.getElementById('statBestSellerQty').textContent = `${entries[0][1]} pcs sold this week`;
  } else {
    document.getElementById('statBestSeller').textContent    = '—';
    document.getElementById('statBestSellerQty').textContent = 'no data this week';
  }
}

async function deleteRecord(id, btn) {
  if (!confirm('Delete this record?')) return;
  btn.disabled = true;
  try {
    await apiFetch(`/history?id=${id}`, { method: 'DELETE' });
    history = history.filter(r=>r._id!==id);
    filterHistory(currentFilter, null);
    updateDashboardStats();
    updateFundUI();
    notify('Record deleted.', 'info');
  } catch (err) {
    notify('Delete failed: '+err.message, 'error');
    btn.disabled = false;
  }
}

function viewRecord(id) {
  const rec = history.find(r=>r._id===id);
  if (!rec) return;
  document.getElementById('modalTitle').textContent = 'RECORD — '+formatDate(rec.date);
  const tbody = document.getElementById('modalBody');
  if (!rec.items||!rec.items.length) {
    tbody.innerHTML='<tr><td colspan="4" class="empty-row">No item data.</td></tr>';
  } else {
    tbody.innerHTML=rec.items.map(item=>`
      <tr>
        <td class="product-name">${escHtml(item.productName||item.productId)}</td>
        <td class="align-center price-cell">&#8369;${(item.price||0).toLocaleString()}</td>
        <td class="align-center"><span class="stock-badge ok">${item.sold}</span></td>
        <td class="subtotal-cell">&#8369;${(item.subtotal||0).toLocaleString()}</td>
      </tr>`).join('');
  }
  document.getElementById('modal').classList.remove('hidden');
}
function closeModal() { document.getElementById('modal').classList.add('hidden'); }
document.getElementById('modal').addEventListener('click',(e)=>{ if(e.target===e.currentTarget) closeModal(); });

// ─── EXPORT CSV ─────────────────────────────
function exportCSV() {
  if (!history.length) { notify('No history to export.', 'error'); return; }
  const rows = [['Date','Product','Price','Sold','Subtotal','Total Sold','Total Stock']];
  history.forEach(rec=>{
    if (rec.items&&rec.items.length) {
      rec.items.forEach((item,i)=>{
        rows.push([formatDate(rec.date),item.productName||'',item.price||'',item.sold,item.subtotal||'',
          i===0?rec.totalSoldPrice||'':'', i===0?rec.totalStockPrice||'':'']);
      });
    } else {
      rows.push([formatDate(rec.date),'','','','',rec.totalSoldPrice||'',rec.totalStockPrice||'']);
    }
  });
  const csv=rows.map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
  a.download=`cigarette-inventory-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  notify('CSV exported!', 'success');
}

// ─── BIND ───────────────────────────────────
function bindHeaderActions() {
  document.getElementById('btnSave').addEventListener('click', saveInventory);
  document.getElementById('btnReset').addEventListener('click', resetForm);
  document.getElementById('btnDownload').addEventListener('click', exportCSV);
}

// ─── UTILS ──────────────────────────────────
let notifyTimer=null;
function notify(msg,type='info') {
  const el=document.getElementById('notification');
  el.textContent=msg; el.className=`notification ${type}`;
  if(notifyTimer) clearTimeout(notifyTimer);
  notifyTimer=setTimeout(()=>el.classList.add('hidden'),4500);
}
function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}