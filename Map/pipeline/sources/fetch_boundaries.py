"""행정동 경계(admdongkor) → 시군구/시도 병합 경계 + 지역 메타.

- 도(道) 산하 일반구("수원시장안구")는 모시(수원시)로 병합, 코드는 sgg[:4]+"0".
- 산출: data/interim/sgg_full.geojson, regions_meta.json → mapshaper 단순화로 outputs/web/*.geojson
"""
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from shapely import make_valid
from shapely.geometry import mapping, shape
from shapely.ops import unary_union

import config
from util import area_km2, load_json, save_json

SRC = config.DATA_RAW / "boundaries" / "hangjeongdong.geojson"
SRC_URL = "https://raw.githubusercontent.com/vuski/admdongkor/master/ver20260701/HangJeongDong_ver20260701.geojson"


def sgg_key(props):
    sgg, sggnm, sido = props["sgg"], props["sggnm"], props["sido"]
    if sido in config.DO_SIDO and sggnm.endswith("구") and "시" in sggnm:
        parent = sggnm.split("시")[0] + "시"
        return sgg[:4] + "0", parent
    return sgg, sggnm


def main():
    if not SRC.exists():
        import requests
        SRC.parent.mkdir(parents=True, exist_ok=True)
        print(f"download {SRC_URL}")
        r = requests.get(SRC_URL, timeout=300)
        r.raise_for_status()
        SRC.write_bytes(r.content)

    fc = load_json(SRC)
    groups = {}
    for feat in fc["features"]:
        p = feat["properties"]
        code, name = sgg_key(p)
        g = groups.setdefault(code, {"name": name, "sido": p["sido"], "sidonm": p["sidonm"], "geoms": []})
        g["geoms"].append(make_valid(shape(feat["geometry"])))

    print(f"행정동 {len(fc['features'])} → 시군구 {len(groups)}")

    features, meta = [], []
    for code in sorted(groups):
        g = groups[code]
        geom = unary_union(g["geoms"])
        short = config.SIDO_SHORT[g["sido"]]
        label = f"{short} {g['name']}" if g["name"] != "세종시" else "세종시"
        rep = geom.representative_point()
        props = {"code": code, "name": g["name"], "label": label, "sido": g["sido"], "sidonm": g["sidonm"]}
        features.append({"type": "Feature", "properties": props, "geometry": mapping(geom)})
        meta.append({**props, "area_km2": round(area_km2(geom), 2), "rep": [round(rep.x, 5), round(rep.y, 5)]})

    full = config.DATA_INTERIM / "sgg_full.geojson"
    save_json({"type": "FeatureCollection", "features": features}, full)
    save_json(meta, config.DATA_INTERIM / "regions_meta.json", indent=1)

    config.OUT_WEB.mkdir(parents=True, exist_ok=True)
    subprocess.run([
        "npx", "-y", "mapshaper", str(full),
        "-simplify", "visvalingam", "10%", "keep-shapes",
        "-clean",
        "-o", "precision=0.0001", f"{config.OUT_WEB}/regions.geojson",
    ], check=True)
    subprocess.run([
        "npx", "-y", "mapshaper", str(full),
        "-dissolve", "sido", "copy-fields=sidonm",
        "-simplify", "visvalingam", "5%", "keep-shapes",
        "-clean",
        "-o", "precision=0.0001", f"{config.OUT_WEB}/sido.geojson",
    ], check=True)
    print("boundaries done")


if __name__ == "__main__":
    main()
