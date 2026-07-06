"""OSM Overpass에서 대한민국 변전소·발전소를 수집한다.

- 변전소: power=substation, voltage 태그 파싱 → 최대전압 154kV 이상만 P1/P2에 사용.
  OSM 태깅 누락 가능성이 있으므로 미태깅 변전소 수를 메타에 기록(신뢰도 C 근거).
- 발전소: power=plant, plant:output:electricity(MW) 파싱, plant:source 분류.
"""
import re
import sys
import time
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import config
from util import save_json

ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]

Q_SUBSTATION = """
[out:json][timeout:180];
area["ISO3166-1"="KR"][admin_level=2]->.kr;
(
  node["power"="substation"](area.kr);
  way["power"="substation"](area.kr);
  relation["power"="substation"](area.kr);
);
out center tags;
"""

Q_PLANT = """
[out:json][timeout:180];
area["ISO3166-1"="KR"][admin_level=2]->.kr;
(
  node["power"="plant"](area.kr);
  way["power"="plant"](area.kr);
  relation["power"="plant"](area.kr);
);
out center tags;
"""


def run_query(q: str):
    last = None
    for round_ in range(3):  # 미러 순환 3바퀴, 라운드마다 대기 증가(rate limit 해소 대기)
        for ep in ENDPOINTS:
            try:
                r = requests.post(ep, data={"data": q}, timeout=300,
                                  headers={"User-Agent": "dc-site-screener/0.1 (research pipeline)"})
                if r.status_code == 200:
                    return r.json()
                last = f"{ep} HTTP {r.status_code}"
            except Exception as e:  # noqa: BLE001
                last = f"{ep} {e}"
            print(f"retry: {last}", flush=True)
            time.sleep(20)
        time.sleep(60 * (round_ + 1))
    raise RuntimeError(f"overpass failed: {last}")


def lonlat(el):
    if "lon" in el:
        return el["lon"], el["lat"]
    c = el.get("center")
    return (c["lon"], c["lat"]) if c else (None, None)


def max_voltage(tags) -> float | None:
    v = tags.get("voltage")
    if not v:
        return None
    vals = [float(x) for x in re.findall(r"\d+(?:\.\d+)?", v)]
    return max(vals) if vals else None


_MW = re.compile(r"([\d.,]+)\s*(GW|MW|kW|W)?", re.IGNORECASE)


def parse_mw(s: str | None) -> float | None:
    if not s:
        return None
    m = _MW.match(s.strip())
    if not m or not m.group(1):
        return None
    try:
        num = float(m.group(1).replace(",", ""))
    except ValueError:
        return None
    unit = (m.group(2) or "MW").upper()
    factor = {"GW": 1000.0, "MW": 1.0, "KW": 0.001, "W": 0.000001}[unit]
    return num * factor


def main():
    subs_raw = run_query(Q_SUBSTATION)
    plants_raw = run_query(Q_PLANT)
    save_json(subs_raw, config.DATA_RAW / "osm" / "substations.json")
    save_json(plants_raw, config.DATA_RAW / "osm" / "plants.json")

    subs154, n_untagged, n_all = [], 0, 0
    for el in subs_raw.get("elements", []):
        tags = el.get("tags", {})
        if tags.get("substation") == "minor_distribution":
            continue
        lon, lat = lonlat(el)
        if lon is None:
            continue
        n_all += 1
        v = max_voltage(tags)
        if v is None:
            n_untagged += 1
            continue
        if v >= 154_000:
            subs154.append({
                "lon": round(lon, 5), "lat": round(lat, 5), "v": v,
                "name": tags.get("name", ""),
            })

    plants = []
    for el in plants_raw.get("elements", []):
        tags = el.get("tags", {})
        lon, lat = lonlat(el)
        if lon is None:
            continue
        mw = parse_mw(tags.get("plant:output:electricity"))
        plants.append({
            "lon": round(lon, 5), "lat": round(lat, 5),
            "mw": round(mw, 1) if mw else None,
            "src": tags.get("plant:source", ""),
            "name": tags.get("name", ""),
        })

    save_json({
        "fetched_at": time.strftime("%Y-%m-%d"),
        "substations_all": n_all,
        "substations_voltage_untagged": n_untagged,
        "substations_154kv": subs154,
        "plants": plants,
    }, config.DATA_INTERIM / "power.json", indent=1)
    print(f"substations total={n_all} untagged={n_untagged} 154kV+={len(subs154)}; plants={len(plants)}")


if __name__ == "__main__":
    main()
