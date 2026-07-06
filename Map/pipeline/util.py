import json
import math
from pathlib import Path

from pyproj import Transformer
from shapely.ops import transform as shp_transform

_TO_UTMK = Transformer.from_crs("EPSG:4326", "EPSG:5179", always_xy=True)


def area_km2(geom_wgs84) -> float:
    projected = shp_transform(_TO_UTMK.transform, geom_wgs84)
    return projected.area / 1_000_000


def haversine_km(lon1: float, lat1: float, lon2: float, lat2: float) -> float:
    r = 6371.0088
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = p2 - p1
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def load_json(path: Path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def save_json(obj, path: Path, indent=None):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=indent, separators=(",", ":") if indent is None else None)
