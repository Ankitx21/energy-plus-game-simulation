"""
Write the reference geometry (straight from the simulation code) that the 3D golden-rule test
compares against:  python sim/make_golden_ref.py  ->  game/dev/golden_ref.json
Then open http://localhost:8000/dev/golden.html (or run it headless) to see PASS/FAIL.
"""
import json

import inputs as I
from make_idf import BASE_DESIGN, building_geometry

DESIGNS = [
    {},
    {"shading": "overhang"},
    {"shading": "louvres", "orientation": "nesw"},
    {"shading": "overhang", "orientation": "nwse", "wwr_ns": "20", "wwr_ew": "10"},
    {"shading": "louvres", "orientation": "ew", "wwr_ns": "30", "wwr_ew": "20", "wall": "rammed_earth"},
    {"shading": "overhang", "orientation": "ew", "wwr_ns": "40", "wwr_ew": "30", "wall": "aac"},
]
INSET = 0.07  # glass sits this far inside the outer wall face in 3D (does not change the window area or shading)


def three(p):  # sim (x east, y north, z up) -> three.js (x, y up, z south)
    return [p[0], p[2], -p[1]]


def aabb(points):
    xs, ys, zs = zip(*points)
    return [min(xs), min(ys), min(zs), max(xs), max(ys), max(zs)]


out = []
for change in DESIGNS:
    d = {**BASE_DESIGN, **change}
    geo = building_geometry(d)
    glass = []
    for f in geo["facades"]:
        for w in f["windows"]:
            pts = []
            for sx in (w["x0"], w["x0"] + w["w"]):
                for z in (w["z0"], w["z0"] + w["h"]):
                    pts.append(three((f["A"][0] + f["t"][0] * sx - f["n"][0] * INSET,
                                      f["A"][1] + f["t"][1] * sx - f["n"][1] * INSET, z)))
            glass.append(aabb(pts))
    shades = []
    for s in geo["shading"]:
        b = aabb([three(p) for p in s["polygon"]])
        if s["type"] == "overhang":   # 3D slab sits on top of the simulated plane, 80 mm thick
            b[1], b[4] = b[1], b[1] + 0.08
        else:                         # 3D slat is 22 mm thick, centred on the simulated plane
            b[1], b[4] = b[1] - 0.011, b[1] + 0.011
        shades.append({"type": s["type"], "box": b})
    out.append({"design": d, "glass": glass, "shading": shades})
path = I.ROOT.parent / "game" / "dev" / "golden_ref.json"
path.write_text(json.dumps(out), encoding="utf-8")
print(f"Wrote {len(out)} designs to {path}")
