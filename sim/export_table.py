"""
Export simulation results into the compact table the game loads.

Usage:  python sim/export_table.py [--city blr] [--settings fast]

Writes
  game/data/<city>.bin    one row per design, 16-bit integers (scaled), row order = make_idf.index_of
  game/data/<city>.json   everything else: options, column names + scales, constants (lighting, plugs,
                          solar yield per kWp), facade areas, costs, game settings. Rows not simulated yet
                          are listed in "missing" so the game can say so.
"""
import argparse
import base64
import json
import sys
from pathlib import Path

import numpy as np

import inputs as I
from make_idf import BASE_DESIGN, CHOICES, OPTION_KEYS, building_geometry, design_from_index

GAME_DATA = I.ROOT.parent / "game" / "data"
FACADES = ["end_a", "side_a", "end_b", "side_b"]
MONTHLY = ["cooling_load", "heating_load", "fans"]
SCALARS = ["comfort_pct", "too_hot_pct", "peak_cooling_kw", "max_indoor_c"]
GAINS = ["roof", "air", "people", "lights", "equipment"]
FACADE_PARTS = ["wall", "window_solar", "window_conduction"]
COLUMNS = ([f"{m}_{i+1}" for m in MONTHLY for i in range(12)] + SCALARS + [f"gain_{g}" for g in GAINS]
           + [f"{f}_{p}" for f in FACADES for p in FACADE_PARTS])


def row_values(r: dict) -> list:
    v = [x for m in MONTHLY for x in r["monthly_kwh"][m]]
    v += [r[s] for s in SCALARS]
    v += [r["heat_gains_kwh"][g] for g in GAINS]
    v += [r["facade_gains_kwh"][f][p] for f in FACADES for p in FACADE_PARTS]
    return v


def solar_yield_per_kwp() -> list:
    """Monthly kWh per kWp for the configured tilt/azimuth, using the same weather file (pvlib)."""
    import pvlib
    s = I.SOLAR_PV
    df, meta = pvlib.iotools.read_epw(str(I.CITY["weather_file"]))
    loc = pvlib.location.Location(meta["latitude"], meta["longitude"], altitude=meta["altitude"])  # times carry the tz
    times = df.index - np.timedelta64(30, "m")  # EPW values describe the hour ending at the timestamp
    sp = loc.get_solarposition(times)
    poa = pvlib.irradiance.get_total_irradiance(
        s["tilt_deg"], s["azimuth_deg"], sp["apparent_zenith"].values, sp["azimuth"].values,
        dni=df["dni"].values, ghi=df["ghi"].values, dhi=df["dhi"].values,
        dni_extra=pvlib.irradiance.get_extra_radiation(times).values, model="haydavies")
    poa_wh = np.nan_to_num(np.asarray(poa["poa_global"]))
    months = df.index.month.values
    return [round(float(poa_wh[months == m].sum()) / 1000 * s["performance_ratio"], 1) for m in range(1, 13)]


def option_details() -> dict:
    """Short technical notes shown under each choice in the game."""
    d = {}
    for k, v in I.WALLS.items():
        d[f"wall.{k}"] = f"U ≈ {I.u_value(v['layers']):.1f} W/m²K · {v['look']}"
    for k, v in I.ROOFS.items():
        d[f"roof.{k}"] = f"U ≈ {I.u_value(v['layers'], 0.14):.1f} W/m²K"
    for k, v in I.ROOF_FINISHES.items():
        d[f"roof_finish.{k}"] = f"absorbs {round(v['solar_absorptance']*100)}% of sunlight"
    for k, v in I.GLAZING.items():
        d[f"glazing.{k}"] = f"U {v['u']} · SHGC {v['shgc']} · light {round(v['vt']*100)}%"
    for k, v in I.COOLING.items():
        d[f"cooling.{k}"] = v["vent"]
    for k, v in I.LIGHTING.items():
        d[f"lighting.{k}"] = f"{v['w_per_m2']} W/m²"
    d["shading.overhang"] = f"{I.SHADING['overhang']['depth_m']*1000:.0f} mm chajja above every window"
    d["shading.louvres"] = f"{I.SHADING['louvres']['slat_count']} horizontal slats in front of every window"
    return d


def facade_table() -> dict:
    """Window and wall areas per facade for every orientation + window-ratio combination."""
    out = {}
    for o in CHOICES["orientation"]:
        for a in CHOICES["wwr_ns"]:
            for b in CHOICES["wwr_ew"]:
                geo = building_geometry({**BASE_DESIGN, "orientation": o, "wwr_ns": a, "wwr_ew": b})
                out[f"{o}|{a}|{b}"] = [{"name": f["name"], "kind": f["kind"], "compass": f["compass"],
                                        "azimuth": f["azimuth"], "length": round(f["length"], 3), "wwr": f["wwr"],
                                        "wwr_group": f["wwr_group"], "window_area": f["window_area"],
                                        "windows_per_floor": len(f["windows"]) // I.GEOMETRY["floors"]}
                                       for f in geo["facades"]]
    return out


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser()
    ap.add_argument("--city", default=I.CITY["id"])
    ap.add_argument("--settings", default="fast")
    a = ap.parse_args()
    # Main batch + the task-3 test batch (same settings, so the rows are interchangeable)
    sources = [I.ROOT / "runs" / f"{a.city}_{a.settings}{sfx}" / "results.jsonl" for sfx in ("", "_test")]
    total = I.combination_count()

    data = np.full((total, len(COLUMNS)), np.nan, dtype=np.float64)
    lighting, plugs = {}, None
    for src in (p for p in sources if p.exists()):
        with open(src, encoding="utf-8") as f:
            for line in f:
                if not line.strip():
                    continue
                r = json.loads(line)
                data[r["row"]] = row_values(r)
                lighting.setdefault(r["design"]["lighting"], r["monthly_kwh"]["lighting"])
                plugs = plugs or r["monthly_kwh"]["plugs"]
    done = ~np.isnan(data[:, 0])
    n_done = int(done.sum())
    if n_done == 0:
        sys.exit("No results yet.")

    # Scale each column to 0..65535 (value = stored * scale). Errors are below 0.002% of each column's maximum.
    maxima = np.nanmax(np.abs(data), axis=0)
    if np.nanmin(data) < 0:
        sys.exit("Unexpected negative value in results; check the simulation.")
    scales = np.where(maxima > 0, maxima / 65535, 1.0)
    packed = np.zeros_like(data, dtype=np.uint16)
    packed[done] = np.round(data[done] / scales).astype(np.uint16)

    GAME_DATA.mkdir(parents=True, exist_ok=True)
    bin_path, json_path = GAME_DATA / f"{a.city}.bin", GAME_DATA / f"{a.city}.json"
    packed.astype("<u2").tofile(bin_path)

    missing = None
    if n_done < total:
        missing = base64.b64encode(np.packbits(~done).tobytes()).decode()

    g = I.GEOMETRY
    roof_area = g["length_m"] * g["width_m"]
    meta = {
        "version": 1,
        "city": {k: (str(v) if isinstance(v, Path) else v) for k, v in I.CITY.items() if k != "weather_file"},
        "weather_file": I.CITY["weather_file"].name,
        "rows": total, "rows_done": n_done, "missing_bitmask_b64": missing,
        "options": [{"id": k, "label": label, "choices": [{"id": c, "label": t} for c, t in ch.items()]}
                    for k, label, ch in I.OPTIONS],
        "option_details": option_details(),
        "base_design": BASE_DESIGN,
        "columns": COLUMNS, "scales": [float(s) for s in scales],
        "constants": {
            "lighting_kwh_monthly": lighting, "plugs_kwh_monthly": plugs,
            "solar_kwh_per_kwp_monthly": solar_yield_per_kwp(),
        },
        "geometry": {"length": g["length_m"], "width": round(g["width_m"], 4), "floors": g["floors"],
                     "floor_to_floor": g["floor_to_floor_m"], "floor_area": g["floor_area_total_m2"],
                     "roof_area": round(roof_area, 2), "window_height": g["window_height_m"],
                     "window_sill": g["window_sill_m"], "plinth": g["plinth_height_m"], "parapet": g["parapet_height_m"],
                     "facades": facade_table()},
        "economics": {"costs": I.COSTS, "ac_efficiency": {k: v for k, v in I.AC_EFFICIENCY.items() if k != "source"},
                      "solar": I.SOLAR_PV, "tariff_rs_per_kwh": I.TARIFF["flat_rs_per_kwh"],
                      "grid_kg_co2_per_kwh": I.GRID_EMISSION_KG_PER_KWH, "fans": I.FANS},
        "cooling_modes": {k: {"ac": v["ac"], "fans": v["fans"]} for k, v in I.COOLING.items()},
        # Placeholder level settings; final values are set in task 5 from the full results.
        "level": {"title": "A family home in Bengaluru", "budget_rs": 800000, "eui_target": 40, "comfort_target": 90,
                  "simulations": 8,
                  "brief": "A two-storey home for a family of four. The developer's draft is a glassy box with "
                           "AC everywhere. Make it net zero and comfortable without blowing the budget."},
    }
    json_path.write_text(json.dumps(meta, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"Exported {n_done:,} of {total:,} designs ({100*n_done/total:.1f}%)")
    print(f"  {bin_path}  {bin_path.stat().st_size/1e6:.2f} MB")
    print(f"  {json_path}  {json_path.stat().st_size/1e3:.0f} kB")
    print(f"  Solar yield: {sum(meta['constants']['solar_kwh_per_kwp_monthly']):,.0f} kWh per kWp per year")


if __name__ == "__main__":
    main()
