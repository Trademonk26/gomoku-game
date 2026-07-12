"""ILIS 산업시설용지 분양현황을 시군구 단위로 내려받는다.

공개 통계검색의 ReportingServer MML 응답(SALocILInduByTot,
SALocILInduGbMbDan)을 사용한다.
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
SALES_REPORT_FILE = "SALocILInduByTot"
PIPELINE_REPORT_FILE = "SALocILInduGbMbDan"
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
SALES_COLS = [
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
PIPELINE_COLS = [
    ("region", 16, 724),
    ("kind", 780, 1358),
    ("park_count", 1414, 2014),
    ("designated_area_m2", 2070, 2968),
    ("industrial_target_area_m2", 3024, 3871),
    ("announced_area_m2", 3927, 4774),
    ("developed_area_m2", 4830, 5676),
    ("sold_area_m2", 5732, 6579),
    ("self_use_area_m2", 6635, 7483),
    ("pipeline_and_unsold_area_m2", 7539, 8383),
    ("development_pipeline_area_m2", 8439, 9286),
    ("unsold_area_m2", 9342, 10189),
    ("pipeline_excluded_area_m2", 10245, 11095),
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


def report_payload(period, sido, report_file, report_title):
    sido_label = REPORT_SIDO_LABEL[sido] if sido else "전체"
    title = f"지역별 [{sido_label}] <{report_title}>"
    mrd_param = (
        "/rf [http://localhost:3004/DataServer/rdagent.jsp] "
        "/rsn [ILIS] "
        f"/rp [{period}] [{sido}] [all] "
        f"/rv pg_no[1] danwi[1] unit[㎡] statitle[{title}]"
    )
    return {
        "opcode": "700",
        "mrd_path": f"http://localhost:2004/ReportingServer/sa/mrd/search/{report_file}.mrd",
        "mrd_param": mrd_param,
        "mrd_plain_param": "",
        "mrd_data": "",
        "runtime_param": "",
        "mmlVersion": "0",
        "protocol": "sync",
    }


def fetch_report(session, period, sido, report_file, report_title):
    r = session.post(
        REPORT_URL,
        data=report_payload(period, sido, report_file, report_title),
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


def column_for(le, ri, columns):
    center = (le + ri) / 2
    for name, start, end in columns:
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
    return "세종시" if name.startswith("세종") else name


def parse_report(mml, columns):
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
            col = column_for(le, ri, columns)
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
            parsed_row = {"region_name": region}
            for name, _, _ in columns:
                if name in {"region", "kind"}:
                    continue
                parsed_row[name] = parse_number(
                    row.get(name, "0"), as_float=name == "unsold_rate_pct"
                )
            parsed.append(parsed_row)
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
    pipeline_by_code = {}
    unmapped = []
    report_rows = []
    pipeline_report_rows = []
    for sido, target_sido in sorted(REPORT_SIDO.items()):
        mml = fetch_report(
            session, period, sido, SALES_REPORT_FILE, "산업시설용지분양현황"
        )
        rows = parse_report(mml, SALES_COLS)
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

        pipeline_mml = fetch_report(
            session,
            period,
            sido,
            PIPELINE_REPORT_FILE,
            "개발중 및 미분양 산업시설용지 현황",
        )
        pipeline_rows = parse_report(pipeline_mml, PIPELINE_COLS)
        for row in pipeline_rows:
            expected_total = (
                row["development_pipeline_area_m2"]
                + row["unsold_area_m2"]
                - row["pipeline_excluded_area_m2"]
            )
            if row["pipeline_and_unsold_area_m2"] != expected_total:
                raise RuntimeError(
                    f"ILIS pipeline formula mismatch: {sido} {row['region_name']}"
                )
        print(
            f"ILIS pipeline {period} {sido}->{target_sido} "
            f"{REPORT_SIDO_LABEL[sido]}: {len(pipeline_rows)} rows"
        )
        for row in pipeline_rows:
            aggregate_names = {
                REPORT_SIDO_LABEL[sido],
                REPORT_SIDO_LABEL[sido].replace("(구)", ""),
                config.SIDO_SHORT[target_sido],
            }
            if row["region_name"] in aggregate_names:
                continue
            code = code_for_row(meta_by_key, target_sido, row)
            record = {"sido": sido, "target_sido": target_sido, **row}
            pipeline_report_rows.append(record)
            if code:
                pipeline_by_code[code] = row["development_pipeline_area_m2"]
            elif not code:
                unmapped.append({"report": PIPELINE_REPORT_FILE, **record})
        time.sleep(0.2)

    sales_codes = {code for code, row in rows_by_code.items() if row is not None}
    if set(pipeline_by_code) != sales_codes:
        raise RuntimeError(
            "ILIS report region mismatch: "
            f"sales-only={sorted(sales_codes - set(pipeline_by_code))}, "
            f"pipeline-only={sorted(set(pipeline_by_code) - sales_codes)}"
        )

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
        values[code]["development_pipeline_area_m2"] = pipeline_by_code.get(code, 0)

    save_json({
        "fetched_at": time.strftime("%Y-%m-%d"),
        "source": {
            "name": "ILIS 산업입지정보센터 통계검색 - 산업시설용지 분양·개발중 현황",
            "url": "https://www.industryland.or.kr/sta/staSearch/list",
            "report_files": [SALES_REPORT_FILE, PIPELINE_REPORT_FILE],
            "period": period,
        },
        "unit": "m2",
        "values": values,
        "report_rows": report_rows,
        "pipeline_report_rows": pipeline_report_rows,
        "unmapped_rows": unmapped,
        "unresolved_split_codes": UNRESOLVED_SPLIT_CODES,
    }, config.DATA_INTERIM / "ilis_industrial_land.json", indent=1)
    print(f"ilis done: {sum(1 for v in rows_by_code.values() if v)} mapped, {len(unmapped)} unmapped")


if __name__ == "__main__":
    main()
