"""
ALL INPUT VALUES FOR THE SIMULATION AND THE GAME, IN ONE PLACE.

Run  `python sim/inputs.py`  to print a readable summary of everything below.

Every value carries a source and a confidence tag:
  [CODE]     taken from an Indian code/standard table (ECBC 2017, ENS 2018) - check exact edition
  [LIT]      typical value from research literature / manufacturer data
  [ASSUME]   modelling assumption chosen for this demo - needs expert review
  [ESTIMATE] cost estimate - verify against current CPWD Schedule of Rates / market quotes
Values marked VERIFY must be checked before results are used for anything beyond the demo.

Units: metres, W, W/m²K (U-value), W/mK (conductivity k), kg/m³ (density), J/kgK (specific heat), ₹.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent

# ─────────────────────────────────────────────────────────────────────────────
# 1. CITY
# ─────────────────────────────────────────────────────────────────────────────
CITY = {
    "id": "blr",
    "name": "Bengaluru",
    "climate_zone": "Temperate",  # [CODE] NBC 2016 / ECBC climate zone
    "lat": 12.97,
    "lon": 77.59,
    "timezone": 5.5,
    "elevation_m": 921,
    # Free TMYx file (typical year built from 2011-2025 data), climate.onebuilding.org
    "weather_file": ROOT / "weather" / "IND_KA_Bengaluru.432950_TMYx.2011-2025.epw",
}

# ─────────────────────────────────────────────────────────────────────────────
# 2. BUILDING GEOMETRY  (the 3D scene must use exactly these numbers)
# ─────────────────────────────────────────────────────────────────────────────
GEOMETRY = {
    "floor_area_total_m2": 220.0,
    "floors": 2,
    "length_m": 15.0,             # long side
    "width_m": 110.0 / 15.0,      # short side = 7.333 m, so footprint = 110 m²
    "floor_to_floor_m": 3.0,      # wall height = 2 x 3.0 = 6.0 m
    # Windows: same layout on both floors. WWR = window area / gross wall area of that facade.
    "window_height_m": 1.5,
    "window_sill_m": 0.75,        # above each floor level, so head is at 2.25 m
    "windows_per_floor_long_facade": 3,
    "windows_per_floor_short_facade": 2,
    # Context only (decorative, not simulated as heat-transfer surfaces):
    "plinth_height_m": 0.45,
    "parapet_height_m": 0.9,
}

# ─────────────────────────────────────────────────────────────────────────────
# 3. MATERIALS  (layer properties for EnergyPlus)
# ─────────────────────────────────────────────────────────────────────────────
# name: (conductivity k W/mK, density kg/m³, specific heat J/kgK, source)
MATERIALS = {
    "cement_plaster": (0.721, 1762, 840, "[CODE] ECBC 2017 / ENS 2018 material table"),
    "burnt_brick":    (0.811, 1820, 880, "[CODE] ECBC 2017 / ENS 2018 material table"),
    "aac_block":      (0.184,  642, 794, "[CODE] ENS 2018 material table - VERIFY"),
    "rammed_earth":   (1.000, 1900, 880, "[LIT] stabilised rammed earth, k 0.8-1.3 in literature - VERIFY"),
    "lime_plaster":   (0.700, 1600, 840, "[LIT]"),
    "rcc":            (1.580, 2288, 880, "[CODE] ECBC 2017 reinforced concrete"),
    "cement_screed":  (0.719, 1648, 920, "[CODE] ECBC 2017 cement mortar"),
    "xps_insulation": (0.029,   35, 1470, "[LIT] extruded polystyrene, aged value"),
    "ceramic_tile":   (1.300, 2300, 840, "[LIT]"),
}

# Constructions are listed OUTSIDE -> INSIDE as (material, thickness m)
WALLS = {
    "brick": {
        "label": "Brick (230 mm)",
        "layers": [("burnt_brick", 0.230), ("cement_plaster", 0.012)],  # exposed brick outside, plastered inside
        "look": "exposed red brick",
        "outer_solar_absorptance": 0.70,  # [LIT] red brick
    },
    "aac": {
        "label": "AAC block (200 mm)",
        "layers": [("cement_plaster", 0.015), ("aac_block", 0.200), ("cement_plaster", 0.012)],
        "look": "smooth plaster, painted off-white",
        "outer_solar_absorptance": 0.45,  # [LIT] light-coloured paint (the 3D colour must match)
    },
    "rammed_earth": {
        "label": "Rammed earth (300 mm)",
        "layers": [("rammed_earth", 0.300), ("lime_plaster", 0.012)],
        "look": "exposed earth layers",
        "outer_solar_absorptance": 0.65,  # [LIT] ochre earth
    },
}

ROOFS = {
    "bare": {
        "label": "Bare RCC slab",
        "layers": [("cement_screed", 0.040), ("rcc", 0.150), ("cement_plaster", 0.012)],
    },
    "insulated": {
        "label": "RCC + 50 mm insulation",
        "layers": [("cement_screed", 0.040), ("xps_insulation", 0.050), ("rcc", 0.150), ("cement_plaster", 0.012)],
    },
}

# Roof finish = solar absorptance of the outer roof surface (1 - reflectance)
ROOF_FINISHES = {
    "normal": {"label": "Normal (grey screed)", "solar_absorptance": 0.70, "thermal_emittance": 0.90,
               "source": "[LIT] weathered concrete 0.65-0.75"},
    "cool":   {"label": "Cool roof (white)", "solar_absorptance": 0.30, "thermal_emittance": 0.90,
               "source": "[CODE] ECBC 2017 cool roof: reflectance >= 0.6 new; 0.30 assumes some ageing - VERIFY"},
}

# Ground floor slab and internal thermal mass (same in every design)
GROUND_FLOOR = [("ceramic_tile", 0.010), ("cement_screed", 0.040), ("rcc", 0.100)]  # inside -> ground
INTERNAL_MASS = {
    "first_floor_slab": {"layers": [("ceramic_tile", 0.010), ("rcc", 0.150), ("cement_plaster", 0.012)],
                         "area_m2": 110.0, "note": "[ASSUME] slab between floors, both faces in the single zone"},
    "partitions":       {"layers": [("cement_plaster", 0.012), ("burnt_brick", 0.115), ("cement_plaster", 0.012)],
                         "area_m2": 220.0, "note": "[ASSUME] internal walls, about 1 m² per m² of floor"},
}

# ─────────────────────────────────────────────────────────────────────────────
# 4. GLAZING  (EnergyPlus "simple glazing": whole-window U, SHGC, visible transmittance)
# ─────────────────────────────────────────────────────────────────────────────
GLAZING = {
    "single_clear": {"label": "Single clear", "u": 5.8, "shgc": 0.82, "vt": 0.88,
                     "source": "[LIT] 6 mm clear float", "look": "clear"},
    "double_lowe":  {"label": "Double low-e", "u": 1.9, "shgc": 0.38, "vt": 0.62,
                     "source": "[LIT] 6-12-6 solar-control low-e, air filled - VERIFY", "look": "slight blue-green tint"},
}

# ─────────────────────────────────────────────────────────────────────────────
# 5. SHADING DEVICES  (identical in simulation and 3D)
# ─────────────────────────────────────────────────────────────────────────────
SHADING = {
    "none": {"label": "None"},
    "overhang": {"label": "Overhang (chajja)", "depth_m": 0.60, "height_above_head_m": 0.05,
                 "side_extension_m": 0.15, "source": "[ASSUME] common 450-600 mm chajja"},
    "louvres": {"label": "Louvres", "slat_depth_m": 0.15, "slat_count": 5, "offset_from_wall_m": 0.10,
                "side_extension_m": 0.10, "note": "[ASSUME] fixed horizontal slats in front of the window"},
}

# ─────────────────────────────────────────────────────────────────────────────
# 6. OCCUPANCY, LIGHTS, EQUIPMENT  (family of 4; hourly fraction of peak, hour 0 = midnight-1am)
# ─────────────────────────────────────────────────────────────────────────────
PEOPLE = {"count": 4, "activity_w_per_person": 110, "source": "[ASSUME] family of 4, seated/light activity"}

LIGHTING = {
    "fluorescent": {"label": "Fluorescent (CFL/tube)", "w_per_m2": 5.0, "source": "[ASSUME] residential"},
    "led":         {"label": "LED", "w_per_m2": 2.5, "source": "[ASSUME] about half of fluorescent"},
}
EQUIPMENT_W_PER_M2 = 3.0  # [ASSUME] peak plug load (fridge, TV, kitchen, laptops); ~2,300 kWh/yr. Excludes water heating.

SCHEDULES = {  # 24 values each, same every day of the year
    "occupancy": [1, 1, 1, 1, 1, 1, 1, .8, .5, .25, .25, .25, .25, .25, .25, .25, .25, .5, .8, .8, .8, .8, 1, 1],
    "lighting":  [.05, .05, .05, .05, .05, .05, .3, .2, .05, .05, .05, .05, .05, .05, .05, .05, .05, .05, .6, .9, .9, .9, .5, .15],
    "equipment": [.2, .2, .2, .2, .2, .2, .6, .6, .6, .3, .3, .3, .3, .3, .3, .3, .3, .3, .7, .7, .7, .7, .7, .3],
}
# [ASSUME] AC is used when the family is home and it is hot: nights 22:00-07:00 and afternoons 13:00-17:00.
# A single zone means the whole house is cooled in those hours (an overestimate vs bedroom-only AC).
AC_AVAILABLE_HOURS = [1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 1, 1]

# ─────────────────────────────────────────────────────────────────────────────
# 7. AIR: LEAKAGE AND NATURAL VENTILATION
# ─────────────────────────────────────────────────────────────────────────────
INFILTRATION_ACH = 0.75  # [ASSUME] air changes per hour, typical Indian masonry construction - VERIFY
NATURAL_VENT = {
    "openable_fraction": 0.5,        # [ASSUME] half the window area can open (sliding/casement mix)
    "discharge_coefficient": 0.6,    # [LIT]
    "open_when_indoor_above_c": 24,  # windows open if inside is warmer than this...
    "open_when_cooler_outside_by_c": 1,  # ...and outside is at least this much cooler
    "close_when_outdoor_above_c": 32,
    "mixed_mode_ac_takes_over_c": 28,  # mixed-mode: windows close and AC runs above this
}

# ─────────────────────────────────────────────────────────────────────────────
# 8. COOLING STRATEGIES
# ─────────────────────────────────────────────────────────────────────────────
COOLING = {
    "ac24":  {"label": "AC at 24 °C", "cool_setpoint": 24, "ac": True,  "fans": False, "vent": "when AC off"},
    "ac26":  {"label": "AC at 26 °C", "cool_setpoint": 26, "ac": True,  "fans": False, "vent": "when AC off"},
    "mixed": {"label": "Mixed-mode", "cool_setpoint": 28, "ac": True,  "fans": True,
              "vent": "windows + fans first, AC only above 28 °C"},
    "nv":    {"label": "Fans + natural ventilation", "cool_setpoint": None, "ac": False, "fans": True,
              "vent": "windows + fans, no AC"},
}
HEATING_SETPOINT_C = 18  # [ASSUME] reverse-cycle AC may heat on cold mornings (AC options only; tiny in Bengaluru)

FANS = {"count": 6, "watts_each": 50, "on_above_c": 26,
        "source": "[ASSUME] 6 conventional ceiling fans, on when occupied and indoor > 26 °C (computed after the run)"}

# ─────────────────────────────────────────────────────────────────────────────
# 9. COMFORT: IMAC (India Model for Adaptive Comfort), Manu et al. 2016
# ─────────────────────────────────────────────────────────────────────────────
# Neutral temperature Tn = slope * T_out_30day_running_mean + intercept; comfortable if |T_operative - Tn| <= band.
IMAC = {
    "naturally_ventilated": {"slope": 0.54, "intercept": 12.83, "band_90pct": 2.38},  # used for fans + NV
    "mixed_mode":           {"slope": 0.28, "intercept": 17.87, "band_90pct": 3.46},  # used for mixed-mode and AC
    "running_mean_days": 30,
    "fan_upper_limit_bonus_c": 0.0,  # DECIDED: no bonus - IMAC field data already includes fan use
    "source": "[CODE-like] IMAC-C (Manu et al. 2016, Building and Environment). "
              "IMAC-R for residences (CEPT/BEE) may suit homes better - VERIFY coefficients and which model to use",
}

# ─────────────────────────────────────────────────────────────────────────────
# 10. BROWSER-ONLY OPTIONS (no simulation needed)
# ─────────────────────────────────────────────────────────────────────────────
AC_EFFICIENCY = {  # effective seasonal COP applied to the simulated cooling load
    "3star":    {"label": "3-star split", "cop": 3.5, "cost_per_tr": 38000},
    "5star":    {"label": "5-star split", "cop": 4.5, "cost_per_tr": 48000},
    "inverter": {"label": "Best inverter", "cop": 5.5, "cost_per_tr": 58000},
    "source": "[LIT]/[ESTIMATE] conservative vs rated ISEER; prices are market estimates - VERIFY",
}
SOLAR_PV = {
    "kwp_per_m2": 0.20,              # [LIT] ~20% efficient modules
    "usable_roof_fraction": 0.60,    # [ASSUME] minus tank, mumty, parapet setback, access
    "tilt_deg": 13, "azimuth_deg": 180,  # [ASSUME] tilt ~ latitude, facing south
    "performance_ratio": 0.78,       # [LIT] inverter, wiring, soiling, heat losses
    "cost_per_kwp": 55000,           # [ESTIMATE] residential rooftop 2025-26 - VERIFY
    "subsidy": {"label": "PM Surya Ghar subsidy", "per_kw_first_2": 30000, "per_kw_third": 18000, "max": 78000,
                "source": "[CODE] scheme rates at launch (2024) - VERIFY current"},
}
TARIFF = {"flat_rs_per_kwh": 7.0, "source": "Game default; BESCOM slab tariff could replace it later"}
GRID_EMISSION_KG_PER_KWH = 0.71  # [CODE] CEA CO2 baseline database, approx - VERIFY latest version

# ─────────────────────────────────────────────────────────────────────────────
# 11. COSTS OF UPGRADES  (extra cost vs the cheapest choice; base house cost not included)
# ─────────────────────────────────────────────────────────────────────────────
COSTS = {  # ALL [ESTIMATE] - VERIFY against CPWD DSR / local quotes
    "wall_rs_per_m2_opaque": {"brick": 0, "aac": 150, "rammed_earth": 400},
    "glazing_rs_per_m2_window": {"single_clear": 0, "double_lowe": 4500},
    "shading_rs_per_m2_window": {"none": 0, "overhang": 1800, "louvres": 4500},
    "roof_rs_per_m2": {"bare": 0, "insulated": 900},
    "roof_finish_rs_per_m2": {"normal": 0, "cool": 180},
    "lighting_rs_per_m2_floor": {"fluorescent": 0, "led": 60},
    "fans_rs_each": 3000,
}

# ─────────────────────────────────────────────────────────────────────────────
# 12. DESIGN OPTIONS = THE 10 SIMULATED DIMENSIONS (order fixes the row index in the table)
# ─────────────────────────────────────────────────────────────────────────────
OPTIONS = [
    ("orientation", "Orientation (long axis)", {
        "ns": "North–South (long walls face E & W)",
        "nwse": "NW–SE",
        "nesw": "NE–SW",
        "ew": "East–West (long walls face N & S)",
    }),
    ("wwr_ns", "Window-to-wall ratio, N/S walls", {"20": "20%", "30": "30%", "40": "40%"}),
    ("wwr_ew", "Window-to-wall ratio, E/W walls", {"10": "10%", "20": "20%", "30": "30%"}),
    ("glazing", "Glazing", {k: v["label"] for k, v in GLAZING.items()}),
    ("shading", "Shading", {k: v["label"] for k, v in SHADING.items()}),
    ("wall", "Walls", {k: v["label"] for k, v in WALLS.items()}),
    ("roof", "Roof", {k: v["label"] for k, v in ROOFS.items()}),
    ("roof_finish", "Roof finish", {k: v["label"] for k, v in ROOF_FINISHES.items()}),
    ("cooling", "Cooling", {k: v["label"] for k, v in COOLING.items()}),
    ("lighting", "Lighting", {k: v["label"] for k, v in LIGHTING.items()}),
]
# Compass bearing of the building's long axis, degrees clockwise from north
ORIENTATION_DEG = {"ns": 0, "nwse": 135, "nesw": 45, "ew": 90}
# Which walls get the "N/S" window ratio: the walls facing closest to north/south.
# In the 45° orientations all walls are equally close, so a tie-break is needed (DECIDED in task 2):
#   "long"  -> the long walls get the N/S ratio (treat diagonal houses as a turned E–W house)
#   "short" -> the short walls get the N/S ratio (treat diagonal houses as a turned N–S house)
WWR_TIE_BREAK = "long"  # bigger windows stay on the long walls, as in typical Indian homes


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────
def u_value(layers, r_surfaces=0.17):
    """Approximate U-value (W/m²K) from layers. r_surfaces = inside + outside surface resistance
    (0.17 for walls, ~0.14 for roofs with heat flowing down)."""
    r = r_surfaces + sum(t / MATERIALS[m][0] for m, t in layers)
    return 1.0 / r


def combination_count():
    n = 1
    for _, _, choices in OPTIONS:
        n *= len(choices)
    return n


def summary():
    g = GEOMETRY
    print(f"CITY      {CITY['name']} ({CITY['climate_zone']}), lat {CITY['lat']}, lon {CITY['lon']}")
    print(f"WEATHER   {CITY['weather_file'].name}  exists: {CITY['weather_file'].exists()}")
    print(f"BUILDING  {g['length_m']:.2f} m x {g['width_m']:.2f} m x {g['floors']} floors "
          f"= {g['length_m']*g['width_m']*g['floors']:.0f} m², walls {g['floors']*g['floor_to_floor_m']:.1f} m high\n")
    print("WALLS (U-value)")
    for v in WALLS.values():
        print(f"  {v['label']:28} U = {u_value(v['layers']):.2f}")
    print("ROOFS (U-value)")
    for v in ROOFS.values():
        print(f"  {v['label']:28} U = {u_value(v['layers'], 0.14):.2f}")
    print("GLAZING")
    for v in GLAZING.values():
        print(f"  {v['label']:28} U = {v['u']}, SHGC = {v['shgc']}, light = {v['vt']}")
    print("\nDESIGN OPTIONS")
    for key, label, choices in OPTIONS:
        print(f"  {label:34} {len(choices)}: {', '.join(choices.values())}")
    print(f"  {'Total combinations':34} {combination_count():,}")
    occ = sum(SCHEDULES["occupancy"]) * PEOPLE["count"]
    plug = sum(SCHEDULES["equipment"]) * EQUIPMENT_W_PER_M2 * g["floor_area_total_m2"] * 365 / 1000
    print(f"\nPEOPLE    {PEOPLE['count']} occupants, {occ:.0f} person-hours per day")
    print(f"PLUGS     ~{plug:,.0f} kWh per year")
    print(f"AC HOURS  {sum(AC_AVAILABLE_HOURS)} hours per day available (AC options)")
    print(f"AIR       infiltration {INFILTRATION_ACH} ACH")
    roof_area = g["length_m"] * g["width_m"]
    max_kwp = roof_area * SOLAR_PV["usable_roof_fraction"] * SOLAR_PV["kwp_per_m2"]
    print(f"SOLAR     max {max_kwp:.1f} kWp on {roof_area*SOLAR_PV['usable_roof_fraction']:.0f} m² usable roof, "
          f"₹{SOLAR_PV['cost_per_kwp']:,}/kWp")
    print(f"TARIFF    ₹{TARIFF['flat_rs_per_kwh']}/kWh")
    n_verify = Path(__file__).read_text(encoding="utf-8").count("- VERIFY")
    print(f"\n{n_verify} values are marked VERIFY (search the file for 'VERIFY').")


if __name__ == "__main__":
    import sys
    sys.stdout.reconfigure(encoding="utf-8")
    summary()
