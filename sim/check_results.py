"""
Sanity checks on simulation results: do the numbers make physical sense?

Usage:  python sim/check_results.py [sim/runs/blr_fast_test]     (default: the test batch)

Checks
  1. Ranges: energy use per m², comfort, peak load, no negative values
  2. Rules: in every pair of designs that differ in ONE option, the change must move the
     expected quantity in the expected direction (e.g. adding an overhang lowers window sunlight).
"""
import json
import sys
from itertools import combinations
from pathlib import Path

import inputs as I
from make_idf import OPTION_KEYS

AREA = I.GEOMETRY["floor_area_total_m2"]
COP = I.AC_EFFICIENCY["3star"]["cop"]

# (option, from, to, quantity, expected direction "down"/"up", why[, only test designs where ...])
RULES = [
    ("shading", "none", "overhang", "windows_solar", "down", "an overhang blocks sunlight on the glass"),
    ("shading", "none", "louvres", "windows_solar", "down", "louvres block sunlight on the glass"),
    ("shading", "none", "overhang", "cooling", "down", "less sunlight in means less to cool"),
    ("roof_finish", "normal", "cool", "roof", "down", "a white roof reflects sunlight"),
    ("roof_finish", "normal", "cool", "cooling", "down", "less roof heat means less to cool"),
    # Real effect found in task 3: under a white cool roof without full-time AC, a bare slab sheds heat to the
    # night sky; insulation blocks that, so roof heat gain can rise. Rule therefore excludes that case.
    ("roof", "bare", "insulated", "roof", "down", "insulation slows heat through the roof",
     lambda d: d["roof_finish"] == "normal" or d["cooling"] in ("ac24", "ac26")),
    ("glazing", "single_clear", "double_lowe", "windows_solar", "down", "low-e glass lets in less solar heat"),
    ("lighting", "fluorescent", "led", "lighting", "down", "LEDs use less electricity"),
    ("lighting", "fluorescent", "led", "lights_heat", "down", "LEDs give off less heat"),
    ("cooling", "ac24", "ac26", "cooling", "down", "a warmer setpoint needs less cooling"),
    ("cooling", "nv", "ac24", "comfort", "up", "AC keeps more hours comfortable than fans alone"),
    ("wwr_ew", "30", "10", "windows_solar", "down", "smaller windows let in less sunlight"),
    ("wwr_ns", "40", "20", "windows_solar", "down", "smaller windows let in less sunlight"),
    ("wall", "brick", "aac", "walls", "down", "AAC insulates better than brick"),
]


def quantities(r: dict) -> dict:
    m, g = r["monthly_kwh"], r["heat_gains_kwh"]
    use = (sum(m["cooling_load"]) + sum(m["heating_load"])) / COP + sum(m["lighting"]) + sum(m["fans"]) + sum(m["plugs"])
    return {"cooling": sum(m["cooling_load"]), "lighting": sum(m["lighting"]), "eui": use / AREA,
            "comfort": r["comfort_pct"], "windows_solar": g["windows_solar"], "roof": g["roof"],
            "walls": g["walls"], "lights_heat": g["lights"], "peak": r["peak_cooling_kw"]}


def main(run_dir: Path) -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    with open(run_dir / "results.jsonl", encoding="utf-8") as f:
        results = [json.loads(line) for line in f if line.strip()]
    print(f"{len(results)} results in {run_dir}\n")
    q = {r["row"]: quantities(r) for r in results}
    fails = 0

    print("1. RANGES")
    euis = [x["eui"] for x in q.values()]
    checks = [
        ("Energy use 5–150 kWh/m²·yr", all(5 <= e <= 150 for e in euis), f"{min(euis):.0f}–{max(euis):.0f}"),
        ("Comfort 40–100%", all(40 <= x["comfort"] <= 100 for x in q.values()),
         f"{min(x['comfort'] for x in q.values()):.0f}–{max(x['comfort'] for x in q.values()):.0f}%"),
        ("Peak cooling 0–40 kW", all(0 <= x["peak"] <= 40 for x in q.values()),
         f"{min(x['peak'] for x in q.values()):.1f}–{max(x['peak'] for x in q.values()):.1f} kW"),
        ("No negative monthly values", all(v >= 0 for r in results for arr in r["monthly_kwh"].values() for v in arr), ""),
        ("No cooling in fans-only designs", all(sum(r["monthly_kwh"]["cooling_load"]) == 0
                                                 for r in results if r["design"]["cooling"] == "nv"), ""),
    ]
    for name, ok, info in checks:
        fails += not ok
        print(f"  {'PASS' if ok else 'FAIL'}  {name:36} {info}")

    print("\n2. ONE-CHANGE RULES")
    by_row = {r["row"]: r for r in results}
    tally = {i: [0, 0, []] for i in range(len(RULES))}
    for a, b in combinations(results, 2):
        diff = [k for k in OPTION_KEYS if a["design"][k] != b["design"][k]]
        if len(diff) != 1:
            continue
        k = diff[0]
        for i, (opt, v0, v1, qty, direction, _, *only) in enumerate(RULES):
            if opt != k or (only and not only[0](a["design"])):
                continue
            if {a["design"][k], b["design"][k]} != {v0, v1}:
                continue
            lo, hi = (a, b) if a["design"][k] == v0 else (b, a)
            x0, x1 = q[lo["row"]][qty], q[hi["row"]][qty]
            if qty == "cooling" and x0 < 1:  # nothing to reduce
                continue
            ok = x1 < x0 if direction == "down" else x1 > x0
            tally[i][0 if ok else 1] += 1
            if not ok:
                tally[i][2].append((lo["row"], hi["row"], x0, x1))
    for i, (opt, v0, v1, qty, direction, why, *_) in enumerate(RULES):
        p, f_, bad = tally[i]
        if p + f_ == 0:
            print(f"  ----  {opt} {v0}→{v1}: no pairs to test")
            continue
        fails += f_ > 0
        print(f"  {'PASS' if f_ == 0 else 'FAIL'}  {opt} {v0}→{v1}: {qty} {direction} in {p}/{p+f_} pairs  ({why})")
        for lo, hi, x0, x1 in bad[:3]:
            print(f"          rows {lo}→{hi}: {x0:,.1f} → {x1:,.1f}")

    print(f"\n{'ALL CHECKS PASSED' if fails == 0 else f'{fails} CHECK(S) FAILED'}")
    return fails


if __name__ == "__main__":
    d = Path(sys.argv[1]) if len(sys.argv) > 1 else I.ROOT / "runs" / f"{I.CITY['id']}_fast_test"
    sys.exit(1 if main(d) else 0)
