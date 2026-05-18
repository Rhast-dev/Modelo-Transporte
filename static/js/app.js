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
  currentStep: 1
};

// ── STEP NAVIGATION ──────────────────────────────────────────

function goStep(n) {
  if (n > state.currentStep) {
    if (!validateStep(state.currentStep)) return;
    if (n === 3) buildCostMatrix();
    if (n === 4) collectCosts();
  }
  showStep(n);
}

function jumpTo(n) {
  if (n > state.currentStep) return;
  if (n === 3) buildCostMatrix();
  if (n === 4) collectCosts();
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
  if (n === 2) buildFlowInputs();
}

function validateStep(step) {
  if (step === 1) {
    if (state.origins.length < 1) { alert('Agrega al menos un origen.'); return false; }
    if (state.destinations.length < 1) { alert('Agrega al menos un destino.'); return false; }
  }
  if (step === 2) {
    collectFlows();
    const ts = state.origins.reduce((s, o) => s + (state.supply[o] || 0), 0);
    const td = state.destinations.reduce((s, d) => s + (state.demand[d] || 0), 0);
    if (ts === 0 || td === 0) { alert('Ingresa valores de oferta y demanda mayores a cero.'); return false; }
  }
  return true;
}

// ── NODES ────────────────────────────────────────────────────

function addNode(type) {
  const inputId = type === 'origin' ? 'origin-input' : 'dest-input';
  const arr = type === 'origin' ? state.origins : state.destinations;
  const val = document.getElementById(inputId).value.trim();
  if (!val) return;
  if (arr.includes(val)) { document.getElementById(inputId).value = ''; return; }
  arr.push(val);
  document.getElementById(inputId).value = '';
  renderTags(type);
}

function removeNode(type, name) {
  const arr = type === 'origin' ? state.origins : state.destinations;
  const idx = arr.indexOf(name);
  if (idx > -1) arr.splice(idx, 1);
  renderTags(type);
}

function renderTags(type) {
  const arr = type === 'origin' ? state.origins : state.destinations;
  const listId = type === 'origin' ? 'origins-tags' : 'destinations-tags';
  const countId = type === 'origin' ? 'origins-count' : 'destinations-count';
  const cls = type === 'origin' ? 'origin-tag' : 'dest-tag';

  document.getElementById(listId).innerHTML = arr.map(n =>
    `<div class="tag ${cls}">${n}<button class="tag-remove" onclick="removeNode('${type}','${n.replace(/'/g, "\\'")}')" title="Eliminar">×</button></div>`
  ).join('');
  document.getElementById(countId).textContent = arr.length;
}

// ── SUPPLY & DEMAND ───────────────────────────────────────────

function buildFlowInputs() {
  document.getElementById('supply-inputs').innerHTML = state.origins.map(o =>
    `<div class="flow-input-row">
      <span class="flow-label">${o}</span>
      <input type="number" min="0" step="any" class="flow-number" id="supply-${CSS.escape(o)}"
        value="${state.supply[o] || ''}" placeholder="0" oninput="updateBalance()" />
    </div>`
  ).join('');

  document.getElementById('demand-inputs').innerHTML = state.destinations.map(d =>
    `<div class="flow-input-row">
      <span class="flow-label">${d}</span>
      <input type="number" min="0" step="any" class="flow-number" id="demand-${CSS.escape(d)}"
        value="${state.demand[d] || ''}" placeholder="0" oninput="updateBalance()" />
    </div>`
  ).join('');

  updateBalance();
}

function collectFlows() {
  state.origins.forEach(o => {
    const el = document.getElementById('supply-' + CSS.escape(o));
    state.supply[o] = el ? (parseFloat(el.value) || 0) : 0;
  });
  state.destinations.forEach(d => {
    const el = document.getElementById('demand-' + CSS.escape(d));
    state.demand[d] = el ? (parseFloat(el.value) || 0) : 0;
  });
}

function updateBalance() {
  const ts = state.origins.reduce((s, o) => {
    const el = document.getElementById('supply-' + CSS.escape(o));
    return s + (el ? parseFloat(el.value) || 0 : 0);
  }, 0);
  const td = state.destinations.reduce((s, d) => {
    const el = document.getElementById('demand-' + CSS.escape(d));
    return s + (el ? parseFloat(el.value) || 0 : 0);
  }, 0);

  const el = document.getElementById('balance-indicator');
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
  collectFlows();
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

  // Routes table
  const tbody = document.getElementById('routes-tbody');
  tbody.innerHTML = data.routes.map(r =>
    `<tr>
      <td>${r.from}</td>
      <td>${r.to}</td>
      <td>${formatNum(r.qty)}</td>
      <td>${formatNum(r.unit_cost)}</td>
      <td>${formatNum(r.subtotal)}</td>
    </tr>`
  ).join('');
  document.getElementById('routes-total').textContent = formatNum(data.total);

  // Allocation matrix
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
      if (id === 'origin-input') addNode('origin');
      else if (id === 'dest-input') addNode('dest');
    }
  }
});
