# Net Zero Builder

A browser game where players redesign a Bengaluru home to be net zero, comfortable and within budget, using results pre-computed with EnergyPlus.

- **Plan and progress:** [PLAN.md](PLAN.md)
- **All input values (materials, schedules, costs):** [sim/inputs.py](sim/inputs.py), or run `python sim/inputs.py` for a summary
- **Setup guide:** `docs/SETUP.md` (written in task 14)

## Folders

| Folder | What's inside |
|---|---|
| `sim/` | Simulation pipeline (Python + EnergyPlus) |
| `sim/weather/` | Bengaluru weather file (TMYx 2011–2025, climate.onebuilding.org) |
| `game/` | The browser game |
| `docs/` | Guides and assumptions |
| `prototype/` | The original single-file prototype, kept for reference |

## Quick checks

```
python sim/inputs.py          # summary of every input value
python sim/check_weather.py   # monthly summary of the weather file
```
