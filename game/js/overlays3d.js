// Overlays drawn from the SIMULATED results of the design on screen:
//  - heat-flow arrows sized by each source's yearly heat gain
//  - facade heat map (kWh per m² of each wall and the roof)
//  - % of window glass in shadow at the current sun position
import * as THREE from 'three';

const V = (x, y, z) => new THREE.Vector3(x, z, -y);  // simulation world -> three.js
const fmt = x => Math.round(x).toLocaleString('en-IN');

// Cool-to-hot colour ramp used by arrows, heat map and legend
const RAMP = ['#3d7fd9', '#7fc4c9', '#ffd23f', '#f2862e', '#d7301f'];
export const RAMP_CSS = `linear-gradient(90deg, ${RAMP.join(', ')})`;
export function heatColor(t) {
  t = Math.min(1, Math.max(0, t)) * (RAMP.length - 1);
  const i = Math.min(RAMP.length - 2, Math.floor(t));
  return new THREE.Color(RAMP[i]).lerp(new THREE.Color(RAMP[i + 1]), t - i);
}

function arrowMesh(from, to, radius, color) {
  const dir = to.clone().sub(from), len = dir.length(); dir.normalize();
  const head = Math.min(len * 0.4, radius * 4.5), g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.35, roughness: 0.5 });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, len - head, 16), mat);
  shaft.position.y = (len - head) / 2;
  const cone = new THREE.Mesh(new THREE.ConeGeometry(radius * 2.2, head, 20), mat);
  cone.position.y = len - head / 2;
  g.add(shaft, cone);
  g.position.copy(from);
  g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  return g;
}

/**
 * Heat-flow arrows. raw = city.lookup(design) result; facades = exported facade geometry; H = wall height.
 * label(text, opts) makes a text sprite.
 */
export function buildArrows(raw, facades, H, label) {
  const g = new THREE.Group();
  const items = [];
  for (const f of facades) {
    const r = raw.facades[f.name];
    items.push({ kind: 'win', f, v: r.windowSolar + r.windowConduction, text: `${f.compass} windows` });
    items.push({ kind: 'wall', f, v: r.wall, text: `${f.compass} wall` });
  }
  items.push({ kind: 'roof', v: raw.gains.roof, text: 'Roof' });
  items.push({ kind: 'air', v: raw.gains.air, text: 'Air leakage' });
  const vmax = Math.max(...items.map(i => i.v), 1);
  for (const it of items) {
    if (it.v < vmax * 0.01) continue;
    const k = Math.sqrt(it.v / vmax), rad = 0.05 + 0.26 * k, len = 1.4 + 2.6 * k, col = heatColor(k);
    let from, to;
    if (it.kind === 'win' || it.kind === 'wall') {
      const f = it.f, along = it.kind === 'win' ? f.length / 2 : f.length * 0.5, z = it.kind === 'win' ? 3.0 : 5.6;
      const px = f.A[0] + f.t[0] * along, py = f.A[1] + f.t[1] * along;
      to = V(px + f.n[0] * 0.35, py + f.n[1] * 0.35, z);
      from = V(px + f.n[0] * (0.35 + len), py + f.n[1] * (0.35 + len), z);
    } else if (it.kind === 'roof') {
      to = new THREE.Vector3(0, H + 0.5, 0); from = new THREE.Vector3(0, H + 0.5 + len, 0);
    } else {  // air: diagonally into the corner nearest the gate side at ground-floor height
      const f = facades[0], c = V(f.A[0], f.A[1], 1.2), out = V(f.A[0] - f.t[0] + f.n[0], f.A[1] - f.t[1] + f.n[1], 0).sub(V(f.A[0], f.A[1], 0)).normalize();
      to = c.clone().addScaledVector(out, 0.4); from = c.clone().addScaledVector(out, 0.4 + len);
    }
    const a = arrowMesh(from, to, rad, col); a.userData.kind = 'arrow'; g.add(a);
    const lab = label(`${it.text} · ${fmt(it.v)}`, { size: 0.55, depthTest: false });
    lab.position.copy(from).add(new THREE.Vector3(0, 0.55, 0)); lab.renderOrder = 10; g.add(lab);
  }
  const inside = raw.gains.people + raw.gains.lights + raw.gains.equipment;
  const board = label(`Inside: people ${fmt(raw.gains.people)} · lights ${fmt(raw.gains.lights)} · appliances ${fmt(raw.gains.equipment)}  (= ${fmt(inside)} kWh)`,
    { size: 0.55, depthTest: false, bg: 'rgba(255,248,232,0.92)' });
  board.position.set(0, H + 5.6, 0); board.renderOrder = 10; g.add(board);
  return { group: g, vmax };
}

/** Per-facade and roof heat gain per m² (kWh/m²·yr), used for the heat map. */
export function heatMapValues(raw, facades, H, roofArea) {
  const out = {};
  for (const f of facades) {
    const r = raw.facades[f.name];
    out[f.name] = { compass: f.compass, total: r.wall + r.windowSolar + r.windowConduction, perM2: (r.wall + r.windowSolar + r.windowConduction) / (f.length * H) };
  }
  out.roof = { compass: 'Roof', total: raw.gains.roof, perM2: raw.gains.roof / roofArea };
  const max = Math.max(...Object.values(out).map(o => o.perM2), 1);
  for (const o of Object.values(out)) o.t = o.perM2 / max;
  return { values: out, max };
}

/**
 * Share of window glass in direct-sun shadow, treated the way the simulation does: windows are flush with
 * the wall face, only the chajjas/louvres shade them, and glass facing away from the sun gets no sun.
 */
const ray = new THREE.Raycaster();
export function windowShadow(facades, occluders, sunDir) {
  const byFacade = {};
  let total = 0, shaded = 0;
  for (const f of facades) {
    const n = new THREE.Vector3(f.n[0], 0, -f.n[1]), t = new THREE.Vector3(f.t[0], 0, -f.t[1]);
    const facingAway = sunDir.dot(n) <= 0.0001;
    let ft = 0, fs = 0;
    for (const [x0, z0, w, h] of f.windows) {
      const nx = 4, nz = 24;  // shading from horizontal devices varies mostly with height (louvre stripes need many rows)
      const a = w * h / (nx * nz);  // each sample stands for this much glass (m²)
      for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
        const sx = x0 + (i + 0.5) * w / nx, sz = z0 + (j + 0.5) * h / nz;
        ft += a;
        if (facingAway) { fs += a; continue; }
        const p = V(f.A[0] + f.t[0] * sx, f.A[1] + f.t[1] * sx, sz).addScaledVector(n, 0.01);
        ray.set(p, sunDir); ray.far = 30;
        if (ray.intersectObjects(occluders, false).length) fs += a;
      }
    }
    byFacade[f.name] = { compass: f.compass, pct: ft ? 100 * fs / ft : 0, facingAway };
    total += ft; shaded += fs;
  }
  return { pct: total ? 100 * shaded / total : 0, byFacade };
}
