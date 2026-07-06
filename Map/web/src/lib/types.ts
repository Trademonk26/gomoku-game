export interface IndicatorMeta {
  id: string;
  axis: string;
  label: string;
  unit: string;
  direction: "up" | "down";
  reliability: "A" | "B" | "C";
  source: { name: string; url: string };
  caveat: string;
  source_type?: string;
  proxy_level?: string;
  official_source?: boolean;
  requires_manual_verification?: boolean;
  cannot_confirm_connection?: boolean;
}

export const SOURCE_TYPE_KO: Record<string, string> = {
  official_stat: "공식 통계",
  official_gis: "공식 GIS",
  official_anonymized: "공식(비식별)",
  official_plan: "공식 계획",
  public_map_proxy: "공개지도 프록시",
  model_proxy: "모델 추정",
  manual_curation: "수동 큐레이션",
};

export interface AxisMeta {
  id: string;
  label: string;
  desc: string;
}

export interface EvidenceItem {
  ind: string;
  text: string;
}

export interface Region {
  code: string;
  name: string;
  label: string;
  sido: string;
  sidonm: string;
  area_km2: number;
  rep: [number, number];
  values: Record<string, number | null>;
  pct: Record<string, number | null>;
  flags: { metro: boolean; jeju: boolean };
  evidence: { recommend: EvidenceItem[]; caution: EvidenceItem[]; verify: EvidenceItem[] };
}

export interface Dataset {
  meta: {
    snapshot: string;
    generated_at: string;
    axes: AxisMeta[];
    indicators: IndicatorMeta[];
    indicator_dictionary?: { version: string; designed: number };
    presets: Record<string, { label: string; w: Record<string, number> }>;
    penalties: { metro: number; jeju: number };
    deferred_axes: Record<string, string>;
    osm_note: string;
    power_overlay: {
      substations: Array<{ lon: number; lat: number; v: number; name: string }>;
      plants: Array<{ lon: number; lat: number; mw: number; src: string; name: string }>;
    };
    landing_stations: Array<{ name: string; lon: number; lat: number }>;
  };
  regions: Region[];
}
