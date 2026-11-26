"""Small helpers for reading the weather file (.epw)."""
import csv
from functools import lru_cache
from pathlib import Path

DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]


@lru_cache(maxsize=4)
def hourly_drybulb(epw_path: Path) -> tuple:
    """8760 hourly outdoor dry-bulb temperatures (°C), Jan 1 00:00-01:00 first."""
    with open(epw_path, newline="", encoding="latin-1") as f:
        rows = list(csv.reader(f))[8:]
    return tuple(float(r[6]) for r in rows)


def monthly_means(epw_path: Path) -> list:
    t = hourly_drybulb(epw_path)
    out, i = [], 0
    for d in DAYS_IN_MONTH:
        n = d * 24
        out.append(sum(t[i:i + n]) / n)
        i += n
    return out


@lru_cache(maxsize=4)
def running_mean_by_day(epw_path: Path, days: int = 30) -> tuple:
    """For each day of the year, mean outdoor temperature of the previous `days` days
    (wraps around the year, since the file is a typical year). Used by IMAC."""
    t = hourly_drybulb(epw_path)
    daily = [sum(t[d * 24:(d + 1) * 24]) / 24 for d in range(365)]
    return tuple(sum(daily[(d - k) % 365] for k in range(1, days + 1)) / days for d in range(365))
