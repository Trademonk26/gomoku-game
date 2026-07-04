import { desc, isNull } from "drizzle-orm";
import { db } from "./index";
import { departureTags, parkings } from "./schema";

export type Occupant = {
  parkingId: string;
  unitNumber: string;
  carModel: string;
  carColor: string;
  parkedAt: Date;
  plannedDepartureAt: Date | null;
};

export type SpotState = {
  id: string;
  label: string;
  col: number;
  row: number;
  occupant: Occupant | null;
};

/** 주차장 전체 상태 — 칸별 현재 주차 차량 + 최신 출차 예정 시간. */
export async function getParkingLotState(): Promise<SpotState[]> {
  const allSpots = await db.query.spots.findMany({
    orderBy: (s, { asc }) => [asc(s.row), asc(s.col)],
  });

  const activeParkings = await db.query.parkings.findMany({
    where: isNull(parkings.departedAt),
    with: {
      car: { with: { household: true } },
      departureTags: {
        orderBy: desc(departureTags.createdAt),
        limit: 1,
      },
    },
  });

  const bySpot = new Map(activeParkings.map((p) => [p.spotId, p]));

  return allSpots.map((spot) => {
    const p = bySpot.get(spot.id);
    return {
      ...spot,
      occupant: p
        ? {
            parkingId: p.id,
            unitNumber: p.car.household.unitNumber,
            carModel: p.car.model,
            carColor: p.car.color,
            parkedAt: p.parkedAt,
            plannedDepartureAt:
              p.departureTags[0]?.plannedDepartureAt ?? null,
          }
        : null,
    };
  });
}

/** 안쪽 칸(row 1)이면 같은 col의 출구쪽 칸(막는 칸)을 반환. */
export function findBlocker(
  spot: SpotState,
  lot: SpotState[],
): SpotState | null {
  if (spot.row !== 1) return null;
  return lot.find((s) => s.col === spot.col && s.row === 0) ?? null;
}

/** 출구쪽 칸(row 0)이면 같은 col의 안쪽 칸(막히는 칸)을 반환. */
export function findBlocked(
  spot: SpotState,
  lot: SpotState[],
): SpotState | null {
  if (spot.row !== 0) return null;
  return lot.find((s) => s.col === spot.col && s.row === 1) ?? null;
}
