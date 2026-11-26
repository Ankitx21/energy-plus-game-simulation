# Net Zero Builder: Stage 1 plan (Bengaluru game)

**Vision:** help people in India design buildings that are comfortable, low-energy and net zero, by giving instant visual feedback from real EnergyPlus simulation. Stage 1 teaches through a game; Stage 2 (later) will let users enter their own building.

**Stage 1 goal:** a polished browser game in which the player redesigns a 220 m² Bengaluru home so that it is net zero (solar ≥ yearly energy use), comfortable and within budget. All results come from pre-computed EnergyPlus runs. Players learn what matters most in this climate.

**How we work:** one task at a time. After each task I report what was done and what to check, then wait for your go-ahead.

---

## 1. Scope

### In scope
- 1 city: Bengaluru (lat 12.97, long 77.59), temperate climate zone
- 1 building: 2-storey home, 220 m² (110 m² per floor)
- 20,736 design combinations, all simulated in EnergyPlus
- A realistic 3D building under the real sun
- The six game features (section 6)
- A Bengaluru-only start screen (the prototype's other 5 levels are removed)

### Not in Stage 1 (later stages)
Other cities · user-entered buildings · trained prediction model · ENS code check · online hosting

---

## 2. Simulation model ("shoebox")

| Item | Value |
|---|---|
| Footprint | 15.0 m × 7.33 m = 110 m² (long side about twice the short side) |
| Floors | 2 × 3.0 m floor-to-floor, so 6.0 m wall height |
| Zones | 1 thermal zone, floor area set to 220 m², intermediate floor modelled as internal mass |
| Cooling | Ideal loads (EnergyPlus calculates the heat to remove; the browser applies AC efficiency) |
| Outputs | Monthly values; faster settings (timestep 4, simplified solar) if the timing test needs them |
| Weather | Bengaluru TMYx file from climate.onebuilding.org |
| Schedules | Typical Indian family of 4–5; AC hours from Indian survey data (IRES 2020) |

**Golden rule:** the 3D building has exactly the same dimensions, orientation, window area per facade and shading devices as the simulated shoebox. Decorative details (plinth, parapet, tank, mumty, frames) do not change what was simulated.

---

## 3. Design options (simulated, 20,736 combinations)

| # | Option | Choices | Count |
|---|---|---|---|
| 1 | Orientation (long axis) | N–S, NW–SE, NE–SW, E–W | 4 |
| 2 | Window-to-wall ratio, N/S walls | 20, 30, 40% | 3 |
| 3 | Window-to-wall ratio, E/W walls | 10, 20, 30% | 3 |
| 4 | Glazing | Single clear, double low-e | 2 |
| 5 | Shading | None, overhang (chajja), louvres | 3 |
| 6 | Walls | Brick, AAC block, rammed earth | 3 |
| 7 | Roof | Bare RCC, +50 mm insulation | 2 |
| 8 | Roof finish | Normal, cool roof | 2 |
| 9 | Cooling | AC 24 °C, AC 26 °C, mixed-mode, fans + natural ventilation | 4 |
| 10 | Lighting | Fluorescent, LED | 2 |

4 × 3 × 3 × 2 × 3 × 3 × 2 × 2 × 4 × 2 = **20,736**

**Browser-only options** (simple maths, no simulation): AC efficiency (3-star, 5-star, inverter) · solar roof coverage (0–100%) · electricity tariff (default ₹7/kWh).

### Outputs per design
- Monthly energy (kWh): cooling load, heating load, lighting, fans, plug loads
- Comfort %: share of occupied hours inside the Indian adaptive comfort band (IMAC)
- Peak cooling load (kW)
- Annual heat gain by source (kWh): windows (solar), windows (conduction), walls, roof, air leakage/ventilation, people, lights, equipment

---

## 4. Browser maths (on top of the table)

| Calculation | Method |
|---|---|
| AC electricity | Cooling load ÷ efficiency of chosen AC |
| Solar output | kWp × monthly yield per kWp for Bengaluru (pre-computed with pvlib) |
| Cost | Upgrade costs (CPWD rates) + AC + solar |
| Monthly bill | Net grid kWh × tariff |
| Payback | Upgrade or solar cost ÷ yearly bill saving |
| Score | Net zero %, comfort, cost vs budget, + bonus for correct predictions |

---

## 5. 3D scene

- **Building:** plinth, window frames and sills, chajjas or louvres, parapet, water tank, mumty (stair headroom); outdoor AC units only with AC options; ceiling fans visible through windows with fan options
- **Materials that follow the options:** exposed brick, plastered AAC, layered rammed earth, grey RCC vs white cool roof, clear vs slightly tinted low-e glass, solar panels sized to the coverage (CC0 textures from ambientCG / Poly Haven, or procedural)
- **Sun:** real position for Bengaluru from date and time (suncalc); time slider, month selector, "play the day"; real-time shadows; sun-path arc for the month; compass; sky colour by time of day
- **Site:** grass, paving, 1–2 trees, compound wall and gate, neighbouring buildings as grey blocks
- **Overlays (toggle):** heat-flow arrows sized by simulated gains · facade heat map · % of window area in shadow right now
- **Camera:** orbit, zoom, presets (street, aerial, each facade)
- **Performance:** quality setting (shadow resolution, detail) for laptops and mid-range phones

---

## 6. Game features

1. **Predict before you simulate:** "Will energy use go up or down, and by about how much?" (3–4 choices); show whether the guess was right, with bonus points
2. **Window ratio per facade:** separate N/S and E/W choices, shown on the 3D building
3. **Heat-flow breakdown:** chart of heat sources, largest highlighted, one line of advice
4. **Design explorer:** scatter of all designs (cost vs energy), player's design highlighted, best trade-offs (Pareto front) marked; click a dot to load it
5. **What matters most:** ranked bar chart of which option changes energy use most in Bengaluru, calculated from the table
6. **Bill and missions:** monthly bill in ₹, payback years for solar and upgrades; missions "cheapest net zero", "no-AC challenge", "lowest energy within budget"

---

## 7. Project structure

```
energy-simulation-game/
├─ PLAN.md                      this plan
├─ README.md                    short overview
├─ requirements.txt             Python packages
├─ prototype/                   original single-file prototype (kept for reference)
├─ sim/                         simulation pipeline (Python)
│  ├─ inputs.py                 options, materials, schedules, costs (one readable file)
│  ├─ check_weather.py          prints a monthly summary of the weather file
│  ├─ make_idf.py               writes one EnergyPlus model for one design
│  ├─ run_batch.py              runs all designs in parallel, resumable, takes --city
│  ├─ export_table.py           results → one compact table for the game
│  ├─ weather/                  Bengaluru weather file
│  └─ runs/                     raw EnergyPlus outputs (large, not shipped)
├─ game/                        the game (open via a local web server)
│  ├─ index.html
│  ├─ css/
│  ├─ js/                       engine, scene, sun, overlays, charts, ui, missions
│  ├─ data/                     blr table (< 5 MB) + metadata
│  └─ vendor/                   three.js, suncalc (local copies, works offline)
└─ docs/
   ├─ SETUP.md                  plain-language setup and run guide
   ├─ ASSUMPTIONS.md            one page of modelling assumptions for expert review
   └─ reference/                papers (not tracked in git)
```

---

## 8. Tasks (one at a time; I stop after each)

| # | Task | Done when | Your laptop | Status |
|---|---|---|---|---|
| **A. Simulation pipeline** |||||
| 1 | **Setup and inputs:** folders, Bengaluru weather file, `sim/inputs.py` with Indian material values (ECBC/ENS), schedules, IMAC, tariff, CPWD costs | You can read and check every input value in one file | — | ☐ |
| 2 | **Shoebox model:** `make_idf.py`; build and run 1 design | 1 sample model runs; results shown in plain language | ~1 min | ☐ |
| 3 | **Test batch:** ~50 designs, timing, sanity checks (shading lowers cooling, cool roof lowers roof gain, energy per m² in a realistic range) | Checks pass; estimated full-batch time known | ~5 min | ☐ |
| 4 | **Full batch:** all 20,736 designs | All runs finished (can resume if stopped) | **~3 h** | ☐ |
| 5 | **Export:** one table < 5 MB, plus "what matters most" ranking and Pareto front | Data file ready; summary of key findings for Bengaluru | ~5 min | ☐ |
| **B. Game** (tasks 6–9 can be done while task 4 runs) |||||
| 6 | **Game skeleton:** split prototype into files, Bengaluru-only start screen, new option panel, load table, browser maths | Game plays with real data (still 2D) | — | ☐ |
| 7 | **3D building:** geometry matching the shoebox, windows per facade, shading, materials that change with options | Building changes correctly with every option | — | ☐ |
| 8 | **Sun and shadows:** suncalc, time/month controls, play the day, sun path, compass, sky | Overhang visibly shades windows at May noon | — | ☐ |
| 9 | **Site, details, camera, quality:** compound, trees, neighbours, tank, mumty, AC units, fans, presets, quality setting | Scene looks finished; runs smoothly | — | ☐ |
| 10 | **Overlays:** heat-flow arrows, facade heat map, window-shadow % readout | Overlays match simulated gains | — | ☐ |
| 11 | **Features 1–3:** predict-before-simulate, window ratio per facade, heat-flow chart + advice | Working in game | — | ☐ |
| 12 | **Features 4–5:** design explorer (scatter + Pareto, click to load), what matters most | Working in game | — | ☐ |
| 13 | **Feature 6:** bill, payback, 3 missions | Working in game | — | ☐ |
| **C. Finish** |||||
| 14 | **Polish and guides:** test laptop and phone sizes, fix issues, write `SETUP.md` and `ASSUMPTIONS.md` | Demo complete; anyone can run it from the guide | — | ☐ |

---

## 9. Git workflow (version tracking)

- The project is a local git repository; `main` always holds approved, working work.
- Each task gets its own branch, e.g. `task/01-setup`. All work for that task is committed there.
- When you approve a task, it is merged into `main` and tagged (`task-01`, `task-02`…), so any finished stage can be restored.
- Commits are local only. Nothing is pushed online unless you ask (e.g. to GitHub for hosting later).
- Not tracked: raw EnergyPlus outputs (`sim/runs/`, regenerated by the scripts) and reference papers (`docs/reference/`).

Useful commands:
```
git log --oneline --graph --all   # history of all tasks
git tag                           # list finished tasks
git checkout task-03              # look at the project as it was after task 3
git checkout main                 # back to the latest approved version
```

## 10. Decisions made

- Game first, Bengaluru only; other prototype levels removed
- Faster EnergyPlus settings if the timing test (task 3) needs them
- Guide written for someone new to EnergyPlus
- Scripts accept `--city` so more cities can be added later without code changes
- Game files run locally with one command (`python -m http.server`); no backend, no paid services
- Free sources only: EnergyPlus 26.2 (installed), Python, pvlib, three.js, suncalc, climate.onebuilding.org, CC0 textures

## 11. Open questions (to settle in task 2)

1. **Window ratios when the building is rotated.** In the NW–SE and NE–SW orientations no wall faces exactly north or south. Proposal: "N/S windows" apply to the pair of walls facing closest to north and south, and the game shows that on the 3D building. (At exactly 45° both pairs are equally close, so the rule needs a tie-break; I'll show you options.)
2. **Comfort with fans.** IMAC allows a higher comfortable temperature when fans move the air. Proposal: apply that higher limit in the fan and mixed-mode options.
3. **Budget for the level.** Proposal: set it after task 5, so that net zero is possible but needs smart choices.

## 12. Risks

| Risk | Plan |
|---|---|
| Batch takes longer than 3 h | Faster settings; batch resumes if interrupted |
| EnergyPlus errors in the first runs | Fixed in task 2 before any batch |
| Results look unrealistic | Sanity checks in task 3; expert review of `ASSUMPTIONS.md` |
| Slow on phones | Quality setting; low-resolution shadows; simpler geometry |
| Usage limits mid-task | Work is saved after every task; this plan tracks progress |
