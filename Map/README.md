# DC Site Screener — 대한민국 데이터센터 입지 스크리닝 맵

AI 데이터센터 건립 후보지를 전국 단위로 스크리닝·랭킹하는 인터랙티브 맵.
"전력 접속 가능성 · 수자원/냉각 · 규제 리스크가 낮은 대규모 부지"를 공개 데이터 기반으로 1차 발굴한다.

- **[BLUEPRINT.md](./BLUEPRINT.md)** — 상세 청사진 (평가 프레임워크 7축 38지표, 데이터 아키텍처, UI/UX, 로드맵)
- 상태: **Phase 1-1 완료 (2026-07-06)** — 시군구 230 단위 MVP 가동

## Phase 1-1에서 구현된 것

- **파이프라인** (`pipeline/`, Python): 행정경계(admdongkor 2026.7 현행 — 광주·전남 통합 반영, 시도 16개) → 시군구 230 병합 → 지표 계산 → 백분위 → 근거(evidence) 자동 생성 → `outputs/web/dataset.json`
- **라이브 지표 8개** (모두 API 키 불필요 소스): P1·P2 변전소 근접성/밀도(OSM 154kV+ 847개), P6 대형 발전설비(OSM), W5 냉방도일(Open-Meteo ERA5 5개년), N1 육양국 거리(큐레이션), N2 서울 IX 지연 추정(산식), H3 지진구역계수(KDS), A1 유치 의지(출처 필수 큐레이션)
- **웹앱** (`web/`, React+TypeScript+MapLibre+ECharts): 코로플레스 지도 + 오버레이(변전소/발전소/육양국), 랭킹 테이블, 지역 상세(레이더·추천/주의/확인필요 근거·지표 팝오버), 가중치 슬라이더 + 프리셋 3종(URL 공유), 순위 안정성(가중치 섭동), 방법론 페이지, 클러스터 가설 8종, 라이트/다크
- **정직한 결측 처리**: L(토지·규제)·S(부지) 축은 API 키 필요 소스라 대기 — 가중치 재분배 + 커버리지 % 상시 표기
- **계약 테스트**: `scoring.py ≡ scoring.ts` 동일 fixture 검증 (pytest 6 + vitest 37)

## 실행

```bash
# 1) 파이프라인 (Python 3.12, 최초 1회)
python3 -m venv .venv && .venv/bin/pip install -r pipeline/requirements.txt
make all            # 경계→OSM→CDD→dataset→테스트→웹 데이터 복사

# 2) 웹앱
cd web && npm install
npm run dev         # 개발 서버
npm run build && npm run preview   # 프로덕션 확인
node scripts/e2e.mjs               # 헤드리스 E2E (스크린샷 5장)
```

## Phase 1-2 (다음 단계) — API 키 발급 필요

| 키 | 발급처 | 잠금 해제되는 지표 |
|---|---|---|
| V-World | vworld.kr | L1 용도지역 비율, L2 규제 중첩도 |
| 공공데이터포털 | data.go.kr | L4 개별공시지가 |
| SGIS | sgis.kostat.go.kr | S5 인구밀도, A2 주거 근접(격자인구) |
| 기상자료개방포털 | data.kma.go.kr | W5를 기상청 관측 평년값으로 승급 |
| (무키) ILIS 정리 | industryland.or.kr | S1·S2 산업단지 공급 |

> ⚠️ 본 도구는 1차 탐색·랭킹 시스템이며 투자 판단 근거가 아니다. 모든 점수는 공개 데이터 프록시(지표별 신뢰도 A/B/C 명시)이고, 최종 의사결정 전 한전 접속검토·현장 실사·지자체 협의·법률 검토가 필수다.
