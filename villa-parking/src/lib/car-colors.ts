/** 온보딩에서 자유 입력된 색 이름을 SVG 차량 색으로 매핑한다. */
const COLOR_MAP: [string[], string][] = [
  [["흰", "화이트", "백색"], "#E9EDF2"],
  [["검", "블랙"], "#2B2F3A"],
  [["은", "실버"], "#C3C9D4"],
  [["회", "그레이", "쥐색"], "#8B93A1"],
  [["파랑", "파란", "블루", "청색"], "#4A7DDE"],
  [["남색", "네이비"], "#2C4A8A"],
  [["빨강", "빨간", "레드", "적색"], "#E0554D"],
  [["주황", "오렌지"], "#FF8A3D"],
  [["노랑", "노란", "옐로"], "#FFD34D"],
  [["초록", "녹색", "그린"], "#3FA96C"],
  [["베이지", "샌드"], "#D6C7A9"],
  [["갈", "브라운"], "#8A6A4F"],
];

export function carColorHex(colorName: string): string {
  for (const [keywords, hex] of COLOR_MAP) {
    if (keywords.some((k) => colorName.includes(k))) return hex;
  }
  return "#8B93A1"; // 알 수 없는 색은 회색
}

/** 밝은 차체 위 텍스트 가독성 판단용. */
export function isLightColor(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 150;
}
