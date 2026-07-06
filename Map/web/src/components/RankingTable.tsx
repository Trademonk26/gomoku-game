import { useState } from "react";

import { GRADE_COLOR } from "../lib/colors";
import { useApp } from "../lib/store";
import type { ScoresBundle } from "../lib/useScores";

const AXIS_COLS = ["P", "W", "N", "H", "A"];

export default function RankingTable({ scores }: { scores: ScoresBundle }) {
  const dataset = useApp((s) => s.dataset)!;
  const select = useApp((s) => s.select);
  const setTab = useApp((s) => s.setTab);
  const [query, setQuery] = useState("");
  const [sidoFilter, setSidoFilter] = useState("all");

  const sidos = [...new Map(dataset.regions.map((r) => [r.sido, r.sidonm])).entries()];
  const axisLabel = new Map(dataset.meta.axes.map((a) => [a.id, a.label]));

  const rows = scores.ranked
    .map((code) => dataset.regions.find((r) => r.code === code)!)
    .filter((r) => (sidoFilter === "all" || r.sido === sidoFilter) && (query === "" || r.label.includes(query)));

  return (
    <div className="rank-view">
      <div className="rank-filters">
        <input placeholder="지역 검색" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="지역 검색" />
        <select value={sidoFilter} onChange={(e) => setSidoFilter(e.target.value)} aria-label="시도 필터">
          <option value="all">전체 시도</option>
          {sidos.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
        </select>
        <span className="muted">{rows.length}개 지역 · 스냅샷 {dataset.meta.snapshot}</span>
      </div>
      <div className="table-scroll">
        <table className="rank-table">
          <thead>
            <tr>
              <th>순위</th>
              <th className="left">지역</th>
              <th>등급</th>
              <th>총점</th>
              {AXIS_COLS.map((a) => <th key={a} title={axisLabel.get(a)}>{a}</th>)}
              <th title="현재 가중치에서 데이터가 확보된 축의 비중">커버리지</th>
              <th title="가중치 ±20% 섭동 시 순위 안정성">안정성</th>
              <th>페널티</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const s = scores.byCode.get(r.code)!;
              const stab = scores.stability.get(r.code);
              return (
                <tr key={r.code} onClick={() => { select(r.code); setTab("map"); }}>
                  <td className="num">{s.rank}</td>
                  <td className="left">{r.label}</td>
                  <td><span className="grade-dot" style={{ background: GRADE_COLOR[s.grade ?? "D"] }} />{s.grade}</td>
                  <td className="num strong">{s.total !== null ? Math.round(s.total) : "—"}</td>
                  {AXIS_COLS.map((a) => (
                    <td key={a} className="num muted">{s.axis[a] !== undefined ? Math.round(s.axis[a]) : "·"}</td>
                  ))}
                  <td className="num muted">{Math.round(s.coverage * 100)}%</td>
                  <td className="dots-cell">{stab ? "●".repeat(stab.dots) + "○".repeat(5 - stab.dots) : ""}</td>
                  <td className="num muted">{s.penalty !== 0 ? s.penalty : ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
