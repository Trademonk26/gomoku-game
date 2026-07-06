// scoring.py ≡ scoring.ts 계약 테스트.
// fixture는 파이프라인(build_dataset.py)이 scoring.py로 생성 — `make web-data`가 복사한다.
import { describe, expect, it } from "vitest";

import fixture from "./scoring.fixture.json";
import { computeScore } from "./scoring";

interface FixtureCase {
  code: string;
  preset: string;
  pct: Record<string, number | null>;
  flags: { metro: boolean; jeju: boolean };
  weights: Record<string, number>;
  expected: { total: number | null; grade: string | null; coverage: number };
}

describe("scoring.ts ≡ scoring.py 계약", () => {
  const cases = (fixture as { cases: FixtureCase[] }).cases;
  const indicators = (fixture as { indicators: Array<{ id: string; axis: string }> }).indicators;

  it("fixture가 비어있지 않다", () => {
    expect(cases.length).toBeGreaterThan(10);
  });

  for (const c of cases) {
    it(`${c.code} @ ${c.preset}`, () => {
      const res = computeScore({ pct: c.pct, flags: c.flags }, indicators, c.weights);
      if (c.expected.total === null) {
        expect(res.total).toBeNull();
      } else {
        expect(res.total).not.toBeNull();
        expect(Math.abs(res.total! - c.expected.total)).toBeLessThan(1e-9);
      }
      expect(res.grade).toBe(c.expected.grade);
      expect(Math.abs(res.coverage - c.expected.coverage)).toBeLessThan(1e-9);
    });
  }
});
