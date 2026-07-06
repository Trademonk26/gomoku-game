"""Open-Meteo ERA5 아카이브로 시군구 대표점의 냉방도일(CDD, 기준 24°C)을 계산한다.

2020~2024년 5개년 일평균기온 → 연평균 CDD. 기상청 관측 평년값의 무키(no-key) 대체 프록시.
"""
import sys
import time
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import config
from util import load_json, save_json

API = "https://archive-api.open-meteo.com/v1/archive"
BATCH = 25


def fetch_batch(coords):
    params = {
        "latitude": ",".join(f"{lat:.4f}" for _, lat in coords),
        "longitude": ",".join(f"{lon:.4f}" for lon, _ in coords),
        "start_date": config.CDD_YEARS[0],
        "end_date": config.CDD_YEARS[1],
        "daily": "temperature_2m_mean",
        "timezone": "Asia/Seoul",
    }
    for attempt in range(5):
        r = requests.get(API, params=params, timeout=120)
        if r.status_code == 200:
            data = r.json()
            return data if isinstance(data, list) else [data]
        time.sleep(5 * (attempt + 1))
    raise RuntimeError(f"open-meteo failed: HTTP {r.status_code} {r.text[:200]}")


def cdd_annual(daily_means):
    vals = [t for t in daily_means if t is not None]
    total = sum(max(0.0, t - config.CDD_BASE_C) for t in vals)
    years = 5.0
    return round(total / years, 1)


def main():
    meta = load_json(config.DATA_INTERIM / "regions_meta.json")
    out = {}
    for i in range(0, len(meta), BATCH):
        chunk = meta[i : i + BATCH]
        results = fetch_batch([(m["rep"][0], m["rep"][1]) for m in chunk])
        if len(results) != len(chunk):
            raise RuntimeError(f"batch size mismatch {len(results)} != {len(chunk)}")
        for m, res in zip(chunk, results):
            out[m["code"]] = cdd_annual(res["daily"]["temperature_2m_mean"])
        print(f"{i + len(chunk)}/{len(meta)}")
        time.sleep(1.0)
    save_json({"fetched_at": time.strftime("%Y-%m-%d"), "base_c": config.CDD_BASE_C, "cdd": out},
              config.DATA_INTERIM / "cdd.json", indent=1)
    print(f"cdd done: {len(out)} regions")


if __name__ == "__main__":
    main()
