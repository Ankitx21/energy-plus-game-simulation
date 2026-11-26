// TEMPORARY flat isometric drawing (from the prototype), driven by the real geometry.
// Replaced by the three.js scene in task 7.
export function drawScene2D(svg, city, design) {
  if (!svg) return;
  const W = svg.clientWidth || 600, H = svg.clientHeight || 380;
  const g = city.meta.geometry, fac = city.facadesFor(design);
  // Draw the house in its own frame: x along the short side (width), y along the long side (length).
  const D = g.length, L = g.width, n = g.floors, ftf = g.floor_to_floor, Hb = n * ftf, m = D * .42;
  const C = .866, Sn = .5;
  const s = Math.min(W * .9 / ((L + D + 2 * m) * C), H * .78 / ((L + D + 2 * m) * Sn + Hb));
  const cx = W * .5 - (L - D) / 2 * C * s, cy = H * .58 - ((L + D + 2 * m) * Sn * s - Math.max(2 * m * Sn, Hb) * s) / 2;
  const P = (x, y, z) => [cx + (x - y) * C * s, cy + (x + y) * Sn * s - z * s];
  const pts = a => a.map(p => P(...p).map(v => v.toFixed(1)).join(',')).join(' ');
  const poly = (a, fill, ex = '') => `<polygon points="${pts(a)}" fill="${fill}" ${ex}/>`;
  const wallC = { brick: '#b9583e', aac: '#e9e4da', rammed_earth: '#c4935c' }[design.wall];
  const glass = design.glazing === 'double_lowe' ? '#7fb3c9' : '#a7d8f2';
  const roofC = design.roof_finish === 'cool' ? '#f8f8f4' : '#9b968e';
  let o = `<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8cc4f2"/><stop offset="1" stop-color="#e8f4fd"/></linearGradient></defs>`;
  o += `<rect width="${W}" height="${H}" fill="url(#sky)"/>`;
  o += poly([[-m, -m, 0], [L + m, -m, 0], [L + m, D + m, 0], [-m, D + m, 0]], '#b5d39a');
  o += poly([[-.6, -.6, 0], [L + 1.2, -.6, 0], [L + 1.2, D + 1.6, 0], [-.6, D + 1.6, 0]], 'rgba(40,30,20,.18)');
  // Visible faces: side_a (long, at x=L) and end_b (short, at y=D)
  const sideA = fac.find(f => f.name === 'side_a'), endB = fac.find(f => f.name === 'end_b');
  o += poly([[0, D, 0], [L, D, 0], [L, D, Hb], [0, D, Hb]], wallC);
  o += poly([[L, 0, 0], [L, D, 0], [L, D, Hb], [L, 0, Hb]], wallC);
  o += poly([[L, 0, 0], [L, D, 0], [L, D, Hb], [L, 0, Hb]], 'rgba(0,0,0,.14)');
  const facade = (f, face) => {
    let w = '';
    const len = f.length, cnt = f.windows_per_floor, wh = g.window_height;
    const ww = f.wwr * len * ftf / wh / cnt, gap = (len - cnt * ww) / (cnt + 1);
    const Q = (a, z, dn) => face === 'y' ? [a, D + dn, z] : [L + dn, a, z];
    for (let fl = 0; fl < n; fl++) for (let k = 0; k < cnt; k++) {
      const a0 = gap + k * (ww + gap), a1 = a0 + ww, z0 = fl * ftf + g.window_sill, z1 = z0 + wh;
      w += poly([Q(a0, z0, 0), Q(a1, z0, 0), Q(a1, z1, 0), Q(a0, z1, 0)], glass, 'stroke="rgba(30,40,50,.55)" stroke-width="1"');
      if (design.shading === 'overhang') w += poly([Q(a0 - .15, z1 + .05, 0), Q(a1 + .15, z1 + .05, 0), Q(a1 + .15, z1 + .05, .6), Q(a0 - .15, z1 + .05, .6)], '#e9e6e0', 'stroke="rgba(0,0,0,.25)" stroke-width=".8"');
      if (design.shading === 'louvres') for (let j = 0; j < 5; j++) { const z = z1 - j * wh / 5; w += `<polyline points="${pts([Q(a0 - .1, z, .17), Q(a1 + .1, z, .17)])}" stroke="#7a7268" stroke-width="${Math.max(1.5, s * .12)}" fill="none"/>`; }
    }
    return w;
  };
  o += facade(endB, 'y') + facade(sideA, 'x');
  if (city.meta.cooling_modes[design.cooling].ac)
    for (let i = 0; i < 2; i++) { const y = D * (.15 + i * .5), z = .3; o += poly([[L + .05, y, z], [L + .05, y + .9, z], [L + .05, y + .9, z + .6], [L + .05, y, z + .6]], '#cfd3d6', 'stroke="#7b8287" stroke-width=".8"'); }
  o += poly([[0, 0, Hb], [L, 0, Hb], [L, D, Hb], [0, D, Hb]], roofC, 'stroke="rgba(0,0,0,.25)"');
  const par = g.parapet * .5;
  o += poly([[0, D, Hb], [L, D, Hb], [L, D, Hb + par], [0, D, Hb + par]], design.roof_finish === 'cool' ? '#fff' : '#b3aea6');
  o += poly([[L, 0, Hb], [L, D, Hb], [L, D, Hb + par], [L, 0, Hb + par]], design.roof_finish === 'cool' ? '#e6e6e1' : '#9c978f');
  const ins = .8, cols = Math.max(1, Math.floor((L - 2 * ins) / 1.1)), rows = Math.max(1, Math.floor((D - 2 * ins) / 1.6));
  const fill = Math.round(cols * rows * design.pv / 100);
  for (let i = 0; i < fill; i++) { const r = Math.floor(i / cols), c = i % cols, x = ins + c * 1.1, y = ins + r * 1.6; o += poly([[x, y, Hb + .35], [x + 1, y, Hb + .35], [x + 1, y + 1.2, Hb + .15], [x, y + 1.2, Hb + .15]], '#1f3c6e', 'stroke="#7fa3d9" stroke-width=".6"'); }
  const lb1 = P(L / 2, D + m * .62, 0), lb2 = P(L + m * .62, D / 2, 0);
  o += `<text x="${lb1[0]}" y="${lb1[1]}" text-anchor="middle">faces ${endB.compass} · ${Math.round(endB.wwr * 100)}% glass</text>`;
  o += `<text x="${lb2[0]}" y="${lb2[1]}" text-anchor="middle">faces ${sideA.compass} · ${Math.round(sideA.wwr * 100)}% glass</text>`;
  svg.innerHTML = o;
}
