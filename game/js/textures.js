// Procedural textures drawn on canvases: no image downloads, crisp at any size.
// Each returns { map, bump, tile: [width_m, height_m] }; UVs in the scene are in metres.
import * as THREE from 'three';

function rng(seed) {  // small deterministic PRNG so textures look the same every load
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function canvas(w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

function toTexture(c, srgb, tile) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1 / tile[0], 1 / tile[1]);
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function noise(ctx, w, h, r, amount, alpha = 0.06) {
  for (let i = 0; i < amount; i++) {
    const v = r() < 0.5 ? 0 : 255;
    ctx.fillStyle = `rgba(${v},${v},${v},${alpha * r()})`;
    ctx.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2);
  }
}

const cache = new Map();
const memo = (key, fn) => { if (!cache.has(key)) cache.set(key, fn()); return cache.get(key); };

// Exposed brick, English bond-ish stretcher courses: 230 x 75 mm bricks, 10 mm joints.
export const brick = () => memo('brick', () => {
  const tile = [0.96, 1.02], W = 512, H = 544, r = rng(11);
  const [c, x] = canvas(W, H), [b, y] = canvas(W, H);
  const pxm = W / tile[0], bw = 0.23 * pxm, bh = 0.075 * pxm, j = 0.01 * pxm;
  x.fillStyle = '#cbbfae'; x.fillRect(0, 0, W, H); y.fillStyle = '#202020'; y.fillRect(0, 0, W, H);
  for (let row = 0; row * (bh + j) < H; row++) {
    const off = row % 2 ? (bw + j) / 2 : 0;
    for (let col = -1; col * (bw + j) < W + bw; col++) {
      const px = col * (bw + j) + off, py = row * (bh + j);
      const t = r(), hue = 10 + t * 10, light = 30 + r() * 12;
      x.fillStyle = `hsl(${hue},${48 + r() * 12}%,${light}%)`;
      x.fillRect(px, py, bw, bh);
      x.fillStyle = `rgba(0,0,0,${r() * 0.12})`; x.fillRect(px, py + bh * 0.6, bw, bh * 0.4);
      y.fillStyle = `rgb(${200 + r() * 40},${200 + r() * 40},${200 + r() * 40})`; y.fillRect(px + 1, py + 1, bw - 2, bh - 2);
    }
  }
  noise(x, W, H, r, 9000, 0.08);
  return { map: toTexture(c, true, tile), bump: toTexture(b, false, tile), tile };
});

// Plastered and painted AAC: off-white, faint trowel texture (light colour = lower solar absorptance).
export const plaster = () => memo('plaster', () => {
  const tile = [2, 2], W = 512, H = 512, r = rng(23);
  const [c, x] = canvas(W, H), [b, y] = canvas(W, H);
  x.fillStyle = '#ece6da'; x.fillRect(0, 0, W, H); y.fillStyle = '#808080'; y.fillRect(0, 0, W, H);
  for (let i = 0; i < 260; i++) {
    const px = r() * W, py = r() * H, rad = 10 + r() * 40;
    const g = x.createRadialGradient(px, py, 0, px, py, rad);
    const tone = r() < 0.5 ? '255,255,255' : '160,140,110';
    g.addColorStop(0, `rgba(${tone},0.05)`); g.addColorStop(1, `rgba(${tone},0)`);
    x.fillStyle = g; x.fillRect(px - rad, py - rad, rad * 2, rad * 2);
  }
  noise(x, W, H, r, 12000, 0.05); noise(y, W, H, r, 20000, 0.25);
  return { map: toTexture(c, true, tile), bump: toTexture(b, false, tile), tile };
});

// Rammed earth: horizontal compaction layers 60–140 mm, ochre tones, speckled aggregate.
export const rammedEarth = () => memo('rammed', () => {
  const tile = [2, 1.2], W = 512, H = 308, r = rng(37);
  const [c, x] = canvas(W, H), [b, y] = canvas(W, H);
  let py = 0; const pxm = H / tile[1];
  while (py < H) {
    const th = (0.07 + r() * 0.11) * pxm, l = 52 + r() * 10;
    x.fillStyle = `hsl(${24 + r() * 10},${24 + r() * 12}%,${l}%)`; x.fillRect(0, py, W, th + 1);
    const g = Math.round(110 + r() * 60); y.fillStyle = `rgb(${g},${g},${g})`; y.fillRect(0, py, W, th + 1);
    x.fillStyle = 'rgba(70,40,20,0.10)'; x.fillRect(0, py + th - 1.5, W, 1.5);  // compaction line
    y.fillStyle = 'rgb(40,40,40)'; y.fillRect(0, py + th - 1.5, W, 1.5);
    py += th;
  }
  for (let i = 0; i < 2500; i++) {  // aggregate speckles
    const v = 70 + r() * 110; x.fillStyle = `rgba(${v},${v * 0.85},${v * 0.7},0.3)`;
    const s = 1 + r() * 2.5; x.fillRect(r() * W, r() * H, s, s);
  }
  return { map: toTexture(c, true, tile), bump: toTexture(b, false, tile), tile };
});

// Roof screed: grey concrete, or bright white cool-roof coating.
export const roofSurface = cool => memo('roof' + cool, () => {
  const tile = [3, 3], W = 512, H = 512, r = rng(cool ? 51 : 53);
  const [c, x] = canvas(W, H), [b, y] = canvas(W, H);
  x.fillStyle = cool ? '#f3f3ef' : '#9a958c'; x.fillRect(0, 0, W, H);
  y.fillStyle = '#808080'; y.fillRect(0, 0, W, H);
  for (let i = 0; i < 160; i++) {
    const px = r() * W, py = r() * H, rad = 20 + r() * 70, g = x.createRadialGradient(px, py, 0, px, py, rad);
    const a = cool ? 0.03 : 0.08;
    g.addColorStop(0, r() < 0.5 ? `rgba(0,0,0,${a})` : `rgba(255,255,255,${a})`); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(px - rad, py - rad, rad * 2, rad * 2);
  }
  noise(x, W, H, r, 16000, cool ? 0.04 : 0.1); noise(y, W, H, r, 20000, 0.3);
  return { map: toTexture(c, true, tile), bump: toTexture(b, false, tile), tile };
});

// Smooth painted concrete for chajjas, bands and copings.
export const paintedConcrete = () => memo('paint', () => {
  const tile = [2, 2], W = 256, H = 256, r = rng(61);
  const [c, x] = canvas(W, H);
  x.fillStyle = '#e4ded3'; x.fillRect(0, 0, W, H); noise(x, W, H, r, 4000, 0.06);
  return { map: toTexture(c, true, tile), bump: null, tile };
});

// Lawn grass for the ground.
export const grass = () => memo('grass', () => {
  const tile = [4, 4], W = 512, H = 512, r = rng(71);
  const [c, x] = canvas(W, H);
  x.fillStyle = '#6f9a48'; x.fillRect(0, 0, W, H);
  for (let i = 0; i < 26000; i++) {
    x.fillStyle = `hsla(${80 + r() * 30},${35 + r() * 25}%,${28 + r() * 22}%,0.55)`;
    x.fillRect(r() * W, r() * H, 1, 2 + r() * 4);
  }
  return { map: toTexture(c, true, tile), bump: null, tile };
});
