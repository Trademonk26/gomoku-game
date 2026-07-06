from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_RAW = ROOT / "data" / "raw"
DATA_INTERIM = ROOT / "data" / "interim"
OUT_WEB = ROOT / "outputs" / "web"
CURATION = ROOT / "pipeline" / "curation"

SNAPSHOT = "2026Q3"

# 광역시·특별(자치)시가 아닌 '도' — 하위 일반구를 모시(母市)로 병합한다
DO_SIDO = {"41", "43", "44", "46", "47", "48", "51", "52"}

# 2026.7 현행: 광주광역시+전라남도 → 전남광주통합특별시(12)로 통합 (구 29/46 코드 소멸)
SIDO_SHORT = {
    "11": "서울", "12": "전남광주", "26": "부산", "27": "대구", "28": "인천",
    "30": "대전", "31": "울산", "36": "세종", "41": "경기", "43": "충북",
    "44": "충남", "47": "경북", "48": "경남", "50": "제주",
    "51": "강원", "52": "전북",
}

# 전력계통영향평가 계통 포화권(수도권) 시도 코드 — 페널티 트리거
METRO_SATURATED_SIDO = {"11", "28", "41"}
JEJU_SIDO = "50"

PENALTY_METRO = -15.0
PENALTY_JEJU = -10.0

# 냉방도일 기준온도(기상청 관행)
CDD_BASE_C = 24.0
CDD_YEARS = ("2020-01-01", "2024-12-31")

# 서울 IX 근사 좌표(강남권) — N2 지연시간 프록시의 기준점
SEOUL_IX = (127.0276, 37.4979)  # (lon, lat)
FIBER_ROUTE_FACTOR = 1.4        # 직선 대비 실제 광경로 우회 계수(프록시)
FIBER_US_PER_KM = 5.0           # 광섬유 전파지연 µs/km
