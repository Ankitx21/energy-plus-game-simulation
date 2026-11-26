// Sun controls under the 3D view: month, time of day, "play the day", and a readout.
import { MONTHS, DAY_OF_MONTH, sunPosition, sunTimes, sunPath, fmtClock, compassName } from './sun.js';

export function sunControlsHTML() {
  return `<div class="sunbar" id="sunbar">
    <label class="sr" for="smonth">Month</label>
    <select id="smonth">${MONTHS.map((m, i) => `<option value="${i + 1}">${DAY_OF_MONTH} ${m}</option>`).join('')}</select>
    <button class="splay" id="splay" aria-label="Play the day from sunrise to sunset">▶ Play the day</button>
    <input type="range" id="stime" min="5" max="19.5" step="0.0833" aria-label="Time of day">
    <span class="sread" id="sread" aria-live="polite"></span>
    <div class="shread" id="shread" aria-live="polite"></div>
    <div class="vrow" role="group" aria-label="Camera views">
      ${[['street', 'Street'], ['aerial', 'Aerial'], ['north', 'N'], ['east', 'E'], ['south', 'S'], ['west', 'W']]
        .map(([k, t]) => `<button class="vbtn" data-view="${k}" aria-label="${k} view">${t}</button>`).join('')}
      <span class="vsep" aria-hidden="true"></span>
      <button class="vbtn ov" data-ov="arrows" aria-pressed="false">Heat arrows</button>
      <button class="vbtn ov" data-ov="heatmap" aria-pressed="false">Heat map</button>
      <button class="vbtn ov" data-ov="shadow" aria-pressed="true">Shadow %</button>
      <label class="qual">Quality <select id="squal">
        <option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></label>
    </div>
  </div>`;
}

export function attachSunControls(root, scene, site, { month = 5, hour = 12.5, onChange } = {}) {
  const $ = q => root.querySelector(q);
  const st = { month, hour, playing: false, raf: 0 };
  const sel = $('#smonth'), rng = $('#stime'), btn = $('#splay'), out = $('#sread');
  sel.value = month; rng.value = hour;

  function apply() {
    const p = sunPosition(st.month, DAY_OF_MONTH, st.hour, site);
    scene.setSun(p.azimuth, p.elevation);
    rng.value = st.hour;
    out.textContent = `${fmtClock(st.hour)} · ` + (p.elevation > 0
      ? `sun ${Math.round(p.elevation)}° up, in the ${compassName(p.azimuth)}`
      : 'sun below the horizon');
    onChange?.(st, p);
  }
  function setMonth(m) {
    st.month = m;
    scene.setSunPath(sunPath(m, DAY_OF_MONTH, site));
    apply();
  }
  function stop() { st.playing = false; cancelAnimationFrame(st.raf); btn.textContent = '▶ Play the day'; }
  function play() {
    const { sunrise, sunset } = sunTimes(st.month, DAY_OF_MONTH, site);
    const from = sunrise - 0.4, to = sunset + 0.5, seconds = matchMedia('(prefers-reduced-motion: reduce)').matches ? 30 : 14;
    if (st.hour < from || st.hour >= to - 0.05) st.hour = from;
    st.playing = true; btn.textContent = '❚❚ Pause';
    let last = performance.now();
    const tick = now => {
      if (!st.playing) return;
      st.hour = Math.min(to, st.hour + (now - last) / 1000 * (to - from) / seconds); last = now;
      apply();
      if (st.hour >= to) { stop(); return; }
      st.raf = requestAnimationFrame(tick);
    };
    st.raf = requestAnimationFrame(tick);
  }
  sel.onchange = () => setMonth(+sel.value);
  rng.oninput = () => { stop(); st.hour = +rng.value; apply(); };
  btn.onclick = () => (st.playing ? stop() : play());
  setMonth(month);
  return { state: st, stop, setMonth, setHour: h => { st.hour = h; apply(); } };
}

// Camera preset buttons and the quality selector (stored per browser)
export function attachViewControls(root, scene) {
  root.querySelectorAll('[data-view]').forEach(b => b.onclick = () => scene.setView(b.dataset.view));
  const q = root.querySelector('#squal');
  q.value = scene.quality;
  q.onchange = () => { scene.setQuality(q.value); try { localStorage.setItem('nzb-quality', q.value); } catch (e) { /* ignore */ } };
}
export function savedQuality() { try { return localStorage.getItem('nzb-quality') || undefined; } catch (e) { return undefined; } }

// Overlay toggles (heat arrows, heat map, shadow %) and the readouts that go with them
export function attachOverlayControls(root, scene, onToggle) {
  const state = { arrows: false, heatmap: false, shadow: true };
  root.querySelectorAll('[data-ov]').forEach(b => b.onclick = () => {
    state[b.dataset.ov] = !state[b.dataset.ov];
    b.setAttribute('aria-pressed', state[b.dataset.ov]);
    scene.setOverlays(state); onToggle?.(state);
  });
  scene.setOverlays(state); onToggle?.(state);
  return state;
}

export function renderShadowReadout(el, sh) {
  if (!el) return;
  if (!sh) { el.innerHTML = ''; el.hidden = true; return; }
  el.hidden = false;
  if (sh.night) { el.innerHTML = '<b>Windows in shadow:</b> sun is down'; return; }
  const parts = Object.values(sh.byFacade).map(f => `<span class="${f.facingAway ? 'away' : ''}" title="${f.facingAway ? 'sun is behind this wall' : ''}">${f.compass} ${Math.round(f.pct)}%</span>`);
  el.innerHTML = `<b>Windows in shadow: ${Math.round(sh.pct)}%</b> <span class="mut">·</span> ${parts.join(' ')}`;
}
