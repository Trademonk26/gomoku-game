export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
      <h1 className="font-display text-4xl text-amber">우리빌라 주차장</h1>
      <p className="text-sm opacity-70">
        이중주차 갈등 없는 아침 — 초경량 주차 공유
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {["출구쪽 왼편", "출구쪽 오른편", "안쪽 왼편", "안쪽 오른편"].map(
          (label) => (
            <div
              key={label}
              className="rounded-xl bg-asphalt px-6 py-8 text-center text-xs opacity-60"
            >
              {label}
            </div>
          ),
        )}
      </div>
    </main>
  );
}
