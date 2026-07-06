import { useApp } from "../lib/store";

interface Cluster {
  title: string;
  regions: string[]; // region.label 정확 일치
  thesis: string;
  risks: string;
  verify: string;
}

// BLUEPRINT.md §8 초기 후보 클러스터 가설 — 데이터로 검증/반증할 시드 콘텐츠
const CLUSTERS: Cluster[] = [
  {
    title: "전남 해남·영암 (솔라시도)",
    regions: ["전남광주 해남군", "전남광주 영암군"],
    thesis: "국내 최대 태양광 밀집(RE100 PPA), 기업도시 초대형 평지 부지, 지자체 유치 적극 — 솔라시도 데이터센터 파크 투자협약 진행",
    risks: "서울 왕복 ~5ms(저지연 부적합), 대규모 송전 보강 필요, 연약지반 가능성",
    verify: "장기 송변전설비계획상 보강 일정 · 실분양 조건 · 지반조사",
  },
  {
    title: "새만금 (군산·김제·부안)",
    regions: ["전북 군산시", "전북 김제시", "전북 부안군"],
    thesis: "국공유 초대형 매립 평지, 재생에너지 계획 집적, 투자진흥 세제",
    risks: "재생에너지가 선점한 접속 대기열, 염해·지반침하, 개발 일정의 정치 변동성",
    verify: "새만금개발청 부지 공급 일정 · 변전소 여유 · 방식(防蝕) 비용",
  },
  {
    title: "강원 춘천·원주·횡성",
    regions: ["강원 춘천시", "강원 원주시", "강원 횡성군"],
    thesis: "냉방도일 전국 최저권(PUE 유리), 네이버 각 춘천 선례, 수도권 인접 비수도권(왕복 ~1.5ms + 규제 회피)",
    risks: "산지로 대형 평지 제한, 일부 군사보호, 송전 보강",
    verify: "154kV 여유 · 10ha+ 평지 필지 실존 여부",
  },
  {
    title: "충북 청주·음성·진천",
    regions: ["충북 청주시", "충북 음성군", "충북 진천군"],
    thesis: "국토 중앙 백본 경유, 산단 공급 활발, 반도체 생태계 인접",
    risks: "지가 상승 진행, 전력·용수를 반도체와 경합",
    verify: "변전소 여유(반도체 경합) · 공업용수 배분 계획",
  },
  {
    title: "부산 강서(에코델타)·김해",
    regions: ["부산 강서구", "경남 김해시"],
    thesis: "해저케이블 육양국(국제 트래픽 관문), 글로벌 CSP 리전 선례, 스마트시티 인프라",
    risks: "태풍·해일·저지대, 높은 지가, 주거 근접 민원",
    verify: "침수 표고·방재 설계 기준 · 육양국 여유 캐파 · 분산특구 지정 여부",
  },
  {
    title: "울산·포항·경주 (동해안 에너지벨트)",
    regions: ["울산 남구", "울산 울주군", "경북 포항시", "경북 경주시"],
    thesis: "원전·대형발전 밀집(계통 여유 프록시 최상위), SK-AWS 울산 103MW 착공 선례, 공업용수 기반",
    risks: "활성단층(양산·울산단층) — 필지 단위 정밀 이격 검토 필수, 중화학 인프라 경합",
    verify: "단층 이격 거리 · 내진 추가 비용 · 미포·온산 잔여 부지",
  },
  {
    title: "세종·대전·천안아산",
    regions: ["세종시", "대전 유성구", "충남 천안시", "충남 아산시"],
    thesis: "통신 백본 중심, 네이버 각 세종 선례, 연구·행정 인력",
    risks: "대형 연속 부지 희소, 지가",
    verify: "10ha+ 부지 실존 · 지자체 인센티브",
  },
  {
    title: "광주·나주 (에너지밸리)",
    regions: ["전남광주 광산구", "전남광주 나주시"],
    thesis: "한전 본사 생태계, NHN 국가AI데이터센터 선례, 재생에너지 접근 — 2026 광주·전남 행정통합으로 단일 광역 협상 창구",
    risks: "국제 트래픽 원거리, 상용 수요처 거리",
    verify: "계통 여유 · 앵커 테넌트 확보 가능성",
  },
];

export default function Clusters({ onPick }: { onPick: (code: string) => void }) {
  const dataset = useApp((s) => s.dataset)!;
  const byLabel = new Map(dataset.regions.map((r) => [r.label, r.code]));

  return (
    <div className="clusters">
      <p className="muted">
        BLUEPRINT §8의 초기 가설 8개 — <strong>가설 라벨</strong>이 붙은 시드 콘텐츠로, 데이터가 가설과 다른 결과를 내면 그것이 곧 도구의 가치입니다.
        지역 칩을 누르면 지도에서 해당 지역이 선택됩니다.
      </p>
      <div className="cluster-grid">
        {CLUSTERS.map((c) => (
          <article key={c.title} className="cluster-card">
            <h3><span className="hypo">가설</span>{c.title}</h3>
            <div className="chips">
              {c.regions.map((label) => {
                const code = byLabel.get(label);
                return code
                  ? <button key={label} className="chip" onClick={() => onPick(code)}>{label}</button>
                  : <span key={label} className="chip off">{label}</span>;
              })}
            </div>
            <p><strong>논리</strong> {c.thesis}</p>
            <p><strong>리스크</strong> {c.risks}</p>
            <p><strong>확인</strong> {c.verify}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
