import { useApp } from "../lib/store";

export default function WeightPanel() {
  const dataset = useApp((s) => s.dataset)!;
  const presetId = useApp((s) => s.presetId);
  const weights = useApp((s) => s.weights);
  const setPreset = useApp((s) => s.setPreset);
  const setWeight = useApp((s) => s.setWeight);

  const total = Object.values(weights).reduce((a, b) => a + b, 0);

  return (
    <div className="weight-bar">
      <div className="preset-group" role="group" aria-label="시나리오 프리셋">
        {Object.entries(dataset.meta.presets).map(([id, p]) => (
          <button key={id} className={id === presetId ? "preset on" : "preset"} onClick={() => setPreset(id)}>
            {p.label}
          </button>
        ))}
      </div>
      <details className="weight-editor">
        <summary>가중치 편집</summary>
        <div className="weight-rows">
          {dataset.meta.axes.map((a) => {
            const w = weights[a.id] ?? 0;
            const deferred = a.id in dataset.meta.deferred_axes;
            return (
              <label key={a.id} className="weight-row">
                <span className="w-label">
                  {a.label}
                  {deferred && <em title={dataset.meta.deferred_axes[a.id]}> (결측→재분배)</em>}
                </span>
                <input type="range" min={0} max={40} step={1} value={w} onChange={(e) => setWeight(a.id, Number(e.target.value))} />
                <span className="w-val">{total > 0 ? Math.round((w / total) * 100) : 0}%</span>
              </label>
            );
          })}
          <p className="muted small">가중치는 합계 대비 비율로 정규화됩니다. 데이터가 없는 축의 가중치는 확보된 축으로 자동 재분배되고 커버리지에 반영됩니다. 현재 설정은 URL에 저장되어 공유 가능합니다.</p>
        </div>
      </details>
    </div>
  );
}
