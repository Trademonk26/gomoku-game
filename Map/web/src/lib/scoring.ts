// pipeline/scoring/scoring.py 와 계약 테스트로 동기화되는 스코어링 코어.
// 합산 순서까지 Python 구현과 동일하게 유지할 것 (부동소수 일치 1e-9).

export interface IndicatorRef {
  id: string;
  axis: string;
}

export interface RegionScoreInput {
  pct: Record<string, number | null>;
  flags: { metro: boolean; jeju: boolean };
}

export interface ScoreResult {
  axis: Record<string, number>;
  base: number | null;
  penalty: number;
  total: number | null;
  grade: string | null;
  coverage: number;
}

export const PENALTY_METRO = -15.0;
export const PENALTY_JEJU = -10.0;

const GRADES: Array<[number, string]> = [
  [85.0, "S"],
  [75.0, "A"],
  [65.0, "B"],
  [50.0, "C"],
];

export function gradeOf(total: number): string {
  for (const [cut, g] of GRADES) {
    if (total >= cut) return g;
  }
  return "D";
}

export function axisScores(region: RegionScoreInput, indicators: IndicatorRef[]): Record<string, number> {
  const byAxis: Record<string, number[]> = {};
  for (const ind of indicators) {
    const p = region.pct[ind.id];
    if (p === null || p === undefined) continue;
    (byAxis[ind.axis] ??= []).push(p);
  }
  const out: Record<string, number> = {};
  for (const a of Object.keys(byAxis)) {
    const v = byAxis[a];
    out[a] = v.reduce((s, x) => s + x, 0) / v.length;
  }
  return out;
}

export function computeScore(
  region: RegionScoreInput,
  indicators: IndicatorRef[],
  weights: Record<string, number>,
): ScoreResult {
  const ax = axisScores(region, indicators);
  const totalW = Object.values(weights).reduce((s, x) => s + x, 0);
  let availW = 0;
  for (const a of Object.keys(weights)) {
    if (a in ax) availW += weights[a];
  }
  if (totalW <= 0 || availW <= 0) {
    return { axis: ax, base: null, penalty: 0, total: null, grade: null, coverage: 0 };
  }
  let acc = 0;
  for (const a of Object.keys(ax)) {
    if (a in weights) acc += weights[a] * ax[a];
  }
  const base = acc / availW;
  let penalty = 0;
  if (region.flags?.metro) penalty += PENALTY_METRO;
  if (region.flags?.jeju) penalty += PENALTY_JEJU;
  const total = Math.min(100, Math.max(0, base + penalty));
  return { axis: ax, base, penalty, total, grade: gradeOf(total), coverage: availW / totalW };
}

export interface RankedRegion {
  code: string;
  total: number | null;
  rank: number | null;
}

export function rankAll(
  regions: Array<{ code: string } & RegionScoreInput>,
  indicators: IndicatorRef[],
  weights: Record<string, number>,
): Map<string, ScoreResult & { rank: number | null }> {
  const results = regions.map((r) => ({ code: r.code, res: computeScore(r, indicators, weights) }));
  const sorted = results
    .filter((x) => x.res.total !== null)
    .sort((a, b) => (b.res.total! - a.res.total!) || a.code.localeCompare(b.code));
  const rankByCode = new Map<string, number>();
  sorted.forEach((x, i) => rankByCode.set(x.code, i + 1));
  const out = new Map<string, ScoreResult & { rank: number | null }>();
  for (const x of results) out.set(x.code, { ...x.res, rank: rankByCode.get(x.code) ?? null });
  return out;
}

// 가중치 ±20% 섭동 → 순위 IQR → 안정성 1~5 (mulberry32 고정 시드로 재현 가능)
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function stabilityAll(
  regions: Array<{ code: string } & RegionScoreInput>,
  indicators: IndicatorRef[],
  weights: Record<string, number>,
  samples = 60,
  seed = 42,
): Map<string, { iqr: number; dots: number }> {
  const rng = mulberry32(seed);
  const axes = Object.keys(weights);
  const ranks = new Map<string, number[]>(regions.map((r) => [r.code, []]));
  for (let s = 0; s < samples; s++) {
    const w: Record<string, number> = {};
    for (const a of axes) w[a] = weights[a] * (0.8 + 0.4 * rng());
    const rr = rankAll(regions, indicators, w);
    for (const r of regions) {
      const rank = rr.get(r.code)?.rank;
      if (rank !== null && rank !== undefined) ranks.get(r.code)!.push(rank);
    }
  }
  const out = new Map<string, { iqr: number; dots: number }>();
  for (const [code, arr] of ranks) {
    if (arr.length === 0) {
      out.set(code, { iqr: Infinity, dots: 0 });
      continue;
    }
    const sorted = [...arr].sort((a, b) => a - b);
    const q = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
    const iqr = q(0.75) - q(0.25);
    const dots = iqr <= 2 ? 5 : iqr <= 5 ? 4 : iqr <= 12 ? 3 : iqr <= 25 ? 2 : 1;
    out.set(code, { iqr, dots });
  }
  return out;
}
