/* ============================================================
   TransportSolver — Frontend Logic
   ============================================================ */

const state = {
  origins: [],
  destinations: [],
  supply: {},
  demand: {},
  costs: {},
  method: 'solver',
  currentStep: 1,
  lastResults: null
};

// ── SWEETALERT HELPERS ────────────────────────────────────────
function swalError(msg) {
  return Swal.fire({ icon: 'error', title: 'Error', text: msg, background: '#1c1d22', color: '#e8e9ed', confirmButtonColor: '#d4f542', confirmButtonText: 'OK' });
}
function swalSuccess(title, msg) {
  return Swal.fire({ icon: 'success', title, text: msg, background: '#1c1d22', color: '#e8e9ed', confirmButtonColor: '#d4f542', confirmButtonText: 'OK' });
}
function swalInfo(title, html) {
  return Swal.fire({ icon: 'info', title, html, background: '#1c1d22', color: '#e8e9ed', confirmButtonColor: '#d4f542' });
}

// ── STEP NAVIGATION ──────────────────────────────────────────

function goStep(n) {
  if (n > state.currentStep) {
    if (!validateStep(state.currentStep)) return;
    if (n === 2) buildCostMatrix();
    if (n === 3) collectCosts();
  }
  showStep(n);
}

function jumpTo(n) {
  if (n > state.currentStep) return;
  if (n === 2) buildCostMatrix();
  if (n === 3) collectCosts();
  showStep(n);
}

function showStep(n) {
  document.querySelectorAll('.step-section').forEach(s => s.classList.remove('active'));
  document.getElementById('step-' + n).classList.add('active');
  document.querySelectorAll('.step-btn').forEach(btn => {
    const s = parseInt(btn.dataset.step);
    btn.classList.remove('active', 'done');
    if (s === n) btn.classList.add('active');
    else if (s < n) btn.classList.add('done');
  });
  state.currentStep = n;
}

function validateStep(step) {
  if (step === 1) {
    if (state.origins.length < 1) { swalError('Agrega al menos un origen.'); return false; }
    if (state.destinations.length < 1) { swalError('Agrega al menos un destino.'); return false; }
    const ts = state.origins.reduce((s, o) => s + (state.supply[o] || 0), 0);
    const td = state.destinations.reduce((s, d) => s + (state.demand[d] || 0), 0);
    if (ts === 0 || td === 0) { swalError('Ingresa valores de oferta y demanda mayores a cero.'); return false; }
  }
  return true;
}

// ── NEW PROBLEM ───────────────────────────────────────────────

function newProblem() {
  state.origins = [];
  state.destinations = [];
  state.supply = {};
  state.demand = {};
  state.costs = {};
  state.method = 'solver';
  state.currentStep = 1;
  state.lastResults = null;

  document.getElementById('results-area').classList.add('hidden');
  document.querySelectorAll('.method-card').forEach(c => c.classList.remove('selected'));
  document.querySelector('[data-method="solver"]').classList.add('selected');

  renderTags('origin');
  renderTags('dest');
  updateBalance();

  document.getElementById('import-panel').classList.add('hidden');
  showStep(1);
}

// ── NODES ────────────────────────────────────────────────────

function addNode(type) {
  const inputId = type === 'origin' ? 'origin-input' : 'dest-input';
  const flowInputId = type === 'origin' ? 'origin-supply-input' : 'dest-demand-input';
  const arr = type === 'origin' ? state.origins : state.destinations;
  const val = document.getElementById(inputId).value.trim();
  const flowVal = parseFloat(document.getElementById(flowInputId).value) || 0;
  if (!val) return;
  if (arr.includes(val)) { document.getElementById(inputId).value = ''; return; }
  arr.push(val);
  if (type === 'origin') state.supply[val] = flowVal;
  else state.demand[val] = flowVal;
  document.getElementById(inputId).value = '';
  document.getElementById(flowInputId).value = '';
  renderTags(type);
  updateBalance();
}

function removeNode(type, name) {
  const arr = type === 'origin' ? state.origins : state.destinations;
  const idx = arr.indexOf(name);
  if (idx > -1) arr.splice(idx, 1);
  if (type === 'origin') delete state.supply[name];
  else delete state.demand[name];
  renderTags(type);
  updateBalance();
}

function renderTags(type) {
  const arr = type === 'origin' ? state.origins : state.destinations;
  const listId = type === 'origin' ? 'origins-tags' : 'destinations-tags';
  const countId = type === 'origin' ? 'origins-count' : 'destinations-count';
  const cls = type === 'origin' ? 'origin-tag' : 'dest-tag';
  const flowKey = type === 'origin' ? state.supply : state.demand;
  const flowLabel = type === 'origin' ? 'Oferta' : 'Demanda';

  document.getElementById(listId).innerHTML = arr.map(n => {
    const flowVal = flowKey[n] || 0;
    return `<div class="tag ${cls}">
      <span class="tag-name">${n}</span>
      <span class="tag-flow-label">${flowLabel}:</span>
      <input type="number" min="0" step="any" class="tag-flow-input" value="${flowVal}"
        onchange="updateNodeFlow('${type}','${n.replace(/'/g, "\\'")}', this.value)"
        onclick="event.stopPropagation()" />
      <button class="tag-remove" onclick="removeNode('${type}','${n.replace(/'/g, "\\'")}')">×</button>
    </div>`;
  }).join('');
  document.getElementById(countId).textContent = arr.length;
}

function updateNodeFlow(type, name, value) {
  const v = parseFloat(value) || 0;
  if (type === 'origin') state.supply[name] = v;
  else state.demand[name] = v;
  updateBalance();
}

// ── BALANCE INDICATOR ─────────────────────────────────────────

function updateBalance() {
  const ts = state.origins.reduce((s, o) => s + (state.supply[o] || 0), 0);
  const td = state.destinations.reduce((s, d) => s + (state.demand[d] || 0), 0);
  const el = document.getElementById('balance-indicator');
  if (!el) return;
  if (ts === 0 && td === 0) { el.classList.add('hidden'); return; }
  el.classList.remove('hidden');
  if (ts === td) {
    el.className = 'balance-indicator balanced';
    el.textContent = `✓ Modelo balanceado — Oferta = Demanda = ${ts}`;
  } else if (ts > td) {
    el.className = 'balance-indicator unbalanced';
    el.textContent = `⚠ Oferta (${ts}) > Demanda (${td}) — Se agregará destino ficticio con demanda ${ts - td}`;
  } else {
    el.className = 'balance-indicator unbalanced';
    el.textContent = `⚠ Demanda (${td}) > Oferta (${ts}) — Se agregará origen ficticio con oferta ${td - ts}`;
  }
}

// ── COST MATRIX ───────────────────────────────────────────────

function buildCostMatrix() {
  const ts = state.origins.reduce((s, o) => s + (state.supply[o] || 0), 0);
  const td = state.destinations.reduce((s, d) => s + (state.demand[d] || 0), 0);
  const allOs = ts < td ? [...state.origins, 'Ficticio_Origen'] : [...state.origins];
  const allDs = td < ts ? [...state.destinations, 'Ficticio_Destino'] : [...state.destinations];

  let html = `<table class="cost-table">
    <thead><tr>
      <th class="origin-th">Origen \\ Destino</th>
      ${allDs.map(d => `<th class="dest-th">${d}</th>`).join('')}
    </tr></thead><tbody>`;

  allOs.forEach(o => {
    html += `<tr><td class="origin-cell">${o}</td>`;
    allDs.forEach(d => {
      const isFict = o.includes('Ficticio') || d.includes('Ficticio');
      const saved = state.costs[o] && state.costs[o][d] !== undefined ? state.costs[o][d] : '';
      html += isFict
        ? `<td class="fictitious-cell">— 0</td>`
        : `<td><input type="number" min="0" step="any" class="cost-input"
            id="cost-${CSS.escape(o)}-${CSS.escape(d)}"
            value="${saved}" placeholder="0" /></td>`;
    });
    html += '</tr>';
  });
  html += '</tbody></table>';
  document.getElementById('cost-matrix-wrap').innerHTML = html;
}

function collectCosts() {
  const ts = state.origins.reduce((s, o) => s + (state.supply[o] || 0), 0);
  const td = state.destinations.reduce((s, d) => s + (state.demand[d] || 0), 0);
  const allOs = ts < td ? [...state.origins, 'Ficticio_Origen'] : [...state.origins];
  const allDs = td < ts ? [...state.destinations, 'Ficticio_Destino'] : [...state.destinations];

  allOs.forEach(o => {
    state.costs[o] = {};
    allDs.forEach(d => {
      if (o.includes('Ficticio') || d.includes('Ficticio')) {
        state.costs[o][d] = 0;
      } else {
        const el = document.getElementById('cost-' + CSS.escape(o) + '-' + CSS.escape(d));
        state.costs[o][d] = el ? (parseFloat(el.value) || 0) : 0;
      }
    });
  });
}

// ── IMPORT EXCEL TABLE ────────────────────────────────────────

let importRows = 4;
let importCols = 4;

function toggleImport() {
  const panel = document.getElementById('import-panel');
  const isHidden = panel.classList.contains('hidden');
  if (isHidden) {
    panel.classList.remove('hidden');
    if (!document.getElementById('excel-grid').innerHTML) {
      initImportGrid();
    }
  } else {
    panel.classList.add('hidden');
  }
}

function initImportGrid(rows, cols) {
  importRows = rows || 4;
  importCols = cols || 4;
  renderImportGrid();
}

function renderImportGrid() {
  const grid = document.getElementById('excel-grid');

  // Column header row with delete buttons
  let html = `<table class="excel-table">`;

  // Col-delete header row
  html += `<tr class="col-ctrl-row"><td class="ctrl-corner"></td>`;
  for (let c = 0; c < importCols; c++) {
    html += `<td class="col-ctrl"><button class="btn-del-col" onclick="deleteImportCol(${c})" title="Eliminar columna">×</button></td>`;
  }
  html += `</tr>`;

  // Data rows
  for (let r = 0; r < importRows; r++) {
    html += `<tr>`;
    // Row delete button
    html += `<td class="row-ctrl"><button class="btn-del-row" onclick="deleteImportRow(${r})" title="Eliminar fila">×</button></td>`;
    for (let c = 0; c < importCols; c++) {
      const existingVal = getImportCellVal(r, c);
      html += `<td><input type="text" class="excel-cell"
        data-r="${r}" data-c="${c}"
        value="${existingVal}"
        onpaste="handlePaste(event, ${r}, ${c})"
        onkeydown="cellKeyNav(event, ${r}, ${c})" /></td>`;
    }
    html += `</tr>`;
  }

  html += `</table>`;
  grid.innerHTML = html;
}

function getImportCellVal(r, c) {
  const el = document.querySelector(`.excel-cell[data-r="${r}"][data-c="${c}"]`);
  return el ? el.value.replace(/"/g, '&quot;') : '';
}

function saveImportData() {
  const cells = document.querySelectorAll('.excel-cell');
  const data = {};
  cells.forEach(c => { data[`${c.dataset.r},${c.dataset.c}`] = c.value; });
  return data;
}

function restoreImportData(data) {
  Object.entries(data).forEach(([key, val]) => {
    const [r, c] = key.split(',');
    const el = document.querySelector(`.excel-cell[data-r="${r}"][data-c="${c}"]`);
    if (el) el.value = val;
  });
}

function addImportRow() {
  const savedData = saveImportData();
  importRows++;
  renderImportGrid();
  restoreImportData(savedData);
}

function addImportCol() {
  const savedData = saveImportData();
  importCols++;
  renderImportGrid();
  restoreImportData(savedData);
}

function deleteImportRow(rowIdx) {
  if (importRows <= 2) { swalError('La tabla debe tener al menos 2 filas.'); return; }
  // Collect data, skip that row, shift
  const data = {};
  let nr = 0;
  for (let r = 0; r < importRows; r++) {
    if (r === rowIdx) continue;
    for (let c = 0; c < importCols; c++) {
      const el = document.querySelector(`.excel-cell[data-r="${r}"][data-c="${c}"]`);
      data[`${nr},${c}`] = el ? el.value : '';
    }
    nr++;
  }
  importRows--;
  renderImportGrid();
  restoreImportData(data);
}

function deleteImportCol(colIdx) {
  if (importCols <= 2) { swalError('La tabla debe tener al menos 2 columnas.'); return; }
  const data = {};
  for (let r = 0; r < importRows; r++) {
    let nc = 0;
    for (let c = 0; c < importCols; c++) {
      if (c === colIdx) continue;
      const el = document.querySelector(`.excel-cell[data-r="${r}"][data-c="${c}"]`);
      data[`${r},${nc}`] = el ? el.value : '';
      nc++;
    }
  }
  importCols--;
  renderImportGrid();
  restoreImportData(data);
}

function resetImportGrid() {
  importRows = 4;
  importCols = 4;
  document.getElementById('excel-grid').innerHTML = '';
  renderImportGrid();
}

function handlePaste(e, startR, startC) {
  e.preventDefault();
  const text = (e.clipboardData || window.clipboardData).getData('text');
  const rows = text.trim().split(/\r?\n/);
  const maxR = rows.length;
  const maxC = Math.max(...rows.map(r => r.split('\t').length));

  const savedData = saveImportData();
  if (startR + maxR > importRows) importRows = startR + maxR;
  if (startC + maxC > importCols) importCols = startC + maxC;
  renderImportGrid();
  restoreImportData(savedData);

  rows.forEach((row, ri) => {
    const cols = row.split('\t');
    cols.forEach((val, ci) => {
      const el = document.querySelector(`.excel-cell[data-r="${startR + ri}"][data-c="${startC + ci}"]`);
      if (el) el.value = val.trim();
    });
  });
}

function cellKeyNav(e, r, c) {
  let nr = r, nc = c;
  if (e.key === 'Tab') { e.preventDefault(); nc = c + 1; if (nc >= importCols) { nc = 0; nr = r + 1; } }
  else if (e.key === 'ArrowDown') { nr = r + 1; }
  else if (e.key === 'ArrowUp') { nr = r - 1; }
  else return;
  const next = document.querySelector(`.excel-cell[data-r="${nr}"][data-c="${nc}"]`);
  if (next) { e.preventDefault(); next.focus(); }
}

function applyImport() {
  const cells = [];
  for (let r = 0; r < importRows; r++) {
    const row = [];
    for (let c = 0; c < importCols; c++) {
      const el = document.querySelector(`.excel-cell[data-r="${r}"][data-c="${c}"]`);
      row.push(el ? el.value.trim() : '');
    }
    cells.push(row);
  }

  const header = cells[0];
  const destNames = header.slice(1, -1).filter(h => h !== '');
  if (destNames.length === 0) { swalError('La tabla no tiene destinos en la primera fila.'); return; }

  const origins = [];
  const supply = {};
  const demand = {};
  const costs = {};

  const dataRows = cells.slice(1);
  const demandRow = dataRows[dataRows.length - 1];
  const originRows = dataRows.slice(0, -1);

  originRows.forEach(row => {
    const oName = row[0];
    if (!oName) return;
    origins.push(oName);
    costs[oName] = {};
    destNames.forEach((d, i) => { costs[oName][d] = parseFloat(row[i + 1]) || 0; });
    supply[oName] = parseFloat(row[row.length - 1]) || 0;
  });

  destNames.forEach((d, i) => { demand[d] = parseFloat(demandRow[i + 1]) || 0; });

  if (origins.length === 0) { swalError('No se encontraron orígenes en la tabla.'); return; }

  state.origins = origins;
  state.destinations = destNames;
  state.supply = supply;
  state.demand = demand;
  state.costs = costs;

  renderTags('origin');
  renderTags('dest');
  updateBalance();
  document.getElementById('import-panel').classList.add('hidden');

  buildCostMatrix();
  setTimeout(() => {
    origins.forEach(o => {
      destNames.forEach(d => {
        const el = document.getElementById('cost-' + CSS.escape(o) + '-' + CSS.escape(d));
        if (el) el.value = costs[o][d];
      });
    });
  }, 50);

  showStep(2);
  state.currentStep = 2;
  swalSuccess('Tabla importada', `${origins.length} orígenes y ${destNames.length} destinos cargados correctamente.`);
}

// ── METHOD SELECTION ─────────────────────────────────────────

function selectMethod(el) {
  document.querySelectorAll('.method-card').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  state.method = el.dataset.method;
  document.getElementById('results-area').classList.add('hidden');
}

// ── SOLVE ────────────────────────────────────────────────────

async function solve() {
  const btn = document.getElementById('solve-btn');
  const label = document.getElementById('solve-label');
  btn.disabled = true;
  btn.classList.add('loading');
  label.textContent = 'Resolviendo...';
  document.getElementById('results-area').classList.add('hidden');

  collectCosts();

  const payload = {
    method: state.method,
    origins: state.origins,
    destinations: state.destinations,
    supply: state.supply,
    demand: state.demand,
    costs: state.costs
  };

  try {
    const resp = await fetch('/solve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await resp.json();
    if (data.error) throw new Error(data.error);
    state.lastResults = data;
    renderResults(data);
  } catch (e) {
    renderError(e.message);
  } finally {
    btn.disabled = false;
    btn.classList.remove('loading');
    label.textContent = 'Resolver modelo';
  }
}

// ── RENDER RESULTS ────────────────────────────────────────────

const METHOD_NAMES = {
  solver: 'Solver PuLP — Óptimo',
  northwest: 'Esquina Noroeste',
  mincost: 'Costo Mínimo',
  vogel: 'Aproximación Vogel'
};

function renderResults(data) {
  document.getElementById('result-method-name').textContent = METHOD_NAMES[state.method] || 'Resultado';
  document.getElementById('result-cost-badge').textContent = formatNum(data.total);
  document.getElementById('result-explanation').textContent = data.explanation || '';

  const balanceEl = document.getElementById('balance-result-info');
  if (data.balance_info) {
    balanceEl.textContent = '⚠ ' + data.balance_info;
    balanceEl.classList.add('visible');
  } else {
    balanceEl.classList.remove('visible');
  }

  const tbody = document.getElementById('routes-tbody');
  tbody.innerHTML = data.routes.map(r =>
    `<tr>
      <td>${r.from}</td><td>${r.to}</td>
      <td>${formatNum(r.qty)}</td>
      <td>${formatNum(r.unit_cost)}</td>
      <td>${formatNum(r.subtotal)}</td>
    </tr>`
  ).join('');
  document.getElementById('routes-total').textContent = formatNum(data.total);

  const origins = data.origins;
  const destinations = data.destinations;
  const alloc = data.allocation;
  let matrix = `<table class="result-table">
    <thead><tr><th></th>${destinations.map(d => `<th>${d}</th>`).join('')}</tr></thead>
    <tbody>`;
  origins.forEach(o => {
    matrix += `<tr><td style="color:var(--origin-color);font-weight:500;">${o}</td>`;
    destinations.forEach(d => {
      const v = alloc[o] ? (alloc[o][d] || 0) : 0;
      matrix += `<td class="${v > 0 ? 'nonzero' : 'zero'}">${formatNum(v)}</td>`;
    });
    matrix += '</tr>';
  });
  matrix += '</tbody></table>';
  document.getElementById('matrix-wrap').innerHTML = matrix;

  document.getElementById('results-area').classList.remove('hidden');
  document.getElementById('results-area').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderError(msg) {
  document.getElementById('result-method-name').textContent = 'Error';
  document.getElementById('result-cost-badge').textContent = '—';
  document.getElementById('result-explanation').textContent = msg;
  document.getElementById('balance-result-info').classList.remove('visible');
  document.getElementById('routes-tbody').innerHTML = '';
  document.getElementById('routes-total').textContent = '—';
  document.getElementById('matrix-wrap').innerHTML = '';
  document.getElementById('results-area').classList.remove('hidden');
}

function formatNum(v) {
  if (v === null || v === undefined) return '—';
  const n = parseFloat(v);
  if (isNaN(n)) return '—';
  return n % 1 === 0 ? n.toString() : n.toFixed(2);
}

// ── KEYBOARD SHORTCUTS ────────────────────────────────────────

document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') {
    if (e.key === 'Enter') {
      const id = e.target.id;
      if (id === 'origin-input' || id === 'origin-supply-input') addNode('origin');
      else if (id === 'dest-input' || id === 'dest-demand-input') addNode('dest');
    }
  }
});

document.addEventListener('DOMContentLoaded', () => {
  initImportGrid(4, 4);
});
