import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AutoRefresh } from "@/components/auto-refresh";
import { ParkingLotView } from "@/components/parking-lot-view";
import {
  findBlocked,
  findBlocker,
  getParkingLotState,
  type SpotState,
} from "@/db/queries";
import { formatTime } from "@/lib/format";

// NFC 태그 랜딩 — 항상 최신 주차 상태를 보여줘야 한다.
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ spotId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { spotId } = await params;
  const lot = await getParkingLotState();
  const spot = lot.find((s) => s.id === spotId);
  return {
    title: spot
      ? `${spot.label} — 우리빌라 주차장`
      : "우리빌라 주차장",
  };
}

function SpotInfoCard({ spot, lot }: { spot: SpotState; lot: SpotState[] }) {
  const o = spot.occupant;
  const blocker = findBlocker(spot, lot); // 안쪽 칸이면 앞을 막는 출구쪽 칸
  const blocked = findBlocked(spot, lot); // 출구쪽 칸이면 뒤에 갇히는 안쪽 칸

  return (
    <section className="w-full rounded-2xl bg-asphalt p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">{spot.label}</h2>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            o ? "bg-coral/15 text-coral" : "bg-mint/15 text-mint"
          }`}
        >
          {o ? "주차 중" : "비어 있음"}
        </span>
      </div>

      {o ? (
        <div className="mt-3 space-y-1.5 text-sm">
          <p>
            {o.unitNumber}호 · {o.carColor} {o.carModel}
          </p>
          {o.plannedDepartureAt ? (
            <p className="font-semibold text-mint">
              {formatTime(o.plannedDepartureAt)} 출차 예정
            </p>
          ) : (
            <p className="opacity-50">출차 시간 미설정</p>
          )}
        </div>
      ) : (
        <div className="mt-3 space-y-1.5 text-sm">
          <p className="opacity-70">지금 비어 있어요.</p>
          {blocked?.occupant && (
            <p className="text-xs leading-relaxed opacity-60">
              이 칸에 대면 안쪽 {blocked.occupant.unitNumber}호 차를 막게
              돼요
              {blocked.occupant.plannedDepartureAt &&
                ` (${formatTime(blocked.occupant.plannedDepartureAt)} 출차 예정)`}
              .
            </p>
          )}
        </div>
      )}

      {blocker?.occupant && (
        <p className="mt-3 border-t border-white/5 pt-3 text-xs leading-relaxed opacity-60">
          출구쪽에 {blocker.occupant.unitNumber}호 {blocker.occupant.carColor}{" "}
          {blocker.occupant.carModel}가 서 있어요
          {blocker.occupant.plannedDepartureAt &&
            ` (${formatTime(blocker.occupant.plannedDepartureAt)} 출차 예정)`}
          .
        </p>
      )}
    </section>
  );
}

export default async function SpotLandingPage({ params }: Props) {
  const { spotId } = await params;
  const lot = await getParkingLotState();
  const spot = lot.find((s) => s.id === spotId);
  if (!spot) notFound();

  return (
    <main className="mx-auto flex w-full max-w-[430px] flex-1 flex-col items-center gap-4 px-5 pb-8 pt-6">
      <AutoRefresh />

      <header className="flex w-full items-center justify-between">
        <h1 className="font-display text-2xl text-amber">우리빌라 주차장</h1>
        <span className="flex items-center gap-1.5 text-xs opacity-60">
          <span className="spot-pulse-dot inline-block h-2 w-2 rounded-full bg-mint" />
          실시간
        </span>
      </header>

      <ParkingLotView lot={lot} highlightSpotId={spot.id} />

      <SpotInfoCard spot={spot} lot={lot} />

      <Link
        href={`/onboarding?spot=${spot.id}`}
        className="mt-1 w-full rounded-2xl bg-amber px-6 py-4 text-center text-base font-bold text-[#141B26] transition-transform duration-200 active:scale-[0.98]"
      >
        내 차도 등록하기
      </Link>
      <p className="-mt-2 text-xs opacity-40">호수·차종·색만 입력, 30초면 끝나요</p>
    </main>
  );
}
