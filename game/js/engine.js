// Browser maths on top of the looked-up EnergyPlus row: AC efficiency, solar, cost, bill, score.
// A "design" holds the 10 simulated choices plus browser-only choices: ac (efficiency key) and pv (0–100 % roof).

export const sum = a => a.reduce((x, y) => x + y, 0);

export function evaluate(city, design, settings) {
  const raw = city.lookup(design);
  if (!raw) return null;
  const m = city.meta, eco = m.economics, geo = m.geometry, k = m.constants;
  const mode = m.cooling_modes[design.cooling];
  const cop = eco.ac_efficiency[design.ac].cop;

  // --- energy (kWh) ---
  const cooling = raw.coolingLoad.map(x => x / cop);
  const heating = raw.heatingLoad.map(x => x / cop);
  const lighting = k.lighting_kwh_monthly[design.lighting];
  const plugs = k.plugs_kwh_monthly;
  const fans = raw.fans;
  const monthlyUse = cooling.map((c, i) => c + heating[i] + lighting[i] + plugs[i] + fans[i]);
  const use = sum(monthlyUse);

  // --- solar ---
  const usableRoof = geo.roof_area * eco.solar.usable_roof_fraction;
  const kwpMax = usableRoof * eco.solar.kwp_per_m2;
  const kwp = kwpMax * design.pv / 100;
  const pvMonthly = k.solar_kwh_per_kwp_monthly.map(y => y * kwp);
  const pv = sum(pvMonthly);

  // --- cost of upgrades and systems (₹, extra over the cheapest choices) ---
  const fac = city.facadesFor(design);
  const H = geo.floors * geo.floor_to_floor;
  const windowArea = sum(fac.map(f => f.window_area));
  const opaqueWall = sum(fac.map(f => f.length * H)) - windowArea;
  const c = eco.costs;
  const parts = {
    walls: c.wall_rs_per_m2_opaque[design.wall] * opaqueWall,
    glazing: c.glazing_rs_per_m2_window[design.glazing] * windowArea,
    shading: c.shading_rs_per_m2_window[design.shading] * windowArea,
    roof: (c.roof_rs_per_m2[design.roof] + c.roof_finish_rs_per_m2[design.roof_finish]) * geo.roof_area,
    lighting: c.lighting_rs_per_m2_floor[design.lighting] * geo.floor_area,
  };
  const tons = mode.ac ? Math.max(1, Math.ceil(raw.peakKw / 3.517 * 2) / 2) : 0;  // AC sized to the peak, in ½-ton steps
  parts.ac = tons * eco.ac_efficiency[design.ac].cost_per_tr;
  parts.fans = mode.fans ? eco.fans.count * c.fans_rs_each : 0;
  const pvGross = kwp * eco.solar.cost_per_kwp;
  const sub = eco.solar.subsidy;
  const subsidy = settings.subsidy && kwp > 0
    ? Math.min(sub.max, sub.per_kw_first_2 * Math.min(kwp, 2) + sub.per_kw_third * Math.min(Math.max(kwp - 2, 0), 1)) : 0;
  parts.solar = pvGross - subsidy;
  const cost = sum(Object.values(parts));

  // --- bill (net metering over the year) ---
  const tariff = settings.tariff;
  const monthlyBill = monthlyUse.map((u, i) => (u - pvMonthly[i]) * tariff);  // negative = credit
  const annualBill = Math.max(0, use - pv) * tariff;

  return {
    raw, design, cop, tons, kwp, kwpMax,
    monthly: { cooling, heating, lighting, plugs, fans, use: monthlyUse, pv: pvMonthly, bill: monthlyBill },
    coolingE: sum(cooling), heatingE: sum(heating), lightingE: sum(lighting), plugsE: sum(plugs), fansE: sum(fans),
    use, pv, eui: use / geo.floor_area, nz: use > 0 ? pv / use : 0,
    comfort: raw.comfort, tooHot: raw.tooHot, peakKw: raw.peakKw,
    cost, costParts: parts, subsidy, annualBill, monthlyBill,
    co2: Math.max(0, use - pv) * eco.grid_kg_co2_per_kwh / 1000,
    windowArea, opaqueWall,
  };
}

// Stars and score for one evaluated design against the level's goals.
export function score(level, r) {
  const s1 = r.eui <= level.eui_target;
  const s2 = r.comfort >= level.comfort_target;
  const over = r.cost > level.budget_rs;
  const s3 = r.nz >= 1 - 1e-9 && !over;
  let pts = 350 * Math.min(1, r.nz) + 350 * r.comfort / 100
          + 150 * Math.min(1, level.eui_target / Math.max(r.eui, 1))
          + 150 * Math.max(0, 1 - r.cost / level.budget_rs);
  if (over) pts *= 0.6;
  return { s1, s2, s3, stars: s1 + s2 + s3, score: Math.round(pts), over };
}

// Every single change from the current design, ranked by score gain.
export function bestMoves(city, level, design, settings) {
  const base = evaluate(city, design, settings);
  if (!base) return [];
  const be = score(level, base), out = [];
  for (const o of city.options) {
    for (const ch of o.choices) {
      if (ch.id === design[o.id]) continue;
      const d = { ...design, [o.id]: ch.id }, r = evaluate(city, d, settings);
      if (!r) continue;
      const e = score(level, r);
      out.push({ label: `${o.label}: ${ch.label}`, design: d, r, e, gain: e.score - be.score });
    }
  }
  for (const pv of [design.pv + 20, design.pv + 40]) {
    if (pv > 100) continue;
    const d = { ...design, pv }, r = evaluate(city, d, settings), e = score(level, r);
    out.push({ label: `Solar PV to ${pv}% of roof`, design: d, r, e, gain: e.score - be.score });
  }
  return out.sort((a, b) => b.gain - a.gain);
}
