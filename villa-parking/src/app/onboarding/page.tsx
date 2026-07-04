// Phase 1-3에서 구현할 30초 온보딩(호수/차종+색/전화번호)의 자리 표시자.
export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ spot?: string }>;
}) {
  const { spot } = await searchParams;

  return (
    <main className="mx-auto flex w-full max-w-[430px] flex-1 flex-col items-center justify-center gap-3 px-5">
      <h1 className="font-display text-2xl text-amber">30초 등록</h1>
      <p className="text-sm opacity-60">
        온보딩은 다음 단계(Phase 1-3)에서 구현됩니다.
      </p>
      {spot && <p className="text-xs opacity-40">선택한 칸: {spot}</p>}
    </main>
  );
}
