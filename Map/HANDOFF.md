# HANDOFF.md — 작업 인수인계 가이드 (2026-07-12 기준)

> 이 프로젝트를 이어받는 에이전트/개발자를 위한 **운영 문서**.
> 설계 근거·지표 정의는 [BLUEPRINT.md](./BLUEPRINT.md)(지표 사전 v1.1 = §3.3), 실행법·상태 요약은 [README.md](./README.md).
> 이 문서는 "무엇이 끝났고, 무엇을 깨뜨리면 안 되고, 어디서 시작하는지"만 다룬다.

## 1. 완료된 것 (커밋 이력)

| 단계 | 커밋 | 내용 |
|---|---|---|
| Phase 0 청사진 | `5ee1f77` | BLUEPRINT.md — 7축 지표 사전, 2단계 스코어링(게이트→가중합), 데이터 아키텍처, UI/UX, 로드맵 |
| Phase 1-1 파이프라인 | `b39b197` | 무키(no-key) 소스만으로 라이브 지표 8개: 행정경계 230 시군구, OSM 전력설비(154kV+ 847개), ERA5 냉방도일, 큐레이션 3종(YAML) |
| Phase 1-1 웹앱 | `9a041f7` | React+MapLibre SPA — 코로플레스, 지역 상세(레이더·추천/주의/확인필요 근거), 가중치 슬라이더+프리셋 3종(URL 공유), 순위 안정성, 랭킹, 방법론, 클러스터 가설 8종, 라이트/다크 |
| 문서 정리 | `01be691` | README·로드맵 갱신 |
| 지표 사전 v1.1 | `ce80096` | 외부 리뷰 반영 — 공식-프록시 **병행 구조**, 43지표 재정비(신규 P11·P12·S6 / 퇴역 W2·H7·A5), 레지스트리 메타필드 5종, UI 고지문 2종 |

**검증 상태 (2026-07-12 전부 통과)**: pytest 6 · vitest 37(계약 테스트) · `npm run build` · Playwright E2E 콘솔 오류 0건.

**라이브 지표 11개**: P1·P2(OSM 변전소 근접/밀도), P6(OSM 발전설비), W5(ERA5 냉방도일), N1(육양국), N2(서울 IX 지연 산식), H3(지진구역계수), S1(미분양)·S2(개발중)·S6(분양공고 산업시설용지), A1(유치 의지 큐레이션). L(토지) 축은 결측 — 가중치 재분배 + 커버리지 %로 정직 표시 중.

## 2. 저장소 지형

- **모노레포** `Trademonk26/gomoku-game` — 오목, 우리빌라 주차장 등 다른 프로젝트와 공존. 이 프로젝트는 `Map/` 디렉토리만 건드린다.
- 루트 `CLAUDE.md` 워크플로우 규칙(승계할 것): 작업 단위별 커밋, **커밋 메시지는 한국어로 구체적으로**, 커밋 전 `git status`로 신규 파일 누락 확인, push 대상은 `origin`.

```
Map/
├── BLUEPRINT.md                  # 설계 원본 (지표 사전 v1.1 §3.3, 게이트 §3.1, 산식 §3.1+§3.4)
├── README.md                     # 실행법 + Phase 1-2 API 키 표
├── Makefile                      # all / boundaries / osm / cdd / dataset / test / web-data / web-build
├── pipeline/                     # Python 3.12, .venv 사용 (.venv/bin/python — Makefile에 배선됨)
│   ├── config.py                 # 상수: SIDO_SHORT("12"=전남광주 통합!), 페널티, CDD 24°C, 서울IX 좌표
│   ├── sources/                  # fetch_boundaries / fetch_osm_power / fetch_cdd
│   ├── curation/                 # landing_stations, seismic_zones, incentives (YAML — 출처 URL 필수 정책)
│   ├── indicators/build_dataset.py  # ★핵심: INDICATORS 레지스트리 + build_values + 근거 생성 + dataset.json
│   ├── scoring/scoring.py        # 백분위(mid-rank)·축평균·가중합·페널티·등급
│   └── tests/test_scoring.py
├── outputs/                      # 커밋됨: web/dataset.json, web/regions.geojson, fixtures/scoring_fixture.json
└── web/                          # React 18 + TS + Vite(rolldown) + MapLibre + ECharts + Zustand
    ├── src/lib/scoring.ts        # scoring.py의 TS 미러 — 계약 테스트 대상
    ├── src/lib/types.ts          # IndicatorMeta(v1.1 메타필드), SOURCE_TYPE_KO
    └── scripts/e2e.mjs           # Playwright 헤드리스 (preview 서버 4173 필요)
```

데이터 흐름: `sources → data/interim(.gitignore) → build_dataset.py → outputs/web/*.json(커밋) → make web-data → web/public/data(.gitignore)로 복사`.

## 3. 깨뜨리면 안 되는 불변식

1. **계약 테스트**: `scoring.py ≡ scoring.ts`. 같은 fixture(`outputs/fixtures/scoring_fixture.json` → `web/src/lib/scoring.fixture.json` 복사본)로 양쪽을 1e-9 허용오차 검증. **합산·순회 순서까지 일부러 동일하게 맞춰져 있다**(부동소수 일치). 스코어링 로직 수정 시 반드시 양쪽 동시 수정 → `make dataset test web-data` → `cd web && npx vitest run`. fixture는 절대 손으로 고치지 말고 재생성한다(지표 추가 시 fixture가 바뀌는 건 정상).
2. **지표 ID는 개념에 고정** (v1.1 원칙): 번호 재배열 금지, 퇴역 ID(W2·H7·A5) 재사용 금지. 신규는 새 번호(다음: P13, W7, L6, N6, H8, S7, A6).
3. **정직성 원칙**: 결측은 결측(0점 대체 금지) + 가중치 재분배 + 커버리지 % 표시. 모든 지표에 신뢰도 A/B/C + caveat + 출처. 큐레이션 YAML은 출처 URL 없으면 등재 금지, 미등재 지역은 결측. 근거(evidence)는 규칙 기반 템플릿만 사용(LLM으로 사실 생성 금지).
4. **공식-프록시 병행 원칙** (v1.1 §3.4): 한전 공식(비식별·집계) ↔ OSM(좌표 프록시)은 교체가 아닌 병행. "전력 접속 가능성"을 점수로 확정 표현 금지 — '확인 필요'(한전 접속검토) 카드로 보낸다(`cannot_confirm_connection` 플래그가 트리거).
5. **행정구역**: 2026.7 현행 기준 시도 16 · 시군구 230. 광주+전남 = 전남광주통합특별시(시도코드 `12`). 도 지역 일반구는 모시(母市)로 병합: `sgg[:4]+"0"`. 큐레이션 키는 `(SIDO_SHORT, 지역명)` — 불일치 시 build_dataset이 SystemExit로 막아준다(의도된 안전장치).
6. **면책 고지 제거 금지**: 푸터 면책, 예비 MVP 배너(App.tsx), 방법론 산식 옆 전력 접속 고지(Methodology.tsx). 이 도구는 1차 스크리닝이지 투자 판단 근거가 아니다.
7. **라이선스**: OSM은 ODbL 저작자표시(지도 어트리뷰션에 이미 반영). TeleGeography 지도는 열람만 — **재배포 금지**(육양국은 자체 근사 DB 사용 중).

## 4. 이미 밟았던 지뢰 (재발 방지)

- **Overpass 406 오류**: `User-Agent` 헤더 없으면 Apache WAF가 0.8초 만에 406 반환. `fetch_osm_power.py`에 UA 설정돼 있음 — 제거하지 말 것. 미러 3개 로테이션 + 재시도 내장.
- **MapLibre 지도 높이 0 붕괴**: maplibre-gl.css의 `.maplibregl-map{position:relative}`가 컨테이너 스타일을 덮어씀. `index.css`의 `.map-container{width:100%;height:100%}` + load 시 `map.resize()`가 그 해결책 — 건드리면 지도가 빈 화면이 된다.
- **E2E는 preview 서버 필요**: `npm run build && npm run preview`(4173) 띄운 뒤 `node scripts/e2e.mjs`. playwright import는 `web/` 안에서 실행해야 모듈 해석됨.
- **admdongkor 스냅샷**: `ver20260701` 고정. 갱신 시 시도코드/시군구 수 변동 여부 확인 후 config·문서 동기화.
- **data.go.kr 파일데이터**: 일부는 다운로드에 로그인 필요. 자동화 시 확인 필요(P11의 15128065 등).
- **재생성 순서**: 지표 코드 수정 후 `make dataset test web-data`를 안 돌리면 web이 구버전 dataset을 서빙한다.

## 5. 다음 작업 (Phase 1-2) — 여기서 시작

### 지표 추가 레시피 (공통 절차)
1. `pipeline/sources/fetch_X.py` 작성 (원천 → `data/interim/X.json`), Makefile 타깃 추가
2. `build_dataset.py`의 `INDICATORS`에 등재 — **v1.1 메타필드 필수**: `source_type / proxy_level / official_source / requires_manual_verification` (+전력 수전 관련이면 `cannot_confirm_connection`)
3. `build_values()`에 계산 추가 (백분위·재분배는 자동)
4. 필요 시 `build_evidence()` 규칙 추가
5. `make dataset test web-data` → `cd web && npx vitest run && npm run build` → E2E
6. BLUEPRINT §3.3 표의 해당 행을 "라이브"로, README 갱신 → 한국어 커밋 + push

### A. 무키로 즉시 가능 (권장 시작점)
| 순서 | 지표 | 소스 | 비고 |
|---|---|---|---|
| 완료 | S1 미분양·S2 개발중·S6 분양공고 산업용지 | ILIS industryland.or.kr 통계 MML 다운로드 | 지역별 현황을 시군구로 매핑. 인천 분구 전 집계는 결측 유지 |
| 1 | L3 평지 비율 | Copernicus GLO-30 DEM(무키) | 경사 5°·표고 200m 기준, 시군구 존율 계산 — 연산량 주의(타일 캐시) |
| 2 | P12 송변전 건설사업 단계 | 한전 정보공개 게시판(BLUEPRINT §4.2 URL) | 44페이지 크롤 → 사업명에서 지역 추출(수동 검수 파일 두기) |
| 3 | P11 공급가능 변전소 수 | data.go.kr 15128065 | 읍면동 단위 → 시군구 집계. 2024.5 스냅샷 캐비앳 유지. 다운로드 로그인 필요 여부 확인 |

### B. API 키 필요 (사용자에게 발급 요청)
| 키 | 발급처 | 잠금 해제 |
|---|---|---|
| V-World | vworld.kr | L1 용도지역 비율, L2 규제 중첩(게이트 레이어), L4 토지특성 공시지가 중앙값 |
| 공공데이터포털 | data.go.kr | P11 등 후속 공공 API |
| SGIS | sgis.kostat.go.kr | S5 인구밀도 역수, A2 주거 근접(격자인구) |
| 기상자료개방포털 | data.kma.go.kr | W5를 기상청 30년 평년값으로 승급(B→A) |

### C. L·S축이 채워진 뒤 켜는 스위치 (순서 중요)
1. **개발가능면적 게이트 활성화** (BLUEPRINT §3.1) — V-World 규제 레이어 확보 후. 임계 30ha 미달 지역은 랭킹 제외 + 사유 표시, 지역 상세에 레이어별 차감 기여 분해.
2. **신뢰도 C 기여 상한(50%) 활성화** (§3.4) — scoring.py와 scoring.ts **양쪽 동시** 구현 + fixture 재생성. 지금 켜면 라이브 8개 중 7개가 C라 커버리지 붕괴 — L·S 적재 후에만.
3. **A1 재검증** — v1.1 재정의(공식 조례·공고·전담조직 중심)에 맞춰 `incentives.yaml` 5개 시드를 국가법령정보센터 자치법규 기준으로 재조사, 신뢰도 C→B 승급.
4. 예비 MVP 배너 문구 갱신(축이 켜질 때마다) — 배너 자체는 게이트 활성화 전까지 유지.

## 6. 검증 루틴 (커밋 전 체크리스트)

```bash
# 파이프라인 (Map/ 에서)
make dataset test web-data      # 재생성 + pytest + web 복사
# 웹 (web/ 에서)
npx vitest run                  # 계약 테스트 37+
npm run build                   # 타입체크 겸 빌드
npm run preview &               # 4173
node scripts/e2e.mjs            # 스크린샷 + 콘솔 오류 0건 확인
```

## 7. 보류/미착수 (스코프 아님을 명시)

- **배포(공개 URL)**: 미실시 — 사용자 지시 대기. gh CLI 인증돼 있음.
- **읍면동(3,500) 드릴다운·PMTiles**: Phase 2. P11이 읍면동 단위라 그때 핵심 데이터가 된다.
- **시도급 공식 데이터 2건**(한전 변전설비현황 15101530, KPX 연료원별 15150573): 점수 지표로 **의도적 미채택**(시군구 변별력 없음) — §3.3 변경 이력 참조. 재도입 논의 전에 그 표부터 읽을 것.
- **뉴스 크롤러(A3)**: 기사 본문 저장 금지(링크만) 정책과 함께 Phase 2.
