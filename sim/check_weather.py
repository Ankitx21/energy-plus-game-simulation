"""Print a plain-language monthly summary of an EnergyPlus weather file (.epw).

Usage:  python sim/check_weather.py [path/to/file.epw]
Defaults to the weather file configured in sim/inputs.py.
"""
import csv
import sys
from pathlib import Path

MONTHS = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split()


def summarise(epw_path: Path) -> None:
    with open(epw_path, newline="", encoding="latin-1") as f:
        rows = list(csv.reader(f))
    loc = rows[0]  # LOCATION,city,state,country,source,WMO,lat,lon,tz,elev
    print(f"Location : {loc[1]}, {loc[3]}  (WMO {loc[5]}, source {loc[4]})")
    print(f"Lat/long : {loc[6]}, {loc[7]}   time zone UTC{float(loc[8]):+}   elevation {loc[9]} m\n")

    data = rows[8:]  # hourly records start after 8 header lines
    print("Month  Mean°C  Min°C  Max°C  RH%   Sun kWh/m²/day  Wind m/s")
    yr_t, yr_g = [], 0.0
    for m in range(1, 13):
        h = [r for r in data if int(r[1]) == m]
        t = [float(r[6]) for r in h]
        rh = [float(r[8]) for r in h]
        ghi = sum(float(r[13]) for r in h) / 1000  # Wh -> kWh per m² for the month
        ws = [float(r[21]) for r in h]
        days = len(h) / 24
        yr_t += t
        yr_g += ghi
        print(f"{MONTHS[m-1]:5}  {sum(t)/len(t):6.1f} {min(t):6.1f} {max(t):6.1f} "
              f"{sum(rh)/len(rh):5.0f}   {ghi/days:10.2f}      {sum(ws)/len(ws):5.1f}")
    print(f"\nYear   mean {sum(yr_t)/len(yr_t):.1f} °C, range {min(yr_t):.1f} to {max(yr_t):.1f} °C, "
          f"sunshine {yr_g:.0f} kWh/m² per year ({len(data)} hourly records)")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    if len(sys.argv) > 1:
        path = Path(sys.argv[1])
    else:
        sys.path.insert(0, str(Path(__file__).parent))
        from inputs import CITY
        path = CITY["weather_file"]
    summarise(path)
