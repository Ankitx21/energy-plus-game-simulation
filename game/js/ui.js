// Screens and panels. State lives in S; every change calls update().
import { evaluate, score, bestMoves } from './engine.js';
import { drawMonthly } from './charts.js';
import { drawScene2D } from './scene2d.js';
import { createScene, webglAvailable } from './scene3d.js';
import { sunControlsHTML, attachSunControls, attachViewControls, savedQuality } from './sunui.js';

const $ = q => document.querySelector(q);
const fmtL = x => '₹' + (x / 1e5).toFixed(1) + ' L';
const fmtR = x => '₹' + Math.round(x).toLocaleString('en-IN');
const fmtN = x => Math.round(x).toLocaleString('en-IN');
const pct = x => Math.round(x * 100) + '%';
const starStr = n => '★'.repeat(n) + '<span class="off">' + '★'.repeat(3 - n) + '</span>';

const GROUPS = [
  ['Orientation', ['orientation']],
  ['Windows', ['wwr_ns', 'wwr_ew', 'glazing']],
  ['Shading', ['shading']],
  ['Walls', ['wall']],
  ['Roof', ['roof', 'roof_finish']],
  ['Cooling', ['cooling', 'ac']],
  ['Lighting', ['lighting']],
];

const S = { city: null, level: null, view: 'levels', ch: null, runs: [], cur: null, simsLeft: 0, busy: false,
            settings: { tariff: 7, subsidy: true }, progress: {} };
try { S.progress = JSON.parse(localStorage.getItem('nzb-progress-v2') || '{}'); } catch (e) { /* private mode */ }
const save = () => { try { localStorage.setItem('nzb-progress-v2', JSON.stringify(S.progress)); } catch (e) { /* ignore */ } };

export function init(city) {
  S.city = city;
  S.level = city.meta.level;
  S.use3d = webglAvailable() && !new URLSearchParams(location.search).has('2d');
  S.settings.tariff = city.meta.economics.tariff_rs_per_kwh;
  $('#home').onclick = renderLevels;
  $('#howlink').onclick = e => { if (S.view !== 'levels') { e.preventDefault(); renderLevels(); setTimeout(() => $('#how').scrollIntoView(), 0); } };
  $('#modal').onclick = e => { if (e.target.id === 'modal') closeModal(); };
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
  renderLevels();
  if (new URLSearchParams(location.search).has('play')) startLevel();  // shortcut for testing and demos
}

// ---------- options (simulated + browser-only) ----------
function optionDefs() {
  const m = S.city.meta;
  const defs = Object.fromEntries(m.options.map(o => [o.id, { ...o, sim: true }]));
  defs.ac = { id: 'ac', label: 'AC efficiency', sim: false,
              choices: Object.entries(m.economics.ac_efficiency).map(([id, v]) => ({ id, label: v.label })) };
  return defs;
}
const detail = (opt, choice) => S.city.meta.option_details[`${opt}.${choice}`] || '';

// ---------- start screen ----------
function disposeScene() { if (S.sunui) { S.sunui.stop(); S.sunui0 = { month: S.sunui.state.month, hour: S.sunui.state.hour }; } S.sunui = null; if (S.scene3d) { S.scene3d.dispose(); S.scene3d = null; } }

function renderLevels() {
  disposeScene();
  S.view = 'levels'; document.body.classList.remove('game');
  const m = S.city.meta, lv = S.level, p = S.progress.blr || {};
  const done = m.rows_done, total = m.rows;
  $('#app').innerHTML = `
  <section class="band hero"><div class="wrap" style="padding-bottom:40px">
    <h1>Make a Bengaluru home net zero</h1>
    <p>Change the orientation, windows, walls, roof, cooling and solar of a real two-storey home, then see what EnergyPlus says about its energy, comfort and cost. Get it to net zero without blowing the budget or cooking the family.</p>
  </div></section>
  <div class="levels">
    <button class="lc" id="play">
      <div class="top"><h3>${m.city.name}</h3><span class="zone">${m.city.climate_zone}</span></div>
      <div><b>${lv.title}</b><div class="meta">Home · ${fmtN(m.geometry.floor_area)} m² · ${m.geometry.floors} floors · budget ${fmtL(lv.budget_rs)}</div></div>
      <div class="meta">${lv.brief}</div>
      <div class="top"><span class="stars">${starStr(p.stars || 0)}</span><span class="meta">${p.score ? 'Best ' + p.score : 'Not played'}</span></div>
      ${done < total ? `<div class="datainfo">Data: ${fmtN(done)} of ${fmtN(total)} designs simulated so far</div>` : ''}
    </button>
  </div>
  <section class="band" id="how"><div class="wrap">
    <h2 style="font-size:clamp(26px,3.4vw,36px)">How a browser can "simulate" a building instantly</h2>
    <p style="max-width:68ch;margin:10px 0 0">The heavy physics runs once, offline. Every one of the ${fmtN(total)} designs you can make was simulated in advance with EnergyPlus, using Bengaluru's weather. Pressing Simulate finds your row in that table and does a little arithmetic on top.</p>
    <div class="pipe">${[
      ['Weather file', `Typical year for ${m.city.name} (${m.weather_file.split('_TMYx')[0].replace('IND_KA_', '')})`, 'climate.onebuilding.org'],
      ['Shoebox model', '220 m² two-storey home; your choices are its inputs', 'Python'],
      ['EnergyPlus batch', `Every combination: ${fmtN(total)} runs`, 'once, on a laptop'],
      ['Results table', 'Monthly energy, comfort, peak load and heat gains per design', `${(total * m.columns.length * 2 / 1e6).toFixed(1)} MB in the game`],
      ['Your browser', 'Finds your row, then adds AC efficiency, solar, cost, bill and score', 'every click'],
    ].map((s, i) => `<div class="st${i === 4 ? ' you' : ''}"><b>${s[0]}</b><span>${s[1]}</span><em class="where">${s[2]}</em></div>`).join('')}</div>
    <p class="note">Results come from a simplified single-zone EnergyPlus model with typical Indian materials and a family of four. They are for comparing designs, not for predicting a real bill. Costs are estimates.</p>
  </div></section>`;
  $('#play').onclick = startLevel;
  $('#tot').textContent = `★ ${p.stars || 0} / 3`;
}

// ---------- game ----------
function startLevel() {
  const m = S.city.meta;
  S.ch = { ...m.base_design, ac: '3star', pv: 0 };
  S.runs = []; S.simsLeft = S.level.simulations;
  if (!commitRun("Developer's draft")) {
    $('#app').innerHTML = `<div class="loading err">The developer's draft has not been simulated yet. Re-export the table when the batch has reached it.</div>`;
    return;
  }
  renderGame();
}

function commitRun(label) {
  const r = evaluate(S.city, S.ch, S.settings);
  if (!r) return false;
  const run = { n: S.runs.length, label, ch: { ...S.ch }, r, e: score(S.level, r) };
  S.runs.push(run); S.cur = run;
  return true;
}
const changed = () => JSON.stringify(S.ch) !== JSON.stringify(S.cur.ch);

function renderGame() {
  S.view = 'game'; document.body.classList.add('game');
  const m = S.city.meta, lv = S.level, defs = optionDefs();
  $('#app').innerHTML = `
  <div class="gbar">
    <button class="back" id="back">← Start</button>
    <div><h2>${lv.title}</h2><div class="sub">${m.city.name} · ${m.city.climate_zone} · home, ${fmtN(m.geometry.floor_area)} m², ${m.geometry.floors} floors</div></div>
    <div class="meter"><div class="lab"><span>Budget used</span><b id="bud"></b></div><div class="track"><i id="budbar"></i></div></div>
    <div><div class="k" style="font-size:13px">Simulations left</div><div class="dots" id="dots"></div></div>
    <button class="btn" id="submit">Submit design</button>
  </div>
  <div class="grid">
    <aside class="panel" id="panel">
      ${GROUPS.map(([g, ids]) => `<div class="og"><h4>${g}</h4>${ids.map(id => { const o = defs[id]; return `
        <div class="opt" id="o-${id}"><div class="ol">${o.label}<span class="pend" title="Changed since last simulation"></span>${o.sim ? '' : '<span class="od" style="margin:0 0 0 auto">browser calc</span>'}</div>
        <div class="chips">${o.choices.map(c => `<button class="chip" data-o="${id}" data-k="${c.id}">${c.label}</button>`).join('')}</div>
        <div class="od" id="d-${id}"></div></div>`; }).join('')}</div>`).join('')}
      <div class="og"><h4>Solar PV</h4><div class="opt" id="o-pv"><div class="ol">Roof coverage <span class="pend"></span><span class="od" style="margin:0 0 0 auto">browser calc</span></div>
        <input type="range" id="pv" min="0" max="100" step="5" aria-label="Solar PV roof coverage"><div class="od" id="d-pv"></div></div></div>
      <div class="og"><h4>Money</h4><div class="money">
        <label>Electricity tariff (₹/kWh) <input type="number" id="tariff" min="1" max="20" step="0.5"></label>
        <label><span>PM Surya Ghar solar subsidy</span><input type="checkbox" id="subsidy"></label></div></div>
      <div class="simbox"><button class="btn sim" id="sim">Simulate</button><div class="od" id="simnote"></div></div>
    </aside>
    <section class="mid">
      <div class="scene" id="scenebox">${S.use3d ? '<div id="scene3d" role="img" aria-label="3D view of your building: drag to orbit, scroll or pinch to zoom"></div>' : '<svg id="scene" role="img" aria-label="Drawing of your building"></svg>'}
        <div class="brief"><b>Client brief</b>${lv.brief}</div>
        ${S.use3d ? sunControlsHTML() : '<div class="tag">2D view (3D needs WebGL)</div>'}
        <div class="scan" id="scan"></div></div>
      <div class="card"><h3 id="mtitle">Month by month: energy used vs solar generated</h3>
        <div class="fig"><svg id="mchart"></svg></div>
        <div class="legend"><span><i style="background:var(--sky)"></i>Cooling</span><span><i style="background:var(--lat)"></i>Heating</span><span><i style="background:#9a948c"></i>Fans, lights, plugs</span><span><i style="background:var(--sol);border-radius:50%"></i>Solar generation</span></div>
      </div>
    </section>
    <aside class="res" id="res"></aside>
    <div class="lower">
      <div class="card"><h3>Run history</h3><div class="scroll"><table id="hist"></table></div></div>
      <div class="card"><h3>Behind the scenes</h3><div id="bts"></div></div>
    </div>
  </div>
  <div class="mbar" id="mbar"></div>`;
  $('#back').onclick = renderLevels;
  $('#submit').onclick = openSubmit;
  $('#sim').onclick = doSim;
  document.querySelectorAll('.chip').forEach(b => b.onclick = () => { S.ch[b.dataset.o] = b.dataset.k; update(); });
  $('#pv').oninput = e => { S.ch.pv = +e.target.value; update(); };
  $('#tariff').value = S.settings.tariff;
  $('#tariff').onchange = e => { S.settings.tariff = Math.max(1, +e.target.value || 7); refreshRuns(); update(); };
  $('#subsidy').checked = S.settings.subsidy;
  $('#subsidy').onchange = e => { S.settings.subsidy = e.target.checked; refreshRuns(); update(); };
  disposeScene();
  if (S.use3d) {
    S.scene3d = createScene($('#scene3d'), S.city.meta, { quality: savedQuality() });
    attachViewControls($('#scenebox'), S.scene3d);
    S.sunui = attachSunControls($('#scenebox'), S.scene3d, S.city.meta.city, S.sunui0 || {});
  }
  else new ResizeObserver(() => drawScene2D($('#scene'), S.city, S.ch)).observe($('#scene'));
  new ResizeObserver(() => drawMonthly($('#mchart'), S.cur.r)).observe($('#mchart'));
  update(); window.scrollTo(0, 0);
}

// Money settings change the browser maths, so recompute stored runs
function refreshRuns() {
  for (const u of S.runs) { u.r = evaluate(S.city, u.ch, S.settings); u.e = score(S.level, u.r); }
}

function doSim() {
  if (S.busy || !changed() || S.simsLeft <= 0) return;
  const sc = $('#scan'), row = S.city.rowOf(S.ch);
  if (!S.city.has(row)) {
    sc.textContent = `Row ${fmtN(row + 1)} has not been simulated yet: the EnergyPlus batch is still running.`;
    sc.classList.add('on'); setTimeout(() => sc.classList.remove('on'), 1800);
    return;
  }
  S.busy = true; S.simsLeft--;
  sc.textContent = `Looking up row ${fmtN(row + 1)} of ${fmtN(S.city.meta.rows)}…`; sc.classList.add('on');
  const fast = matchMedia('(prefers-reduced-motion: reduce)').matches;
  setTimeout(() => { commitRun('Run ' + S.runs.length); sc.classList.remove('on'); S.busy = false; update(); }, fast ? 60 : 650);
}

function update() {
  const lv = S.level, ch = S.ch, cur = S.cur.ch, defs = optionDefs();
  const acOn = S.city.meta.cooling_modes[ch.cooling].ac;
  for (const id of Object.keys(defs)) {
    document.querySelectorAll(`.chip[data-o="${id}"]`).forEach(b => {
      b.setAttribute('aria-pressed', b.dataset.k === ch[id]);
      if (id === 'ac') b.disabled = !acOn;
    });
    $('#o-' + id).classList.toggle('chg', ch[id] !== cur[id]);
    $('#d-' + id).textContent = id === 'ac' ? (acOn ? `COP ${S.city.meta.economics.ac_efficiency[ch.ac].cop}` : 'No AC in this cooling mode') : detail(id, ch[id]);
  }
  const live = evaluate(S.city, ch, S.settings);
  $('#pv').value = ch.pv; $('#o-pv').classList.toggle('chg', ch.pv !== cur.pv);
  const kwpMax = S.city.meta.geometry.roof_area * S.city.meta.economics.solar.usable_roof_fraction * S.city.meta.economics.solar.kwp_per_m2;
  $('#d-pv').textContent = `${ch.pv}% of usable roof · ${(kwpMax * ch.pv / 100).toFixed(1)} kWp`;
  if (live) {
    const u = live.cost / lv.budget_rs;
    $('#bud').textContent = `${fmtL(live.cost)} of ${fmtL(lv.budget_rs)}`;
    const bb = $('#budbar'); bb.style.width = Math.min(100, u * 100) + '%'; bb.classList.toggle('over', u > 1);
  } else {
    $('#bud').textContent = 'design not simulated yet';
  }
  $('#dots').innerHTML = Array.from({ length: lv.simulations }, (_, i) => `<i class="${i < lv.simulations - S.simsLeft ? 'used' : ''}"></i>`).join('');
  const ok = changed() && S.simsLeft > 0;
  document.querySelectorAll('.sim').forEach(b => { b.disabled = !ok; b.textContent = S.simsLeft > 0 ? `Simulate (${S.simsLeft} left)` : 'No simulations left'; });
  $('#simnote').textContent = !live ? 'This exact design is not in the table yet (batch still running)'
    : changed() ? 'Design changed since last run' : 'Change something to run a new simulation';
  if (S.scene3d) {
    // outdoor AC units: about one per 2 tons of AC capacity, only in AC modes
    const acOn = S.city.meta.cooling_modes[S.ch.cooling].ac;
    const acUnits = !acOn ? 0 : live ? Math.min(4, Math.max(1, Math.ceil(live.tons / 2))) : 2;
    S.scene3d.update(S.ch, { acUnits });
  } else drawScene2D($('#scene'), S.city, S.ch);
  drawMonthly($('#mchart'), S.cur.r);
  const r = S.cur.r;
  $('#mtitle').textContent = r.pv >= r.use ? 'Month by month: solar covers the year' : r.pv > 0 ? 'Month by month: where solar falls short' : 'Month by month: energy used, no solar yet';
  renderResults(); renderHist(); renderBTS(); renderMbar();
}

function renderResults() {
  const lv = S.level, { r, e } = S.cur;
  const ringR = 46, circ = 2 * Math.PI * ringR, f = Math.min(1, r.nz);
  const goals = [[e.s1, `Energy use ≤ ${lv.eui_target} kWh/m²·yr`], [e.s2, `Comfortable ≥ ${lv.comfort_target}% of the time`], [e.s3, 'Net zero (solar ≥ yearly use), within budget']];
  const rows = [['Cooling', r.coolingE, 'var(--sky)'], ['Heating', r.heatingE, 'var(--lat)'], ['Fans', r.fansE, '#9a948c'], ['Lighting', r.lightingE, '#9a948c'], ['Appliances', r.plugsE, '#9a948c'], ['Solar', r.pv, 'var(--sol)']];
  const mx = Math.max(...rows.map(x => x[1]), 1);
  const mv = bestMoves(S.city, lv, S.cur.ch, S.settings).filter(x => x.gain > 0 && !(x.e.over && !e.over)).slice(0, 3);
  S._moves = mv;
  $('#res').innerHTML = `
    ${changed() ? `<div class="stale">Showing <b>${S.cur.label}</b>. You've changed the design since: simulate to see the new results.</div>` : ''}
    <div class="nzrow">
      <svg class="ring" viewBox="0 0 120 120" aria-label="Net zero ${pct(r.nz)}">
        <circle cx="60" cy="60" r="${ringR}" fill="none" stroke="var(--line)" stroke-width="13"/>
        <circle cx="60" cy="60" r="${ringR}" fill="none" stroke="var(--sol)" stroke-width="13" stroke-linecap="round" stroke-dasharray="${circ * f} ${circ}" transform="rotate(-90 60 60)"/>
        <text x="60" y="64" text-anchor="middle">${pct(r.nz)}</text><text class="s" x="60" y="82" text-anchor="middle">net zero</text></svg>
      <div><div class="k">Score</div><div style="font-size:34px;font-weight:800;line-height:1">${e.score}</div><div class="stars" style="margin-top:4px">${starStr(e.stars)}</div></div>
    </div>
    <div class="kpis">
      <div class="k">Energy use<b>${r.eui.toFixed(0)}<span style="font-size:13px;font-weight:500"> kWh/m²·yr</span></b><em>target ≤ ${lv.eui_target}</em></div>
      <div class="k">Comfortable<b>${r.comfort.toFixed(0)}%</b><em>of occupied hours (IMAC)</em></div>
      <div class="k">Electricity bill<b>${fmtR(r.annualBill)}</b><em>per year at ₹${S.settings.tariff}/kWh</em></div>
      <div class="k">Cost<b class="${e.over ? 'up' : ''}">${fmtL(r.cost)}</b><em>${e.over ? 'over budget' : 'of ' + fmtL(lv.budget_rs)}</em></div>
      <div class="k">Solar<b>${r.kwp.toFixed(1)} kWp</b><em>${fmtN(r.pv)} kWh/yr</em></div>
      <div class="k">Grid CO₂<b>${r.co2.toFixed(1)} t</b><em>per year, net</em></div>
    </div>
    <div class="goals">${goals.map(g => `<div class="goal${g[0] ? ' met' : ''}"><span class="ic">${g[0] ? '★' : '·'}</span><span>${g[1]}</span></div>`).join('')}</div>
    <div class="card" style="padding:14px"><h3 style="font-size:16px">Yearly energy, kWh</h3><div class="bars">${rows.map(x => `<div class="br"><span>${x[0]}</span><span class="t"><i style="width:${x[1] / mx * 100}%;background:${x[2]}"></i></span><span class="v">${fmtN(x[1])}</span></div>`).join('')}</div></div>
    <div class="hint"><h3>Best next moves</h3>${mv.length ? mv.map((x, i) => {
      const dE = x.r.eui - r.eui, dC = x.r.cost - r.cost;
      return `<div class="mv"><div><b>${x.label}</b><small>+${x.gain} pts · EUI ${dE > 0 ? '+' : '−'}${Math.abs(dE).toFixed(0)} · ${dC >= 0 ? '+' : '−'}${fmtL(Math.abs(dC))}</small></div><button data-mv="${i}">Apply</button></div>`; }).join('')
      : '<div class="od">No single change improves this design. Try a bigger combined move.</div>'}</div>`;
  document.querySelectorAll('[data-mv]').forEach(b => b.onclick = () => { S.ch = { ...S._moves[+b.dataset.mv].design }; update(); });
}

function renderHist() {
  $('#hist').innerHTML = `<thead><tr><th>Run</th><th class="n">EUI</th><th class="n">Comfort</th><th class="n">Net zero</th><th class="n">Bill/yr</th><th class="n">Cost</th><th class="n">Score</th><th>Stars</th><th></th></tr></thead><tbody>${
    S.runs.map(u => `<tr class="${u === S.cur ? 'cur' : ''}"><td>${u.label}</td><td class="n">${u.r.eui.toFixed(0)}</td><td class="n">${u.r.comfort.toFixed(0)}%</td><td class="n">${pct(u.r.nz)}</td><td class="n">${fmtR(u.r.annualBill)}</td><td class="n">${fmtL(u.r.cost)}</td><td class="n"><b>${u.e.score}</b></td><td><span class="stars" style="font-size:14px">${starStr(u.e.stars)}</span></td><td>${u === S.cur ? '' : `<button data-run="${u.n}">Restore</button>`}</td></tr>`).join('')}</tbody>`;
  document.querySelectorAll('[data-run]').forEach(b => b.onclick = () => { const u = S.runs[+b.dataset.run]; S.cur = u; S.ch = { ...u.ch }; update(); });
}

function renderBTS() {
  const { ch, r } = S.cur, m = S.city.meta;
  $('#bts').innerHTML = `<div style="font-size:14px">For <b>${S.cur.label}</b>, your ${m.options.length} simulated choices become one row number; the rest is browser maths.</div>
   <div class="key">key [${m.options.map(o => `<b>${ch[o.id]}</b>`).join(', ')}]<br>→ row <b>${fmtN(r.raw.row + 1)}</b> of ${fmtN(m.rows)}<br><br>
   AC electricity = heat to remove ${fmtN(r.coolingE * r.cop)} kWh ÷ COP ${r.cop} = <b>${fmtN(r.coolingE)} kWh</b><br>
   solar = ${r.kwp.toFixed(1)} kWp × ${fmtN(r.pv / Math.max(r.kwp, 1e-9))} kWh/kWp = <b>${fmtN(r.pv)} kWh</b><br>
   cost = upgrades ${fmtL(r.costParts.walls + r.costParts.glazing + r.costParts.shading + r.costParts.roof + r.costParts.lighting)} + AC ${r.tons} ton ${fmtL(r.costParts.ac)} + fans ${fmtL(r.costParts.fans)} + solar ${fmtL(r.costParts.solar)} = <b>${fmtL(r.cost)}</b></div>
   <p class="note" style="margin-top:10px">Simulated with EnergyPlus 26.2 for ${m.city.name}. Data: ${fmtN(m.rows_done)} of ${fmtN(m.rows)} designs.</p>`;
}

function renderMbar() {
  const { r, e } = S.cur;
  $('#mbar').innerHTML = `<div class="k">Net zero<b>${pct(r.nz)}</b></div><div class="k">EUI<b>${r.eui.toFixed(0)}</b></div><div class="k">Score<b>${e.score}</b></div><button class="btn sim" ${changed() && S.simsLeft > 0 ? '' : 'disabled'}>Simulate</button>`;
  $('#mbar .sim').onclick = doSim;
}

function openSubmit() {
  const run = S.cur, e = run.e, p = S.progress.blr || {};
  const better = !p.score || e.score > p.score;
  if (better) { S.progress.blr = { stars: Math.max(e.stars, p.stars || 0), score: e.score }; save(); }
  $('#dlg').innerHTML = `<h2 id="mt">${e.stars === 3 ? 'Net zero achieved' : e.stars ? 'Design submitted' : 'Not there yet'}</h2>
   <div class="big">${starStr(e.stars)}</div><div class="score">${e.score} pts</div>
   <div class="od" style="color:var(--ink)">${run.label}: ${pct(run.r.nz)} net zero · ${run.r.comfort.toFixed(0)}% comfortable · ${fmtL(run.r.cost)}${better && p.score ? ' · new best!' : ''}</div>
   <div class="row"><button class="btn alt" id="mk">Keep designing</button><button class="btn" id="ml">Back to start</button></div>`;
  $('#modal').classList.add('on');
  $('#mk').onclick = closeModal;
  $('#ml').onclick = () => { closeModal(); renderLevels(); };
  $('#mk').focus();
}
function closeModal() { $('#modal').classList.remove('on'); }
