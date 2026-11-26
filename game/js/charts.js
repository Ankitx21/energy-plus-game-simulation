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
