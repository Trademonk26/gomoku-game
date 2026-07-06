import { useApp } from "../lib/store";

export default function Methodology() {
  const dataset = useApp((s) => s.dataset)!;
  const m = dataset.meta;

  return (
    <div className="method">
      <section>
        <h2>이 도구는 무엇인가</h2>
        <p>
          데이터센터 후보지를 빠르게 좁히기 위한 <strong>1차 탐색·랭킹 시스템</strong>입니다. 투자 권유나 확정적 매수 판단 근거가 아니며,
          최종 의사결정 전에는 반드시 현장 실사 · 지자체 확인 · <strong>한전 계통 접속검토</strong> · 토지이용계획 확인 · 인허가·법률 검토가 필요합니다.
          모든 점수는 공개 데이터 기반 <strong>프록시(간접 지표)</strong>이며, 지표마다 신뢰도 등급(A/B/C)과 한계를 명시합니다.
        </p>
      </section>

      <section>
        <h2>점수 산식</h2>
        <pre>{`총점(r) = clamp( Σ_a w_a × A_a(r) / Σ_a w_a(확보 축)  +  페널티(r), 0, 100 )

  A_a(r)  = 축 내 확보 지표들의 백분위 점수 평균 (전국 mid-rank 백분위, 방향 정렬)
  결측 축  = 가중치를 확보된 축으로 재분배 + 커버리지(%)로 표시 (0점 처리하지 않음)
  페널티   = 계통 포화권(수도권) ${m.penalties.metro} · 계통 고립(제주) ${m.penalties.jeju}
  등급     = S ≥85 · A ≥75 · B ≥65 · C ≥50 · D <50
  안정성   = 가중치 ±20% 무작위 섭동 60회 → 순위 IQR (●5=안정 ~ ●1=민감)`}</pre>
        <p className="muted">
          개발가능면적 게이트(그린벨트·군사보호 등 규제 레이어 차감)는 BLUEPRINT §3.1에 설계되어 있으나, 규제 GIS가 API 키 대기 상태라
          <strong> Phase 1-1에서는 비활성</strong>입니다.
        </p>
      </section>

      <section>
        <h2>시나리오 프리셋 가중치</h2>
        <div className="table-scroll">
          <table>
            <thead>
              <tr><th className="left">축</th>{Object.values(m.presets).map((p) => <th key={p.label}>{p.label}</th>)}</tr>
            </thead>
            <tbody>
              {m.axes.map((a) => (
                <tr key={a.id}>
                  <td className="left">{a.label}{a.id in m.deferred_axes ? " (대기)" : ""}</td>
                  {Object.values(m.presets).map((p) => <td key={p.label} className="num">{p.w[a.id]}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2>지표 사전 — 라이브 {m.indicators.length}개 / 설계 38개</h2>
        <div className="table-scroll">
          <table>
            <thead>
              <tr><th>ID</th><th>축</th><th className="left">지표</th><th>방향</th><th>신뢰도</th><th className="left">출처</th><th className="left">한계(주의)</th></tr>
            </thead>
            <tbody>
              {m.indicators.map((i) => (
                <tr key={i.id}>
                  <td>{i.id}</td>
                  <td>{i.axis}</td>
                  <td className="left">{i.label} ({i.unit})</td>
                  <td>{i.direction === "down" ? "↓" : "↑"}</td>
                  <td><span className={`rel rel-${i.reliability}`}>{i.reliability}</span></td>
                  <td className="left">{i.source.url ? <a href={i.source.url} target="_blank" rel="noreferrer">{i.source.name}</a> : i.source.name}</td>
                  <td className="left muted">{i.caveat}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted">
          결측 축: {Object.entries(m.deferred_axes).map(([k, v]) => `${k}(${v})`).join(" · ")} — Phase 1-2에서
          V-World(용도지역), 공공데이터포털(공시지가), ILIS(산업단지), SGIS(인구격자) API 키 발급 후 적재 예정.
        </p>
        <p className="muted">{m.osm_note} — OSM 변전소 태깅은 불완전할 수 있어 전력축 신뢰도는 C입니다.</p>
      </section>

      <section>
        <h2>데이터 출처·라이선스</h2>
        <ul className="src-list">
          <li>행정경계: 통계청·행정안전부 원천, <a href="https://github.com/vuski/admdongkor" target="_blank" rel="noreferrer">vuski/admdongkor</a> ver20260701 (2026.7 광주·전남 통합 반영)</li>
          <li>전력설비: <a href="https://www.openstreetmap.org" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a>, ODbL</li>
          <li>기후(냉방도일): <a href="https://open-meteo.com" target="_blank" rel="noreferrer">Open-Meteo</a> ERA5 재분석 2020~2024, 기준온도 24°C</li>
          <li>지진구역: <a href="https://www.kalis.or.kr/wpge/m_195/info/info060601.do" target="_blank" rel="noreferrer">국토안전관리원 지진구역도</a> (KDS 내진설계기준)</li>
          <li>육양국: 공개 보도 기반 자체 정리(부산 송정·거제·태안) — 좌표 ±수 km 근사</li>
          <li>유치 의지: 언론 보도 수동 큐레이션(출처 URL 필수 정책, 현재 5개 지역 시드)</li>
        </ul>
        <p className="muted">스냅샷 {m.snapshot} · 생성일 {m.generated_at} · 상세 설계는 저장소의 BLUEPRINT.md 참조</p>
      </section>
    </div>
  );
}
