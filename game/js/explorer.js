// Feature 4: design explorer (every design on cost vs energy use, best-value front, click to load)
// Feature 5: what matters most (average effect of each option over every other combination)
import { evaluateAll, paretoFront, importance } from './analysis.js';

const fmtL = x => '₹' + (x / 1e5).toFixed(2) + ' L';
const cache = new Map();

function data(city, settings, ac, solar) {
  const key = [ac, solar, settings.tariff, settings.subsidy].join('|');
  if (!cache.has(key)) cache.set(key, evaluateAll(city, settings, { ac, pv: solar === 'nz' ? 'nz' : 0 }));
  return cache.get(key);
}

// Resolve a CSS colour (including light-dark()) to rgb() so canvas can use it
function cssColor(el, v) { el.style.color = v; return getComputedStyle(el).color; }

/**
 * Open the explorer inside container. ctx: { city, settings, level, design, runs, onLoad(design) }.
 */
export function renderExplorer(root, ctx) {
  const { city, level } = ctx;
  const st = { tab: 'all', cooling: 'all', solar: 'none', hover: -1 };
  const coolOpt = city.options.find(o => o.id === 'cooling');
  root.innerHTML = `
    <div class="xhead"><h2 id="mt">Explore every design</h2><button class="btn alt" id="xclose" aria-label="Close explorer">Close</button></div>
    <div class="xtabs" role="tablist">
      <button role="tab" data-tab="all" aria-selected="true">All ${city.meta.rows.toLocaleString('en-IN')} designs</button>
      <button role="tab" data-tab="matters" aria-selected="false">What matters most</button></div>
    <div id="xbody"></div>`;
  const body = root.querySelector('#xbody');
  root.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => {
    st.tab = b.dataset.tab;
    root.querySelectorAll('[data-tab]').forEach(x => x.setAttribute('aria-selected', x === b));
    draw();
  });

  function draw() { st.tab === 'all' ? drawAll() : drawMatters(); }

  // ---------- all designs ----------
  function drawAll() {
    body.innerHTML = `
      <div class="xfilters">
        <div class="xf"><span>Cooling</span>${[['all', 'All'], ...coolOpt.choices.map(c => [c.id, c.label])].map(([id, t]) =>
          `<button class="chip" data-cool="${id}" aria-pressed="${st.cooling === id}">${t}</button>`).join('')}</div>
        <div class="xf"><span>Solar</span><button class="chip" data-sol="none" aria-pressed="${st.solar === 'none'}">None</button><button class="chip" data-sol="nz" aria-pressed="${st.solar === 'nz'}">Sized for net zero</button></div>
      </div>
      <div class="xlegend"><span><i class="dot ok"></i>Comfortable ≥ ${level.comfort_target}%</span><span><i class="dot no"></i>Less comfortable</span><span><i class="ln"></i>Best value (cheapest for its energy use, comfortable)</span><span><i class="ring"></i>Your design</span></div>
      <div class="xplot"><canvas id="xc" role="img" aria-label="Scatter plot of every design: cost against energy use. Use the table below for the same information."></canvas><div class="xtip" id="xtip" hidden></div></div>
      <div class="od">Each dot is one EnergyPlus run, with your AC choice (${city.meta.economics.ac_efficiency[ctx.design.ac].label}). Hover to inspect, click to load it into your design (then simulate).</div>
      <h3 class="xh3">Best-value designs</h3><div class="scroll"><table id="xtab"></table></div>`;
    body.querySelectorAll('[data-cool]').forEach(b => b.onclick = () => { st.cooling = b.dataset.cool; drawAll(); });
    body.querySelectorAll('[data-sol]').forEach(b => b.onclick = () => { st.solar = b.dataset.sol; drawAll(); });
    const cv = body.querySelector('#xc'), tip = body.querySelector('#xtip');
    cv.parentElement.classList.add('busy');
    setTimeout(() => plot(cv, tip), 20);  // let "calculating" paint first
  }

  function plot(cv, tip) {
    const all = data(city, ctx.settings, ctx.design.ac, st.solar);
    const coolIdx = Object.fromEntries(coolOpt.choices.map((c, i) => [c.id, i]));
    let stride = 1; const k = city.options.indexOf(coolOpt);
    for (let j = k + 1; j < city.options.length; j++) stride *= city.options[j].choices.length;
    const keep = i => st.cooling === 'all' || Math.floor(i / stride) % coolOpt.choices.length === coolIdx[st.cooling];
    const ok = i => all.comfort[i] >= level.comfort_target;
    const front = paretoFront(all, i => keep(i) && ok(i));
    const curRow = city.rowOf(ctx.design);
    cv.parentElement.classList.remove('busy');

    // scales
    const dpr = Math.min(2, window.devicePixelRatio || 1), W = cv.clientWidth || 800, H = cv.clientHeight || 420;
    cv.width = W * dpr; cv.height = H * dpr;
    const g = cv.getContext('2d'); g.scale(dpr, dpr);
    const ml = 54, mr = 14, mt = 14, mb = 40, iw = W - ml - mr, ih = H - mt - mb;
    let xMax = 0, yMax = 0;
    for (let i = 0; i < all.n; i++) if (keep(i)) { xMax = Math.max(xMax, all.cost[i]); yMax = Math.max(yMax, all.eui[i]); }
    xMax = Math.max(xMax, level.budget_rs) * 1.04; yMax = Math.ceil(yMax / 10) * 10 + 5;
    const X = v => ml + v / xMax * iw, Y = v => mt + ih - v / yMax * ih;
    const col = { ok: cssColor(cv, 'var(--x-ok)'), no: cssColor(cv, 'var(--x-no)'), front: cssColor(cv, 'var(--x-front)'),
                  ink: cssColor(cv, 'var(--ink)'), mut: cssColor(cv, 'var(--mut)'), line: cssColor(cv, 'var(--line)'), bg: cssColor(cv, 'var(--bg)') };

    const pts = [];  // [x, y, row] for hit testing
    function paint() {
      g.clearRect(0, 0, W, H);
      g.font = '12px Archivo, system-ui, sans-serif'; g.lineWidth = 1;
      // grid + axes
      g.strokeStyle = col.line; g.fillStyle = col.mut; g.textAlign = 'right';
      for (let v = 0; v <= yMax; v += 10) { g.beginPath(); g.moveTo(ml, Y(v)); g.lineTo(W - mr, Y(v)); g.stroke(); g.fillText(v, ml - 6, Y(v) + 4); }
      g.textAlign = 'center';
      const step = xMax > 1e6 ? 2e5 : 1e5;
      for (let v = 0; v <= xMax; v += step) g.fillText('₹' + v / 1e5 + ' L', X(v), H - mb + 16);
      g.fillText('Cost of upgrades and systems', ml + iw / 2, H - 6);
      g.save(); g.translate(13, mt + ih / 2); g.rotate(-Math.PI / 2); g.fillText('Energy use, kWh/m²·yr', 0, 0); g.restore();
      // budget and target guides
      g.setLineDash([5, 4]); g.strokeStyle = col.mut;
      g.beginPath(); g.moveTo(X(level.budget_rs), mt); g.lineTo(X(level.budget_rs), mt + ih); g.stroke();
      g.beginPath(); g.moveTo(ml, Y(level.eui_target)); g.lineTo(W - mr, Y(level.eui_target)); g.stroke();
      g.setLineDash([]); g.fillStyle = col.mut; g.textAlign = 'left';
      g.fillText('budget', X(level.budget_rs) + 4, mt + 12);
      g.fillText(`target ${level.eui_target}`, ml + 4, Y(level.eui_target) - 5);
      // dots: less comfortable first, comfortable on top
      pts.length = 0;
      for (const pass of [0, 1]) {
        g.fillStyle = pass ? col.ok : col.no; g.globalAlpha = pass ? 0.45 : 0.35;
        for (let i = 0; i < all.n; i++) {
          if (!keep(i) || ok(i) !== !!pass) continue;
          const x = X(all.cost[i]), y = Y(all.eui[i]);
          g.fillRect(x - 1.5, y - 1.5, 3, 3); pts.push([x, y, i]);
        }
      }
      g.globalAlpha = 1;
      // best-value front
      g.strokeStyle = col.front; g.lineWidth = 2; g.beginPath();
      front.forEach((i, n) => { const x = X(all.cost[i]), y = Y(all.eui[i]); n ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke();
      for (const i of front) { g.beginPath(); g.arc(X(all.cost[i]), Y(all.eui[i]), 4, 0, 7); g.fillStyle = col.front; g.fill(); g.lineWidth = 2; g.strokeStyle = col.bg; g.stroke(); }
      // your design and past runs
      if (keep(curRow) && !Number.isNaN(all.eui[curRow])) {
        const x = X(all.cost[curRow]), y = Y(all.eui[curRow]);
        g.beginPath(); g.arc(x, y, 8, 0, 7); g.lineWidth = 2.5; g.strokeStyle = col.ink; g.stroke();
        g.fillStyle = col.ink; g.textAlign = 'left'; g.font = '600 12px Archivo, system-ui, sans-serif'; g.fillText('Your design', x + 11, y + 4);
      }
      if (st.hover >= 0) { const i = st.hover; g.beginPath(); g.arc(X(all.cost[i]), Y(all.eui[i]), 6, 0, 7); g.lineWidth = 2; g.strokeStyle = col.ink; g.stroke(); }
    }
    paint();

    const nearest = (mx, my) => { let best = -1, bd = 100; for (const [x, y, i] of pts) { const d = (x - mx) ** 2 + (y - my) ** 2; if (d < bd) { bd = d; best = i; } } return best; };
    let raf = 0;
    cv.onmousemove = e => {
      const r = cv.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const i = nearest(mx, my);
        if (i !== st.hover) { st.hover = i; paint(); }
        if (i < 0) { tip.hidden = true; cv.style.cursor = ''; return; }
        cv.style.cursor = 'pointer';
        tip.hidden = false; tip.innerHTML = tipHTML(i);
        const tx = Math.min(mx + 14, W - tip.offsetWidth - 6), ty = my + 14 + tip.offsetHeight > H ? my - tip.offsetHeight - 10 : my + 14;
        tip.style.left = tx + 'px'; tip.style.top = ty + 'px';
      });
    };
    cv.onmouseleave = () => { tip.hidden = true; st.hover = -1; paint(); };
    cv.onclick = e => { const r = cv.getBoundingClientRect(), i = nearest(e.clientX - r.left, e.clientY - r.top); if (i >= 0) load(i); };

    function tipHTML(i) {
      const d = city.designOf(i);
      return `<b>${fmtL(all.cost[i])} · ${all.eui[i].toFixed(1)} kWh/m²·yr</b><div>Comfortable ${all.comfort[i].toFixed(0)}% · solar ${all.pv[i]}%</div>
        <div class="xd">${city.options.map(o => o.choices.find(c => c.id === d[o.id]).label).join(' · ')}</div><div class="od">Click to load</div>`;
    }
    function load(i) { ctx.onLoad({ ...city.designOf(i), ac: ctx.design.ac, pv: st.solar === 'nz' ? all.pv[i] : ctx.design.pv }); }

    // table view of the front (also the accessible version of the chart)
    const short = { orientation: 'Orient.', wwr_ns: 'N/S glass', wwr_ew: 'E/W glass', glazing: 'Glass', shading: 'Shading', wall: 'Walls', roof: 'Roof', roof_finish: 'Finish', cooling: 'Cooling', lighting: 'Lights' };
    body.querySelector('#xtab').innerHTML = `<thead><tr><th class="n">Cost</th><th class="n">Energy</th><th class="n">Comfort</th>${city.options.map(o => `<th>${short[o.id] || o.label}</th>`).join('')}<th></th></tr></thead><tbody>${
      front.map(i => { const d = city.designOf(i); return `<tr${i === curRow ? ' class="cur"' : ''}><td class="n">${fmtL(all.cost[i])}</td><td class="n">${all.eui[i].toFixed(1)}</td><td class="n">${all.comfort[i].toFixed(0)}%</td>${
        city.options.map(o => `<td>${o.choices.find(c => c.id === d[o.id]).label.replace(/ \(.*\)$/, '')}</td>`).join('')}<td><button data-load="${i}">Load</button></td></tr>`; }).join('')}</tbody>`;
    body.querySelectorAll('[data-load]').forEach(b => b.onclick = () => load(+b.dataset.load));
  }

  // ---------- what matters most ----------
  function drawMatters() {
    body.innerHTML = '<div class="xplot busy" style="height:120px"></div>';
    setTimeout(() => {
      const all = data(city, ctx.settings, ctx.design.ac, 'none');
      const imp = importance(city, all), mx = Math.max(...imp.map(o => o.swingEui));
      body.innerHTML = `<p class="od" style="color:var(--ink);font-size:14px;margin:4px 0 12px">For each choice, the average result over <b>every</b> combination of the other choices (your AC: ${city.meta.economics.ac_efficiency[ctx.design.ac].label}, no solar). The bar shows how far energy use moves between the best and worst choice for that option.</p>
      <div class="mm">${imp.map(o => {
        const cs = [...o.choices].sort((a, b) => a.eui - b.eui);
        return `<div class="mmr"><div class="mml"><b>${o.label}</b><small>comfort moves ${o.swingComfort.toFixed(1)} pts</small></div>
          <div class="mmb"><span class="t"><i style="width:${o.swingEui / mx * 100}%"></i></span><span class="v">${o.swingEui.toFixed(1)} kWh/m²·yr</span></div>
          <div class="mmc">${cs.map((c, n) => `<span class="${n === 0 ? 'best' : ''}">${c.label.replace(/ \(.*\)$/, '')} <b>${c.eui.toFixed(0)}</b></span>`).join('')}</div></div>`;
      }).join('')}</div>
      <p class="note">Average energy use (kWh/m²·yr) shown after each choice; the lowest is highlighted. Options near the top are where your decisions count most in Bengaluru.</p>`;
    }, 20);
  }

  draw();
  return { close: () => { root.innerHTML = ''; } };
}
