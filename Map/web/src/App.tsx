import { useEffect, useState } from "react";

import Clusters from "./components/Clusters";
import MapView from "./components/MapView";
import Methodology from "./components/Methodology";
import RankingTable from "./components/RankingTable";
import RegionPanel from "./components/RegionPanel";
import WeightPanel from "./components/WeightPanel";
import { useApp, type Tab } from "./lib/store";
import { useScores } from "./lib/useScores";
import type { Dataset } from "./lib/types";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "map", label: "지도" },
  { id: "rank", label: "랭킹" },
  { id: "clusters", label: "클러스터 가설" },
  { id: "method", label: "방법론·출처" },
];

export default function App() {
  const dataset = useApp((s) => s.dataset);
  const setData = useApp((s) => s.setData);
  const tab = useApp((s) => s.tab);
  const setTab = useApp((s) => s.setTab);
  const select = useApp((s) => s.select);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const scores = useScores();

  useEffect(() => {
    Promise.all([
      fetch("data/dataset.json").then((r) => r.json() as Promise<Dataset>),
      fetch("data/regions.geojson").then((r) => r.json()),
      fetch("data/sido.geojson").then((r) => r.json()),
    ])
      .then(([d, rg, sg]) => setData(d, rg, sg))
      .catch((e) => setError(String(e)));
  }, [setData]);

  if (error) return <div className="boot">데이터 로드 실패: {error}</div>;
  if (!dataset || !scores) return <div className="boot">데이터 로딩 중…</div>;

  const onSearch = (v: string) => {
    setSearch(v);
    const hit = dataset.regions.find((r) => r.label === v);
    if (hit) {
      select(hit.code);
      setTab("map");
      setSearch("");
    }
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <h1>DC Site Screener</h1>
          <span className="snapshot">{dataset.meta.snapshot}</span>
        </div>
        <nav className="tabs" role="tablist">
          {TABS.map((t) => (
            <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? "on" : ""} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </nav>
        <input
          className="search"
          list="region-list"
          placeholder="지역 검색 (예: 전남광주 해남군)"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          aria-label="지역 검색"
        />
        <datalist id="region-list">
          {dataset.regions.map((r) => <option key={r.code} value={r.label} />)}
        </datalist>
      </header>

      <WeightPanel />

      <div className="mvp-banner" role="note">
        Phase 1-1 예비 MVP(무키 공개 데이터) — L(토지·규제)·S(부지) 축과 개발가능면적 게이트가 비활성입니다.
        현재 랭킹은 투자 판단이 아니라 UI·산식·데이터 구조 검증용입니다.
      </div>

      <main className="main">
        {tab === "map" && (
          <div className="map-layout">
            <MapView scores={scores} />
            <RegionPanel scores={scores} />
          </div>
        )}
        {tab === "rank" && <RankingTable scores={scores} />}
        {tab === "clusters" && <Clusters onPick={(code) => { select(code); setTab("map"); }} />}
        {tab === "method" && <Methodology />}
      </main>

      <footer className="disclaimer">
        ⓘ 1차 스크리닝 도구입니다 — 모든 점수는 공개 데이터 프록시이며, 실제 의사결정 전 한전 접속검토·현장 실사·지자체 협의·법률 검토가 필수입니다.
      </footer>
    </div>
  );
}
