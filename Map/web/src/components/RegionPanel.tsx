import * as echarts from "echarts";
import { useEffect, useMemo, useRef } from "react";

import { GRADE_COLOR } from "../lib/colors";
import { useApp } from "../lib/store";
import type { ScoresBundle } from "../lib/useScores";
import type { IndicatorMeta, Region } from "../lib/types";

const LIVE_AXES = ["P", "W", "N", "H", "A"];

function Dots({ n }: { n: number }) {
  return <span className="dots" title={`순위 안정성 ${n}/5 (가중치 ±20% 섭동 시 순위 변동폭)`}>{"●".repeat(n)}{"○".repeat(5 - n)}</span>;
}

function Radar({ region, scores }: { region: Region; scores: ScoresBundle }) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);
  const dataset = useApp((s) => s.dataset)!;
  const res = scores.byCode.get(region.code)!;

  useEffect(() => {
    if (!ref.current) return;
    chartRef.current = echarts.init(ref.current);
    const onResize = () => chartRef.current?.resize();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      chartRef.current?.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    const axisLabels = dataset.meta.axes.filter((a) => LIVE_AXES.includes(a.id));
    const vals = axisLabels.map((a) => res.axis[a.id] ?? 0);
    const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const ink = dark ? "#c3c2b7" : "#52514e";
    const grid = dark ? "#2c2c2a" : "#e1e0d9";
    chartRef.current?.setOption({
      animation: false,
      radar: {
        indicator: axisLabels.map((a) => ({ name: a.label, max: 100 })),
        radius: "68%",
        axisName: { color: ink, fontSize: 11 },
        splitLine: { lineStyle: { color: grid } },
        splitArea: { show: false },
        axisLine: { lineStyle: { color: grid } },
      },
      series: [{
        type: "radar",
        data: [
          { value: axisLabels.map(() => 50), name: "전국 중위(50)", lineStyle: { color: ink, width: 1, type: "dashed" }, symbol: "none", areaStyle: { opacity: 0 } },
          { value: vals, name: region.label, lineStyle: { color: dark ? "#3987e5" : "#2a78d6", width: 2 }, symbolSize: 4, itemStyle: { color: dark ? "#3987e5" : "#2a78d6" }, areaStyle: { color: dark ? "#3987e5" : "#2a78d6", opacity: 0.12 } },
        ],
      }],
    });
  }, [region, res, dataset]);

  return <div ref={ref} className="radar" role="img" aria-label={`${region.label} 축별 점수 레이더 차트`} />;
}

function IndicatorRow({ ind, region }: { ind: IndicatorMeta; region: Region }) {
  const v = region.values[ind.id];
  const p = region.pct[ind.id];
  return (
    <details className="ind-row">
      <summary>
        <span className="ind-label">{ind.label}</span>
        <span className="ind-val">{v === null || v === undefined ? "결측" : `${v.toLocaleString()}${ind.unit}`}</span>
        <span className="ind-bar" aria-label={p !== null && p !== undefined ? `백분위 점수 ${Math.round(p)}` : "결측"}>
          <i style={{ width: `${p ?? 0}%` }} />
        </span>
        <span className={`rel rel-${ind.reliability}`} title={`신뢰도 ${ind.reliability}`}>{ind.reliability}</span>
      </summary>
      <div className="ind-detail">
        <p>{ind.caveat}</p>
        <p className="ind-src">
          출처: {ind.source.url ? <a href={ind.source.url} target="_blank" rel="noreferrer">{ind.source.name}</a> : ind.source.name}
          {" · "}방향: {ind.direction === "down" ? "낮을수록 좋음 ↓" : "높을수록 좋음 ↑"}
        </p>
      </div>
    </details>
  );
}

export default function RegionPanel({ scores }: { scores: ScoresBundle }) {
  const dataset = useApp((s) => s.dataset)!;
  const selected = useApp((s) => s.selected);
  const select = useApp((s) => s.select);

  const region = useMemo(() => dataset.regions.find((r) => r.code === selected) ?? null, [dataset, selected]);

  if (!region) {
    return (
      <aside className="panel">
        <h2>지역을 선택하세요</h2>
        <p className="muted">지도를 클릭하거나 아래 상위 지역에서 선택하면 축별 점수·추천/주의 사유·확인 체크리스트가 표시됩니다.</p>
        <ol className="top-list">
          {scores.ranked.slice(0, 10).map((code) => {
            const r = dataset.regions.find((x) => x.code === code)!;
            const s = scores.byCode.get(code)!;
            return (
              <li key={code}>
                <button onClick={() => select(code)}>
                  <span className="grade-dot" style={{ background: GRADE_COLOR[s.grade ?? "D"] }} />
                  {r.label}
                  <span className="muted"> {Math.round(s.total!)}점 · {s.grade}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </aside>
    );
  }

  const s = scores.byCode.get(region.code)!;
  const stab = scores.stability.get(region.code);
  const byAxis = new Map<string, IndicatorMeta[]>();
  for (const ind of dataset.meta.indicators) {
    if (!byAxis.has(ind.axis)) byAxis.set(ind.axis, []);
    byAxis.get(ind.axis)!.push(ind);
  }

  return (
    <aside className="panel">
      <div className="panel-head">
        <div>
          <h2>{region.label}</h2>
          <span className="muted">{region.sidonm} · {region.area_km2.toLocaleString()}km²</span>
        </div>
        <button className="close" onClick={() => select(null)} aria-label="선택 해제">×</button>
      </div>

      <div className="score-hero">
        <div className="hero-num">
          {s.total !== null ? Math.round(s.total) : "—"}
          <span className="hero-sub">/100</span>
        </div>
        <div className="hero-meta">
          <span className="grade-chip"><i className="grade-dot" style={{ background: GRADE_COLOR[s.grade ?? "D"] }} />등급 {s.grade ?? "—"}</span>
          <span>{s.rank}위 / {scores.n}</span>
          <span>커버리지 {Math.round(s.coverage * 100)}%</span>
          {stab && <Dots n={stab.dots} />}
        </div>
        {s.penalty !== 0 && (
          <div className="penalty-chip">페널티 {s.penalty}점 {region.flags.metro ? "(계통 포화권·수도권)" : ""}{region.flags.jeju ? "(계통 고립·제주)" : ""}</div>
        )}
      </div>

      <Radar region={region} scores={scores} />
      <p className="muted small">L(토지·규제)·S(부지) 축은 데이터 대기 — 가중치는 확보된 축으로 재분배됨</p>

      {region.evidence.recommend.length > 0 && (
        <section className="ev ev-good">
          <h3>✓ 추천 근거</h3>
          <ul>{region.evidence.recommend.map((e, i) => <li key={i}>{e.text}</li>)}</ul>
        </section>
      )}
      {region.evidence.caution.length > 0 && (
        <section className="ev ev-warn">
          <h3>⚠ 주의</h3>
          <ul>{region.evidence.caution.map((e, i) => <li key={i}>{e.text}</li>)}</ul>
        </section>
      )}
      {region.evidence.verify.length > 0 && (
        <section className="ev ev-verify">
          <h3>◎ 실사 전 확인 필요</h3>
          <ul>{region.evidence.verify.map((e, i) => <li key={i}>{e.text}</li>)}</ul>
        </section>
      )}

      <section className="ind-list">
        <h3>지표 상세</h3>
        {dataset.meta.axes.filter((a) => LIVE_AXES.includes(a.id)).map((a) => (
          <div key={a.id} className="axis-group">
            <div className="axis-head">
              <span>{a.label}</span>
              <span className="muted">{s.axis[a.id] !== undefined ? `${Math.round(s.axis[a.id])}점` : "결측"}</span>
            </div>
            {(byAxis.get(a.id) ?? []).map((ind) => <IndicatorRow key={ind.id} ind={ind} region={region} />)}
          </div>
        ))}
      </section>
    </aside>
  );
}
