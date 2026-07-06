"""ILIS 산업시설용지 분양현황을 시군구 단위로 내려받는다.

공개 통계검색의 ReportingServer MML 응답(SALocILInduByTot)을 사용한다.
산출: data/interim/ilis_industrial_land.json
"""
import html
import re
import sys
import time
from pathlib import Path
from urllib.parse import quote
from xml.etree import ElementTree as ET

import requests

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import config
from util import load_json, save_json

BASE = "https://www.industryland.or.kr"
REPORT_URL = f"{BASE}/ReportingServer/service"
USER_AGENT = "Mozilla/5.0 (compatible; MapPipeline/1.0; +https://github.com/Trademonk26/gomoku-game)"
REPORT_FILE = "SALocILInduByTot"
REPORT_SIDO = {
    **{sido: sido for sido in config.SIDO_SHORT if sido != "12"},
    "29": "12",  # 광주광역시(2026-07-01 전) → 전남광주통합특별시
    "46": "12",  # 전라남도(2026-07-01 전) → 전남광주통합특별시
}
REPORT_SIDO_LABEL = {**config.SIDO_SHORT, "29": "광주(구)", "46": "전남(구)"}
UNRESOLVED_SPLIT_CODES = {
    "28125": "ILIS 202605는 인천 중구 분구 전 집계라 제물포구/영종구로 배분 불가",
    "28155": "ILIS 202605는 인천 중구 분구 전 집계라 제물포구/영종구로 배분 불가",
    "28275": "ILIS 202605는 인천 서구 분구 전 집계라 서해구/검단구로 배분 불가",
    "28290": "ILIS 202605는 인천 서구 분구 전 집계라 서해구/검단구로 배분 불가",
}
COLS = [
    ("region", 269, 935),
    ("kind", 935, 1531),
    ("park_count", 1531, 2176),
    ("designated_area_m2", 2176, 3107),
    ("industrial_target_area_m2", 3107, 4039),
    ("announced_area_m2", 4039, 4934),
    ("sold_area_m2", 4934, 5806),
    ("unsold_area_m2", 5806, 6689),
    ("unsold_rate_pct", 6689, 7490),
]


def api_get(session, path):
    r = session.get(f"{BASE}{path}", timeout=60)
    r.raise_for_status()
    data = r.json()
    if data.get("code") != 200:
        raise RuntimeError(f"ILIS GET {path} failed: {data}")
    return data["result"]


def latest_period(session):
    years = api_get(session, "/sta/staSearch/staYearList.do")
    year = max(y["sta_year_cd"] for y in years)
    months = api_get(session, f"/sta/staSearch/staMonthList.do/{year}")
    month = max(m["sta_month_cd"] for m in months)
    return f"{year}{month}"


def report_payload(period, sido):
    sido_label = REPORT_SIDO_LABEL[sido] if sido else "전체"
    title = f"지역별 [{sido_label}] <산업시설용지분양현황>"
    mrd_param = (
        "/rf [http://localhost:3004/DataServer/rdagent.jsp] "
        "/rsn [ILIS] "
        f"/rp [{period}] [{sido}] [all] "
        f"/rv pg_no[1] danwi[1] unit[㎡] statitle[{title}]"
    )
    return {
        "opcode": "700",
        "mrd_path": f"http://localhost:2004/ReportingServer/sa/mrd/search/{REPORT_FILE}.mrd",
        "mrd_param": mrd_param,
        "mrd_plain_param": "",
        "mrd_data": "",
        "runtime_param": "",
        "mmlVersion": "0",
        "protocol": "sync",
    }


def fetch_report(session, period, sido):
    r = session.post(
        REPORT_URL,
        data=report_payload(period, sido),
        headers={
            "Content-Type": "application/x-www-form-urlencoded",
            "Origin": BASE,
            "Referer": f"{BASE}/sta/staSearch/list",
        },
        timeout=120,
    )
    r.raise_for_status()
    text = r.text
    if "<MML" not in text:
        raise RuntimeError(f"unexpected ILIS report response for {sido}: {text[:200]}")
    return text


def text_of(el):
    return "".join(el.itertext()).strip()


def column_for(le, ri):
    center = (le + ri) / 2
    for name, start, end in COLS:
        if start <= center < end:
            return name
    return None


def parse_number(value, *, as_float=False):
    value = value.strip()
    if value in {"", "-"}:
        return 0.0 if as_float else 0
    value = value.replace(",", "")
    return float(value) if as_float else int(round(float(value)))


def normalize_region_name(name):
    name = re.sub(r"\([^)]*\)$", "", name.strip())
    return "세종시" if name in {"세종", "세종특별"} else name


def parse_report(mml):
    root = ET.fromstring(mml)
    items_by_page = {}
    for page in root.findall(".//PG"):
        page_no = page.attrib.get("no", "1")
        for tl in page.findall(".//TL"):
            text = html.unescape(text_of(tl))
            if not text:
                continue
            try:
                le = int(float(tl.attrib["le"]))
                ri = int(float(tl.attrib["ri"]))
                top = int(float(tl.attrib["to"]))
                bottom = int(float(tl.attrib["bo"]))
            except KeyError:
                continue
            col = column_for(le, ri)
            if not col:
                continue
            items_by_page.setdefault(page_no, []).append(((top + bottom) / 2, col, text))

    parsed = []
    for page_no in sorted(items_by_page, key=lambda x: int(x)):
        clusters = []
        for center, col, text in sorted(items_by_page[page_no]):
            if not clusters or abs(center - clusters[-1]["center"]) > 80:
                clusters.append({"center": center, "items": []})
            clusters[-1]["items"].append((center, col, text))
            clusters[-1]["center"] = sum(i[0] for i in clusters[-1]["items"]) / len(clusters[-1]["items"])

        for cluster in clusters:
            row = {}
            for _, col, text in cluster["items"]:
                row[col] = f"{row[col]}{text}" if col in row else text
            if row.get("kind") != "계" or "region" not in row:
                continue
            region = normalize_region_name(row["region"])
            if region == "전국":
                continue
            parsed.append({
                "region_name": region,
                "park_count": parse_number(row.get("park_count", "0")),
                "designated_area_m2": parse_number(row.get("designated_area_m2", "0")),
                "industrial_target_area_m2": parse_number(row.get("industrial_target_area_m2", "0")),
                "announced_area_m2": parse_number(row.get("announced_area_m2", "0")),
                "sold_area_m2": parse_number(row.get("sold_area_m2", "0")),
                "unsold_area_m2": parse_number(row.get("unsold_area_m2", "0")),
                "unsold_rate_pct": parse_number(row.get("unsold_rate_pct", "0"), as_float=True),
            })
    return parsed


def code_for_row(meta_by_key, target_sido, row):
    key = (config.SIDO_SHORT[target_sido], row["region_name"])
    return meta_by_key.get(key)


def main():
    meta = load_json(config.DATA_INTERIM / "regions_meta.json")
    meta_by_key = {(config.SIDO_SHORT[m["sido"]], m["name"]): m["code"] for m in meta}
    current_codes = {m["code"] for m in meta}

    session = requests.Session()
    session.headers.update({"User-Agent": USER_AGENT, "Accept": "application/json, text/plain, */*"})

    period = latest_period(session)
    rows_by_code = {code: None for code in current_codes}
    unmapped = []
    report_rows = []
    for sido, target_sido in sorted(REPORT_SIDO.items()):
        mml = fetch_report(session, period, sido)
        rows = parse_report(mml)
        print(f"ILIS {period} {sido}->{target_sido} {REPORT_SIDO_LABEL[sido]}: {len(rows)} rows")
        for row in rows:
            aggregate_names = {
                REPORT_SIDO_LABEL[sido],
                REPORT_SIDO_LABEL[sido].replace("(구)", ""),
                config.SIDO_SHORT[target_sido],
            }
            if row["region_name"] in aggregate_names:
                continue
            code = code_for_row(meta_by_key, target_sido, row)
            record = {"sido": sido, "target_sido": target_sido, **row}
            report_rows.append(record)
            if code:
                rows_by_code[code] = {k: v for k, v in row.items() if k != "region_name"}
            else:
                unmapped.append(record)
        time.sleep(0.2)

    values = {}
    for code in sorted(current_codes):
        if code in UNRESOLVED_SPLIT_CODES:
            values[code] = None
            continue
        values[code] = rows_by_code[code] or {
            "park_count": 0,
            "designated_area_m2": 0,
            "industrial_target_area_m2": 0,
            "announced_area_m2": 0,
            "sold_area_m2": 0,
            "unsold_area_m2": 0,
            "unsold_rate_pct": 0.0,
        }

    save_json({
        "fetched_at": time.strftime("%Y-%m-%d"),
        "source": {
            "name": "ILIS 산업입지정보센터 통계검색 - 지역별 산업시설용지분양현황",
            "url": "https://www.industryland.or.kr/sta/staSearch/list",
            "report_file": REPORT_FILE,
            "period": period,
        },
        "unit": "m2",
        "values": values,
        "report_rows": report_rows,
        "unmapped_rows": unmapped,
        "unresolved_split_codes": UNRESOLVED_SPLIT_CODES,
    }, config.DATA_INTERIM / "ilis_industrial_land.json", indent=1)
    print(f"ilis done: {sum(1 for v in rows_by_code.values() if v)} mapped, {len(unmapped)} unmapped")


if __name__ == "__main__":
    main()
