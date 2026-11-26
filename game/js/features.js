// Game features 1–3: predict before you simulate, window ratio per facade, heat-flow breakdown + advice.
const fmtN = x => Math.round(x).toLocaleString('en-IN');

// ---------- feature 1: predict before you simulate ----------
// Same = within these margins; otherwise up or down.
export const PREDICT_MARGIN = { eui: 1, comfort: 1 };

export function predictHTML(changes) {
  const q = (id, label) => `
    <fieldset class="pq"><legend>${label}</legend><div class="pqo">${[['down', '↓ Down'], ['same', '≈ About the same'], ['up', '↑ Up']]
      .map(([v, t]) => `<label><input type="radio" name="${id}" value="${v}"><span>${t}</span></label>`).join('')}</div></fieldset>`;
  return `<h2 id="mt">Predict first</h2>
    <div class="od" style="color:var(--ink)">You changed: <b>${changes.join(', ')}</b>.<br>What will EnergyPlus say, compared with your last run?</div>
    ${q('p-eui', 'Energy use')}${q('p-comfort', 'Comfortable hours')}
    <div class="row"><button class="btn alt" id="pskip">Skip</button><button class="btn" id="pgo">Simulate</button></div>
    <label class="od pnever"><input type="checkbox" id="pnever"> Don't ask me to predict</label>`;
}

export function direction(delta, margin) { return delta < -margin ? 'down' : delta > margin ? 'up' : 'same'; }

/** Compare a prediction with what actually happened. Returns rows for the reveal banner. */
export function checkPrediction(pred, prevR, newR) {
  const out = [];
  const add = (key, label, d, unit, good) => {
    if (!pred[key]) return;
    const actual = direction(d, PREDICT_MARGIN[key]);
    out.push({ label, guess: pred[key], actual, right: actual === pred[key], text: `${d > 0 ? '+' : d < 0 ? '−' : '±'}${Math.abs(d).toFixed(1)} ${unit}`, good });
  };
  add('eui', 'Energy use', newR.eui - prevR.eui, 'kWh/m²·yr', newR.eui <= prevR.eui);
  add('comfort', 'Comfort', newR.comfort - prevR.comfort, 'pts', newR.comfort >= prevR.comfort);
  return out;
}

export function revealHTML(rows, tally) {
  const arrow = { up: '↑', down: '↓', same: '≈' };
  return `<div class="reveal"><b>Your prediction</b>${rows.map(r => `
    <div class="rv ${r.right ? 'ok' : 'no'}"><span>${r.right ? '✓' : '✗'}</span><span>${r.label}: you said ${arrow[r.guess]}, it went ${arrow[r.actual]} (${r.text})</span></div>`).join('')}
    <div class="od">Predictions right so far: ${tally.right} of ${tally.total}</div></div>`;
}

// ---------- feature 2: window ratio per facade ----------
export function facadeTableHTML(facades, prevFacades) {
  return `<table class="ftab"><thead><tr><th>Facade</th><th class="n">Glass</th><th class="n">Windows</th><th class="n">m²</th></tr></thead><tbody>${
    facades.map(f => {
      const p = prevFacades?.find(x => x.name === f.name), d = p ? f.window_area - p.window_area : 0;
      return `<tr><td>${f.compass} <span class="mut">(${f.azimuth}°)</span></td><td class="n">${Math.round(f.wwr * 100)}%</td><td class="n">${f.windows.length}</td><td class="n">${f.window_area.toFixed(1)}${Math.abs(d) > 0.05 ? ` <span class="${d > 0 ? 'up' : 'dn'}">${d > 0 ? '+' : '−'}${Math.abs(d).toFixed(1)}</span>` : ''}</td></tr>`;
    }).join('')}</tbody></table>`;
}

// ---------- feature 3: where the heat comes from ----------
export function heatItems(raw, facades) {
  const items = facades.map(f => ({ key: `win_${f.name}`, label: `${f.compass} windows`, v: raw.facades[f.name].windowSolar + raw.facades[f.name].windowConduction, kind: 'win' }));
  items.push({ key: 'walls', label: 'Walls (all sides)', v: raw.gains.walls, kind: 'wall' },
             { key: 'roof', label: 'Roof', v: raw.gains.roof, kind: 'roof' },
             { key: 'air', label: 'Outside air (leaks + open windows)', v: raw.gains.air, kind: 'air' },
             { key: 'people', label: 'People', v: raw.gains.people, kind: 'in' },
             { key: 'lights', label: 'Lights', v: raw.gains.lights, kind: 'in' },
             { key: 'equipment', label: 'Appliances', v: raw.gains.equipment, kind: 'in' });
  return items;
}

const KIND_COLOR = { win: 'var(--sky)', wall: 'var(--lat)', roof: 'var(--lat)', air: '#7fb3a8', in: '#9a948c' };

export function heatChartHTML(raw, facades, prevRaw, prevFacades) {
  const items = heatItems(raw, facades).sort((a, b) => b.v - a.v);
  const prev = prevRaw ? Object.fromEntries(heatItems(prevRaw, prevFacades).map(i => [i.key, i.v])) : null;
  const mx = Math.max(...items.map(i => i.v), 1), total = items.reduce((a, i) => a + i.v, 0);
  return `<div class="bars hf">${items.map(i => {
    const d = prev ? i.v - prev[i.key] : 0;
    return `<div class="br"><span>${i.label}</span><span class="t"><i style="width:${i.v / mx * 100}%;background:${KIND_COLOR[i.kind]}"></i></span><span class="v">${fmtN(i.v)}${prev && Math.abs(d) >= 50 ? `<small class="${d > 0 ? 'up' : 'dn'}">${d > 0 ? '+' : '−'}${fmtN(Math.abs(d))}</small>` : ''}</span></div>`;
  }).join('')}</div>
  <div class="od">Heat entering the house per year, kWh. Total ${fmtN(total)} kWh${prev ? ` (${total - sumPrev(prev) > 0 ? '+' : '−'}${fmtN(Math.abs(total - sumPrev(prev)))} vs previous run)` : ''}. Coloured: <span style="color:var(--sky)">■</span> windows <span style="color:var(--lat)">■</span> walls and roof <span style="color:#7fb3a8">■</span> air <span style="color:#9a948c">■</span> inside the home.</div>`;
}
const sumPrev = p => Object.values(p).reduce((a, b) => a + b, 0);

/**
 * Plain-language advice from the biggest heat sources. Each tip names the one change to try.
 * Advice never quotes the result of the change: the player has to simulate (and can predict first).
 */
export function advice(city, design, raw, facades) {
  const items = heatItems(raw, facades).sort((a, b) => b.v - a.v);
  const tips = [], seen = new Set();
  const push = (key, text, why, change) => { if (!seen.has(key)) { seen.add(key); tips.push({ text, why, change }); } };
  const winItems = items.filter(i => i.kind === 'win');
  const allWin = winItems.reduce((a, i) => a + i.v, 0);
  for (const it of items) {
    if (tips.length >= 3) break;
    if (it.kind === 'win') {
      if (allWin < 0.25 * items.reduce((a, i) => a + i.v, 0)) continue;
      const f = facades.find(x => `win_${x.name}` === it.key), solar = raw.facades[f.name].windowSolar;
      if (design.shading === 'none' && solar > 0.6 * it.v)
        push('shade', `Shade the windows`, `Most of the heat through the ${f.compass} windows is direct sun. A chajja (overhang) or louvres stop it before it reaches the glass.`, { shading: 'overhang' });
      else if (design.glazing === 'single_clear')
        push('glass', 'Use double low-e glass', `The ${f.compass} windows let in a lot of heat. Low-e glass reflects much of the sun's heat and slows conduction.`, { glazing: 'double_lowe' });
      else if (f.wwr_group === 'ew' && design.wwr_ew !== '10')
        push('wwr_ew', 'Make the east/west windows smaller', `Low morning and afternoon sun hits the ${f.compass} wall almost straight on; shading cannot stop all of it.`, { wwr_ew: '10' });
      else if (f.wwr_group === 'ns' && design.wwr_ns !== '20')
        push('wwr_ns', 'Make the north/south windows smaller', `The ${f.compass} windows are still one of the biggest heat sources.`, { wwr_ns: '20' });
    } else if (it.kind === 'roof') {
      if (design.roof_finish === 'normal') push('cool', 'Paint the roof white (cool roof)', 'The flat roof faces the sun all day. A white finish reflects most of the sunlight for very little cost.', { roof_finish: 'cool' });
      else if (design.roof === 'bare') push('ins', 'Try roof insulation (check it helps!)', 'Insulation slows heat through the slab. Under a white roof it can also trap heat at night, so simulate to check.', { roof: 'insulated' });
    } else if (it.kind === 'wall') {
      if (design.wall === 'brick') push('wall', 'Use AAC blocks for the walls', 'AAC holds more air, so heat crosses the wall about three times more slowly than through brick.', { wall: 'aac' });
    } else if (it.key === 'lights') {
      if (design.lighting === 'fluorescent') push('led', 'Switch to LED lighting', 'LEDs use about half the electricity, and less electricity means less waste heat in the rooms.', { lighting: 'led' });
    } else if (it.kind === 'air' || it.kind === 'in') {
      if (design.cooling === 'ac24') push('sp', 'Set the AC to 26 °C, or use fans first', 'Each degree warmer cuts the cooling the AC has to do. Ceiling fans make 26 °C feel like 24 °C.', { cooling: 'ac26' });
    }
  }
  if (tips.length < 3 && design.cooling === 'ac24') push('sp', 'Set the AC to 26 °C, or use fans first', 'Each degree warmer cuts the cooling the AC has to do. Ceiling fans make 26 °C feel like 24 °C.', { cooling: 'ac26' });
  if (tips.length < 3 && design.lighting === 'fluorescent') push('led', 'Switch to LED lighting', 'LEDs use about half the electricity of tube lights.', { lighting: 'led' });
  return tips.slice(0, 3);
}
