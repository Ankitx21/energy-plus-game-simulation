// The site around the house: plot with compound wall and gate, paving, lawn, road, trees and
// neighbouring buildings. The plot rotates with the house (its front gate faces the end_a side).
//
// Fidelity note: the simulation assumes an open site. Neighbouring blocks are therefore placed well
// away and do not cast shadows; trees stand in the plot corners, away from the windows.
import * as THREE from 'three';
import { mergeGeometries } from '../vendor/BufferGeometryUtils.js';

function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

const MAT = {};
function mats() {
  if (MAT.wall) return MAT;
  MAT.wall = new THREE.MeshStandardMaterial({ color: '#d8d0c2', roughness: 0.9 });
  MAT.coping = new THREE.MeshStandardMaterial({ color: '#b9b1a3', roughness: 0.8 });
  MAT.paving = new THREE.MeshStandardMaterial({ color: '#b5aa98', roughness: 0.95 });
  MAT.road = new THREE.MeshStandardMaterial({ color: '#36373a', roughness: 0.95 });
  MAT.footpath = new THREE.MeshStandardMaterial({ color: '#9c968c', roughness: 0.95 });
  MAT.line = new THREE.MeshBasicMaterial({ color: '#e8e2cf' });
  MAT.gate = new THREE.MeshStandardMaterial({ color: '#2f3a3a', roughness: 0.5, metalness: 0.6 });
  MAT.trunk = new THREE.MeshStandardMaterial({ color: '#5b4330', roughness: 1 });
  MAT.leaf = [new THREE.MeshStandardMaterial({ color: '#3f6f2d', roughness: 0.9, flatShading: true }),
              new THREE.MeshStandardMaterial({ color: '#4f8636', roughness: 0.9, flatShading: true }),
              new THREE.MeshStandardMaterial({ color: '#5c9440', roughness: 0.9, flatShading: true })];
  MAT.shrub = new THREE.MeshStandardMaterial({ color: '#3d6b2c', roughness: 0.95, flatShading: true });
  MAT.neighbour = new THREE.MeshStandardMaterial({ color: '#b8b6b1', roughness: 0.95 });
  MAT.neighbourWin = new THREE.MeshStandardMaterial({ color: '#7b8590', roughness: 0.5 });
  return MAT;
}

// Merge many boxes that share a material into one mesh (far fewer draw calls)
function mergedBoxes(list, mat, { cast = true, receive = true } = {}) {
  const geoms = list.map(([w, h, d, x, y, z, ry = 0]) => {
    const g = new THREE.BoxGeometry(w, h, d);
    if (ry) g.rotateY(ry);
    return g.translate(x, y, z);
  });
  const m = new THREE.Mesh(mergeGeometries(geoms), mat);
  geoms.forEach(g => g.dispose());
  m.castShadow = cast; m.receiveShadow = receive;
  return m;
}

function tree(r, scale, detail) {
  const M = mats(), g = new THREE.Group();
  const h = 2.2 * scale;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14 * scale, 0.22 * scale, h, 7), M.trunk);
  trunk.position.y = h / 2; trunk.castShadow = true; g.add(trunk);
  const clumps = detail ? 7 : 4;
  for (let i = 0; i < clumps; i++) {
    const rad = (0.9 + r() * 0.7) * scale;
    const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(rad, detail ? 1 : 0), M.leaf[i % 3]);
    const a = r() * Math.PI * 2, d = (i === 0 ? 0 : 0.9 + r() * 0.6) * scale;
    leaf.position.set(Math.cos(a) * d, h + (0.6 + r() * 1.1) * scale, Math.sin(a) * d);
    leaf.castShadow = true; leaf.receiveShadow = true; g.add(leaf);
  }
  return g;
}

/**
 * Build the site for a house of width Wd (local x) and length Ld (local y) at compass bearing `bearing`.
 * Returns { group, front } where front is the world direction (three.js) from the house to the gate.
 */
export function buildSite({ Wd, Ld, bearing, detail = true }) {
  const M = mats(), r = rng(5);
  const g = new THREE.Group();
  g.rotation.y = -THREE.MathUtils.degToRad(bearing);
  // Plot in local coordinates (x across, y along; three z = -y). Setbacks: front 5 m, back 3 m, sides 3 m.
  const x0 = -Wd / 2 - 3, x1 = Wd / 2 + 3, yF = -Ld / 2 - 5, yB = Ld / 2 + 3;
  const wallH = 1.2, wallT = 0.2, gate = 3.6;

  // Compound wall with pillars and coping, gate opening centred on the front
  const walls = [], copings = [], pillars = [];
  const run = (ax, ay, bx, by) => {
    const len = Math.hypot(bx - ax, by - ay), cx = (ax + bx) / 2, cy = (ay + by) / 2, ry = Math.atan2(-(by - ay), bx - ax);
    walls.push([len, wallH, wallT, cx, wallH / 2, -cy, ry]);
    copings.push([len + 0.04, 0.06, wallT + 0.08, cx, wallH + 0.03, -cy, ry]);
    const n = Math.max(1, Math.round(len / 3));
    for (let i = 0; i <= n; i++) pillars.push([0.34, wallH + 0.15, 0.34, ax + (bx - ax) * i / n, (wallH + 0.15) / 2, -(ay + (by - ay) * i / n)]);
  };
  run(x0, yF, -gate / 2, yF); run(gate / 2, yF, x1, yF);
  run(x1, yF, x1, yB); run(x1, yB, x0, yB); run(x0, yB, x0, yF);
  g.add(mergedBoxes(walls, M.wall), mergedBoxes(copings, M.coping, { cast: false }), mergedBoxes(pillars, M.coping));
  // Gate: two pillars and a pair of steel grille leaves
  const gp = [[0.5, 1.9, 0.5, -gate / 2 - 0.25, 0.95, -yF], [0.5, 1.9, 0.5, gate / 2 + 0.25, 0.95, -yF]];
  g.add(mergedBoxes(gp, M.coping));
  const bars = [];
  for (let i = 0; i <= 18; i++) bars.push([0.03, 1.35, 0.03, -gate / 2 + gate * i / 18, 0.75, -yF]);
  bars.push([gate, 0.05, 0.04, 0, 1.4, -yF], [gate, 0.05, 0.04, 0, 0.12, -yF], [gate, 0.04, 0.04, 0, 0.8, -yF]);
  g.add(mergedBoxes(bars, M.gate, { receive: false }));

  // Paving: driveway from the gate, 1 m apron around the house, path round the side
  const pave = [[gate, 0.02, Ld / 2 + 5 - Ld / 2, 0, 0.012, -(yF + 2.5)],
                [Wd + 2, 0.02, Ld + 2, 0, 0.011, 0]];
  g.add(mergedBoxes(pave, M.paving, { cast: false }));
  // Road and footpath outside the gate, with a dashed centre line
  const road = new THREE.Mesh(new THREE.BoxGeometry(80, 0.02, 7), M.road);
  road.position.set(0, 0.01, -(yF - 1.6 - 3.5)); road.receiveShadow = true; g.add(road);
  const fp = new THREE.Mesh(new THREE.BoxGeometry(80, 0.08, 1.6), M.footpath);
  fp.position.set(0, 0.04, -(yF - 0.8)); fp.receiveShadow = true; g.add(fp);
  const dashes = [];
  for (let x = -38; x < 38; x += 4) dashes.push([2, 0.005, 0.15, x, 0.025, -(yF - 1.6 - 3.5)]);
  g.add(mergedBoxes(dashes, M.line, { cast: false, receive: false }));

  // Trees in the back corners and one by the front wall; shrubs along the front
  for (const [tx, ty, s] of [[x0 + 1.3, yB - 1.3, 1.25], [x1 - 1.4, yB - 1.2, 1.0], [x0 + 1.2, yF + 1.5, 0.95]]) {
    const t = tree(r, s, detail); t.position.set(tx, 0, -ty); g.add(t);
  }
  if (detail) {
    const shrubs = [];
    for (let i = 0; i < 8; i++) {
      const sx = x1 - 0.6 - i * 0.55;
      const geom = new THREE.IcosahedronGeometry(0.35 + r() * 0.15, 0).translate(sx, 0.3, -(yF + 0.55));
      shrubs.push(geom);
    }
    const sm = new THREE.Mesh(mergeGeometries(shrubs), M.shrub); sm.castShadow = true; g.add(sm);
  }

  // Neighbouring buildings (context only: far enough away and no shadows, as the simulation has none)
  const blocks = [[10, 9, 6.5, x1 + 13, yF + 8], [10, 8, 7.5, x0 - 13, yB - 6], [14, 9, 6, 0, yB + 15],
                  [11, 9, 7, x1 + 14, yB + 12], [12, 9, 6.5, -16, yF - 20], [12, 9, 8, 17, yF - 21]];
  for (const [bw, bl, bh, bx, by] of blocks) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bl), M.neighbour);
    b.position.set(bx, bh / 2, -by); b.castShadow = false; b.receiveShadow = true; g.add(b);
    const strips = [];
    for (let f = 0; f < Math.floor(bh / 3); f++) {
      strips.push([bw * 0.8, 0.9, bl + 0.02, bx, f * 3 + 1.6, -by]);
      strips.push([bw + 0.02, 0.9, bl * 0.8, bx, f * 3 + 1.6, -by]);
    }
    const sm = mergedBoxes(strips, M.neighbourWin, { cast: false });
    g.add(sm);
  }

  const front = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), g.rotation.y); // local -y
  return { group: g, front, plot: { x0, x1, yF, yB } };
}

export { mergedBoxes };
