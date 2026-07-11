# UL 9540A 6판 Section 10 — LSFT 셀프 러닝 웹앱

EV 배터리 출신 기구/전장 설계자를 위한 UL 9540A 6판(2026.03) Section 10
Installation Level Large-Scale Fire Test (LSFT) 인터랙티브 교육자료.

## 실행

`index.html`(기초, Rev.1)을 브라우저로 열면 끝. 외부 의존성 없는 단일 HTML 파일이다.
심화 과정은 `advanced.html`(Rev.2) — index 헤더/부록에서 링크로 연결된다.

## 구성

| 단계 | 내용 |
|---|---|
| STEP 1 | 규격 배경 — 1~5판 vs 6판 Before/After, EPRI 사고 분석, "연료원" 철학 전환 |
| STEP 2 | 시험 절차 6축 인터랙티브 체험 (오답 시 즉시 교정 피드백, 순차 잠금 해제) |
| STEP 3 | 판정 기준 — Non-propagation, RDP 평가(NFPA 855 §9.2.2.2), Annex C 연계 |
| STEP 4 | 설계 반영 체크리스트 5항목 (체크 상태 localStorage 저장) |
| 부록 | 제외 범위(실내·벽면 인접·적층·주거용), SVG 컴포넌트, 근거자료 |

## Rev.2 심화 — advanced.html (그레이존 파일)

기초와 달리 "확정 지식"이 아닌 "판단 훈련"용. 미확정 내용은 확정처럼 쓰지 않는 것이 원칙.

| 섹션 | 내용 | 형식 |
|---|---|---|
| ① | Developed fire의 범위 (전체 전소 vs 랙 종대) | 3단 카드(확실/미확정/시사점) |
| ② | TRPP vs 소방 설비 경계 | 부품 8종 분류 게임 (끄나/남기나/그레이) |
| ③ | Target 외피 관통 시 합부 | 3단 카드 + 4케이스 사고실험 표 |
| ④ | Heat flux의 실익 | 정답형 퀴즈 (외삽 근거) |
| ⑤ | 점화원 위치 (내부 점화가 표준인 이유) | 3단 카드 |
| ⑥ | Target full form 미적용 시 불리한 점 | 3단 카드 |
| ⑦ | 이 시험이 못 보는 것들 — LSFT 구조적 한계 7가지 | 비판적 독해 카드 |

## 검수자 확인 사항

- 조항 번호는 원문 대조 전이므로 본문에 `[조항번호 검수 필요]` 로 표기되어 있다.
  원문 확보 후 검색해서 직접 기입할 것 (index.html 내 `verify` 클래스 span).
- STEP 2에 실제 시험장 사진용 placeholder 슬롯 3개가 있다 (`photo-slot` 클래스).
- 사내 용어 매핑: Enclosure→컨테이너, Unit→Rack, Module→Pack, Cell→Cell.

## 근거자료

UL 9540A Ed.6 (2026.03), NFPA 855:2026 (§9.2.2.2, Annex G.11),
ACP LSFT Fact Sheet, EPRI BESS 사고 데이터 분석 — 공개 자료 수준으로 사실관계 한정.
