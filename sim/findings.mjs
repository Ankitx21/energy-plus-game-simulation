// Key findings for Bengaluru from the full table, using the game's own maths (game/js/*.js).
// Usage:  node sim/findings.mjs [--md docs/FINDINGS.md]
import { readFileSync, writeFileSync } from 'node:fs';
import { CityData } from '../game/js/data.js';
import { evaluate, score } from '../game/js/engine.js';
import { evaluateAll, paretoFront, importance, MISSIONS, missionBest } from '../game/js/analysis.js';

const root = new URL('../game/data/', import.meta.url);
const meta = JSON.parse(readFileSync(new URL('blr.json', root), 'utf8'));
const buf = readFileSync(new URL('blr.bin', root));
const city = new CityData(meta, buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
const settings = { tariff: meta.economics.tariff_rs_per_kwh, subsidy: true };
const lv = meta.level;
const L = x => '₹' + (x / 1e5).toFixed(2) + ' L', N = x => Math.round(x).toLocaleString('en-IN');
const lines = [];
const out = s => { console.log(s); lines.push(s); };
const label = d => meta.options.map(o => `${o.label}: ${o.choices.find(c => c.id === d[o.id]).label}`).join(' · ');
const pct = (a, q) => { const s = [...a].filter(x => !Number.isNaN(x)).sort((x, y) => x - y); return s[Math.floor(q * (s.length - 1))]; };

const t0 = Date.now();
const draft = evaluate(city, { ...meta.base_design, ac: '3star', pv: 0 }, settings);
const none = evaluateAll(city, settings, { ac: '3star', pv: 0 });
const nz = evaluateAll(city, settings, { ac: 'best', pv: 'nz' });
out(`# Net Zero Builder · Bengaluru findings\n`);
out(`Computed from all ${N(meta.rows)} EnergyPlus designs with the game's own maths (tariff ₹${settings.tariff}/kWh, solar subsidy on). ${Date.now() - t0} ms.\n`);

{
  const imp = importance(city, none), cheap = missionBest(city, settings, lv, MISSIONS[0]);
  const brute = evaluate(city, { ...meta.base_design, ac: '3star', pv: 90 }, settings);
  out(`## In plain words\n`);
  out(`1. **How you cool matters far more than anything else.** Switching from AC at 24 °C to fans with natural ventilation changes energy use by ${imp[0].swingEui.toFixed(0)} kWh/m²·yr on average; the next most important choice (${imp[1].label.toLowerCase()}) changes it by only ${imp[1].swingEui.toFixed(0)}. Bengaluru's mild climate lets a well-designed home stay comfortable most of the year without AC.`);
  out(`2. **Net zero is easy; affordable, comfortable net zero is the puzzle.** Every design can reach net zero with enough roof solar, but bolting ${brute.kwp.toFixed(1)} kWp onto the developer's draft costs ${L(brute.cost)}, over the ${L(lv.budget_rs)} budget. The cheapest comfortable net-zero design costs ${L(cheap.cost)}.`);
  out(`3. **Cheap passive moves come first.** A cool (white) roof and LED lights cost little and cut energy use straight away. Low-e glass and louvres help, but cost much more for each unit of energy saved.`);
  out(`4. **A cool roof and insulation do not always add up.** Under a white roof, insulation can trap indoor heat that a bare slab would lose to the night sky, so it can raise cooling slightly.`);
  out(`5. **Orientation and window size matter less here than people expect**, because the windows are modest and the roof and cooling dominate. They still help comfort without AC.\n`);
}
out(`## The developer's draft\n`);
out(`- Energy use ${draft.eui.toFixed(0)} kWh/m²·yr, comfort ${draft.comfort.toFixed(0)}%, AC ${draft.tons} t, cost of upgrades and systems ${L(draft.cost)}, bill ${'₹' + N(draft.annualBill)}/yr.\n`);

out(`## Range across all designs (3-star AC, no solar)\n`);
out(`| | min | 25% | median | 75% | max |\n|---|---|---|---|---|---|`);
for (const [k, f] of [['Energy use (kWh/m²·yr)', 'eui'], ['Comfort (%)', 'comfort'], ['Cost (₹ L)', 'cost']]) {
  const s = f === 'cost' ? x => (x / 1e5).toFixed(2) : x => x.toFixed(0);
  out(`| ${k} | ${s(pct(none[f], 0))} | ${s(pct(none[f], .25))} | ${s(pct(none[f], .5))} | ${s(pct(none[f], .75))} | ${s(pct(none[f], 1))} |`);
}
const roofOk = nz.nz.filter(x => x >= 1 - 1e-9).length;
out(`\n- ${N(roofOk)} of ${N(meta.rows)} designs (${(100 * roofOk / meta.rows).toFixed(0)}%) can reach net zero with solar on the usable roof.`);
const nzc = []; for (let i = 0; i < nz.n; i++) if (nz.nz[i] >= 1 - 1e-9 && nz.comfort[i] >= lv.comfort_target) nzc.push(nz.cost[i]);
out(`- ${N(nzc.length)} of those also reach ≥ ${lv.comfort_target}% comfort. Their cost (solar sized for net zero, cheapest AC): min ${L(pct(nzc, 0))}, 10% ${L(pct(nzc, .1))}, median ${L(pct(nzc, .5))}.\n`);

out(`## What matters most (average effect of each choice over every other combination; 3-star AC, no solar)\n`);
out(`| Option | Energy-use swing | Comfort swing | Best for energy |\n|---|---|---|---|`);
for (const o of importance(city, none)) {
  const b = [...o.choices].sort((a, c) => a.eui - c.eui)[0];
  out(`| ${o.label} | ${o.swingEui.toFixed(1)} kWh/m²·yr | ${o.swingComfort.toFixed(1)} pts | ${b.label} (${b.eui.toFixed(0)}) |`);
}

out(`\n## Pareto front: cost vs energy use (comfort ≥ ${lv.comfort_target}%, 3-star AC, no solar)\n`);
const front = paretoFront(none, i => none.comfort[i] >= lv.comfort_target);
out(`${front.length} designs on the front. Every 4th:\n`);
out(`| Cost | Energy use | Comfort | Design |\n|---|---|---|---|`);
front.filter((_, i) => i % 4 === 0 || i === front.length - 1).forEach(i =>
  out(`| ${L(none.cost[i])} | ${none.eui[i].toFixed(1)} | ${none.comfort[i].toFixed(0)}% | ${label(city.designOf(i))} |`));

out(`\n## Missions: best possible answers\n`);
for (const m of MISSIONS) {
  const b = missionBest(city, settings, lv, m);
  if (!b) { out(`- **${m.title}**: no design meets it.`); continue; }
  out(`- **${m.title}**: ${L(b.cost)}, ${b.eui.toFixed(1)} kWh/m²·yr, comfort ${b.comfort.toFixed(0)}%, solar ${b.design.pv}% (${b.kwp.toFixed(1)} kWp), AC ${b.design.ac}. Score ${score(lv, b).score}, ${score(lv, b).stars}★.\n  ${label(b.design)}`);
}
const md = process.argv.indexOf('--md');
if (md > 0) writeFileSync(process.argv[md + 1], lines.join('\n') + '\n');
