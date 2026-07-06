import { create } from "zustand";

import type { Dataset } from "./types";

export type Tab = "map" | "rank" | "method" | "clusters";

interface AppState {
  dataset: Dataset | null;
  regionsGeo: GeoJSON.FeatureCollection | null;
  sidoGeo: GeoJSON.FeatureCollection | null;
  tab: Tab;
  presetId: string;
  weights: Record<string, number>;
  selected: string | null;
  layers: { substation: boolean; plant: boolean; landing: boolean };
  setData: (d: Dataset, r: GeoJSON.FeatureCollection, s: GeoJSON.FeatureCollection) => void;
  setTab: (t: Tab) => void;
  setPreset: (id: string) => void;
  setWeight: (axis: string, v: number) => void;
  select: (code: string | null) => void;
  toggleLayer: (k: keyof AppState["layers"]) => void;
}

function hashState(presetId: string, weights: Record<string, number>) {
  const w = Object.entries(weights).map(([k, v]) => `${k}:${v}`).join(",");
  return `#p=${presetId}&w=${w}`;
}

export function parseHash(): { presetId?: string; weights?: Record<string, number> } {
  const h = window.location.hash.replace(/^#/, "");
  if (!h) return {};
  const params = new URLSearchParams(h);
  const presetId = params.get("p") ?? undefined;
  const wRaw = params.get("w");
  let weights: Record<string, number> | undefined;
  if (wRaw) {
    weights = {};
    for (const pair of wRaw.split(",")) {
      const [k, v] = pair.split(":");
      const n = Number(v);
      if (k && Number.isFinite(n) && n >= 0) weights[k] = n;
    }
  }
  return { presetId, weights };
}

export const useApp = create<AppState>((set, get) => ({
  dataset: null,
  regionsGeo: null,
  sidoGeo: null,
  tab: "map",
  presetId: "balanced",
  weights: {},
  selected: null,
  layers: { substation: true, plant: false, landing: true },
  setData: (dataset, regionsGeo, sidoGeo) => {
    const fromHash = parseHash();
    const presetId = fromHash.presetId && dataset.meta.presets[fromHash.presetId] ? fromHash.presetId : "balanced";
    const base = { ...dataset.meta.presets[presetId].w };
    const weights = fromHash.weights && Object.keys(fromHash.weights).length > 0 ? { ...base, ...fromHash.weights } : base;
    set({ dataset, regionsGeo, sidoGeo, presetId, weights });
  },
  setTab: (tab) => set({ tab }),
  setPreset: (presetId) => {
    const d = get().dataset;
    if (!d) return;
    const weights = { ...d.meta.presets[presetId].w };
    window.history.replaceState(null, "", hashState(presetId, weights));
    set({ presetId, weights });
  },
  setWeight: (axis, v) => {
    const weights = { ...get().weights, [axis]: v };
    window.history.replaceState(null, "", hashState(get().presetId, weights));
    set({ weights });
  },
  select: (selected) => set({ selected }),
  toggleLayer: (k) => set((s) => ({ layers: { ...s.layers, [k]: !s.layers[k] } })),
}));
