"""
Run ONE design through EnergyPlus and turn the raw output into the numbers the game needs.

Usage:
  python sim/simulate.py                       # developer's draft (base design)
  python sim/simulate.py --row 1234            # any row of the table
  python sim/simulate.py shading=overhang cooling=nv   # base design with changes
  add --keep to keep the EnergyPlus files in sim/sample/<row>/

run_design() is also used by run_batch.py for the full batch.
"""
import json
import shutil
import sqlite3
import subprocess
import sys
import time
from pathlib import Path

import inputs as I
from epw import DAYS_IN_MONTH, running_mean_by_day
from make_idf import BASE_DESIGN, CHOICES, building_geometry, design_from_index, index_of, make_idf

ENERGYPLUS = Path(r"C:\EnergyPlusV26-2-0\energyplus.exe")
J_TO_KWH = 1 / 3.6e6
MONTHS = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split()


class SimulationError(RuntimeError):
    pass


def _query(con, name, freq):
    """Rows (key, month, hour, value) for one output variable, warm-up days excluded, in time order."""
    sql = """SELECT d.KeyValue, t.Month, t.Hour, r.Value
             FROM ReportData r
             JOIN ReportDataDictionary d ON r.ReportDataDictionaryIndex = d.ReportDataDictionaryIndex
             JOIN Time t ON r.TimeIndex = t.TimeIndex
             WHERE d.Name = ? AND d.ReportingFrequency = ? AND (t.WarmupFlag IS NULL OR t.WarmupFlag = 0)
             ORDER BY r.TimeIndex"""
    return con.execute(sql, (name, freq)).fetchall()


def _monthly(con, name):
    vals = [0.0] * 12
    for _, month, _, v in _query(con, name, "Monthly"):
        vals[month - 1] += v * J_TO_KWH
    return vals


def _annual_by_key(con, name):
    return {k.lower(): v for k, _, _, v in _query(con, name, "Run Period")}


def parse_results(sql_path: Path, design: dict) -> dict:
    con = sqlite3.connect(sql_path)
    try:
        cool = I.COOLING[design["cooling"]]
        cooling = _monthly(con, "Zone Ideal Loads Supply Air Total Cooling Energy")
        heating = _monthly(con, "Zone Ideal Loads Supply Air Total Heating Energy")
        lighting = _monthly(con, "Zone Lights Electricity Energy")
        plugs = _monthly(con, "Zone Electric Equipment Electricity Energy")

        top = [v for _, _, _, v in _query(con, "Zone Operative Temperature", "Hourly")]
        if len(top) != 8760:
            raise SimulationError(f"expected 8760 hourly temperatures, got {len(top)}")
        cool_rate = [v for _, _, _, v in _query(con, "Zone Ideal Loads Supply Air Total Cooling Rate", "Hourly")]
        peak_kw = max(cool_rate) / 1000 if cool_rate else 0.0

        # --- comfort (IMAC) and fans, hour by hour, weighted by how many people are home ---
        model = I.IMAC["naturally_ventilated" if design["cooling"] == "nv" else "mixed_mode"]
        trm = running_mean_by_day(I.CITY["weather_file"], I.IMAC["running_mean_days"])
        occ = I.SCHEDULES["occupancy"]
        fan_w = I.FANS["count"] * I.FANS["watts_each"]
        fans = [0.0] * 12
        comf_num = comf_den = 0.0
        hot_hours = cold_hours = 0.0
        hour = 0
        for m, days in enumerate(DAYS_IN_MONTH):
            for d in range(days):
                day_of_year = sum(DAYS_IN_MONTH[:m]) + d
                tn = model["slope"] * trm[day_of_year] + model["intercept"]
                fans_on = cool["fans"]
                upper = tn + model["band_90pct"] + (I.IMAC["fan_upper_limit_bonus_c"] if fans_on else 0)
                lower = tn - model["band_90pct"]
                for h in range(24):
                    t, w = top[hour], occ[h]
                    comf_den += w
                    if lower <= t <= upper:
                        comf_num += w
                    elif t > upper:
                        hot_hours += w
                    else:
                        cold_hours += w
                    if fans_on and t > I.FANS["on_above_c"]:
                        fans[m] += fan_w * w / 1000
                    hour += 1

        # --- annual heat gains by source (kWh) ---
        geo = building_geometry(design)
        cond = {k: v * 8.76 for k, v in _annual_by_key(con, "Surface Inside Face Conduction Heat Gain Rate").items()}
        win_sol = {k: v * J_TO_KWH for k, v in _annual_by_key(con, "Surface Window Transmitted Solar Radiation Energy").items()}
        win_gain = {k: v * J_TO_KWH for k, v in _annual_by_key(con, "Surface Window Heat Gain Energy").items()}
        one = lambda name: sum(_annual_by_key(con, name).values()) * J_TO_KWH
        facades = {}
        for fa in geo["facades"]:
            names = [w["name"].lower() for w in fa["windows"]]
            sol = sum(win_sol.get(n, 0) for n in names)
            facades[fa["name"]] = {
                "compass": fa["compass"],
                "wall": round(cond.get(fa["name"].lower(), 0), 1),
                "window_solar": round(sol, 1),
                "window_conduction": round(max(0.0, sum(win_gain.get(n, 0) for n in names) - sol), 1),
            }
        gains = {
            "windows_solar": sum(f["window_solar"] for f in facades.values()),
            "windows_conduction": sum(f["window_conduction"] for f in facades.values()),
            "walls": sum(f["wall"] for f in facades.values()),
            "roof": cond.get("roof", 0.0),
            "air": one("Zone Infiltration Sensible Heat Gain Energy") + one("Zone Ventilation Sensible Heat Gain Energy"),
            "people": one("Zone People Total Heating Energy"),
            "lights": one("Zone Lights Total Heating Energy"),
            "equipment": one("Zone Electric Equipment Total Heating Energy"),
        }
    finally:
        con.close()

    r1 = lambda xs: [round(x, 1) for x in xs]
    return {
        "row": index_of(design),
        "design": design,
        "monthly_kwh": {"cooling_load": r1(cooling), "heating_load": r1(heating), "lighting": r1(lighting),
                        "fans": r1(fans), "plugs": r1(plugs)},
        "comfort_pct": round(100 * comf_num / comf_den, 1),
        "too_hot_pct": round(100 * hot_hours / comf_den, 1),
        "too_cold_pct": round(100 * cold_hours / comf_den, 1),
        "peak_cooling_kw": round(peak_kw, 2),
        "heat_gains_kwh": {k: round(v, 1) for k, v in gains.items()},
        "facade_gains_kwh": facades,
        "max_indoor_c": round(max(top), 1),
    }


def run_design(design: dict, workdir: Path, keep: bool = False, timeout: int = 300, settings: str = "fast") -> dict:
    """Write the IDF, run EnergyPlus, parse the results. Raises SimulationError on failure."""
    workdir.mkdir(parents=True, exist_ok=True)
    idf = workdir / "in.idf"
    idf.write_text(make_idf(design, settings=settings), encoding="utf-8")
    t0 = time.perf_counter()
    proc = subprocess.run([str(ENERGYPLUS), "-w", str(I.CITY["weather_file"]), "-d", str(workdir), str(idf)],
                          capture_output=True, text=True, timeout=timeout)
    seconds = time.perf_counter() - t0
    err = (workdir / "eplusout.err").read_text(errors="replace") if (workdir / "eplusout.err").exists() else ""
    if proc.returncode != 0 or "Completed Successfully" not in err:
        severe = [l for l in err.splitlines() if "** Severe" in l or "** Fatal" in l][:5]
        raise SimulationError(f"EnergyPlus failed for row {index_of(design)}: " + " | ".join(severe or [proc.stdout[-300:]]))
    try:
        result = parse_results(workdir / "eplusout.sql", design)
    finally:
        if not keep:
            shutil.rmtree(workdir, ignore_errors=True)
    result["seconds"] = round(seconds, 2)
    result["warnings"] = err.count("** Warning")
    return result


def report(r: dict) -> None:
    """Plain-language summary of one result (cooling shown at 3-star AC efficiency)."""
    d, m = r["design"], r["monthly_kwh"]
    labels = {k: c for k, _, c in I.OPTIONS}
    print("DESIGN (row %d)" % r["row"])
    for k, label, choices in I.OPTIONS:
        print(f"  {label:34} {choices[d[k]]}")
    cop = I.AC_EFFICIENCY["3star"]["cop"]
    use = {"Cooling (AC electricity)": sum(m["cooling_load"]) / cop, "Heating": sum(m["heating_load"]) / cop,
           "Lighting": sum(m["lighting"]), "Fans": sum(m["fans"]), "Plugs & appliances": sum(m["plugs"])}
    total = sum(use.values())
    area = I.GEOMETRY["floor_area_total_m2"]
    print(f"\nYEARLY ELECTRICITY (cooling at 3-star AC, COP {cop})")
    for k, v in use.items():
        print(f"  {k:26} {v:7,.0f} kWh   {'█' * int(30 * v / total)}")
    print(f"  {'TOTAL':26} {total:7,.0f} kWh  = {total/area:.0f} kWh/m²·yr")
    print(f"  Cooling the AC must remove: {sum(m['cooling_load']):,.0f} kWh of heat; peak {r['peak_cooling_kw']} kW "
          f"(≈ {r['peak_cooling_kw']/3.517:.1f} ton of AC)")
    print(f"\nCOMFORT  {r['comfort_pct']}% of occupied hours comfortable (IMAC); "
          f"too hot {r['too_hot_pct']}%, too cold {r['too_cold_pct']}%; hottest indoor {r['max_indoor_c']} °C")
    g = r["heat_gains_kwh"]
    gt = sum(g.values())
    names = {"windows_solar": "Windows: sunlight", "windows_conduction": "Windows: conduction", "walls": "Walls",
             "roof": "Roof", "air": "Air leakage / ventilation", "people": "People", "lights": "Lights",
             "equipment": "Appliances"}
    print("\nWHERE THE HEAT COMES FROM (yearly heat gains)")
    for k, v in sorted(g.items(), key=lambda kv: -kv[1]):
        print(f"  {names[k]:26} {v:7,.0f} kWh  {100*v/gt:4.0f}%  {'█' * int(30 * v / gt)}")
    print("\nBY FACADE (window sunlight / wall conduction, kWh)")
    for name, f in r["facade_gains_kwh"].items():
        print(f"  {f['compass']:2} wall: windows {f['window_solar']:6,.0f}   wall {f['wall']:6,.0f}")
    print("\nMONTHLY COOLING LOAD (kWh of heat removed)")
    mx = max(m["cooling_load"]) or 1
    for i, v in enumerate(m["cooling_load"]):
        print(f"  {MONTHS[i]}  {v:6,.0f}  {'█' * int(30 * v / mx)}")
    print(f"\nEnergyPlus run took {r['seconds']} s, {r['warnings']} warnings")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    args = sys.argv[1:]
    keep = "--keep" in args
    args = [a for a in args if a != "--keep"]
    if args and args[0] == "--row":
        design = design_from_index(int(args[1]))
    else:
        design = dict(BASE_DESIGN)
        for a in args:
            k, v = a.split("=")
            if k not in CHOICES or v not in CHOICES[k]:
                sys.exit(f"Unknown option {a}. Choices: " + "; ".join(f"{k}={'/'.join(c)}" for k, c in CHOICES.items()))
            design[k] = v
    res = run_design(design, I.ROOT / "sample" / str(index_of(design)), keep=keep)
    report(res)
    (I.ROOT / "sample" / f"result_{res['row']}.json").write_text(json.dumps(res, indent=1), encoding="utf-8")
