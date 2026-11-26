# Net Zero Builder

A browser game in which players redesign a two-storey Bengaluru home to be **net zero, comfortable and within budget**. Every one of the 20,736 possible designs was simulated in advance with EnergyPlus; the game looks up the right result instantly and adds AC efficiency, solar, cost and the electricity bill on top.

**Play:** double-click `play.bat` (Windows), or run `python -m http.server 8000` inside `game/` and open <http://localhost:8000>. Full instructions: [docs/SETUP.md](docs/SETUP.md).

## What's in the game

- A realistic 3D house that matches the simulated building exactly, with the real sun for any month and time, moving shadows, sun path, compass, and camera presets.
- Overlays: heat-flow arrows, a heat map of the walls and roof, window glass in shadow, and window area per facade.
- **Predict before you simulate:** guess whether energy use and comfort will go up or down, then see if you were right.
- **Where the heat comes from:** yearly heat gain by source, with plain-language advice.
- **Design explorer:** every design on a cost vs energy chart, with the best-value designs highlighted; click to load one.
- **What matters most:** the options ranked by how much they change energy use.
- **Monthly bill in ₹ and payback**, plus three missions: cheapest net zero, the no-AC challenge, and lowest energy within budget.

## Documents

| Document | What it covers |
|---|---|
| [docs/SETUP.md](docs/SETUP.md) | How to play, put it online, and re-create the data |
| [docs/ASSUMPTIONS.md](docs/ASSUMPTIONS.md) | Every simplification and input value, and what the game cannot tell you |
| [docs/FINDINGS.md](docs/FINDINGS.md) | What the 20,736 simulations show for Bengaluru |
| [PLAN.md](PLAN.md) | The project plan, task list and notes from each task |
| [sim/inputs.py](sim/inputs.py) | All input values in one file (`python sim/inputs.py` prints a summary) |

## Folders

| Folder | What's inside |
|---|---|
| `sim/` | Simulation pipeline (Python + EnergyPlus) |
| `sim/weather/` | Bengaluru weather file (TMYx 2011–2025, climate.onebuilding.org) |
| `game/` | The browser game: a static website with no backend |
| `docs/` | Guides, assumptions and findings |
| `prototype/` | The original single-file prototype, kept for reference |

## Built with

EnergyPlus 26.2, Python (pandas, numpy, pvlib) and three.js 0.170, all free. Results are for comparing designs, not for predicting a real bill; see [docs/ASSUMPTIONS.md](docs/ASSUMPTIONS.md).
