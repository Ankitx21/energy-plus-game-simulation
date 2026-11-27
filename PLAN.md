# Net Zero Builder: Stage 1 plan (Bengaluru game)

**Vision:** help people in India design buildings that are comfortable, low-energy and net zero, by giving instant visual feedback from real EnergyPlus simulation. Stage 1 teaches through a game; Stage 2 (later) will let users enter their own building: see [docs/STAGE2_PLAN.md](docs/STAGE2_PLAN.md).

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
│  ├─ epw.py                    weather-file helpers (temperatures, running mean)
│  ├─ make_idf.py               geometry + one EnergyPlus model for one design
│  ├─ simulate.py               runs one design, turns output into game numbers
│  ├─ sample/                   sample model (base.idf) and its result
│  ├─ run_batch.py              runs all designs in parallel, resumable, takes --city
│  ├─ check_results.py          automatic physics sanity checks on results
│  ├─ export_table.py           results → one compact table for the game
│  ├─ weather/                  Bengaluru weather file
│  └─ runs/                     raw EnergyPlus outputs (large, not shipped)
├─ play.bat                     double-click to start the game (local web server + browser)
├─ game/                        the game (open via a local web server)
│  ├─ index.html
│  ├─ css/style.css
│  ├─ js/main.js                start-up and loading
│  ├─ js/data.js                loads the table, design ↔ row lookup
│  ├─ js/engine.js              browser maths: AC efficiency, solar, cost, bill, score, best moves
│  ├─ js/ui.js                  screens and panels
│  ├─ js/charts.js              SVG charts
│  ├─ js/scene3d.js             three.js house built from the exact simulated geometry
│  ├─ js/sun.js                 sun position (NOAA equations), sunrise/sunset, daily sun path
│  ├─ js/sunui.js               month selector, time slider, "play the day", readout
│  ├─ js/overlays3d.js          heat-flow arrows, facade heat map, window-shadow % (from simulated data)
│  ├─ js/site3d.js              plot, compound wall + gate, paving, road, trees, neighbouring blocks
│  ├─ js/textures.js            procedural materials (brick, AAC plaster, rammed earth, roofs, grass)
│  ├─ js/scene2d.js             2D fallback for devices without WebGL
│  ├─ dev/                      developer pages: scene.html (render any design), golden.html (golden-rule test)
│  ├─ vendor/                   three.js 0.170 (MIT), OrbitControls, RoomEnvironment
│  ├─ data/                     blr.bin table (2.4 MB) + blr.json metadata, from sim/export_table.py
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
| 1 | **Setup and inputs:** folders, Bengaluru weather file, `sim/inputs.py` with Indian material values (ECBC/ENS), schedules, IMAC, tariff, CPWD costs | You can read and check every input value in one file | — | ✅ done |
| 2 | **Shoebox model:** `make_idf.py`; build and run 1 design | 1 sample model runs; results shown in plain language | ~1 min | ✅ done |
| 3 | **Test batch:** ~50 designs, timing, sanity checks (shading lowers cooling, cool roof lowers roof gain, energy per m² in a realistic range) | Checks pass; estimated full-batch time known | ~5 min | ✅ done |
| 4 | **Full batch:** all 20,736 designs | All runs finished (can resume if stopped) | **~3 h** | ✅ done |
| 5 | **Export:** one table < 5 MB, plus "what matters most" ranking and Pareto front | Data file ready; summary of key findings for Bengaluru | ~5 min | ✅ done |
| **B. Game** (tasks 6–9 can be done while task 4 runs) |||||
| 6 | **Game skeleton:** split prototype into files, Bengaluru-only start screen, new option panel, load table, browser maths | Game plays with real data (still 2D) | — | ✅ done |
| 7 | **3D building:** geometry matching the shoebox, windows per facade, shading, materials that change with options | Building changes correctly with every option | — | ✅ done |
| 8 | **Sun and shadows:** suncalc, time/month controls, play the day, sun path, compass, sky | Real sun position; shadows move with time and month | — | ✅ done |
| 9 | **Site, details, camera, quality:** compound, trees, neighbours, tank, mumty, AC units, fans, presets, quality setting | Scene looks finished; runs smoothly | — | ✅ done |
| 10 | **Overlays:** heat-flow arrows, facade heat map, window-shadow % readout | Overlays match simulated gains | — | ✅ done |
| 11 | **Features 1–3:** predict-before-simulate, window ratio per facade, heat-flow chart + advice | Working in game | — | ✅ done |
| 12 | **Features 4–5:** design explorer (scatter + Pareto, click to load), what matters most | Working in game | — | ✅ done |
| 13 | **Feature 6:** bill, payback, 3 missions | Working in game | — | ✅ done |
| **C. Finish** |||||
| 14 | **Polish and guides:** test laptop and phone sizes, fix issues, write `SETUP.md` and `ASSUMPTIONS.md` | Demo complete; anyone can run it from the guide | — | ✅ done |

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

## 11. Open questions

1. ~~Window ratios when the building is rotated.~~ **Decided (task 2):** each wall gets the ratio of the direction it faces most closely. In the 45° orientations the **long walls get the N/S ratio**, so the bigger windows stay on the long walls as in typical homes.
2. ~~Comfort with fans.~~ **Decided (task 2):** no extra allowance; the IMAC comfort band already comes from surveys in buildings with fans.
3. **Budget for the level.** Proposal: set it after task 5, so that net zero is possible but needs smart choices.

## Task 2 findings

- One EnergyPlus run takes **about 2–3 s**, so the full batch should take roughly **1.5–2 h** on 8–10 parallel workers.
- Developer's draft: 73 kWh/m²·yr, 91% comfortable, 65% of heat gain through windows (mostly east and west glass).
- Each change moves energy the right way: overhang −13% cooling, louvres −14%, cool roof −20%; a well-designed mixed-mode house uses 17 kWh/m²·yr at 99% comfort.
- Peak cooling (29 kW for the draft) is inflated because the whole house is cooled at 1 pm after heating up all morning (single zone + AC schedule). Worth expert review; it only affects AC sizing cost.

## Task 3 findings

- **Settings:** "fast" now means 2 timesteps per hour. Tested on 8 designs against the most accurate settings: annual cooling within ±0.8%, comfort within ±0.5 points, peak cooling up to 10% lower; 2.5x faster.
- **Speed on this laptop:** a single run takes ~1.5 s, but 10 parallel runs share a 15 W chip, so sustained throughput is **~91 designs/min**. Full batch: **about 3h 40m** (600 rows already done). Setting Windows power mode to "Best performance" may shorten this.
- **Physics checks:** all 19 checks pass on 52 test designs and on 600 batch designs (every one-change pair moves the right quantity the right way).
- **Real effect found:** with a white cool roof and no full-time AC, adding roof insulation *raises* roof heat gain (the bare slab cools to the night sky; insulation blocks that). Good material for a "predict" question in the game.

## Task 4 notes
- All 20,736 designs simulated (8 h 21 m wall time, including two laptop sleeps; about 90 designs/min when awake).
- 8 runs timed out around the sleeps; a re-run retried them with no errors.
- `check_results.py`: all checks pass. Ranges: energy use 17–74 kWh/m²·yr, comfort 78–100%, peak cooling up to 29.1 kW.
- Finding: with a **white cool roof**, adding roof insulation raises roof heat gain in 644 of 2,592 AC pairs and raises yearly cooling in most of them (median +470 to +870 kWh). The bare slab sheds indoor heat to the night sky, and AC runs only 13 h a day. With a normal roof, insulation always helps (cooling −1,000 to −8,000 kWh). The roof rule now covers the normal finish only. Good teaching moment for the game: "cool roof first; insulation on top of it may not pay".

## Task 5 notes
- Final export: all 20,736 designs, `game/data/blr.bin` 2.36 MB + `blr.json` 57 kB (now committed).
- `game/js/analysis.js`: whole-table maths shared by the game and `sim/findings.mjs` (Node) so both always agree: evaluate every design, Pareto front, "what matters most" (average effect of each choice), best answer for each mission.
- `docs/FINDINGS.md`: key findings in plain words, ranges, ranking, Pareto front, mission answers. Regenerate with `node sim/findings.mjs --md docs/FINDINGS.md`.
- Level tuned: budget ₹7 L (bolting solar on the draft costs ₹8.2 L), energy target 30 kWh/m²·yr, comfort 90 %, no-AC challenge 92 %.
- Score rebalanced (out of 1000): net zero 350, comfort 250 (relative to target), energy 200 (linear from 80 to target), budget 200. Every sensible single move now raises the score.

## Task 11 notes
- `game/js/features.js`. **Predict first:** before each simulation a dialog asks whether energy use and comfort will go up, down or stay about the same (±1); the result panel then shows ✓/✗ with the real change and a running tally. Skip or "don't ask me" (remembered) are allowed.
- **Window ratio per facade:** table under the Windows options (compass, % glass, window count, m², change since last run) and a "Window %" 3D overlay labelling each facade.
- **Where the heat comes from:** card under the monthly chart with yearly heat gain per source (windows per facade, walls, roof, air, people, lights, appliances), sorted, with the change since the previous run; up to three plain-language tips from the biggest sources, each with "Try it" (sets the option; the player still has to simulate, so tips never reveal numbers).

## Task 12 notes
- `game/js/explorer.js`, opened with "Explore all designs" in the top bar. It unlocks for good after the first submit (or when simulations run out); before that it asks "Peek at every answer?".
- **All designs:** canvas scatter of all 20,736 designs (cost vs energy use) with the player's AC choice; blue = comfortable ≥ target, grey = less; orange line = best-value front (cheapest for its energy use, comfortable); budget and target guides; "Your design" ring. Filters: cooling mode, solar none / sized for net zero. Hover tooltip, click to load into the design (still needs a simulation). The front is also listed as a table with Load buttons (accessible view).
- **What matters most:** options ranked by how far average energy use moves between their best and worst choice, with each choice's average and the comfort swing.
- Colours validated for colour-blind separation in light and dark mode.
- Dev shortcut: `?play&xopen` or `?play&xopen=matters`.

## Task 13 notes
- **Bill and payback card:** monthly bill in ₹ with net metering (bars above zero = pay, below = solar credit), yearly bill, extra cost vs the developer's draft, yearly saving, payback in years and the 25-year balance. Follows the tariff and subsidy settings.
- **Missions** (start screen; `game/js/analysis.js` `MISSIONS`): Cheapest net zero (≥ 90 % comfort), No-AC challenge (fans only, net zero, ≥ 92 % comfort; 70 % comfort + 30 % cost), Lowest energy within budget (≥ 90 % comfort). On start the game searches every design × AC efficiency × solar size for the best possible answer (about a second).
- Mission score: below the goal up to 399 for progress (so hints still work); goal met 400 + 600 × closeness to the best. Stars: goal met, within 80 %, within 95 %. Submitting shows the best possible value. AC modes are locked in the no-AC challenge.
- Header shows total stars across the main level and the three missions (12). Any submit unlocks the explorer.

## Task 14 notes
- Guides: `docs/SETUP.md` (play, host, re-create the data, troubleshooting) and `docs/ASSUMPTIONS.md` (every simplification, value and limit); README rewritten.
- Polish: no repeated group headings in the option panel; clearer weather label; larger Window % labels; `dev/scene.html?wwr`.
- Tests: golden rule ALL PASS (worst 0.05 mm) after fixing the test to ignore part tags it does not check; jsdom runs through the main level, predictions, explorer unlock, bill and all three missions with no errors; laptop (1400 px) and phone (375 px) layouts checked, with no sideways overflow on the phone.
- **Stage 1 (the Bengaluru game) is complete.** Stage 2 (more cities, ENS check, bring-your-own-building tool) is next: see [docs/STAGE2_PLAN.md](docs/STAGE2_PLAN.md).

## Task 6 notes

- `sim/export_table.py` was written now (not in task 5) because the game needs the data format; task 5 re-runs it on the full results and adds rankings and the Pareto front.
- Lookups in the browser match the Python results exactly (draft: cooling 40,653 kWh, comfort 91.6%, peak 28.1 kW).
- Solar yield from pvlib with the same weather file: 1,483 kWh per kWp per year.
- Draft economics: AC ₹3.0 L; full-roof solar (13.2 kWp) makes it net zero but costs ₹9.5 L, over the placeholder ₹8 L budget.
- To tune in task 5: score weights (an overhang currently lowers the score because its cost outweighs its energy saving at the placeholder targets), budget, energy target.
- Removed from the prototype: other cities, 2050 climate toggle, daylight score (no daylight data in the table).

## Task 7 notes

- **Golden rule verified automatically:** `python sim/make_golden_ref.py`, then open `dev/golden.html`. In 6 designs (incl. both 45° orientations) all 120 windows and 360 shading devices sit within 0.05 mm of the simulated geometry.
- Walls are extruded from the simulated outer faces with real thicknesses (brick 242 mm, AAC 227 mm, rammed earth 312 mm); glass sits 70 mm inside the outer face.
- Decorative parts that cannot shade the windows: plinth band, flush floor band, stone sills, frames, parapet coping, panel mounts.
- **Solar maximum changed from 13.2 to 12.0 kWp** so the maths equals the 30-panel layout drawn on the roof (one end kept free for the mumty and tank in task 9). Panels tilt 13° towards the side facing closest to south; in the 45° orientations that side faces SE or SW, a small yield difference not modelled.
- Materials are procedural (drawn in code), so no texture downloads; the game stays light and works offline.
- Add `?play` to the game URL to jump straight into the level; `?2d` forces the 2D fallback.

## Task 8 notes

- Sun position uses the NOAA solar equations in `js/sun.js`; checked against pvlib for 6 dates/times: worst difference 0.06°.
- Each month uses its 21st day (closest to the solstices and equinoxes). Times are Indian Standard Time.
- **Bengaluru fact worth teaching:** at noon in May the sun is 82° up and slightly *north* (latitude 13° N), so south walls are in shade at midday in summer, while in December afternoons the low south-west sun reaches deep under a chajja.
- Lighting rebalanced so sunlit walls are clearly brighter than shaded ones; glass made a little more solid so shadow lines show.
- Night: sky turns dark blue and interior lights glow through the windows.
- Shadow lines on glass are still subtle; task 10's "% of window area in shadow" readout makes the effect explicit.

## Task 9 notes

- **Site** (rotates with the house; gate on the end_a side): compound wall with pillars and steel gate, driveway and apron paving, road with footpath, three trees, shrubs, six neighbouring blocks.
- **Fidelity:** the simulation assumes an open site, so neighbouring blocks stand well away and **cast no shadows**; trees sit in plot corners away from windows. The 1.2 m compound wall can shade the lowest part of ground-floor windows only when the sun is very low.
- **Details:** stair headroom (mumty) with door and black water tank in the roof corner kept free of panels; outdoor AC units on wall brackets in the band between floors (about one per 2 tons, west-side wall first) only when AC is chosen; ceiling fans (2 per floor) visible through windows in fan and mixed modes, spinning on High quality.
- **Camera presets:** Street (from the footpath across the road), Aerial (shows the whole sun path), N, E, S, W. Smooth moves; instant with reduced motion.
- **Quality:** High / Medium / Low (shadow map 2048/2048/1024, soft/soft/hard shadows, pixel ratio 2/1.5/1, detail on/on/off, spinning fans on High only). Auto-picked from device type and CPU cores; the choice is remembered.
- **Fans** hang with blades at 2.2 m (just below the window head) so they can be seen through the glass from street level; from raised camera angles the line of sight points down into the rooms, so fans are hidden, as in real life.
- **Testing note:** headless Chrome screenshots stall on animated pages while the batch loads the CPU; `dev/scene.html` therefore renders in a still mode. Idle check: the game draws 37 frames while loading and then stops (no continuous rendering).
- **Performance:** window frames, sills, louvre rods, walls, pillars and neighbour windows are merged into a few meshes; the scene only re-renders when something changes (camera, sun, design, spinning fans).

## Task 10 notes

- **Heat arrows** (toggle): one arrow into each facade's windows and walls, plus roof and air leakage, sized and coloured by that source's yearly simulated heat gain; a panel shows heat from people, lights and appliances. Draft: east windows 19,600 kWh and west 18,488 kWh are the biggest arrows, then the roof 12,285.
- **Heat map** (toggle): each wall and the roof coloured by heat gain per m² (draft: S 283, E 254, W 244, N 150, roof 112 kWh/m²), with labels and a legend.
- **Windows in shadow %** (on by default): live at the current sun position, per facade. Treated like the simulation: flush windows, only the chajjas/louvres shade (tested against invisible zero-thickness planes at the simulated positions), glass facing away from the sun counts as shaded.
- **Checked against EnergyPlus's own sunlit fraction** at 6 moments (2 designs × Dec/May/Mar): totals within 4 points; chajja facades within 1–4 points; worst single facade 9 points (louvres, sun grazing the facade).
- Overlays need this exact design in the table; until the batch reaches it, the legend says so.

## 12. Risks

| Risk | Plan |
|---|---|
| Batch takes longer than 3 h | Faster settings; batch resumes if interrupted |
| EnergyPlus errors in the first runs | Fixed in task 2 before any batch |
| Results look unrealistic | Sanity checks in task 3; expert review of `ASSUMPTIONS.md` |
| Slow on phones | Quality setting; low-resolution shadows; simpler geometry |
| Usage limits mid-task | Work is saved after every task; this plan tracks progress |
