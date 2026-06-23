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
  loadPeriodFromStorage();
  await loadProducts();
  await loadHistory();
  bindHeaderActions();
});

// ─── DATE HELPERS ───────────────────────────
function setTodayDate() {
  const dp = document.getElementById('datePicker');
  dp.value = toIsoDate(new Date());
  dp.addEventListener('change', updateRecordDateBadge);
}
function updateRecordDateBadge() {
  const dp = document.getElementById('datePicker');
  document.getElementById('recordDate').textContent = dp.value ? formatDate(dp.value) : '—';
}
function formatDate(iso) {
  const [y,m,d] = iso.split('-');
  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  return `${d} ${months[parseInt(m,10)-1]} ${y}`;
}
function toIsoDate(d) { return d.toISOString().split('T')[0]; }
function daysBetween(isoA, isoB) {
  const a = new Date(isoA+'T00:00:00'), b = new Date(isoB+'T00:00:00');
  return Math.ceil((b - a) / (1000*60*60*24));
}

// ─── API ────────────────────────────────────
async function apiFetch(url, options = {}) {
  const res  = await fetch(API_BASE + url, { headers: {'Content-Type':'application/json'}, ...options });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// ─── PRODUCTS ───────────────────────────────
async function loadProducts() {
  try {
    products = await apiFetch('/products');
  } catch {
    products = defaultProducts();
  }
  renderInventoryTable();
  checkLowStock();
}
function defaultProducts() {
  return [
    {_id:'1',name:'MARLBORO RED',price:176,stock:0},{_id:'2',name:'MARLBORO LIGHT',price:176,stock:0},
    {_id:'3',name:'MARLBORO BLUE',price:176,stock:0},{_id:'4',name:'MARLBORO BLACK',price:176,stock:0},
    {_id:'5',name:'CRAFTED BLUE',price:164,stock:0},{_id:'6',name:'FORTUNE WHITE',price:164,stock:0},
    {_id:'7',name:'FORTUNE LIGHT',price:164,stock:0},{_id:'8',name:'CHESTER RED',price:145,stock:0},
    {_id:'9',name:'CHESTER WHITE',price:145,stock:0},{_id:'10',name:'CHESTER REMIX',price:145,stock:0},
  ];
}
function checkLowStock() {
  const low = products.filter(p=>p.stock>0&&p.stock<=5).map(p=>p.name);
  const out = products.filter(p=>p.stock===0).map(p=>p.name);
  const bar = document.getElementById('lowStockAlert');
  if (out.length||low.length) {
    bar.classList.remove('hidden');
    let msg='';
    if(out.length) msg+=`OUT OF STOCK: ${out.join(', ')}. `;
    if(low.length) msg+=`LOW STOCK (≤5): ${low.join(', ')}.`;
    document.getElementById('lowStockMsg').textContent=msg;
  } else bar.classList.add('hidden');
}

// ─── INVENTORY TABLE ────────────────────────
function renderInventoryTable() {
  const tbody = document.getElementById('tableBody');
  tbody.innerHTML = '';
  products.forEach(p=>{
    const sc = p.stock===0?'out':p.stock<=5?'low':'ok';
    const tr = document.createElement('tr');
    tr.innerHTML=`
      <td class="product-name">${escHtml(p.name)}</td>
      <td class="price-cell">&#8369;${p.price.toLocaleString()}</td>
      <td class="align-center">
        <span class="stock-badge ${sc}" id="stock_${p._id}"
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

async function promptRestock(id, name, cur) {
  const v = prompt(`RESTOCK: ${name}\nKasalukuyang stock: ${cur}\n\nBagong stock total:`);
  if (v===null) return;
  const n = parseInt(v,10);
  if (isNaN(n)||n<0) { notify('Invalid amount.','error'); return; }
  try {
    await apiFetch(`/products/${id}`,{method:'PATCH',body:JSON.stringify({stock:n})});
    notify(`${name} restocked to ${n} units!`,'success');
    await loadProducts();
  } catch(e){ notify('Restock failed: '+e.message,'error'); }
}

function onSoldInput(input, id) {
  const sold=parseInt(input.value,10)||0, price=+input.dataset.price, stock=+input.dataset.stock;
  input.classList.toggle('error', sold>stock);
  document.getElementById(`sub_${id}`).textContent='\u20B1'+(Math.max(0,sold)*price).toLocaleString();
  recalcTotals();
}
function recalcTotals() {
  let ts=0, tv=0;
  products.forEach(p=>{
    const s=parseInt(document.getElementById(`sold_${p._id}`)?.value,10)||0;
    ts+=Math.max(0,s)*p.price; tv+=p.stock*p.price;
  });
  document.getElementById('totalSales').textContent='\u20B1'+ts.toLocaleString();
  document.getElementById('totalStockValue').textContent='\u20B1'+tv.toLocaleString();
}

// ─── SAVE ───────────────────────────────────
async function saveInventory() {
  const date = document.getElementById('datePicker').value;
  if (!date) { notify('Pumili ng date.','error'); return; }
  const items=[]; let err=false;
  products.forEach(p=>{
    const input=document.getElementById(`sold_${p._id}`);
    const sold=parseInt(input.value,10)||0;
    if(sold>p.stock){err=true;input.classList.add('error');return;}
    if(sold>0) items.push({productId:p._id,sold});
  });
  if(err){notify('May sold qty na lampas sa stock.','error');return;}
  if(!items.length){notify('Maglagay ng kahit isang sold qty.','error');return;}

  const btn=document.getElementById('btnSave');
  btn.disabled=true;
  btn.innerHTML='<span class="spinner"></span> SAVING\u2026';
  try {
    await apiFetch('/submit',{method:'POST',body:JSON.stringify({date,items})});
    notify('Saved! ✅','success');
    await loadProducts();
    await loadHistory(); // this will auto-refresh the fund
  } catch(e){
    notify('Save failed: '+e.message,'error');
  } finally {
    btn.disabled=false;
    btn.innerHTML=`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> SAVE`;
  }
}
function resetForm() {
  products.forEach(p=>{
    const i=document.getElementById(`sold_${p._id}`); if(i){i.value=0;i.classList.remove('error');}
    const s=document.getElementById(`sub_${p._id}`); if(s) s.textContent='\u20B10';
  });
  recalcTotals(); notify('Form reset.','info');
}

// ══════════════════════════════════════════════
//  💰 PERIOD FUND TRACKER
//
//  Logic:
//  - User sets a START date and END date (ahente babalik)
//  - Fund = sum of all sales (from history) within that date range
//  - Deductions = stock purchases manually entered by user (stored in localStorage)
//  - Net balance = Fund sales - Deductions
// ══════════════════════════════════════════════

function getPeriod() {
  const start = localStorage.getItem('period_start');
  const end   = localStorage.getItem('period_end');
  return (start && end) ? {start, end} : null;
}

function loadPeriodFromStorage() {
  const p = getPeriod();
  if (!p) return;
  document.getElementById('periodStart').value = p.start;
  document.getElementById('periodEnd').value   = p.end;
  showPeriodStatus(p);
}

function setPeriod() {
  const start = document.getElementById('periodStart').value;
  const end   = document.getElementById('periodEnd').value;
  if (!start||!end) { notify('Pumili ng simula at katapusan ng period.','error'); return; }
  if (start>end) { notify('Dapat ang Start ay mas maaga kaysa End.','error'); return; }
  localStorage.setItem('period_start', start);
  localStorage.setItem('period_end', end);
  showPeriodStatus({start, end});
  updateFundUI();
  notify('Period naka-set na! ✅','success');
}

function clearPeriod() {
  localStorage.removeItem('period_start');
  localStorage.removeItem('period_end');
  document.getElementById('periodStart').value='';
  document.getElementById('periodEnd').value='';
  document.getElementById('periodStatusBar').style.display='none';
  updateFundUI();
}

function showPeriodStatus({start, end}) {
  const bar     = document.getElementById('periodStatusBar');
  const label   = document.getElementById('periodLabel');
  const daysEl  = document.getElementById('periodDaysLeft');
  const today   = toIsoDate(new Date());
  const daysLeft= daysBetween(today, end);
  const totalDays = daysBetween(start, end);
  bar.style.display='flex';
  label.textContent = `${formatDate(start)} → ${formatDate(end)} (${totalDays} araw na period)`;
  if(daysLeft<0)       daysEl.textContent='OVERDUE — Dapat nakabalik na si ahente!';
  else if(daysLeft===0) daysEl.textContent='TODAY — Bumabalik si ahente ngayon!';
  else                  daysEl.textContent=`${daysLeft} araw pa bago bumalik si ahente`;
  daysEl.style.color = daysLeft<=1?'var(--danger)':daysLeft<=3?'var(--warning)':'var(--info)';
}

// Get purchases (deductions) from localStorage
function getPurchases() {
  try { return JSON.parse(localStorage.getItem('fund_purchases')||'[]'); } catch { return []; }
}
function savePurchases(arr) { localStorage.setItem('fund_purchases', JSON.stringify(arr)); }

// Total sales within the set period (from MongoDB history)
function getPeriodSales() {
  const p = getPeriod(); if(!p) return 0;
  return history
    .filter(r => r.date >= p.start && r.date <= p.end)
    .reduce((a,r) => a+(r.totalSoldPrice||0), 0);
}

// Total spent buying stock within the set period
function getPeriodSpent() {
  const p = getPeriod(); if(!p) return 0;
  const today = toIsoDate(new Date());
  return getPurchases()
    .filter(tx => tx.date >= p.start && tx.date <= (p.end < today ? p.end : today))
    .reduce((a,tx) => a+tx.amount, 0);
}

function buyStock() {
  const amount = parseFloat(document.getElementById('buyAmount').value);
  const note   = document.getElementById('buyNote').value.trim() || 'Stock purchase';
  if (isNaN(amount)||amount<=0) { notify('Maglagay ng tamang halaga.','error'); return; }
  const p = getPeriod();
  if (!p) { notify('Mag-set muna ng period!','error'); return; }

  const balance = getPeriodSales() - getPeriodSpent();
  if (amount>balance) {
    if (!confirm(`Ang pondo mo ay ₱${balance.toLocaleString()} lang.\n₱${amount.toLocaleString()} ang gusto mong ibawas.\n\nItuloy pa rin?`)) return;
  }

  const purchases = getPurchases();
  purchases.unshift({
    id:     Date.now().toString(),
    amount,
    note,
    date:   toIsoDate(new Date()),
    time:   new Date().toLocaleTimeString('en-PH',{hour:'2-digit',minute:'2-digit'}),
  });
  savePurchases(purchases);
  document.getElementById('buyAmount').value='';
  document.getElementById('buyNote').value='';
  updateFundUI();
  notify(`₱${amount.toLocaleString()} na-deduct sa pondo.`,'info');
}

function deletePurchase(id) {
  if (!confirm('I-remove ang purchase na ito?')) return;
  savePurchases(getPurchases().filter(t=>t.id!==id));
  updateFundUI();
  notify('Purchase removed.','info');
}

function confirmResetFund() {
  if (!confirm('I-reset ang lahat ng purchases? Hindi mabubura ang sales history.')) return;
  localStorage.removeItem('fund_purchases');
  updateFundUI();
  notify('Fund purchases na-reset.','info');
}

function updateFundUI() {
  const p        = getPeriod();
  const sales    = getPeriodSales();
  const spent    = getPeriodSpent();
  const balance  = sales - spent;
  const today    = toIsoDate(new Date());

  // Benta sa period
  document.getElementById('fundPeriodSales').textContent = '\u20B1'+sales.toLocaleString();
  if (p) {
    const recs = history.filter(r=>r.date>=p.start&&r.date<=p.end);
    document.getElementById('fundPeriodSalesSub').textContent =
      `${recs.length} araw na recorded mula ${formatDate(p.start)}`;
  } else {
    document.getElementById('fundPeriodSalesSub').textContent = 'Mag-set ng period';
  }

  // Spent
  document.getElementById('fundSpent').textContent = '\u20B1'+spent.toLocaleString();
  const txCount = getPurchases().filter(t=>p?t.date>=p.start:true).length;
  document.getElementById('fundSpentSub').textContent =
    txCount ? `${txCount} purchase${txCount>1?'s':''} sa period` : 'Walang binili pa';

  // Balance
  const balEl  = document.getElementById('fundBalance');
  const boxEl  = document.getElementById('fundBalanceBox');
  const iconEl = document.getElementById('fundBalanceIcon');
  const subEl  = document.getElementById('fundBalanceSub');
  balEl.textContent = '\u20B1'+Math.abs(balance).toLocaleString()+(balance<0?' (KULANG)':'');
  boxEl.className = 'fund-flow-box';
  if (!p) {
    iconEl.textContent='💰'; subEl.textContent='Mag-set ng period'; balEl.style.color='var(--text-primary)';
  } else if (balance>=0) {
    boxEl.classList.add('ok'); iconEl.textContent='💚'; subEl.textContent='Kaya mo pang bumili ng stock!'; balEl.style.color='var(--accent)';
  } else {
    boxEl.classList.add('bad'); iconEl.textContent='🔴'; subEl.textContent='Kulang na ang pondo!'; balEl.style.color='var(--danger)';
  }

  // Progress bar (sales = 100%, spent reduces it)
  const prgWrap = document.getElementById('fundProgressWrap');
  if (p && sales>0) {
    prgWrap.style.display='flex';
    const pct     = Math.min(100, Math.round((spent/sales)*100));
    const remPct  = 100-pct;
    const fill    = document.getElementById('fundProgressFill');
    const pctEl   = document.getElementById('fundProgressPct');
    // Bar shows REMAINING (not spent)
    fill.style.width = remPct+'%';
    pctEl.textContent = remPct+'% natitira';
    fill.className = 'fund-progress-fill';
    if(remPct<30)      fill.classList.add('bad');
    else if(remPct<60) fill.classList.add('warn');

    document.getElementById('fundProgressLeft').textContent =
      balance>=0 ? `Natitira: ₱${balance.toLocaleString()} sa pondo mo`
                 : `Kulang ng ₱${Math.abs(balance).toLocaleString()}!`;
    document.getElementById('fundProgressLeft').style.color =
      balance>=0 ? 'var(--success)' : 'var(--danger)';

    // Projection: how much more will you earn before period ends
    const daysLeft = daysBetween(today, p.end);
    if (daysLeft>0) {
      const recs = history.filter(r=>r.date>=p.start&&r.date<=today);
      const elapsed = daysBetween(p.start, today)||1;
      const dailyAvg = recs.length ? sales/elapsed : 0;
      const projected = balance + (dailyAvg*daysLeft);
      document.getElementById('fundProjectedInfo').textContent =
        `+₱${Math.round(dailyAvg).toLocaleString()}/araw × ${daysLeft} days → Projected: ₱${Math.round(projected).toLocaleString()}`;
    } else {
      document.getElementById('fundProjectedInfo').textContent = '';
    }
  } else if (p && sales===0) {
    prgWrap.style.display='flex';
    document.getElementById('fundProgressFill').style.width='0%';
    document.getElementById('fundProgressPct').textContent='0%';
    document.getElementById('fundProgressLeft').textContent='Wala pang sales sa period na ito.';
    document.getElementById('fundProgressLeft').style.color='var(--text-dim)';
    document.getElementById('fundProjectedInfo').textContent='';
  } else {
    prgWrap.style.display='none';
  }

  // Render purchase list
  renderPurchaseList(p);
}

function renderPurchaseList(p) {
  const list  = document.getElementById('fundTxList');
  const count = document.getElementById('fundTxCount');
  const purchases = p
    ? getPurchases().filter(t=>t.date>=p.start)
    : getPurchases();

  count.textContent = `${purchases.length} purchase${purchases.length!==1?'s':''}`;

  if (!purchases.length) {
    list.innerHTML='<div class="fund-empty">Wala pang biniling stock sa period na ito.</div>';
    return;
  }
  list.innerHTML = purchases.map(tx=>`
    <div class="fund-tx-item">
      <div class="fund-tx-dot"></div>
      <div class="fund-tx-date">${tx.date} ${tx.time||''}</div>
      <div class="fund-tx-note">${escHtml(tx.note)}</div>
      <div class="fund-tx-amount">−₱${tx.amount.toLocaleString()}</div>
      <button class="fund-tx-del" onclick="deletePurchase('${tx.id}')" title="Remove">✕</button>
    </div>`).join('');
}

// ─── HISTORY ────────────────────────────────
async function loadHistory() {
  try {
    history = await apiFetch('/history');
  } catch { history=[]; }
  filterHistory(currentFilter, null);
  updateDashboardStats();
  updateFundUI();
}

function getWeekRange(offset=0){
  const now=new Date();now.setHours(0,0,0,0);
  const s=new Date(now);s.setDate(now.getDate()-now.getDay()+offset*7);
  const e=new Date(s);e.setDate(s.getDate()+6);
  return{from:toIsoDate(s),to:toIsoDate(e)};
}
function getMonthRange(offset=0){
  const now=new Date();const y=now.getFullYear();const m=now.getMonth()+offset;
  return{from:toIsoDate(new Date(y,m,1)),to:toIsoDate(new Date(y,m+1,0))};
}

function filterHistory(type, btnEl) {
  currentFilter=type;
  if(btnEl){document.querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('active'));btnEl.classList.add('active');}
  let filtered=[...history];
  const today=toIsoDate(new Date());
  if(type==='today') filtered=history.filter(r=>r.date===today);
  else if(type==='week'){const{from,to}=getWeekRange(0);filtered=history.filter(r=>r.date>=from&&r.date<=to);}
  else if(type==='lastweek'){const{from,to}=getWeekRange(-1);filtered=history.filter(r=>r.date>=from&&r.date<=to);}
  else if(type==='month'){const{from,to}=getMonthRange(0);filtered=history.filter(r=>r.date>=from&&r.date<=to);}
  else if(type==='lastmonth'){const{from,to}=getMonthRange(-1);filtered=history.filter(r=>r.date>=from&&r.date<=to);}
  else if(type==='custom'){
    const from=document.getElementById('filterFrom').value;
    const to=document.getElementById('filterTo').value;
    if(!from||!to){notify('Pumili ng From at To dates.','error');return;}
    filtered=history.filter(r=>r.date>=from&&r.date<=to);
    document.querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('active'));
  }
  renderHistoryRows(filtered);
  updateHistorySummary(filtered);
}

function renderHistoryRows(rows) {
  const tbody=document.getElementById('historyBody');
  if(!rows.length){tbody.innerHTML='<tr><td colspan="4" class="empty-row">Walang records para sa period na ito.</td></tr>';return;}
  tbody.innerHTML='';
  rows.forEach(rec=>{
    const tr=document.createElement('tr');
    tr.innerHTML=`
      <td class="history-date">${formatDate(rec.date)}</td>
      <td class="history-amount" style="color:var(--accent)">${rec.totalSoldPrice?'\u20B1'+rec.totalSoldPrice.toLocaleString():'—'}</td>
      <td class="history-amount" style="color:var(--text-muted)">${rec.totalStockPrice?'\u20B1'+rec.totalStockPrice.toLocaleString():'—'}</td>
      <td><div class="actions-cell">
        <button class="btn btn-ghost btn-sm" onclick="viewRecord('${rec._id}')">VIEW</button>
        <button class="btn btn-danger btn-sm" onclick="deleteRecord('${rec._id}',this)">DEL</button>
      </div></td>`;
    tbody.appendChild(tr);
  });
}
function updateHistorySummary(rows){
  const s=document.getElementById('historySummary');
  if(!rows.length){s.style.display='none';return;}
  s.style.display='flex';
  const total=rows.reduce((a,r)=>a+(r.totalSoldPrice||0),0);
  document.getElementById('summaryCount').textContent=rows.length;
  document.getElementById('summaryTotal').textContent='\u20B1'+total.toLocaleString();
  document.getElementById('summaryAvg').textContent='\u20B1'+Math.round(total/rows.length).toLocaleString();
}

function updateDashboardStats(){
  const{from:wFrom,to:wTo}=getWeekRange(0);
  const wr=history.filter(r=>r.date>=wFrom&&r.date<=wTo);
  const wt=wr.reduce((a,r)=>a+(r.totalSoldPrice||0),0);
  document.getElementById('statWeekSales').textContent='\u20B1'+wt.toLocaleString();
  document.getElementById('statWeekDays').textContent=`${wr.length} araw na recorded`;

  const{from:mFrom,to:mTo}=getMonthRange(0);
  const mr=history.filter(r=>r.date>=mFrom&&r.date<=mTo);
  const mt=mr.reduce((a,r)=>a+(r.totalSoldPrice||0),0);
  document.getElementById('statMonthSales').textContent='\u20B1'+mt.toLocaleString();
  document.getElementById('statMonthDays').textContent=`${mr.length} araw na recorded`;

  const at=history.reduce((a,r)=>a+(r.totalSoldPrice||0),0);
  document.getElementById('statDailyAvg').textContent='\u20B1'+(history.length?Math.round(at/history.length):0).toLocaleString();
  document.getElementById('statTotalDays').textContent=`${history.length} total na araw`;

  const sm={};
  wr.forEach(rec=>{(rec.items||[]).forEach(item=>{const n=item.productName||'?';sm[n]=(sm[n]||0)+item.sold;});});
  const e=Object.entries(sm).sort((a,b)=>b[1]-a[1]);
  if(e.length){
    document.getElementById('statBestSeller').textContent=e[0][0];
    document.getElementById('statBestSellerQty').textContent=`${e[0][1]} pcs ngayong linggo`;
  } else {
    document.getElementById('statBestSeller').textContent='—';
    document.getElementById('statBestSellerQty').textContent='wala pang data ngayong linggo';
  }
}

async function deleteRecord(id,btn){
  if(!confirm('I-delete ang record na ito?'))return;
  btn.disabled=true;
  try{
    await apiFetch(`/history?id=${id}`,{method:'DELETE'});
    history=history.filter(r=>r._id!==id);
    filterHistory(currentFilter,null);updateDashboardStats();updateFundUI();
    notify('Record deleted.','info');
  }catch(e){notify('Delete failed: '+e.message,'error');btn.disabled=false;}
}

function viewRecord(id){
  const rec=history.find(r=>r._id===id);if(!rec)return;
  document.getElementById('modalTitle').textContent='RECORD — '+formatDate(rec.date);
  const tbody=document.getElementById('modalBody');
  if(!rec.items||!rec.items.length){tbody.innerHTML='<tr><td colspan="4" class="empty-row">No item data.</td></tr>';}
  else{tbody.innerHTML=rec.items.map(item=>`
    <tr>
      <td class="product-name">${escHtml(item.productName||item.productId)}</td>
      <td class="align-center price-cell">&#8369;${(item.price||0).toLocaleString()}</td>
      <td class="align-center"><span class="stock-badge ok">${item.sold}</span></td>
      <td class="subtotal-cell">&#8369;${(item.subtotal||0).toLocaleString()}</td>
    </tr>`).join('');}
  document.getElementById('modal').classList.remove('hidden');
}
function closeModal(){document.getElementById('modal').classList.add('hidden');}
document.getElementById('modal').addEventListener('click',e=>{if(e.target===e.currentTarget)closeModal();});

// ─── CSV ────────────────────────────────────
function exportCSV(){
  if(!history.length){notify('Wala pang history.','error');return;}
  const rows=[['Date','Product','Price','Sold','Subtotal','Total Sold','Total Stock']];
  history.forEach(rec=>{
    if(rec.items&&rec.items.length) rec.items.forEach((item,i)=>rows.push([formatDate(rec.date),item.productName||'',item.price||'',item.sold,item.subtotal||'',i===0?rec.totalSoldPrice||'':'',i===0?rec.totalStockPrice||'':'']));
    else rows.push([formatDate(rec.date),'','','','',rec.totalSoldPrice||'',rec.totalStockPrice||'']);
  });
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([rows.map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n')],{type:'text/csv'}));
  a.download=`cig-inv-${toIsoDate(new Date())}.csv`;a.click();
  notify('CSV exported!','success');
}

// ─── BIND ───────────────────────────────────
function bindHeaderActions(){
  document.getElementById('btnSave').addEventListener('click',saveInventory);
  document.getElementById('btnReset').addEventListener('click',resetForm);
  document.getElementById('btnDownload').addEventListener('click',exportCSV);
}

// ─── UTILS ──────────────────────────────────
let ntimer=null;
function notify(msg,type='info'){
  const el=document.getElementById('notification');
  el.textContent=msg;el.className=`notification ${type}`;
  if(ntimer)clearTimeout(ntimer);
  ntimer=setTimeout(()=>el.classList.add('hidden'),4500);
}
function escHtml(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}