# Setup guide

This guide has two parts:

- **Part A: play the game.** It takes 2 minutes and needs nothing except Python and a web browser.
- **Part B: re-create the data.** Only needed if you change the house, the materials or the costs. You do not need to know EnergyPlus; every step is one command.

---

## Part A: Play the game

### What you need

- A modern web browser (Chrome, Edge, Firefox or Safari, from 2023 or later). A laptop or desktop gives the full 3D view; phones and tablets work too.
- **Python 3** (any version from 3.8). It is used only to run a tiny local web server. Check with `python --version` in a terminal. If it is missing, install it from [python.org](https://www.python.org/downloads/) and tick "Add Python to PATH".

### Start it

**On Windows:** double-click **`play.bat`** in the project folder. A black window opens (that is the web server) and the game opens in your browser at `http://localhost:8000`. Close the black window when you are done.

**On Mac or Linux** (or in any terminal):

```
cd game
python -m http.server 8000
```

Then open <http://localhost:8000> in your browser. Press `Ctrl+C` in the terminal to stop.

### Why not just double-click `index.html`?

Browsers block web pages opened straight from disk (`file://...`) from loading data files. The game needs to load its 2.4 MB results table, so it must be served by a web server, even a local one. If you open the file directly, the game shows a message explaining this.

### Put it online (optional)

The `game/` folder is a complete static website: no backend, no database, no build step. Upload the whole `game/` folder to any static host (GitHub Pages, Netlify, Cloudflare Pages, a university web server) and it works as is. The page loads one web font from Google Fonts; without internet it falls back to the system font.

### Useful links inside the game

| Address | What it does |
|---|---|
| `index.html` | Normal start screen |
| `index.html?play` | Skips the start screen (good for demos) |
| `index.html?2d` | Forces the simple 2D drawing instead of 3D (for very old computers) |
| `index.html?play&xopen` | Opens the design explorer straight away |
| `dev/scene.html` | The 3D scene on its own, for checking how it looks |
| `dev/golden.html` | Automatic test: the 3D building must match the simulated building (should say ALL PASS) |

### If something goes wrong

| Problem | Fix |
|---|---|
| "python is not recognised" | Install Python and tick "Add Python to PATH", then open a new terminal. |
| "Address already in use" | Another program uses port 8000. Use another number: `python -m http.server 8080`, then open `http://localhost:8080`. |
| The 3D view is slow | Set **Quality** to Low (under the 3D view). The game remembers it. |
| The 3D view is blank | Your browser or graphics driver has WebGL turned off. The game falls back to 2D automatically; updating the browser usually fixes it. |
| Old results after changing data | Hard-refresh the page (`Ctrl+Shift+R`, or `Cmd+Shift+R` on a Mac). |

---

## Part B: Re-create the data

Every design in the game was simulated in advance. You only need this part if you change something in [`sim/inputs.py`](../sim/inputs.py) (materials, schedules, costs, the house size) and want the game to reflect it.

### What you need

1. **Python 3.10 or newer** and the three Python packages:
   ```
   pip install -r requirements.txt
   ```
2. **EnergyPlus 26.2** (free) from [energyplus.net](https://energyplus.net/downloads). Install it to the default folder `C:\EnergyPlusV26-2-0\`. If you install it somewhere else (or on Mac/Linux), change the one line `ENERGYPLUS = ...` near the top of [`sim/simulate.py`](../sim/simulate.py).
3. **Node.js 18 or newer** (free, [nodejs.org](https://nodejs.org)). It is used only for the findings report in step 6.

The Bengaluru weather file is already in `sim/weather/`.

### The steps

Run these from the project folder. Each step tells you in plain words what it did.

| Step | Command | Time | What it does |
|---|---|---|---|
| 1 | `python sim/inputs.py` | instant | Prints every input value so you can check your changes. |
| 2 | `python sim/simulate.py` | ~10 s | Simulates the developer's draft once and explains the results. Add `--row 1234` or `shading=overhang` to try another design. |
| 3 | `python sim/run_batch.py --test` | ~2 min | Simulates about 50 designs and estimates how long the full batch will take. |
| 4 | `python sim/run_batch.py --all` | 3–8 h | Simulates all 20,736 designs. |
| 5 | `python sim/check_results.py sim/runs/blr_fast` | ~10 s | Sanity checks: values in sensible ranges, and every single change behaves as physics says it should (e.g. shading lowers solar gain). Should end with ALL CHECKS PASSED. |
| 6 | `python sim/export_table.py` then `node sim/findings.mjs --md docs/FINDINGS.md` | ~1 min | Packs the results into `game/data/blr.bin` and `blr.json` for the game, then writes the plain-language findings report. |

Then refresh the game in your browser.

### About the long batch (step 4)

- It uses all but two of your processor cores and keeps Windows awake while it runs. **Keep the laptop plugged in and the lid open**; if it sleeps, a few runs can time out.
- It is **resumable**: if it stops for any reason (power cut, closed window, restart), run the same command again and it carries on from where it stopped. Runs that failed are retried.
- Progress is printed every 200 designs, with an estimate of the time left. Results are saved one line per design in `sim/runs/blr_fast/results.jsonl`.
- `--settings accurate` uses finer EnergyPlus settings (about 2.5 times slower). The game data was made with the default fast settings; on test designs they agree within ±0.8 % for yearly cooling and ±0.5 points for comfort (peak cooling can read up to 10 % lower).

### If you change the house shape or the options

The option list in `sim/inputs.py` (`OPTIONS`) fixes the order of rows in the results table. If you add or remove a choice, delete `sim/runs/blr_fast/` and re-run steps 3 to 6, because the old rows no longer line up. Then run `python sim/make_golden_ref.py` and open `dev/golden.html` to confirm the 3D building still matches the simulation.

---

## Project layout

| Folder | What's inside |
|---|---|
| `sim/` | Simulation pipeline: inputs, model builder, batch runner, checks, export |
| `sim/weather/` | Bengaluru weather file (typical year 2011–2025, climate.onebuilding.org) |
| `game/` | The browser game (static website) |
| `game/js/` | Game code: `data.js` loads the table, `engine.js` does the browser maths, `analysis.js` the whole-table maths, `ui.js` the screens, `scene3d.js` the 3D view |
| `game/data/` | The pre-computed results table |
| `docs/` | This guide, [ASSUMPTIONS.md](ASSUMPTIONS.md) and [FINDINGS.md](FINDINGS.md) |
| `prototype/` | The original one-file prototype, kept for reference |
