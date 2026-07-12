"""지표 계산 → 백분위 → 근거(evidence) 생성 → outputs/web/dataset.json 산출.

Phase 1-2 라이브 지표 11개: P1 P2 P6 / W5 / N1 N2 / H3 / S1 S2 S6 / A1
L(토지·규제) 축은 API 키 필요 소스라 결측 — 가중치 재분배 + 커버리지로 정직하게 표시.
"""
import sys
import time
from pathlib import Path

import yaml

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import config
from scoring.scoring import compute_score, percentile_scores
from util import haversine_km, load_json, save_json

AXES = [
    {"id": "P", "label": "전력 인프라", "desc": "154kV+ 변전소 근접성·밀도, 대형 발전원"},
    {"id": "W", "label": "수자원·냉각", "desc": "냉방도일(냉각 부하)"},
    {"id": "L", "label": "토지·규제", "desc": "용도지역·규제 중첩·지가 (데이터 대기)"},
    {"id": "N", "label": "통신망", "desc": "해저케이블 육양국, 수도권 지연시간"},
    {"id": "H", "label": "재난 안전", "desc": "지진구역계수"},
    {"id": "S", "label": "부지 확보", "desc": "공식 산업시설용지 미분양·개발중·분양공고 면적"},
    {"id": "A", "label": "인허가·수용성", "desc": "지자체 유치 의지(큐레이션)"},
]

PRESETS = {
    "balanced": {"label": "균형(기본)", "w": {"P": 30, "L": 15, "S": 13, "W": 12, "H": 10, "N": 10, "A": 10}},
    "ai": {"label": "AI 훈련 캠퍼스", "w": {"P": 38, "L": 12, "S": 16, "W": 13, "H": 9, "N": 4, "A": 8}},
    "cloud": {"label": "클라우드 리전/코로", "w": {"P": 25, "L": 13, "S": 10, "W": 10, "H": 10, "N": 20, "A": 12}},
}

INDICATORS = [
    {"id": "P1", "axis": "P", "label": "154kV+ 변전소 근접성", "unit": "km", "direction": "down",
     "reliability": "C", "source": {"name": "OpenStreetMap (ODbL)", "url": "https://www.openstreetmap.org"},
     "source_type": "public_map_proxy", "proxy_level": "proxy", "official_source": False,
     "requires_manual_verification": True, "cannot_confirm_connection": True,
     "caveat": "OSM 태깅 기반 — 전압 미태깅 변전소 누락 가능. 여유용량은 알 수 없음(한전 접속검토 필수)",
     "good": "대용량 수전 인프라(154kV급) 근접", "bad": "송전 인프라 원거리 — 전용선로 신설 비용·기간 부담"},
    {"id": "P2", "axis": "P", "label": "반경 20km 154kV+ 변전소 수", "unit": "개", "direction": "up",
     "reliability": "C", "source": {"name": "OpenStreetMap (ODbL)", "url": "https://www.openstreetmap.org"},
     "source_type": "public_map_proxy", "proxy_level": "proxy", "official_source": False,
     "requires_manual_verification": True, "cannot_confirm_connection": True,
     "caveat": "OSM 태깅 기반 — 실제 여유용량과 무관",
     "good": "복수 변전소 인접 — 계통 대안 확보 유리", "bad": "인접 변전소 희소"},
    {"id": "P6", "axis": "P", "label": "반경 30km 대형 발전설비", "unit": "MW", "direction": "up",
     "reliability": "C", "source": {"name": "OpenStreetMap (ODbL)", "url": "https://www.openstreetmap.org"},
     "source_type": "public_map_proxy", "proxy_level": "proxy", "official_source": False,
     "requires_manual_verification": True, "cannot_confirm_connection": True,
     "caveat": "OSM 출력 태그 합산(원전·석탄·가스·유류) — 누락·구식 값 가능",
     "good": "대형 발전원 인접 — 계통 여유·안정성 프록시", "bad": "대형 발전원 원거리"},
    {"id": "W5", "axis": "W", "label": "냉방도일(연평균, 기준 24°C)", "unit": "°C·일", "direction": "down",
     "reliability": "B", "source": {"name": "Open-Meteo ERA5 (2020~2024)", "url": "https://open-meteo.com"},
     "source_type": "model_proxy", "proxy_level": "proxy", "official_source": False,
     "requires_manual_verification": False,
     "caveat": "재분석(ERA5) 격자 기반 — 기상청 관측 평년값 대체 프록시",
     "good": "냉방 부하 낮음 — 프리쿨링·PUE 유리", "bad": "냉방 부하 높음 — 냉각 비용 부담"},
    {"id": "N1", "axis": "N", "label": "국제 육양국 거리", "unit": "km", "direction": "down",
     "reliability": "C", "source": {"name": "공개 보도 기반 자체 정리(부산 송정·거제·태안)", "url": "https://www.khan.co.kr/article/202411201535001"},
     "source_type": "manual_curation", "proxy_level": "proxy", "official_source": False,
     "requires_manual_verification": True,
     "caveat": "육양국 좌표는 ±수 km 근사 — 케이블 시스템별 용량·여유는 별도 확인",
     "good": "국제 해저케이블 관문 근접", "bad": "국제 트래픽 관문 원거리"},
    {"id": "N2", "axis": "N", "label": "서울 IX 왕복지연 추정", "unit": "ms", "direction": "down",
     "reliability": "C", "source": {"name": "직선거리×우회계수(1.4)×5µs/km 산식", "url": ""},
     "source_type": "model_proxy", "proxy_level": "weak_proxy", "official_source": False,
     "requires_manual_verification": True,
     "caveat": "도로·직선 기반 추정 — 실제 광경로는 통신사 견적으로 확인 필요",
     "good": "수도권 저지연 서비스권", "bad": "저지연 서비스 부적합(AI 훈련 워크로드는 무관)"},
    {"id": "H3", "axis": "H", "label": "지진구역계수", "unit": "g", "direction": "down",
     "reliability": "A", "source": {"name": "국토안전관리원 지진구역도(KDS)", "url": "https://www.kalis.or.kr/wpge/m_195/info/info060601.do"},
     "source_type": "official_stat", "proxy_level": "direct", "official_source": True,
     "requires_manual_verification": False,
     "caveat": "행정구역 단위 설계기준값 — 동남권 실제 지진활동도(활성단층)는 Phase 2 H2로 보강",
     "good": "설계 지진하중 낮은 구역(지진구역 II)", "bad": None},
    {"id": "S1", "axis": "S", "label": "미분양 산업시설용지 면적", "unit": "ha", "direction": "up",
     "reliability": "A", "source": {"name": "ILIS 산업입지정보센터 통계검색 - 지역별 산업시설용지분양현황", "url": "https://www.industryland.or.kr/sta/staSearch/list"},
     "source_type": "official_stat", "proxy_level": "direct", "official_source": True,
     "requires_manual_verification": False,
     "caveat": "시군구 단위 공식 통계의 미분양면적 — 데이터센터 용도 적합성·필지 형상·가격·인프라는 개별 공고 확인 필요",
     "good": "공식 미분양 산업시설용지 재고 — 즉시 확보 후보가 많음", "bad": "공식 미분양 산업시설용지 재고 부족"},
    {"id": "S2", "axis": "S", "label": "개발중 산업시설용지 면적", "unit": "ha", "direction": "up",
     "reliability": "A", "source": {"name": "ILIS 산업입지정보센터 통계검색 - 개발중 및 미분양 산업시설용지 현황", "url": "https://www.industryland.or.kr/sta/staSearch/list"},
     "source_type": "official_stat", "proxy_level": "direct", "official_source": True,
     "requires_manual_verification": False,
     "caveat": "시군구 단위 공식 통계의 분양미공고 개발중 산업시설용지 — 공급 시점·조성 공정·개별 필지 계획은 사업시행자 확인 필요",
     "good": "개발중 산업시설용지 면적 큼 — 중기 공급 파이프라인 풍부", "bad": "개발중 산업시설용지 공급 파이프라인 부족"},
    {"id": "S6", "axis": "S", "label": "분양공고 산업시설용지 면적", "unit": "ha", "direction": "up",
     "reliability": "A", "source": {"name": "ILIS 산업입지정보센터 통계검색 - 지역별 산업시설용지분양현황", "url": "https://www.industryland.or.kr/sta/staSearch/list"},
     "source_type": "official_stat", "proxy_level": "direct", "official_source": True,
     "requires_manual_verification": False,
     "caveat": "시군구 단위 공식 통계의 분양공고면적 — 현재 공고별 잔여 필지·접수 상태는 ILIS/시행자 공고 확인 필요",
     "good": "분양공고 산업시설용지 면적 큼 — 공급 신호 강함", "bad": "분양공고 산업시설용지 면적 작음"},
    {"id": "A1", "axis": "A", "label": "지자체 유치 의지(큐레이션)", "unit": "점", "direction": "up",
     "reliability": "C", "source": {"name": "언론 보도 수동 큐레이션(출처 필수 정책)", "url": ""},
     "source_type": "manual_curation", "proxy_level": "proxy", "official_source": False,
     "requires_manual_verification": True,
     "caveat": "v1.1 재정의: 공식 조례·공고·전담조직 중심(B 목표) — 현행 시드 5개 지역은 언론 보도 포함(C·재검증 대상), 미등재 지역은 0점이 아닌 결측",
     "good": "유치 실적·의지 문서화(협약·기공·준공)", "bad": None},
]

IND_BY_ID = {i["id"]: i for i in INDICATORS}


def build_values(meta, power, cdd, ilis, stations, zone2_keys, incentives):
    values = {m["code"]: {} for m in meta}
    subs = power["substations_154kv"]
    plants = [p for p in power["plants"]
              if p["mw"] and any(t in {"nuclear", "coal", "gas", "oil", "lng"} for t in p["src"].split(";"))]
    for m in meta:
        code, (lon, lat) = m["code"], m["rep"]
        dists = [haversine_km(lon, lat, s["lon"], s["lat"]) for s in subs]
        v = values[code]
        v["P1"] = round(min(dists), 1) if dists else None
        v["P2"] = sum(1 for d in dists if d <= 20.0)
        v["P6"] = round(sum(p["mw"] for p in plants if haversine_km(lon, lat, p["lon"], p["lat"]) <= 30.0), 0)
        v["W5"] = cdd.get(code)
        v["N1"] = round(min(haversine_km(lon, lat, s["lon"], s["lat"]) for s in stations), 1)
        km_seoul = haversine_km(lon, lat, *config.SEOUL_IX) * config.FIBER_ROUTE_FACTOR
        v["N2"] = round(km_seoul * config.FIBER_US_PER_KM * 2 / 1000.0, 2)
        key = (config.SIDO_SHORT[m["sido"]], m["name"])
        v["H3"] = 0.07 if key in zone2_keys else 0.11
        ilis_row = ilis["values"].get(code)
        v["S1"] = None if ilis_row is None else round((ilis_row.get("unsold_area_m2") or 0) / 10_000, 1)
        v["S2"] = None if ilis_row is None else round((ilis_row.get("development_pipeline_area_m2") or 0) / 10_000, 1)
        v["S6"] = None if ilis_row is None else round((ilis_row.get("announced_area_m2") or 0) / 10_000, 1)
        v["A1"] = incentives.get(key, {}).get("score")
    return values


def build_evidence(m, values, pct, flags, incentives):
    rec, caution, verify = [], [], []
    key = (config.SIDO_SHORT[m["sido"]], m["name"])
    for ind in INDICATORS:
        iid = ind["id"]
        p, v = pct[m["code"]].get(iid), values[m["code"]].get(iid)
        if p is None:
            continue
        vtxt = f"{v:g}{ind['unit']}"
        if p >= 90 and ind["good"]:
            note = incentives.get(key, {}).get("note") if iid == "A1" else None
            rec.append({"ind": iid, "text": f"「{ind['label']}」 전국 상위 {max(1, round(100 - p))}% ({vtxt}) — {note or ind['good']}"})
        elif p <= 15 and ind["bad"]:
            caution.append({"ind": iid, "text": f"「{ind['label']}」 전국 하위 {max(1, round(p))}% ({vtxt}) — {ind['bad']}"})
        if ind["reliability"] == "C" and p >= 80:
            verify.append({"ind": iid, "text": f"「{ind['label']}」은(는) 프록시 지표 — {ind['caveat']}"})
    conn_ids = [i["id"] for i in INDICATORS if i.get("cannot_confirm_connection")]
    p_axis = [pct[m["code"]].get(i) for i in conn_ids]
    p_avail = [x for x in p_axis if x is not None]
    if p_avail and sum(p_avail) / len(p_avail) >= 75:
        verify.append({"ind": "P", "text": "전력축 상위권 — 한전 접속검토(예비검토→본검토) 신청으로 실제 수전 가능성 확인 필수"})
    if flags["metro"]:
        caution.append({"ind": "P8", "text": "전력계통영향평가 대상권(수도권) — 페널티 −15점 적용. 신규 대형 수전은 평가 통과 필요"})
    if flags["jeju"]:
        caution.append({"ind": "P8", "text": "계통 고립(제주) — 페널티 −10점 적용. HVDC 연계 제약"})
    verify.append({"ind": "L", "text": "토지·규제(L) 축은 데이터 대기(V-World API 키 필요) — 용도지역·규제중첩은 토지이음/V-World에서 개별 확인"})
    return {"recommend": rec[:4], "caution": caution[:3], "verify": verify[:4]}


def main():
    meta = load_json(config.DATA_INTERIM / "regions_meta.json")
    power = load_json(config.DATA_INTERIM / "power.json")
    cdd = load_json(config.DATA_INTERIM / "cdd.json")["cdd"]
    ilis = load_json(config.DATA_INTERIM / "ilis_industrial_land.json")

    stations = yaml.safe_load((config.CURATION / "landing_stations.yaml").read_text())["stations"]
    seismic = yaml.safe_load((config.CURATION / "seismic_zones.yaml").read_text())
    zone2_keys = {(g["sido_short"], n) for g in seismic["zone2_regions"] for n in g["names"]}
    inc_raw = yaml.safe_load((config.CURATION / "incentives.yaml").read_text())["entries"]
    incentives = {(e["sido_short"], e["name"]): e for e in inc_raw}

    valid_keys = {(config.SIDO_SHORT[m["sido"]], m["name"]) for m in meta}
    for k in list(incentives) + list(zone2_keys):
        if k not in valid_keys:
            raise SystemExit(f"큐레이션 키가 지역 목록과 불일치: {k}")

    values = build_values(meta, power, cdd, ilis, stations, zone2_keys, incentives)

    pct = {m["code"]: {} for m in meta}
    codes = [m["code"] for m in meta]
    for ind in INDICATORS:
        scores = percentile_scores([values[c].get(ind["id"]) for c in codes], ind["direction"])
        for c, s in zip(codes, scores):
            pct[c][ind["id"]] = s

    regions = []
    for m in meta:
        flags = {"metro": m["sido"] in config.METRO_SATURATED_SIDO, "jeju": m["sido"] == config.JEJU_SIDO}
        regions.append({
            "code": m["code"], "name": m["name"], "label": m["label"],
            "sido": m["sido"], "sidonm": m["sidonm"], "area_km2": m["area_km2"], "rep": m["rep"],
            "values": values[m["code"]], "pct": pct[m["code"]], "flags": flags,
            "evidence": build_evidence(m, values, pct, flags, incentives),
        })

    dataset = {
        "meta": {
            "snapshot": config.SNAPSHOT,
            "generated_at": time.strftime("%Y-%m-%d"),
            "axes": AXES,
            "indicators": [{k: v for k, v in ind.items() if k not in ("good", "bad")} for ind in INDICATORS],
            "indicator_dictionary": {"version": "v1.1", "designed": 43},
            "presets": PRESETS,
            "penalties": {"metro": -15, "jeju": -10},
            "deferred_axes": {"L": "V-World API 키 필요"},
            "ilis_note": f"ILIS 산업시설용지분양현황·개발중 및 미분양 현황 {ilis['source']['period']} 기준, 미등재 시군구는 0㎡로 처리. 행정구역 분구 전 집계는 결측 유지",
            "osm_note": f"변전소 전체 {power['substations_all']}개 중 전압 미태깅 {power['substations_voltage_untagged']}개 제외",
            "power_overlay": {
                "substations": power["substations_154kv"],
                "plants": [p for p in power["plants"] if p["mw"] and p["mw"] >= 500],
            },
            "landing_stations": stations,
        },
        "regions": regions,
    }
    save_json(dataset, config.OUT_WEB / "dataset.json")
    save_json(dataset, config.OUT_WEB / f"dataset_{config.SNAPSHOT}.json")

    # 계약 테스트 fixture: 표본 지역 × 3프리셋 기대 점수
    inds_min = [{"id": i["id"], "axis": i["axis"]} for i in INDICATORS]
    sample = regions[::20]
    fixture = {"indicators": inds_min, "cases": []}
    for preset_id, preset in PRESETS.items():
        for r in sample:
            res = compute_score({"pct": r["pct"], "flags": r["flags"]}, inds_min, preset["w"])
            fixture["cases"].append({
                "code": r["code"], "preset": preset_id, "pct": r["pct"], "flags": r["flags"],
                "weights": preset["w"],
                "expected": {"total": res["total"], "grade": res["grade"], "coverage": res["coverage"]},
            })
    save_json(fixture, config.ROOT / "outputs" / "fixtures" / "scoring_fixture.json", indent=1)
    print(f"dataset done: {len(regions)} regions, fixture cases={len(fixture['cases'])}")


if __name__ == "__main__":
    main()
