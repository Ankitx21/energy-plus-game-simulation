# Assumptions and limits

Net Zero Builder is a **teaching game**, not a design tool. Its results are good for **comparing designs with each other** ("does a white roof help more than low-e glass?"), not for predicting a real home's bill. This page lists every simplification so you can judge the results, and points to the one file where each value lives: [`sim/inputs.py`](../sim/inputs.py).

Each value has a source tag in that file:

| Tag | Meaning |
|---|---|
| `[CODE]` | From an Indian code or official table (ECBC 2017, ENS 2018, NBC 2016, CEA) |
| `[LIT]` | From published research or manufacturer data |
| `[ASSUME]` | A reasonable typical value chosen for this game |
| `[ESTIMATE]` | A market price estimate |
| `VERIFY` | Should be checked before the results are used beyond the demo (12 values) |

---

## 1. Where and when

- **City:** Bengaluru, 12.97° N, 77.59° E, 921 m, temperate climate (NBC 2016).
- **Weather:** a free "typical year" file built from 2011–2025 measurements (TMYx, climate.onebuilding.org). A real year can be hotter or cooler, and heat waves are under-represented in typical years.

## 2. The house

- Two storeys, **15.0 m × 7.33 m**, 110 m² per floor, **220 m² in total**, 3.0 m floor to floor.
- Windows 1.5 m tall with a 0.75 m sill on both floors: 3 per floor on each long wall, 2 per floor on each short wall. Window width follows the chosen window-to-wall ratio.
- Plinth (0.45 m) and parapet (0.9 m) are drawn in 3D but not simulated.
- **The 3D building has exactly the simulated dimensions, orientation, windows and shading** (checked automatically by `game/dev/golden.html` to within 0.05 mm). Trees, the compound wall and neighbouring buildings are decoration only and are **not** in the simulation. The "windows in shadow" readout also counts only the building's own chajjas and louvres, to match the simulation.

## 3. How the simulation works (in plain words)

- **EnergyPlus 26.2**, the free US Department of Energy building simulator, runs every hour of a typical year for each design.
- **One single zone:** the whole house is treated as one room with one temperature. Real homes have warmer and cooler rooms; this model gives a house-wide average.
- **Ideal AC:** the model calculates how much heat the AC has to remove; the browser divides that by the AC efficiency (COP) to get electricity. Real AC performance drops on very hot afternoons.
- **AC hours:** when AC is chosen, it may run at night (22:00–07:00) and in the afternoon (13:00–17:00), 13 hours a day, and cools the whole house. Many families cool only bedrooms, so real AC use is often lower.
- **Natural ventilation:** half the window area can open. Windows open when inside is above 24 °C and outside is at least 1 °C cooler, and close when outside is above 32 °C. In mixed mode the windows close and AC takes over above 28 °C.
- **Air leakage:** 0.75 air changes per hour all the time (typical Indian masonry). `VERIFY`
- **Ground floor** sits on a 100 mm slab on the ground; the first-floor slab and internal walls are included as thermal mass.
- **Fast settings:** 2 time steps per hour and shadow updates every 20 days. On test designs this agrees with EnergyPlus's most detailed settings within ±0.8 % for yearly cooling and ±0.5 points for comfort; peak cooling can read up to 10 % lower.

## 4. Materials and choices

| Choice | What is simulated | U-value (W/m²K) |
|---|---|---|
| Brick wall | 230 mm burnt brick, 12 mm plaster inside, exposed red outside (absorbs 70 % of sun) | 2.1 |
| AAC wall | 200 mm AAC block, plastered both sides, painted off-white (45 %) | 0.8 |
| Rammed earth wall | 300 mm stabilised rammed earth + lime plaster (65 %). Conductivity varies a lot in the literature. `VERIFY` | 2.1 |
| Bare roof | 150 mm RCC slab + 40 mm screed | 3.3 |
| Insulated roof | the same + 50 mm XPS insulation | 0.5 |
| Normal roof finish | grey screed, absorbs 70 % of sunlight | |
| Cool roof | white coating, absorbs 30 % (allows for some ageing and dirt). `VERIFY` | |
| Single clear glass | 6 mm float: U 5.8, solar heat gain 0.82, light 88 % | 5.8 |
| Double low-e glass | 6-12-6 solar-control: U 1.9, solar heat gain 0.38, light 62 %. `VERIFY` | 1.9 |
| Overhang (chajja) | 600 mm deep, 50 mm above each window, 150 mm wider each side | |
| Louvres | 5 horizontal slats 150 mm deep, 100 mm in front of each window | |
| Fluorescent / LED | 5.0 / 2.5 W per m² of floor | |

Material properties come from the ECBC 2017 and ENS 2018 tables where available.

## 5. People and appliances

- A **family of four** (110 W each), home mostly in the evening and at night, with the same pattern every day (no weekends or holidays).
- Lights and appliances follow typical daily patterns; appliances peak at 3 W/m².
- **Six ceiling fans** of 50 W each, on when someone is home and it is above 26 °C inside (used with fans-only and mixed-mode cooling).

## 6. Comfort

- Comfort uses **IMAC**, the India Model for Adaptive Comfort (Manu et al., 2016). It is based on surveys of Indian occupants, who are comfortable at warmer temperatures in naturally ventilated buildings than international standards assume.
- A comfortable hour is one where the indoor temperature is within the IMAC band around the "neutral" temperature, which rises with the average outdoor temperature over the previous 30 days.
- The naturally ventilated model is used for fans only; the mixed-mode model for AC and mixed mode. Only hours when someone is home count.
- IMAC was developed mostly from offices; a residential version (IMAC-R) may suit homes better. `VERIFY`
- Humidity is not part of the comfort test.

## 7. Done in the browser (not simulated)

| Item | Value |
|---|---|
| AC efficiency (seasonal COP) | 3-star 3.5 · 5-star 4.5 · best inverter 5.5 (conservative compared with rated ISEER). `VERIFY` |
| AC size | the simulated peak cooling, rounded up to half a ton (minimum 1 ton) |
| Solar panels | up to 12 kWp (30 panels of 400 Wp on the free part of the roof), tilted 13°, facing south |
| Solar yield | 1,483 kWh per kWp per year, from the same weather file (pvlib, performance ratio 0.78) |
| Net zero | solar generation over the year ≥ electricity used over the year (net metering) |
| Tariff | flat ₹7 per kWh (changeable in the game). Real BESCOM tariffs have slabs and fixed charges |
| Grid CO₂ | 0.71 kg per kWh (CEA). `VERIFY` latest version |

## 8. Costs

All costs are **extra costs over the cheapest choice**; the cost of the house itself is not included. All are estimates and should be checked against the CPWD schedule of rates or local quotes. `VERIFY`

| Item | Extra cost |
|---|---|
| AAC / rammed earth walls | ₹150 / ₹400 per m² of solid wall |
| Double low-e glass | ₹4,500 per m² of window |
| Overhang / louvres | ₹1,800 / ₹4,500 per m² of window |
| Roof insulation | ₹900 per m² of roof |
| Cool roof coating | ₹180 per m² of roof |
| LED lighting | ₹60 per m² of floor |
| AC | 3-star ₹38,000 · 5-star ₹48,000 · inverter ₹58,000 per ton |
| Ceiling fans | ₹3,000 each (6 fans, fans-only and mixed mode) |
| Solar | ₹55,000 per kWp, minus the PM Surya Ghar subsidy (₹30,000 per kW for the first 2 kW, ₹18,000 for the third, at most ₹78,000) when switched on. `VERIFY` current rates |

Payback compares a design with the developer's draft: extra cost ÷ yearly bill saving. It ignores price rises, interest, maintenance and equipment replacement.

## 9. What the game cannot tell you

- Room-by-room temperatures, daylight, glare, noise, air quality or humidity.
- Effects of trees, neighbours or the site (only the building's own shading devices are simulated).
- Real occupant behaviour, which changes energy use more than most design choices.
- Embodied carbon of materials.
- Code compliance (ENS / ECBC): not checked in this version.

For a summary of what the results show for Bengaluru, see [FINDINGS.md](FINDINGS.md).
