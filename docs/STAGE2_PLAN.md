# Stage 2 plan: a trained model for any building, any Indian city

**Status:** proposed, not started. Stage 1 (the Bengaluru game) is complete and tagged `v1.0`.
**Start here** if you are picking the project up on another computer, or in a new Claude session: read this file, then [PLAN.md](../PLAN.md) for how stage 1 was built.

---

## 1. The idea in one paragraph

The game is instant because all 20,736 combinations of one fixed house were simulated in advance and stored in a lookup table. That cannot work for real buildings, whose sizes, window ratios and materials can take any value, in any city. Stage 2 instead **trains a small machine-learning model (a "surrogate") to imitate EnergyPlus**. We simulate tens of thousands of random, realistic buildings with the same automated pipeline, the model learns how the inputs drive the results, and then it predicts EnergyPlus's answer for a new building in about a millisecond, inside the browser, with no EnergyPlus and no server.

```
Your building's values  →  trained model  →  cooling, energy use, comfort, peak load, heat gains
(size, WWR, U-values,      (a few MB, runs     in ~1 ms
 SHGC, shading, city…)      in the browser)
```

## 2. Why it is feasible even with "infinite" combinations

- We do not simulate every building. The model **learns patterns from a well-spread sample** and fills in between, the way a doctor estimates weight from height and age without having met you.
- Building physics changes **smoothly** (21 % glass behaves almost like 20 %), so about 50,000–100,000 samples spread evenly (Latin hypercube sampling) can cover about 20 inputs. Published surrogates of this kind typically land within a few percent of EnergyPlus.
- A **pilot run** (about 2,000 buildings) measures the real accuracy before committing to the full run.

## 3. How rooms are handled: levels of detail

| Level | What it models | Feasible? | Expected accuracy vs EnergyPlus | Good for | When |
|---|---|---|---|---|---|
| 1. Whole building | One zone (like the game) | Yes | a few % on yearly energy | early choices: shape, glass, walls, roof, cooling, solar | **Stage 2** |
| 2. Orientation zones | Per floor: N, S, E, W perimeter strips + core; ground, middle and top floor separately (standard energy-code method) | Yes | a few % whole building, ~5–10 % per zone | "the west side and top floor overheat" | **Stage 2** |
| 3. Room by room | A building = a set of rooms; a room model predicts each (size, exposed walls, orientation, glass, floor position, use) and they are added up. Handles any plan (L-shapes, courtyards) | Yes, research-level | ~5–15 % per room; total usually better | room comfort, any plan | Stage 3 |
| 4. Exact check | Import the real model (SketchUp / Revit / gbXML) and run real EnergyPlus | Yes, not instant (minutes) | exact to EnergyPlus | final check of a real design | Later |

**Decision proposed:** stage 2 = Levels 1 + 2.

## 4. User inputs (proposed; agreeing this is task 1)

Each extra input needs more training runs. **Core set (19):** city, area, floors, aspect ratio, orientation, window % on each facade (4), glass U, glass SHGC, shading depth, wall U, wall mass, roof U, roof colour, air leakage, cooling mode, AC setpoint, occupants, lighting.

| Group | Input | Range / choices |
|---|---|---|
| Location | City | 20–30 cities, at least one per climate zone (hot-dry, warm-humid, composite, temperate, cold) |
| Shape | Total floor area | 60 – 500 m² |
| | Floors | 1 – 4 |
| | Aspect ratio (length ÷ width) | 1 – 3 |
| | Floor-to-floor height | 2.8 – 3.6 m |
| | Orientation of long axis | 0 – 180° |
| Windows | Window-to-wall ratio N, S, E, W (separately) | 0 – 60 % each |
| | Glass U-value | 1.5 – 5.8 W/m²K |
| | Glass SHGC | 0.2 – 0.85 |
| | Shading (chajja) depth | 0 – 1.2 m |
| | Side fins | optional, 0 – 0.6 m |
| | Openable window share | 20 – 80 % |
| Walls and roof | Wall U-value (picked from a material list) | 0.3 – 3.0 W/m²K |
| | Wall thermal mass | light / medium / heavy |
| | Wall solar absorptance (colour) | 0.3 – 0.8 |
| | Roof U-value | 0.3 – 3.5 W/m²K |
| | Roof solar absorptance | 0.2 – 0.8 |
| | Roof exposed | yes / no (middle-floor flat) |
| Air and cooling | Air leakage | 0.3 – 1.5 air changes per hour |
| | Cooling mode | AC / mixed-mode / fans only |
| | AC setpoint | 22 – 28 °C |
| | AC hours | night / night + afternoon / all day |
| People and use | Occupants | 1 – 10 |
| | Lighting power | 2 – 8 W/m² |
| | Appliance power | 2 – 8 W/m² |

**Stays as browser maths (no training needed),** exactly as in the game: AC efficiency, tariff and bill, rooftop solar size, cost, subsidy and payback, CO₂, and the **ENS (Eco Niwas Samhita) compliance check**, which is a code formula and can be exact.

**Model outputs:** monthly cooling and heating need, energy use per m², comfort % (IMAC), peak cooling load (AC size), heat-gain breakdown (walls, roof, windows per facade, air, internal), hottest indoor temperature; per zone for Level 2.

## 5. How the training works

1. **Sample:** a script draws random realistic buildings across the input ranges (Latin hypercube, so no region is missed).
2. **Simulate:** each is built as an EnergyPlus model and run automatically. This reuses the stage 1 pipeline (`sim/make_idf.py`, `sim/run_batch.py`), which was written to take `--city` and to be resumable and parallel.
3. **Table:** one row per building, its inputs alongside its EnergyPlus results.
4. **Train** on about 80 % of rows. Compare gradient-boosted trees (LightGBM) and a small neural network; keep the more accurate one that is small enough for the browser (target < 5 MB).
5. **Test** on the 20 % the model never saw, against EnergyPlus's real answers. Where it is weak, simulate more buildings in that region and retrain.
6. **Export** to the browser. Train about 5 models: where they disagree, the tool shows "less certain here".
7. **Benchmark:** the 20,736 exact stage 1 results for Bengaluru double as a test set.

## 6. Reliability

**A. Model vs EnergyPlus**, measured on the held-out buildings. Targets (the pilot gives the real numbers):

| Output | Expected error |
|---|---|
| Yearly cooling / energy use | ~2–5 % |
| Monthly values | ~5–8 % |
| Comfort % | ~±1–3 points |
| Peak cooling (AC size) | ~5–10 % |

**B. EnergyPlus model vs a real building:** depends on the simplifications (box shape, zoning, typical occupants, estimated prices; see [ASSUMPTIONS.md](ASSUMPTIONS.md)). Good for comparing options and early design, not a guaranteed bill or certification.

**Safeguards:** a warning when inputs are outside the trained ranges, the confidence indicator, and a published accuracy report.
**Struggles:** atriums, double-height spaces, curved glass, detailed shading from neighbours and trees, complex cross-ventilation.

## 7. Computing time

Almost all time is spent **generating examples with EnergyPlus**; training takes minutes. EnergyPlus uses one core per run and the batch runs one per core, so **cores matter most**. A GPU does not help EnergyPlus.

| Step | Laptop (i5-1235U, ~90 runs/min) | **Desktop (Ryzen 9 7950X3D, 16 cores / 32 threads, 128 GB; est. 400–650 runs/min)** |
|---|---|---|
| Speed test | ~2 min | ~1 min |
| Re-run game batch (20,736) | ~4–8 h | ~35–50 min |
| Pilot (~2,000 buildings, 3 cities) | ~1 h | ~10–20 min |
| Level 1 data (100,000 runs) | ~18 h | ~3–4 h |
| Level 2 data (100,000 runs, 5 zones per floor; each run ~3–5× slower) | ~3–4 days | ~10–16 h (one night) |
| Train one model | ~10–30 min | ~2–10 min |
| Final 5-model set with tuning | ~2–3 h | ~30–60 min |

Desktop numbers are estimates until the speed test is run there. Work can also be split across machines with `run_batch.py --rows`. Cloud option: a rented 64-core machine costs roughly ₹200–400 an hour.

## 8. Tasks (one at a time; report after each and wait for go-ahead)

| # | Task | Done when |
|---|---|---|
| 0 | **Finish stage 1:** play-test feedback; accuracy check (re-run ~20 designs with accurate settings, confirm the window heat split is not double counting, heat in ≈ heat out, compare with published Indian home benchmarks) | Report on how far the game's numbers can be trusted |
| 1 | **Inputs and ranges:** agree the final input list (section 4) | Signed-off input specification |
| 2 | **Flexible model builder:** `make_idf.py` builds any box building from continuous values, with Level 2 zoning | Random buildings run without errors; geometry checked |
| 3 | **Cities:** choose 20–25 cities across all climate zones; download free TMYx weather files | Weather files in `sim/weather/` |
| 4 | **Pilot:** ~2,000 buildings in 3 cities; train a first model | Real accuracy numbers; go / adjust decision |
| 5 | **Full data run:** 50,000–100,000 buildings (desktop) | All runs done, sanity checks pass |
| 6 | **Train, test, export** the final model set | Accuracy report; model file < 5 MB |
| 7 | **Tool interface:** input form, sliders, instant results; reuse the game's charts, heat breakdown, bill, payback, best moves | Working in the browser |
| 8 | **ENS check** | Matches the code's worked examples |
| 9 | **Guides, accuracy report and tests** | Anyone can run it from the guide |

## 9. Setting up on another computer (e.g. the desktop)

1. Install Git, Python 3.10+ and EnergyPlus 26.2 (default folder `C:\EnergyPlusV26-2-0\`; otherwise edit `ENERGYPLUS` in `sim/simulate.py`).
2. `git clone https://github.com/Ankitx21/energy-plus-game-simulation.git`, then `pip install -r requirements.txt`.
3. Windows power mode **Best performance**, sleep off.
4. Speed test: `python sim/run_batch.py --test --workers 30`.
5. Not in git (too large): the raw stage 1 outputs `sim/runs/blr_fast/results.jsonl`. Copy them by hand only if you need to re-check or re-export stage 1.

## 10. Future scope (after stage 2)

**Near term:** apartments (middle floors, shared walls); offices and schools (ECBC); bedroom-only and multi-zone AC use; state-wise CPWD cost data; Hindi, Kannada, Tamil and other languages.
**Medium term:** import SketchUp / Revit / gbXML to fill in the inputs; 2050 climate weather files; embodied carbon of materials; daylight and glare; a classroom mode with teacher dashboards.
**Long term:** validation against real homes' smart-meter data; policy studies (e.g. city-wide cool roofs); an open India-wide dataset and a research publication; an API for other tools and government portals.

## 11. Working agreements carried over from stage 1

- One task at a time: finish, report in plain language, wait for the go-ahead.
- Free tools only (EnergyPlus, Python, pvlib, three.js); no backend for the finished tool.
- A git branch per task, merged into `main`, tagged; push to GitHub only when asked.
- All input values in one file with source tags, and values to verify marked `VERIFY`.
