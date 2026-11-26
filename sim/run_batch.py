"""
Run many designs through EnergyPlus in parallel. Safe to stop and restart: finished designs are skipped.

Usage:
  python sim/run_batch.py --test                    # ~70 designs chosen to test the physics (task 3)
  python sim/run_batch.py --all                     # all 20,736 designs (task 4)
  python sim/run_batch.py --rows 0-99               # a range of rows
  options:  --workers 10   --settings fast|accurate   --city blr

Results go to  sim/runs/<city>_<settings>[_test]/results.jsonl  (one line per design).
While running, Windows is asked not to go to sleep.
"""
import argparse
import ctypes
import json
import os
import random
import shutil
import sys
import time
from concurrent.futures import ProcessPoolExecutor, as_completed
from pathlib import Path

import inputs as I
from make_idf import BASE_DESIGN, CHOICES, design_from_index, index_of
from simulate import run_design

TOTAL = I.combination_count()

# One-change pairs used by --test; check_results.py knows what each change should do.
TEST_CHANGES = [("shading", "none", "overhang"), ("shading", "none", "louvres"),
                ("roof_finish", "normal", "cool"), ("roof", "bare", "insulated"),
                ("glazing", "single_clear", "double_lowe"), ("lighting", "fluorescent", "led"),
                ("cooling", "ac24", "ac26"), ("cooling", "nv", "ac24"), ("wwr_ew", "30", "10"),
                ("wwr_ns", "40", "20"), ("wall", "brick", "aac")]


def test_rows(n_bases: int = 4, seed: int = 7) -> list:
    rng = random.Random(seed)
    bases = [dict(BASE_DESIGN)] + [{k: rng.choice(v) for k, v in CHOICES.items()} for _ in range(n_bases - 1)]
    rows = set()
    for b in bases:
        if b["cooling"] == "nv":  # keep most bases air-conditioned so cooling checks have something to measure
            b["cooling"] = "ac26"
        for opt, a, z in TEST_CHANGES:
            rows.add(index_of({**b, opt: a}))
            rows.add(index_of({**b, opt: z}))
    return sorted(rows)


def _worker(row: int, tmp_root: str, settings: str) -> dict:
    try:
        return run_design(design_from_index(row), Path(tmp_root) / str(row), settings=settings)
    except Exception as e:  # report, don't crash the batch
        return {"row": row, "error": f"{type(e).__name__}: {e}"}


def keep_awake(on: bool) -> None:
    if os.name == "nt":
        ES_CONTINUOUS, ES_SYSTEM_REQUIRED = 0x80000000, 0x00000001
        ctypes.windll.kernel32.SetThreadExecutionState(ES_CONTINUOUS | (ES_SYSTEM_REQUIRED if on else 0))


def fmt_time(s: float) -> str:
    h, rem = divmod(int(s), 3600)
    return f"{h}h {rem // 60:02d}m" if h else f"{rem // 60}m {rem % 60:02d}s"


def main():
    sys.stdout.reconfigure(encoding="utf-8", line_buffering=True)
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--test", action="store_true")
    g.add_argument("--all", action="store_true")
    g.add_argument("--rows", help="e.g. 0-99 or 5,17,42")
    ap.add_argument("--workers", type=int, default=max(1, (os.cpu_count() or 4) - 2))
    ap.add_argument("--settings", choices=["fast", "accurate"], default="fast")
    ap.add_argument("--city", default=I.CITY["id"])
    a = ap.parse_args()
    if a.city != I.CITY["id"]:
        sys.exit(f"City '{a.city}' is not set up yet. Add its weather file and settings to sim/inputs.py.")

    if a.test:
        rows = test_rows()
    elif a.all:
        rows = list(range(TOTAL))
    elif "-" in a.rows:
        lo, hi = map(int, a.rows.split("-"))
        rows = list(range(lo, hi + 1))
    else:
        rows = [int(x) for x in a.rows.split(",")]

    out_dir = I.ROOT / "runs" / f"{a.city}_{a.settings}{'_test' if a.test else ''}"
    out_dir.mkdir(parents=True, exist_ok=True)
    results_path, errors_path, tmp_root = out_dir / "results.jsonl", out_dir / "errors.jsonl", out_dir / "tmp"
    done = set()
    if results_path.exists():
        with open(results_path, encoding="utf-8") as f:
            done = {json.loads(line)["row"] for line in f if line.strip()}
    todo = [r for r in rows if r not in done]
    print(f"{len(rows):,} designs requested, {len(rows) - len(todo):,} already done, {len(todo):,} to run "
          f"with {a.workers} workers ({a.settings} settings)\nResults: {results_path}")
    if not todo:
        return

    keep_awake(True)
    t0, n_ok, n_err, sim_seconds = time.time(), 0, 0, 0.0
    try:
        with ProcessPoolExecutor(max_workers=a.workers) as pool, \
                open(results_path, "a", encoding="utf-8") as fout, open(errors_path, "a", encoding="utf-8") as ferr:
            futures = [pool.submit(_worker, r, str(tmp_root), a.settings) for r in todo]
            for i, fut in enumerate(as_completed(futures), 1):
                res = fut.result()
                if "error" in res:
                    n_err += 1
                    ferr.write(json.dumps(res) + "\n"); ferr.flush()
                    print(f"  ERROR row {res['row']}: {res['error'][:200]}")
                else:
                    n_ok += 1
                    sim_seconds += res["seconds"]
                    fout.write(json.dumps(res, separators=(",", ":")) + "\n"); fout.flush()
                if i % max(1, min(200, len(todo) // 20)) == 0 or i == len(todo):
                    el = time.time() - t0
                    rate = i / el
                    print(f"  {i:,}/{len(todo):,} done ({100*i/len(todo):.0f}%), {rate*60:.0f} designs/min, "
                          f"elapsed {fmt_time(el)}, remaining ~{fmt_time((len(todo)-i)/rate)}")
    except KeyboardInterrupt:
        print("\nStopped. Run the same command again to continue where it left off.")
    finally:
        keep_awake(False)
        shutil.rmtree(tmp_root, ignore_errors=True)

    el = time.time() - t0
    if n_ok:
        rate = (n_ok + n_err) / el
        print(f"\nFinished {n_ok:,} designs ({n_err} errors) in {fmt_time(el)}. "
              f"Average EnergyPlus run {sim_seconds/n_ok:.1f} s; throughput {rate*60:.0f} designs/min.")
        print(f"At this speed all {TOTAL:,} designs would take about {fmt_time(TOTAL / rate)}.")


if __name__ == "__main__":
    main()
