import { useMemo } from "react";

import { rankAll, stabilityAll, type ScoreResult } from "./scoring";
import { useApp } from "./store";

export interface ScoresBundle {
  byCode: Map<string, ScoreResult & { rank: number | null }>;
  stability: Map<string, { iqr: number; dots: number }>;
  ranked: string[];
  n: number;
}

export function useScores(): ScoresBundle | null {
  const dataset = useApp((s) => s.dataset);
  const weights = useApp((s) => s.weights);
  return useMemo(() => {
    if (!dataset) return null;
    const inds = dataset.meta.indicators.map((i) => ({ id: i.id, axis: i.axis }));
    const regions = dataset.regions.map((r) => ({ code: r.code, pct: r.pct, flags: r.flags }));
    const byCode = rankAll(regions, inds, weights);
    const stability = stabilityAll(regions, inds, weights);
    const ranked = [...byCode.entries()]
      .filter(([, v]) => v.rank !== null)
      .sort((a, b) => a[1].rank! - b[1].rank!)
      .map(([code]) => code);
    return { byCode, stability, ranked, n: ranked.length };
  }, [dataset, weights]);
}
