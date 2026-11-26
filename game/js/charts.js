// SVG charts.
const MON = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
const MONL = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Stacked monthly energy use (cooling / heating / other) with solar generation as a line.
export function drawMonthly(svg, r) {
  if (!svg) return;
  const W = svg.clientWidth || 500, H = svg.clientHeight || 220;
  if (!r) { svg.innerHTML = ''; return; }
  const ml = 48, mr = 8, mt = 10, mb = 24, iw = W - ml - mr, ih = H - mt - mb;
  const use = r.monthly.use, pv = r.monthly.pv;
  const mx = Math.max(...use, ...pv) * 1.08 || 1;
  const step = mx > 8000 ? 2000 : mx > 4000 ? 1000 : mx > 1500 ? 500 : mx > 600 ? 200 : 100;
  const y = v => mt + ih - v / mx * ih, bw = iw / 12;
  let o = '';
  for (let v = 0; v <= mx; v += step)
    o += `<line x1="${ml}" x2="${W - mr}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)"/><text x="${ml - 6}" y="${y(v) + 4}" text-anchor="end">${v >= 1000 ? (v / 1000) + 'k' : v}</text>`;
  r.monthly.cooling.forEach((c, i) => {
    const x = ml + i * bw + bw * .18, w = bw * .64, h = r.monthly.heating[i], other = use[i] - c - h;
    let yy = y(0);
    for (const [v, col] of [[other, '#9a948c'], [h, 'var(--lat)'], [c, 'var(--sky)']]) {
      const hh = v / mx * ih; yy -= hh;
      if (hh > 0) o += `<rect x="${x}" y="${yy}" width="${w}" height="${hh}" fill="${col}"><title>${MONL[i]}: ${Math.round(v)} kWh</title></rect>`;
    }
    o += `<text x="${ml + i * bw + bw / 2}" y="${H - 6}" text-anchor="middle">${W < 520 ? MON[i] : MONL[i]}</text>`;
  });
  if (r.pv > 0) {
    const pp = pv.map((v, i) => [ml + i * bw + bw / 2, y(v)]);
    o += `<polyline points="${pp.map(p => p.join(',')).join(' ')}" fill="none" stroke="var(--sol)" stroke-width="3"/>`;
    o += pp.map(p => `<circle cx="${p[0]}" cy="${p[1]}" r="4" fill="var(--sol)" stroke="var(--bg)" stroke-width="1.5"/>`).join('');
  }
  o += `<text x="${ml}" y="${mt + 12}" style="fill:var(--ink)" dx="6">kWh per month</text>`;
  svg.innerHTML = o;
}

// Monthly electricity bill in ₹ with net metering: bars above zero = you pay, below = solar credit.
export function drawBill(svg, r) {
  if (!svg) return;
  const W = svg.clientWidth || 500, H = svg.clientHeight || 180;
  if (!r) { svg.innerHTML = ''; return; }
  const b = r.monthlyBill, ml = 56, mr = 8, mt = 10, mb = 24, iw = W - ml - mr, ih = H - mt - mb;
  const hi = Math.max(0, ...b), lo = Math.min(0, ...b), span = (hi - lo) * 1.1 || 1;
  const y = v => mt + (hi * 1.05 - v) / span * ih, bw = iw / 12;
  const step = [500, 1000, 2000, 5000, 10000, 20000].find(s => span / s <= 6) || 50000;
  let o = '';
  for (let v = Math.ceil(lo / step) * step; v <= hi * 1.05; v += step)
    o += `<line x1="${ml}" x2="${W - mr}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)"/><text x="${ml - 6}" y="${y(v) + 4}" text-anchor="end">${v < 0 ? '−' : ''}₹${Math.abs(v) >= 1000 ? Math.abs(v) / 1000 + 'k' : Math.abs(v)}</text>`;
  b.forEach((v, i) => {
    const x = ml + i * bw + bw * .18, w = bw * .64, top = y(Math.max(v, 0)), h = Math.max(1, Math.abs(y(v) - y(0)));
    o += `<rect x="${x}" y="${top}" width="${w}" height="${h}" rx="3" fill="${v >= 0 ? 'var(--x-front)' : 'var(--x-ok)'}"><title>${MONL[i]}: ${v >= 0 ? 'pay' : 'credit'} ₹${Math.round(Math.abs(v)).toLocaleString('en-IN')}</title></rect>`;
    o += `<text x="${ml + i * bw + bw / 2}" y="${H - 6}" text-anchor="middle">${W < 520 ? MON[i] : MONL[i]}</text>`;
  });
  o += `<line x1="${ml}" x2="${W - mr}" y1="${y(0)}" y2="${y(0)}" stroke="var(--mut)"/>`;
  svg.innerHTML = o;
}
