import type { SpotState } from "@/db/queries";
import { carColorHex } from "@/lib/car-colors";
import { formatTime } from "@/lib/format";

const CELL_W = 154;
const CELL_H = 178;
const CAR_W = 88;
const CAR_H = 132;

function cellX(col: number) {
  return col === 0 ? 38 : 198;
}

// row 1(안쪽)이 위, row 0(출구쪽)이 아래 — 출구는 화면 아래 방향.
function cellY(row: number) {
  return row === 1 ? 34 : 216;
}

function Car({ spot, x, y }: { spot: SpotState; x: number; y: number }) {
  const o = spot.occupant!;
  const color = carColorHex(o.carColor);
  return (
    <g>
      {/* 차체 */}
      <rect
        x={x}
        y={y}
        width={CAR_W}
        height={CAR_H}
        rx={18}
        fill={color}
        stroke="rgba(255,255,255,0.18)"
        strokeWidth={1}
      />
      {/* 앞유리 (차머리가 출구 방향 = 아래) */}
      <rect
        x={x + 13}
        y={y + 86}
        width={CAR_W - 26}
        height={26}
        rx={8}
        fill="#141B26"
        opacity={0.45}
      />
      {/* 뒷유리 */}
      <rect
        x={x + 15}
        y={y + 18}
        width={CAR_W - 30}
        height={18}
        rx={7}
        fill="#141B26"
        opacity={0.3}
      />
      {/* 헤드라이트 */}
      <rect x={x + 10} y={y + CAR_H - 8} width={16} height={4} rx={2} fill="#FFB454" opacity={0.85} />
      <rect x={x + CAR_W - 26} y={y + CAR_H - 8} width={16} height={4} rx={2} fill="#FFB454" opacity={0.85} />
      {/* 호수 뱃지 */}
      <rect x={x + CAR_W / 2 - 24} y={y + 46} width={48} height={22} rx={11} fill="rgba(10,14,20,0.55)" />
      <text
        x={x + CAR_W / 2}
        y={y + 61}
        textAnchor="middle"
        fontSize={12}
        fontWeight={600}
        fill="#E8EDF4"
      >
        {o.unitNumber}호
      </text>
    </g>
  );
}

function SpotCell({
  spot,
  highlighted,
}: {
  spot: SpotState;
  highlighted: boolean;
}) {
  const x = cellX(spot.col);
  const y = cellY(spot.row);
  const carX = x + (CELL_W - CAR_W) / 2;
  const carY = y + 10;
  const o = spot.occupant;

  return (
    <g>
      {/* 칸 라인 */}
      <rect
        x={x}
        y={y}
        width={CELL_W}
        height={CELL_H}
        rx={14}
        fill={highlighted ? "rgba(255,180,84,0.07)" : "none"}
        stroke="rgba(255,255,255,0.14)"
        strokeWidth={1.5}
        strokeDasharray="7 6"
      />
      {o ? (
        <>
          <Car spot={spot} x={carX} y={carY} />
          {/* 출차 예정 시간 필 */}
          {o.plannedDepartureAt ? (
            <>
              <rect x={x + CELL_W / 2 - 31} y={y + CELL_H - 28} width={62} height={22} rx={11} fill="#4ADEAB" />
              <text
                x={x + CELL_W / 2}
                y={y + CELL_H - 13}
                textAnchor="middle"
                fontSize={12}
                fontWeight={700}
                fill="#0D2A1F"
              >
                {formatTime(o.plannedDepartureAt)}
              </text>
            </>
          ) : (
            <>
              <rect x={x + CELL_W / 2 - 34} y={y + CELL_H - 28} width={68} height={22} rx={11} fill="rgba(255,255,255,0.12)" />
              <text
                x={x + CELL_W / 2}
                y={y + CELL_H - 13}
                textAnchor="middle"
                fontSize={11}
                fill="rgba(232,237,244,0.75)"
              >
                시간 미설정
              </text>
            </>
          )}
        </>
      ) : (
        <text
          x={x + CELL_W / 2}
          y={y + CELL_H / 2 + 4}
          textAnchor="middle"
          fontSize={13}
          fill="rgba(232,237,244,0.28)"
        >
          빈 칸
        </text>
      )}
      {/* 탭한 칸 강조 링 */}
      {highlighted && (
        <rect
          className="spot-pulse"
          x={x - 3}
          y={y - 3}
          width={CELL_W + 6}
          height={CELL_H + 6}
          rx={17}
          fill="none"
          stroke="#FFB454"
          strokeWidth={2.5}
        />
      )}
    </g>
  );
}

export function ParkingLotView({
  lot,
  highlightSpotId,
}: {
  lot: SpotState[];
  highlightSpotId?: string;
}) {
  return (
    <svg
      viewBox="0 0 390 470"
      role="img"
      aria-label="주차장 실시간 탑뷰"
      className="w-full"
    >
      <defs>
        <radialGradient id="streetlamp" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFB454" stopOpacity={0.2} />
          <stop offset="100%" stopColor="#FFB454" stopOpacity={0} />
        </radialGradient>
      </defs>

      {/* 아스팔트 */}
      <rect x={20} y={16} width={350} height={396} rx={20} fill="#1E2836" stroke="rgba(255,255,255,0.06)" />

      {/* 가로등 불빛 */}
      <ellipse cx={330} cy={40} rx={110} ry={90} fill="url(#streetlamp)" />
      <circle cx={344} cy={26} r={4} fill="#FFB454" opacity={0.9} />

      {lot.map((spot) => (
        <SpotCell
          key={spot.id}
          spot={spot}
          highlighted={spot.id === highlightSpotId}
        />
      ))}

      {/* 출구 표시 */}
      <text x={195} y={444} textAnchor="middle" fontSize={12} fill="rgba(232,237,244,0.5)" letterSpacing={2}>
        ▼ 출구
      </text>
    </svg>
  );
}
