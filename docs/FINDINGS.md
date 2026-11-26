# Net Zero Builder · Bengaluru findings

Computed from all 20,736 EnergyPlus designs with the game's own maths (tariff ₹7/kWh, solar subsidy on). 2349 ms.

## In plain words

1. **How you cool matters far more than anything else.** Switching from AC at 24 °C to fans with natural ventilation changes energy use by 29 kWh/m²·yr on average; the next most important choice (lighting) changes it by only 5. Bengaluru's mild climate lets a well-designed home stay comfortable most of the year without AC.
2. **Net zero is easy; affordable, comfortable net zero is the puzzle.** Every design can reach net zero with enough roof solar, but bolting 10.8 kWp onto the developer's draft costs ₹8.20 L, over the ₹7.00 L budget. The cheapest comfortable net-zero design costs ₹1.71 L.
3. **Cheap passive moves come first.** A cool (white) roof and LED lights cost little and cut energy use straight away. Low-e glass and louvres help, but cost much more for each unit of energy saved.
4. **A cool roof and insulation do not always add up.** Under a white roof, insulation can trap indoor heat that a bare slab would lose to the night sky, so it can raise cooling slightly.
5. **Orientation and window size matter less here than people expect**, because the windows are modest and the roof and cooling dominate. They still help comfort without AC.

## The developer's draft

- Energy use 73 kWh/m²·yr, comfort 92%, AC 8 t, cost of upgrades and systems ₹3.04 L, bill ₹1,12,080/yr.

## Range across all designs (3-star AC, no solar)

| | min | 25% | median | 75% | max |
|---|---|---|---|---|---|
| Energy use (kWh/m²·yr) | 17 | 22 | 26 | 39 | 74 |
| Comfort (%) | 79 | 90 | 94 | 97 | 100 |
| Cost (₹ L) | 0.18 | 3.71 | 5.25 | 6.86 | 12.75 |

- 20,736 of 20,736 designs (100%) can reach net zero with solar on the usable roof.
- 15,340 of those also reach ≥ 90% comfort. Their cost (solar sized for net zero, cheapest AC): min ₹1.71 L, 10% ₹5.18 L, median ₹7.87 L.

## What matters most (average effect of each choice over every other combination; 3-star AC, no solar)

| Option | Energy-use swing | Comfort swing | Best for energy |
|---|---|---|---|
| Cooling | 28.6 kWh/m²·yr | 8.9 pts | Fans + natural ventilation (20) |
| Lighting | 5.1 kWh/m²·yr | 0.2 pts | LED (28) |
| Glazing | 3.7 kWh/m²·yr | 3.2 pts | Double low-e (29) |
| Roof finish | 3.4 kWh/m²·yr | 2.4 pts | Cool roof (white) (29) |
| Walls | 2.6 kWh/m²·yr | 1.5 pts | AAC block (200 mm) (29) |
| Shading | 2.4 kWh/m²·yr | 1.5 pts | Louvres (30) |
| Roof | 1.9 kWh/m²·yr | 2.7 pts | RCC + 50 mm insulation (30) |
| Window-to-wall ratio, N/S walls | 1.8 kWh/m²·yr | 1.6 pts | 20% (30) |
| Window-to-wall ratio, E/W walls | 1.5 kWh/m²·yr | 1.4 pts | 10% (30) |
| Orientation (long axis) | 1.3 kWh/m²·yr | 1.2 pts | East–West (long walls face N & S) (30) |

## Pareto front: cost vs energy use (comfort ≥ 90%, 3-star AC, no solar)

13 designs on the front. Every 4th:

| Cost | Energy use | Comfort | Design |
|---|---|---|---|
| ₹0.71 L | 21.9 | 90% | Orientation (long axis): East–West (long walls face N & S) · Window-to-wall ratio, N/S walls: 20% · Window-to-wall ratio, E/W walls: 10% · Glazing: Single clear · Shading: None · Walls: AAC block (200 mm) · Roof: Bare RCC slab · Roof finish: Cool roof (white) · Cooling: Fans + natural ventilation · Lighting: Fluorescent (CFL/tube) |
| ₹2.21 L | 17.1 | 91% | Orientation (long axis): East–West (long walls face N & S) · Window-to-wall ratio, N/S walls: 20% · Window-to-wall ratio, E/W walls: 10% · Glazing: Single clear · Shading: Overhang (chajja) · Walls: Rammed earth (300 mm) · Roof: Bare RCC slab · Roof finish: Cool roof (white) · Cooling: Fans + natural ventilation · Lighting: LED |
| ₹3.45 L | 16.7 | 94% | Orientation (long axis): North–South (long walls face E & W) · Window-to-wall ratio, N/S walls: 20% · Window-to-wall ratio, E/W walls: 10% · Glazing: Double low-e · Shading: None · Walls: AAC block (200 mm) · Roof: RCC + 50 mm insulation · Roof finish: Cool roof (white) · Cooling: Fans + natural ventilation · Lighting: LED |
| ₹5.87 L | 16.5 | 93% | Orientation (long axis): East–West (long walls face N & S) · Window-to-wall ratio, N/S walls: 20% · Window-to-wall ratio, E/W walls: 10% · Glazing: Double low-e · Shading: Louvres · Walls: AAC block (200 mm) · Roof: RCC + 50 mm insulation · Roof finish: Cool roof (white) · Cooling: Fans + natural ventilation · Lighting: LED |

## Missions: best possible answers

- **Cheapest net zero**: ₹1.71 L, 17.1 kWh/m²·yr, comfort 90%, solar 25% (3.0 kWp), AC 3star. Score 976, 3★.
  Orientation (long axis): East–West (long walls face N & S) · Window-to-wall ratio, N/S walls: 20% · Window-to-wall ratio, E/W walls: 10% · Glazing: Single clear · Shading: None · Walls: AAC block (200 mm) · Roof: Bare RCC slab · Roof finish: Cool roof (white) · Cooling: Fans + natural ventilation · Lighting: LED
- **No-AC challenge**: ₹4.12 L, 16.8 kWh/m²·yr, comfort 95%, solar 25% (3.0 kWp), AC 3star. Score 941, 3★.
  Orientation (long axis): North–South (long walls face E & W) · Window-to-wall ratio, N/S walls: 20% · Window-to-wall ratio, E/W walls: 10% · Glazing: Double low-e · Shading: None · Walls: AAC block (200 mm) · Roof: RCC + 50 mm insulation · Roof finish: Normal (grey screed) · Cooling: Fans + natural ventilation · Lighting: LED
- **Lowest energy within budget**: ₹5.87 L, 16.5 kWh/m²·yr, comfort 93%, solar 0% (0.0 kWp), AC 3star. Score 566, 2★.
  Orientation (long axis): East–West (long walls face N & S) · Window-to-wall ratio, N/S walls: 20% · Window-to-wall ratio, E/W walls: 10% · Glazing: Double low-e · Shading: Louvres · Walls: AAC block (200 mm) · Roof: RCC + 50 mm insulation · Roof finish: Cool roof (white) · Cooling: Fans + natural ventilation · Lighting: LED
