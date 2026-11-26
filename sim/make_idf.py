"""
Build the EnergyPlus model (IDF text) for ONE design.

A "design" is a dict with one choice per option, e.g.
  {"orientation": "ns", "wwr_ns": "40", "wwr_ew": "30", "glazing": "single_clear", "shading": "none",
   "wall": "brick", "roof": "bare", "roof_finish": "normal", "cooling": "ac24", "lighting": "fluorescent"}

`building_geometry(design)` is the single source of truth for the shape: the same numbers are
exported to the 3D scene, so the game shows exactly what was simulated.

Usage (writes a sample IDF you can open in EnergyPlus' IDF Editor):
  python sim/make_idf.py              -> sim/sample/base.idf  (developer's draft)
"""
import math
from pathlib import Path

import inputs as I
from epw import monthly_means

OPTION_KEYS = [k for k, _, _ in I.OPTIONS]
CHOICES = {k: list(c.keys()) for k, _, c in I.OPTIONS}

# The developer's energy-hungry draft that every level starts from
BASE_DESIGN = {"orientation": "ns", "wwr_ns": "40", "wwr_ew": "30", "glazing": "single_clear",
               "shading": "none", "wall": "brick", "roof": "bare", "roof_finish": "normal",
               "cooling": "ac24", "lighting": "fluorescent"}


# ─────────────────────────────── design <-> row number ───────────────────────────────
def index_of(design: dict) -> int:
    """Row number of a design in the results table (mixed radix, last option changes fastest)."""
    i = 0
    for k in OPTION_KEYS:
        i = i * len(CHOICES[k]) + CHOICES[k].index(design[k])
    return i


def design_from_index(i: int) -> dict:
    d = {}
    for k in reversed(OPTION_KEYS):
        n = len(CHOICES[k])
        d[k] = CHOICES[k][i % n]
        i //= n
    return {k: d[k] for k in OPTION_KEYS}


# ─────────────────────────────── geometry ───────────────────────────────
COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]


def compass(az: float) -> str:
    return COMPASS[int(((az % 360) + 22.5) // 45) % 8]


def building_geometry(design: dict) -> dict:
    """World coordinates (x = east, y = north, z = up, metres), footprint centred on the origin.

    The building is first laid out with its long axis along local +y, then rotated clockwise
    by the orientation bearing. Returns facades (with windows) and shading polygons."""
    g = I.GEOMETRY
    W, L = g["width_m"], g["length_m"]
    ftf, floors = g["floor_to_floor_m"], g["floors"]
    H = ftf * floors
    th = math.radians(I.ORIENTATION_DEG[design["orientation"]])
    c, s = math.cos(th), math.sin(th)

    def rot(x, y):  # clockwise rotation by the compass bearing
        return (round(x * c + y * s, 4), round(-x * s + y * c, 4))

    P = [(-W / 2, -L / 2), (W / 2, -L / 2), (W / 2, L / 2), (-W / 2, L / 2)]  # counter-clockwise from above
    # (name, start corner, end corner, kind, local outward bearing)
    edges = [("end_a", 0, 1, "short", 180), ("side_a", 1, 2, "long", 90),
             ("end_b", 2, 3, "short", 0), ("side_b", 3, 0, "long", 270)]

    facades = []
    for name, i0, i1, kind, local_az in edges:
        az = (local_az + I.ORIENTATION_DEG[design["orientation"]]) % 360
        d_ns = min(abs(az - 0), abs(az - 180), abs(az - 360))
        d_ew = min(abs(az - 90), abs(az - 270))
        if abs(d_ns - d_ew) < 1e-6:  # 45° orientations: tie-break rule
            group = "ns" if (kind == "long") == (I.WWR_TIE_BREAK == "long") else "ew"
        else:
            group = "ns" if d_ns < d_ew else "ew"
        wwr = int(design["wwr_ns" if group == "ns" else "wwr_ew"]) / 100
        length = L if kind == "long" else W
        A, B = rot(*P[i0]), rot(*P[i1])
        t = ((B[0] - A[0]) / length, (B[1] - A[1]) / length)  # along the wall, left -> right seen from outside
        n = (math.sin(math.radians(az)), math.cos(math.radians(az)))  # outward normal

        # Windows: equal size and equal gaps, same layout on each floor
        count = g["windows_per_floor_long_facade" if kind == "long" else "windows_per_floor_short_facade"]
        wh = g["window_height_m"]
        w = wwr * length * ftf / wh / count
        gap = (length - count * w) / (count + 1)
        windows = []
        for f in range(floors):
            for k in range(count):
                windows.append({"name": f"{name}_f{f+1}_w{k+1}", "x0": round(gap + k * (w + gap), 4),
                                "z0": round(f * ftf + g["window_sill_m"], 4), "w": round(w, 4), "h": wh})
        facades.append({"name": name, "kind": kind, "length": length, "azimuth": az, "compass": compass(az),
                        "wwr_group": group, "wwr": wwr, "A": A, "B": B, "t": t, "n": n, "height": H,
                        "windows": windows, "window_area": round(sum(x["w"] * x["h"] for x in windows), 3)})

    shading = []  # list of {"window", "type", "polygon": [(x,y,z)...]}
    sh = I.SHADING[design["shading"]]
    for fa in facades:
        def pt(sx, z, d):  # wall-local (along, height, out from wall) -> world
            return (round(fa["A"][0] + fa["t"][0] * sx + fa["n"][0] * d, 4),
                    round(fa["A"][1] + fa["t"][1] * sx + fa["n"][1] * d, 4), round(z, 4))

        for win in fa["windows"]:
            head = win["z0"] + win["h"]
            if design["shading"] == "overhang":
                z, e, dep = head + sh["height_above_head_m"], sh["side_extension_m"], sh["depth_m"]
                slats = [(z, 0.0, dep)]
            elif design["shading"] == "louvres":
                e, off, dep, nsl = sh["side_extension_m"], sh["offset_from_wall_m"], sh["slat_depth_m"], sh["slat_count"]
                slats = [(head - k * win["h"] / nsl, off, off + dep) for k in range(nsl)]
            else:
                slats = []
            for j, (z, d0, d1) in enumerate(slats):
                x0, x1 = win["x0"] - e, win["x0"] + win["w"] + e
                shading.append({"window": win["name"], "type": design["shading"], "id": f"{win['name']}_sh{j}",
                                "polygon": [pt(x0, z, d1), pt(x0, z, d0), pt(x1, z, d0), pt(x1, z, d1)]})

    corners = [rot(*p) for p in P]
    return {"facades": facades, "shading": shading, "corners": corners, "height": H,
            "width": W, "length": L, "bearing": I.ORIENTATION_DEG[design["orientation"]]}


# ─────────────────────────────── IDF writing helpers ───────────────────────────────
def obj(kind: str, *fields) -> str:
    vals = ["" if f is None else (f"{f:.6g}" if isinstance(f, float) else str(f)) for f in fields]
    if not vals:
        return f"{kind};\n"
    return f"{kind},\n" + "".join(f"  {v},\n" for v in vals[:-1]) + f"  {vals[-1]};\n"


def hourly_schedule(name: str, limits: str, values24) -> str:
    fields = [name, limits, "Through: 12/31", "For: AllDays"]
    for h in range(24):
        if h == 23 or values24[h + 1] != values24[h]:
            fields += [f"Until: {h+1:02d}:00", values24[h]]
    return obj("Schedule:Compact", *fields)


def constant_schedule(name: str, limits: str, value) -> str:
    return obj("Schedule:Compact", name, limits, "Through: 12/31", "For: AllDays", "Until: 24:00", value)


def material(name, k, rho, cp, thick, solar_abs=0.7):
    return obj("Material", name, "MediumRough", thick, k, rho, cp, 0.9, solar_abs, solar_abs)


def layered_construction(cname, layers, seen: set, outer_abs=None):
    """Returns (new materials text, construction text). Each layer becomes a Material at its thickness;
    materials already written (names in `seen`) are not repeated."""
    mats, names = "", []
    for idx, (m, thick) in enumerate(layers):
        k, rho, cp, _ = I.MATERIALS[m]
        sa = outer_abs if (idx == 0 and outer_abs is not None) else 0.7
        mname = f"{m}_{int(round(thick*1000))}mm" + (f"_abs{int(round(sa*100))}" if idx == 0 and outer_abs is not None else "")
        if mname not in seen:
            seen.add(mname)
            mats += material(mname, k, rho, cp, thick, sa)
        names.append(mname)
    return mats, obj("Construction", cname, *names)


def vertices(pts):
    out = []
    for p in pts:
        out += [p[0], p[1], p[2]]
    return out


# ─────────────────────────────── the model ───────────────────────────────
def make_idf(design: dict, detailed_outputs: bool = False) -> str:
    geo = building_geometry(design)
    cool = I.COOLING[design["cooling"]]
    H, ftf = geo["height"], I.GEOMETRY["floor_to_floor_m"]
    parts = []
    add = parts.append

    # --- simulation settings (the "faster settings": 4 timesteps/hour, exterior-only solar, no sizing) ---
    add(obj("Version", "26.2"))
    add(obj("SimulationControl", "No", "No", "No", "No", "Yes", "No", 1))
    add(obj("Building", "NetZeroHome", 0, "Suburbs", 0.04, 0.4, "FullExterior", 25, 6))
    add(obj("ShadowCalculation", "PolygonClipping", "Periodic", 20, 15000))
    add(obj("Timestep", 4))
    add(obj("GlobalGeometryRules", "UpperLeftCorner", "Counterclockwise", "Relative"))
    add(obj("Site:Location", I.CITY["name"], I.CITY["lat"], I.CITY["lon"], I.CITY["timezone"], I.CITY["elevation_m"]))
    # Ground under the slab: monthly mean outdoor air temperature (reasonable for a tropical slab-on-grade)
    add(obj("Site:GroundTemperature:BuildingSurface", *[round(t, 1) for t in monthly_means(I.CITY["weather_file"])]))
    add(obj("RunPeriod", "Year", 1, 1, None, 12, 31, None, "Monday", "Yes", "No", "No", "Yes", "Yes"))

    # --- schedules ---
    add(obj("ScheduleTypeLimits", "Fraction", 0, 1, "Continuous"))
    add(obj("ScheduleTypeLimits", "Temperature", -60, 200, "Continuous"))
    add(obj("ScheduleTypeLimits", "AnyNumber"))
    add(hourly_schedule("Occupancy", "Fraction", I.SCHEDULES["occupancy"]))
    add(hourly_schedule("Lighting", "Fraction", I.SCHEDULES["lighting"]))
    add(hourly_schedule("Equipment", "Fraction", I.SCHEDULES["equipment"]))
    add(hourly_schedule("ACAvailable", "Fraction", I.AC_AVAILABLE_HOURS))
    add(constant_schedule("AlwaysOn", "Fraction", 1))
    add(constant_schedule("Activity", "AnyNumber", I.PEOPLE["activity_w_per_person"]))

    # --- constructions ---
    seen = set()
    wall = I.WALLS[design["wall"]]
    m, c = layered_construction("Wall", wall["layers"], seen, wall["outer_solar_absorptance"]); add(m); add(c)
    fin = I.ROOF_FINISHES[design["roof_finish"]]
    m, c = layered_construction("Roof", I.ROOFS[design["roof"]]["layers"], seen, fin["solar_absorptance"]); add(m); add(c)
    m, c = layered_construction("GroundFloor", I.GROUND_FLOOR, seen); add(m); add(c)
    for key, im in I.INTERNAL_MASS.items():
        # Both faces sit inside the zone (symmetric 3-layer build-up): model half of it with twice the area
        (m1, t1), (m2, t2), _ = im["layers"]
        m, c = layered_construction(f"Mass_{key}", [(m1, t1), (m2, t2 / 2)], seen); add(m); add(c)
    gl = I.GLAZING[design["glazing"]]
    add(obj("WindowMaterial:SimpleGlazingSystem", "Glass", gl["u"], gl["shgc"], gl["vt"]))
    add(obj("Construction", "Window", "Glass"))

    # --- zone and surfaces ---
    add(obj("Zone", "House", 0, 0, 0, 0, 1, 1, None, None, I.GEOMETRY["floor_area_total_m2"], None, None, "Yes"))
    for fa in geo["facades"]:
        A, B = fa["A"], fa["B"]
        pts = [(A[0], A[1], H), (A[0], A[1], 0), (B[0], B[1], 0), (B[0], B[1], H)]
        add(obj("BuildingSurface:Detailed", fa["name"], "Wall", "Wall", "House", None, "Outdoors", None,
                "SunExposed", "WindExposed", "autocalculate", 4, *vertices(pts)))
        for win in fa["windows"]:
            add(obj("Window", win["name"], "Window", fa["name"], None, 1, win["x0"], win["z0"], win["w"], win["h"]))
    C = geo["corners"]
    add(obj("BuildingSurface:Detailed", "roof", "Roof", "Roof", "House", None, "Outdoors", None,
            "SunExposed", "WindExposed", "autocalculate", 4,
            *vertices([(C[3][0], C[3][1], H), (C[0][0], C[0][1], H), (C[1][0], C[1][1], H), (C[2][0], C[2][1], H)])))
    add(obj("BuildingSurface:Detailed", "ground_floor", "Floor", "GroundFloor", "House", None, "Ground", None,
            "NoSun", "NoWind", "autocalculate", 4,
            *vertices([(C[2][0], C[2][1], 0), (C[1][0], C[1][1], 0), (C[0][0], C[0][1], 0), (C[3][0], C[3][1], 0)])))
    for key, im in I.INTERNAL_MASS.items():
        add(obj("InternalMass", f"mass_{key}", f"Mass_{key}", "House", None, 2 * im["area_m2"]))
    for shd in geo["shading"]:
        add(obj("Shading:Building:Detailed", shd["id"], None, 4, *vertices(shd["polygon"])))

    # --- internal gains ---
    add(obj("People", "Family", "House", "Occupancy", "People", I.PEOPLE["count"], None, None, 0.3, "autocalculate", "Activity"))
    add(obj("Lights", "Lights", "House", "Lighting", "Watts/Area", None, I.LIGHTING[design["lighting"]]["w_per_m2"],
            None, 0, 0.37, 0.18, 1, "Lighting"))
    add(obj("ElectricEquipment", "Plugs", "House", "Equipment", "Watts/Area", None, I.EQUIPMENT_W_PER_M2, None, 0, 0.3, 0, "Plugs"))

    # --- air leakage and openable windows ---
    add(obj("ZoneInfiltration:DesignFlowRate", "Leakage", "House", "AlwaysOn", "AirChanges/Hour", None, None, None,
            I.INFILTRATION_ACH, 1, 0, 0, 0))
    nv = I.NATURAL_VENT
    if cool["ac"] and design["cooling"] != "mixed":
        add(hourly_schedule("WindowsOpenable", "Fraction", [1 - a for a in I.AC_AVAILABLE_HOURS]))  # closed while AC runs
    else:
        add(constant_schedule("WindowsOpenable", "Fraction", 1))
    max_in = nv["mixed_mode_ac_takes_over_c"] if design["cooling"] == "mixed" else 100
    for fa in geo["facades"]:
        if fa["window_area"] > 0:
            add(obj("ZoneVentilation:WindandStackOpenArea", f"Vent_{fa['name']}", "House",
                    round(fa["window_area"] * nv["openable_fraction"], 3), "WindowsOpenable", "autocalculate",
                    round(fa["azimuth"], 1), ftf / 2, nv["discharge_coefficient"],
                    nv["open_when_indoor_above_c"], None, max_in, None, nv["open_when_cooler_outside_by_c"], None,
                    -100, None, nv["close_when_outdoor_above_c"], None, 40))

    # --- cooling: ideal loads (EnergyPlus reports the heat to remove; AC efficiency is applied in the game) ---
    if cool["ac"]:
        add(constant_schedule("CoolSetpoint", "Temperature", cool["cool_setpoint"]))
        add(constant_schedule("HeatSetpoint", "Temperature", I.HEATING_SETPOINT_C))
        add(constant_schedule("DualSetpointType", "AnyNumber", 4))
        add(obj("ThermostatSetpoint:DualSetpoint", "Setpoints", "HeatSetpoint", "CoolSetpoint"))
        add(obj("ZoneControl:Thermostat", "Thermostat", "House", "DualSetpointType", "ThermostatSetpoint:DualSetpoint", "Setpoints"))
        add(obj("ZoneHVAC:EquipmentConnections", "House", "HouseEquipment", "House Inlet", None, "House Air", "House Return"))
        add(obj("ZoneHVAC:EquipmentList", "HouseEquipment", "SequentialLoad", "ZoneHVAC:IdealLoadsAirSystem", "AC", 1, 1, None, None))
        add(obj("ZoneHVAC:IdealLoadsAirSystem", "AC", "ACAvailable", "House Inlet", None, None, 50, 13, 0.0156, 0.0077,
                "NoLimit", None, None, "NoLimit", None, None, "ACAvailable", "ACAvailable", "ConstantSensibleHeatRatio", 0.7, "None"))

    # --- outputs (SQLite only, to keep runs fast and small) ---
    yes_no = lambda b: "Yes" if b else "No"
    add(obj("OutputControl:Files", "No", "No", "No", yes_no(detailed_outputs), yes_no(detailed_outputs), "Yes", "No", "No",
            "No", "No", "No", "No", "No", "No", "No", "No", "Yes", "No", "No", "No", "No", "No", "No", "No", "No", "No",
            "No", "No", "No", "No", "No", "No", "No"))
    add(obj("Output:SQLite", "Simple"))
    out = lambda key, var, freq: add(obj("Output:Variable", key, var, freq))
    for v in ["Zone Ideal Loads Supply Air Total Cooling Energy", "Zone Ideal Loads Supply Air Total Heating Energy"]:
        out("*", v, "Monthly")
    for v in ["Zone Lights Electricity Energy", "Zone Electric Equipment Electricity Energy"]:
        out("*", v, "Monthly")
    out("*", "Zone Operative Temperature", "Hourly")
    out("*", "Zone Ideal Loads Supply Air Total Cooling Rate", "Hourly")
    # Annual average rate (W) of conduction heat entering through each wall/roof; x 8.76 = kWh/yr
    out("*", "Surface Inside Face Conduction Heat Gain Rate", "RunPeriod")
    for v in ["Surface Window Transmitted Solar Radiation Energy",
              "Surface Window Heat Gain Energy", "Zone Infiltration Sensible Heat Gain Energy",
              "Zone Ventilation Sensible Heat Gain Energy", "Zone People Total Heating Energy",
              "Zone Lights Total Heating Energy", "Zone Electric Equipment Total Heating Energy"]:
        out("*", v, "RunPeriod")
    return "".join(parts)


if __name__ == "__main__":
    import sys
    sys.stdout.reconfigure(encoding="utf-8")
    outdir = I.ROOT / "sample"
    outdir.mkdir(exist_ok=True)
    p = outdir / "base.idf"
    p.write_text(make_idf(BASE_DESIGN, detailed_outputs=True), encoding="utf-8")
    geo = building_geometry(BASE_DESIGN)
    print(f"Wrote {p}  (row {index_of(BASE_DESIGN)})")
    for fa in geo["facades"]:
        print(f"  {fa['name']:7} faces {fa['compass']:2} ({fa['azimuth']:5.1f}°) {fa['kind']:5} "
              f"WWR {fa['wwr']:.0%} ({fa['wwr_group']}), window area {fa['window_area']:.1f} m²")
