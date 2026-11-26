// Loads the pre-computed EnergyPlus table and looks up designs.
// Table layout (written by sim/export_table.py): one row per design, 16-bit integers,
// value = stored * scale[column]. Row number = mixed-radix index over the options, last option fastest.

export async function loadCity(id = 'blr') {
  const [meta, buf] = await Promise.all([
    fetch(`data/${id}.json`).then(r => { if (!r.ok) throw new Error(`data/${id}.json: ${r.status}`); return r.json(); }),
    fetch(`data/${id}.bin`).then(r => { if (!r.ok) throw new Error(`data/${id}.bin: ${r.status}`); return r.arrayBuffer(); }),
  ]);
  return new CityData(meta, buf);
}

export class CityData {
  constructor(meta, buf) {
    this.meta = meta;
    this.table = new Uint16Array(buf);
    this.ncol = meta.columns.length;
    if (this.table.length !== meta.rows * this.ncol) throw new Error('Table size does not match its metadata');
    this.col = Object.fromEntries(meta.columns.map((c, i) => [c, i]));
    this.options = meta.options;
    this.optionIds = meta.options.map(o => o.id);
    this.choiceIndex = Object.fromEntries(meta.options.map(o => [o.id, Object.fromEntries(o.choices.map((c, i) => [c.id, i]))]));
    this.missing = null;
    if (meta.missing_bitmask_b64) {
      const bin = atob(meta.missing_bitmask_b64);
      this.missing = Uint8Array.from(bin, ch => ch.charCodeAt(0));
    }
  }

  get complete() { return !this.missing; }

  rowOf(design) {
    let i = 0;
    for (const o of this.options) i = i * o.choices.length + this.choiceIndex[o.id][design[o.id]];
    return i;
  }

  designOf(row) {
    const picks = [];
    for (let k = this.options.length - 1; k >= 0; k--) {
      const o = this.options[k], n = o.choices.length;
      picks[k] = o.choices[row % n].id; row = Math.floor(row / n);
    }
    return Object.fromEntries(this.options.map((o, k) => [o.id, picks[k]]));
  }

  has(row) {
    if (!this.missing) return true;
    return !((this.missing[row >> 3] >> (7 - (row & 7))) & 1);  // numpy packbits is big-endian per byte
  }

  // Raw simulated values for one design, or null if not simulated yet.
  lookup(design) {
    const row = this.rowOf(design);
    if (!this.has(row)) return null;
    const base = row * this.ncol, s = this.meta.scales, t = this.table;
    const v = name => t[base + this.col[name]] * s[this.col[name]];
    const month = name => Array.from({ length: 12 }, (_, i) => v(`${name}_${i + 1}`));
    const facades = {};
    for (const f of ['end_a', 'side_a', 'end_b', 'side_b'])
      facades[f] = { wall: v(`${f}_wall`), windowSolar: v(`${f}_window_solar`), windowConduction: v(`${f}_window_conduction`) };
    return {
      row,
      coolingLoad: month('cooling_load'), heatingLoad: month('heating_load'), fans: month('fans'),
      comfort: v('comfort_pct'), tooHot: v('too_hot_pct'), peakKw: v('peak_cooling_kw'), maxIndoor: v('max_indoor_c'),
      gains: {
        windowsSolar: Object.values(facades).reduce((a, f) => a + f.windowSolar, 0),
        windowsConduction: Object.values(facades).reduce((a, f) => a + f.windowConduction, 0),
        walls: Object.values(facades).reduce((a, f) => a + f.wall, 0),
        roof: v('gain_roof'), air: v('gain_air'), people: v('gain_people'),
        lights: v('gain_lights'), equipment: v('gain_equipment'),
      },
      facades,
    };
  }

  facadesFor(design) {
    return this.meta.geometry.facades[`${design.orientation}|${design.wwr_ns}|${design.wwr_ew}`];
  }
}
