// dataviz 레퍼런스 팔레트 기반. 순차 램프(blue 100→700)는 검증된 기본값,
// 마커 3색(변전소/발전소/육양국)은 validate_palette.js 통과(라이트 ΔE 51.8 / 다크 별도 검증).
export const SEQ = [
  "#cde2fb", "#b7d3f6", "#9ec5f4", "#86b6ef", "#6da7ec", "#5598e7",
  "#3987e5", "#2a78d6", "#256abf", "#1c5cab", "#184f95", "#104281", "#0d366b",
];

export const NO_DATA_LIGHT = "#e1e0d9";
export const NO_DATA_DARK = "#2c2c2a";

// 점수 → 램프 인덱스: [35, 85] 선형 매핑 후 clamp (분포 중심 구간 해상도 확보)
export function scoreColor(total: number | null): string {
  if (total === null) return NO_DATA_LIGHT;
  const t = Math.min(1, Math.max(0, (total - 35) / 50));
  return SEQ[Math.round(t * (SEQ.length - 1))];
}

export const GRADE_COLOR: Record<string, string> = {
  S: "#104281",
  A: "#1c5cab",
  B: "#2a78d6",
  C: "#5598e7",
  D: "#9ec5f4",
};

export const MARKER = {
  substation: { light: "#eb6834", dark: "#d95926", label: "154kV+ 변전소" },
  plant: { light: "#4a3aa7", dark: "#9085e9", label: "대형 발전소(≥500MW)" },
  landing: { light: "#e87ba4", dark: "#d55181", label: "국제 육양국" },
};

export function legendStops(): Array<{ color: string; label: string }> {
  return [
    { color: SEQ[0], label: "≤40" },
    { color: SEQ[3], label: "50" },
    { color: SEQ[6], label: "60" },
    { color: SEQ[9], label: "70" },
    { color: SEQ[12], label: "≥85" },
  ];
}
