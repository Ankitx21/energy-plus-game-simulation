// three.js scene: the simulated house, built from the exact geometry exported by sim/export_table.py.
// Golden rule: walls, windows and shading devices use the simulated numbers; decorative parts
// (plinth, sills, frames, parapet coping, panel mounts) never shade the windows.
import * as THREE from 'three';
import { OrbitControls } from '../vendor/OrbitControls.js';
import { RoomEnvironment } from '../vendor/RoomEnvironment.js';
import * as TX from './textures.js';

// Simulation world (x east, y north, z up) -> three.js (x east, y up, z south)
const V = (x, y, z) => new THREE.Vector3(x, z, -y);

export function webglAvailable() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); }
  catch (e) { return false; }
}

function scaleUV(geom, sx, sy) {
  const uv = geom.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * sx, uv.getY(i) * sy);
  return geom;
}

function textSprite(text, { size = 1, color = '#1d1a17', bg = 'rgba(255,255,255,0.85)' } = {}) {
  const c = document.createElement('canvas'), x = c.getContext('2d'), fs = 64;
  x.font = `700 ${fs}px Archivo, system-ui, sans-serif`;
  const w = Math.ceil(x.measureText(text).width) + 40;
  c.width = w; c.height = fs + 28;
  x.font = `700 ${fs}px Archivo, system-ui, sans-serif`;
  x.fillStyle = bg; x.beginPath(); x.roundRect(0, 0, w, c.height, 22); x.fill();
  x.fillStyle = color; x.textBaseline = 'middle'; x.fillText(text, 20, c.height / 2 + 2);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthWrite: false }));
  s.scale.set(size * w / c.height, size, 1);
  return s;
}

function solarPanelTexture() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = '#c9ced6'; x.fillRect(0, 0, 128, 256);           // aluminium frame
  x.fillStyle = '#16264a'; x.fillRect(4, 4, 120, 248);
  for (let i = 0; i < 6; i++) for (let j = 0; j < 10; j++) {     // 6 x 10 cells
    x.fillStyle = (i + j) % 2 ? '#1d3363' : '#1a2e5a';
    x.fillRect(6 + i * 19.6, 6 + j * 24.4, 18.4, 23.2);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

export function createScene(container, meta, opts = {}) {
  const geo = meta.geometry;
  let needs = true, raf = 0, disposed = false;
  function requestRender() { needs = true; }
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: !!opts.preserveDrawingBuffer });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.domElement.style.display = 'block';
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;

  const camera = new THREE.PerspectiveCamera(38, 1, 0.3, 500);
  camera.position.set(15.5, 10, 17.5);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 3, 0);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.minDistance = 7; controls.maxDistance = 75;

  // Sky dome: vertical gradient whose colours follow the sun's height (night, dawn/dusk, day)
  const skyUniforms = { top: { value: new THREE.Color() }, horizon: { value: new THREE.Color() },
                        glowDir: { value: new THREE.Vector3(0, 1, 0) }, glow: { value: new THREE.Color() } };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(300, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyUniforms,
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: [
      'uniform vec3 top; uniform vec3 horizon; uniform vec3 glow; uniform vec3 glowDir; varying vec3 vDir;',
      'void main(){ float h = max(vDir.y, 0.0); vec3 c = mix(horizon, top, pow(h, 0.55));',
      '  float g = pow(max(dot(normalize(vDir), glowDir), 0.0), 8.0) * (1.0 - h * 0.6);',
      '  gl_FragColor = vec4(c + glow * g, 1.0); }'].join('\n'),
  }));
  scene.add(sky);
  scene.fog = new THREE.Fog('#d6e8f5', 70, 200);

  // Lights: sky light + the sun (positioned from the real sun position by setSun)
  const hemi = new THREE.HemisphereLight('#dfeaff', '#8a7a5c', 0.85);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff3df', 2.4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 100 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);

  // Visible sun disc, the day's path arc with hour marks, and the current position on it
  const ARC_R = 24, SUN_R = 250;
  const glowTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
    const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,250,225,1)'); g.addColorStop(0.18, 'rgba(255,236,170,1)');
    g.addColorStop(0.35, 'rgba(255,214,120,0.45)'); g.addColorStop(1, 'rgba(255,200,100,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const sunDisc = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, depthWrite: false, fog: false, transparent: true }));
  sunDisc.scale.set(46, 46, 1); scene.add(sunDisc);
  const pathGroup = new THREE.Group(); scene.add(pathGroup);
  const marker = new THREE.Mesh(new THREE.SphereGeometry(0.45, 20, 12), new THREE.MeshBasicMaterial({ color: '#ffc233', fog: false }));
  scene.add(marker);
  const dirOf = (az, el) => {
    const a = THREE.MathUtils.degToRad(az), e = THREE.MathUtils.degToRad(el);
    return V(Math.sin(a) * Math.cos(e), Math.cos(a) * Math.cos(e), Math.sin(e));
  };

  function setSunPath(points) {  // points: [{t, azimuth, elevation}] from sun.js
    pathGroup.traverse(o => { o.geometry?.dispose(); if (o.material?.map) o.material.map.dispose(); });
    pathGroup.clear();
    const pts = points.map(p => dirOf(p.azimuth, Math.max(p.elevation, 0)).multiplyScalar(ARC_R));
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineDashedMaterial({ color: '#ffb000', dashSize: 0.6, gapSize: 0.35, fog: false }));
    line.computeLineDistances(); pathGroup.add(line);
    for (let h = Math.ceil(points[0].t); h <= Math.floor(points[points.length - 1].t); h++) {
      const p = points.reduce((b, q) => Math.abs(q.t - h) < Math.abs(b.t - h) ? q : b);
      if (p.elevation < 2) continue;
      const pos = dirOf(p.azimuth, p.elevation).multiplyScalar(ARC_R);
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 6), new THREE.MeshBasicMaterial({ color: '#ffb000', fog: false }));
      dot.position.copy(pos); pathGroup.add(dot);
      if (h % 3 === 0) {
        const lab = textSprite(`${h}:00`, { size: 0.7, color: '#7a4b00', bg: 'rgba(255,248,230,0.9)' });
        lab.position.copy(pos).add(new THREE.Vector3(0, 0.9, 0)); pathGroup.add(lab);
      }
    }
    requestRender();
  }

  const C = (a, b, t) => new THREE.Color(a).lerp(new THREE.Color(b), Math.min(1, Math.max(0, t)));
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  let sunState = { azimuth: 150, elevation: 55 };
  function setSun(azimuthDeg, elevationDeg) {
    sunState = { azimuth: azimuthDeg, elevation: elevationDeg };
    const dir = dirOf(azimuthDeg, elevationDeg), e = elevationDeg;
    sun.position.copy(dir).multiplyScalar(60);
    const day = smooth(-1, 12, e), golden = 1 - smooth(4, 25, e);
    sun.intensity = 3.6 * smooth(-0.5, 8, e);
    sun.color.copy(C('#fff3df', '#ffb070', golden));
    sun.castShadow = e > 0;
    hemi.intensity = 0.1 + 0.42 * smooth(-10, 20, e);
    hemi.color.copy(C('#4a5a85', '#dfeaff', day));
    const tw = smooth(-8, 2, e), dy = smooth(2, 18, e);   // night -> twilight -> day
    skyUniforms.top.value.copy(C('#0a1330', '#33508f', tw)).lerp(new THREE.Color('#4f9be0'), dy);
    skyUniforms.horizon.value.copy(C('#1b2747', '#f2a273', tw)).lerp(new THREE.Color('#cfe5f6'), dy);
    skyUniforms.glow.value.copy(C('#000000', '#ff9c50', tw * (1 - dy * 0.85)));
    skyUniforms.glowDir.value.copy(dir);
    scene.fog.color.copy(skyUniforms.horizon.value);
    scene.environmentIntensity = 0.1 + 0.22 * day;
    sunDisc.position.copy(dir).multiplyScalar(SUN_R); sunDisc.visible = e > -1;
    sunDisc.material.color.copy(C('#ffffff', '#ffb070', golden));
    marker.position.copy(dirOf(azimuthDeg, Math.max(e, 0)).multiplyScalar(ARC_R)); marker.visible = e > -0.5;
    const night = 1 - smooth(-4, 3, e);   // interior lights glow through the windows after dark
    for (const k of ['glass_true', 'glass_false']) if (mats[k]) { mats[k].emissive.set('#ffcf8a'); mats[k].emissiveIntensity = 0.55 * night; }
    requestRender();
  }

  // Ground
  const grassTx = TX.grass();
  const ground = new THREE.Mesh(scaleUV(new THREE.PlaneGeometry(160, 160), 160, 160),
    new THREE.MeshStandardMaterial({ map: grassTx.map, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
  scene.add(ground);

  // Shared materials
  const mats = {};
  const wallMat = key => mats['wall_' + key] ||= (() => {
    const t = key === 'brick' ? TX.brick() : key === 'aac' ? TX.plaster() : TX.rammedEarth();
    return new THREE.MeshStandardMaterial({ map: t.map, bumpMap: t.bump, bumpScale: key === 'aac' ? 0.6 : 1.6, roughness: 0.92 });
  })();
  const roofMat = cool => mats['roof_' + cool] ||= (() => {
    const t = TX.roofSurface(cool);
    return new THREE.MeshStandardMaterial({ map: t.map, bumpMap: t.bump, bumpScale: 0.8, roughness: cool ? 0.6 : 0.95 });
  })();
  const paint = mats.paint = new THREE.MeshStandardMaterial({ map: TX.paintedConcrete().map, roughness: 0.85 });
  const interior = mats.interior = new THREE.MeshStandardMaterial({ color: '#8f877c', roughness: 0.95 });
  const floorMat = mats.floor = new THREE.MeshStandardMaterial({ color: '#8a7d6c', roughness: 0.7 });
  const plinthMat = mats.plinth = new THREE.MeshStandardMaterial({ color: '#7d756b', roughness: 0.9 });
  const frameMat = mats.frame = new THREE.MeshStandardMaterial({ color: '#3b3f44', roughness: 0.45, metalness: 0.5 });
  const sillMat = mats.sill = new THREE.MeshStandardMaterial({ color: '#5d5a56', roughness: 0.35, metalness: 0.1 });
  const louvreMat = mats.louvre = new THREE.MeshStandardMaterial({ color: '#9aa1a8', roughness: 0.4, metalness: 0.6 });
  const glassMat = lowe => mats['glass_' + lowe] ||= new THREE.MeshPhysicalMaterial({
    color: lowe ? '#8fb3bd' : '#d8ebf1', metalness: 0, roughness: 0.06, transparent: true,
    opacity: lowe ? 0.78 : 0.6, envMapIntensity: lowe ? 1.4 : 0.9, side: THREE.DoubleSide });
  const panelMat = mats.panel = new THREE.MeshStandardMaterial({ map: solarPanelTexture(), roughness: 0.25, metalness: 0.3 });
  const mountMat = mats.mount = new THREE.MeshStandardMaterial({ color: '#a7adb3', roughness: 0.5, metalness: 0.6 });

  const building = new THREE.Group();
  scene.add(building);

  const add = (parent, geom, mat, { cast = true, receive = true } = {}) => {
    const m = new THREE.Mesh(geom, mat); m.castShadow = cast; m.receiveShadow = receive; parent.add(m); return m;
  };
  const box = (parent, w, h, d, mat, x, y, z, o) => { const m = add(parent, new THREE.BoxGeometry(w, h, d), mat, o); m.position.set(x, y, z); return m; };

  function clear() {
    building.traverse(o => { if (o.isMesh || o.isSprite) { o.geometry?.dispose(); if (o.isSprite) { o.material.map?.dispose(); o.material.dispose(); } } });
    building.clear();
  }

  let lastKey = '';
  function update(design) {
    const key = JSON.stringify(design);
    if (key === lastKey) return;
    lastKey = key;
    clear();
    const facades = geo.facades[`${design.orientation}|${design.wwr_ns}|${design.wwr_ew}`];
    const th = geo.wall_thickness[design.wall];
    const H = geo.floors * geo.floor_to_floor, par = geo.parapet;
    const Wd = geo.width, Ld = geo.length, bearing = geo.bearing[design.orientation];
    const wm = wallMat(design.wall);
    const sh = geo.shading[design.shading];

    // --- walls with window openings, one per facade, in facade-local coordinates ---
    for (const f of facades) {
      const t3 = new THREE.Vector3(f.t[0], 0, -f.t[1]), n3 = new THREE.Vector3(f.n[0], 0, -f.n[1]);
      const basis = new THREE.Matrix4().makeBasis(t3, new THREE.Vector3(0, 1, 0), n3).setPosition(V(f.A[0], f.A[1], 0));
      const g = new THREE.Group(); g.matrixAutoUpdate = false; g.matrix.copy(basis); building.add(g);
      // Wall starts `th` along so corners don't overlap the neighbouring wall (no flicker)
      const s = new THREE.Shape();
      s.moveTo(th, 0); s.lineTo(f.length, 0); s.lineTo(f.length, H + par); s.lineTo(th, H + par); s.closePath();
      for (const [x0, z0, w, h] of f.windows) {
        const hole = new THREE.Path();
        hole.moveTo(x0, z0); hole.lineTo(x0, z0 + h); hole.lineTo(x0 + w, z0 + h); hole.lineTo(x0 + w, z0); hole.closePath();
        s.holes.push(hole);
      }
      const wg = new THREE.ExtrudeGeometry(s, { depth: th, bevelEnabled: false });
      wg.translate(0, 0, -th);
      add(g, wg, wm);  // same material on faces, ends and window reveals
      // floor band between storeys (flush, colour only)
      box(g, f.length - th, 0.14, 0.004, paint, (f.length + th) / 2, geo.floor_to_floor, 0.002, { cast: false });

      for (const [x0, z0, w, h] of f.windows) {
        const cx = x0 + w / 2, inset = -0.07;
        const gl = add(g, new THREE.PlaneGeometry(w, h), glassMat(design.glazing === 'double_lowe'), { cast: false });
        gl.position.set(cx, z0 + h / 2, inset); gl.userData.kind = 'glass';
        const fw = 0.05, fd = 0.06;  // frame profile
        box(g, w, fw, fd, frameMat, cx, z0 + fw / 2, inset, { cast: false });
        box(g, w, fw, fd, frameMat, cx, z0 + h - fw / 2, inset, { cast: false });
        box(g, fw, h, fd, frameMat, x0 + fw / 2, z0 + h / 2, inset, { cast: false });
        box(g, fw, h, fd, frameMat, x0 + w - fw / 2, z0 + h / 2, inset, { cast: false });
        const panes = Math.max(2, Math.round(w / 1.1));
        for (let k = 1; k < panes; k++) box(g, 0.035, h, fd, frameMat, x0 + w * k / panes, z0 + h / 2, inset, { cast: false });
        box(g, w + 0.1, 0.035, th + 0.05, sillMat, cx, z0 - 0.0175, -(th - 0.05) / 2, { cast: false });  // stone sill
        const head = z0 + h;
        if (design.shading === 'overhang') {  // simulated plane at head + height_above_head; slab sits on top of it
          const e = sh.side_extension_m, d = sh.depth_m, zb = head + sh.height_above_head_m;
          box(g, w + 2 * e, 0.08, d, paint, cx, zb + 0.04, d / 2).userData.kind = 'overhang';
        } else if (design.shading === 'louvres') {
          const e = sh.side_extension_m, d = sh.slat_depth_m, off = sh.offset_from_wall_m, n = sh.slat_count;
          for (let k = 0; k < n; k++) box(g, w + 2 * e, 0.022, d, louvreMat, cx, head - k * h / n, off + d / 2).userData.kind = 'louvre';
          const zTop = head, zBot = head - (n - 1) * h / n;
          for (const xr of [x0 - e + 0.012, x0 + w + e - 0.012]) box(g, 0.024, zTop - zBot, 0.024, louvreMat, xr, (zTop + zBot) / 2, off + d / 2, { cast: false });
        }
      }
      // facade label on the ground
      const lab = textSprite(`${f.compass} · ${Math.round(f.wwr * 100)}% glass`, { size: 0.75 });
      lab.position.copy(V(f.A[0] + f.t[0] * f.length / 2 + f.n[0] * 3.2, f.A[1] + f.t[1] * f.length / 2 + f.n[1] * 3.2, 0.5));
      building.add(lab);
    }

    // --- building-local parts: rotate with the house (three.js rotation.y = -bearing) ---
    const L = new THREE.Group(); L.rotation.y = -THREE.MathUtils.degToRad(bearing); building.add(L);
    // local axes: x = across the width, three z = -(along the length); end_b is at local +y = three -z
    const iw = Wd - 2 * th, il = Ld - 2 * th;
    box(L, Wd + 0.08, geo.plinth, Ld + 0.08, plinthMat, 0, geo.plinth / 2, 0, { cast: false });
    const rt = geo.roof_thickness[design.roof];
    const rm = roofMat(design.roof_finish === 'cool');
    box(L, iw, rt, il, [interior, interior, rm, interior, interior, interior], 0, H - rt / 2, 0);
    box(L, iw, 0.15, il, [interior, interior, floorMat, interior, interior, interior], 0, geo.floor_to_floor - 0.075, 0, { cast: false });
    const gf = add(L, new THREE.PlaneGeometry(iw, il), floorMat, { cast: false });
    gf.rotation.x = -Math.PI / 2; gf.position.y = 0.01;
    const cy = H + par + 0.03;  // parapet coping
    box(L, th + 0.06, 0.06, Ld + 0.06, paint, Wd / 2 - th / 2, cy, 0);
    box(L, th + 0.06, 0.06, Ld + 0.06, paint, -Wd / 2 + th / 2, cy, 0);
    box(L, Wd + 0.06, 0.06, th + 0.06, paint, 0, cy, Ld / 2 - th / 2);
    box(L, Wd + 0.06, 0.06, th + 0.06, paint, 0, cy, -Ld / 2 + th / 2);

    // --- solar panels: 30-panel layout (= 12 kWp), tilted towards the side facing closest to south ---
    const sol = meta.economics.solar, [pw, pl] = sol.panel_size_m;
    const kwpMax = geo.roof_area * sol.usable_roof_fraction * sol.kwp_per_m2;
    const nPanels = Math.round(kwpMax * design.pv / 100 / sol.panel_kwp);
    if (nPanels > 0) {
      const south = facades.reduce((b, f) => {
        const d = Math.abs(((f.azimuth - 180 + 540) % 360) - 180);
        return d < b.d ? { f, d } : b;
      }, { d: 1e9 }).f.name;
      // usable region (local x, local y): inside parapet setback, the end_b end kept for mumty + tank
      const x0 = -Wd / 2 + 0.5, x1 = Wd / 2 - 0.5, y0 = -Ld / 2 + 0.5, y1 = Ld / 2 - 0.5 - 3.6;
      const tilt = THREE.MathUtils.degToRad(sol.tilt_deg), along = pl * Math.cos(tilt);
      const tiltAlongY = south === 'end_a' || south === 'end_b';
      const dirSign = { end_a: -1, end_b: 1, side_a: 1, side_b: -1 }[south];  // which way the panel faces
      const cols = tiltAlongY ? Math.floor((x1 - x0) / pw) : Math.floor((x1 - x0) / along);
      const rows = tiltAlongY ? Math.floor((y1 - y0) / along) : Math.floor((y1 - y0) / pw);
      const cw = tiltAlongY ? pw : along, rh = tiltAlongY ? along : pw;
      const ox = x0 + ((x1 - x0) - cols * cw) / 2, oy = y0 + ((y1 - y0) - rows * rh) / 2;
      let placed = 0;
      for (let r = 0; r < rows && placed < nPanels; r++) for (let c = 0; c < cols && placed < nPanels; c++, placed++) {
        const px = ox + (c + 0.5) * cw, py = oy + (r + 0.5) * rh, base = H + 0.3 + pl * Math.sin(tilt) / 2;
        const p = add(L, new THREE.BoxGeometry(pw, 0.035, pl), [mountMat, mountMat, panelMat, mountMat, mountMat, mountMat]);
        p.position.set(px, base, -py);
        if (tiltAlongY) p.rotation.x = dirSign * tilt;      // faces local -y (end_a) or +y (end_b)
        else { p.rotation.y = Math.PI / 2; p.rotation.x = -dirSign * tilt; }
        box(L, 0.05, 0.3 + pl * Math.sin(tilt) / 2, 0.05, mountMat, px, H + (0.3 + pl * Math.sin(tilt) / 2) / 2, -py, { cast: false });
      }
    }
    requestRender();
  }

  // Compass rose on the ground around the house
  const compass = (() => {
    const N = 1024, c = document.createElement('canvas'); c.width = c.height = N;
    const x = c.getContext('2d'), m = N / 2, R = N * 0.47;
    x.strokeStyle = 'rgba(255,255,255,0.85)'; x.lineWidth = 6; x.beginPath(); x.arc(m, m, R, 0, Math.PI * 2); x.stroke();
    x.lineWidth = 3; x.beginPath(); x.arc(m, m, R * 0.93, 0, Math.PI * 2); x.stroke();
    for (let a = 0; a < 360; a += 15) {
      const r = THREE.MathUtils.degToRad(a), l = a % 90 === 0 ? 0.86 : a % 45 === 0 ? 0.89 : 0.91;
      x.lineWidth = a % 45 === 0 ? 6 : 3;
      x.beginPath(); x.moveTo(m + Math.sin(r) * R * l, m - Math.cos(r) * R * l);
      x.lineTo(m + Math.sin(r) * R * 0.93, m - Math.cos(r) * R * 0.93); x.stroke();
    }
    x.font = '800 54px Archivo, system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    for (const [t, a] of [['N', 0], ['E', 90], ['S', 180], ['W', 270]]) {
      const r = THREE.MathUtils.degToRad(a);
      x.fillStyle = t === 'N' ? '#d9480f' : 'rgba(255,255,255,0.95)';
      x.fillText(t, m + Math.sin(r) * R * 0.78, m - Math.cos(r) * R * 0.78);
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(30, 30),
      new THREE.MeshStandardMaterial({ map: t, transparent: true, depthWrite: false, roughness: 1 }));
    mesh.rotation.x = -Math.PI / 2; mesh.position.y = 0.02; mesh.receiveShadow = true;
    return mesh;
  })();
  scene.add(compass);
  setSun(sunState.azimuth, sunState.elevation);

  // Render on demand
  controls.addEventListener('change', requestRender);
  function loop() {
    if (disposed) return;
    raf = requestAnimationFrame(loop);
    const moved = controls.update();
    if (needs || moved) { renderer.render(scene, camera); needs = false; }
  }
  function resize() {
    const w = container.clientWidth || 600, h = container.clientHeight || 400;
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = '100%'; renderer.domElement.style.height = '100%';
    camera.aspect = w / h; camera.updateProjectionMatrix(); requestRender();
  }
  const ro = new ResizeObserver(resize); ro.observe(container); resize();
  loop();

  return {
    update, setSun, setSunPath, requestRender, get sunState() { return sunState; }, camera, controls, renderer, scene,
    renderNow() { controls.update(); renderer.render(scene, camera); },
    dispose() { disposed = true; cancelAnimationFrame(raf); ro.disconnect(); clear(); renderer.dispose(); container.removeChild(renderer.domElement); },
  };
}
