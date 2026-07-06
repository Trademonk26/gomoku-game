import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useMemo, useRef, useState } from "react";

import { MARKER, NO_DATA_DARK, NO_DATA_LIGHT, legendStops, scoreColor } from "../lib/colors";
import { useApp } from "../lib/store";
import type { ScoresBundle } from "../lib/useScores";

const KR_BOUNDS: [[number, number], [number, number]] = [[124.6, 33.0], [131.2, 38.8]];

function useDark() {
  const [dark, setDark] = useState(() => window.matchMedia("(prefers-color-scheme: dark)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const fn = (e: MediaQueryListEvent) => setDark(e.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);
  return dark;
}

export default function MapView({ scores }: { scores: ScoresBundle }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [ready, setReady] = useState(false);
  const [hover, setHover] = useState<{ code: string; x: number; y: number } | null>(null);
  const dark = useDark();

  const dataset = useApp((s) => s.dataset)!;
  const regionsGeo = useApp((s) => s.regionsGeo)!;
  const sidoGeo = useApp((s) => s.sidoGeo)!;
  const selected = useApp((s) => s.selected);
  const select = useApp((s) => s.select);
  const layers = useApp((s) => s.layers);
  const toggleLayer = useApp((s) => s.toggleLayer);

  const overlayGeo = useMemo(() => {
    const pt = (lon: number, lat: number, props: Record<string, unknown>) => ({
      type: "Feature" as const, properties: props, geometry: { type: "Point" as const, coordinates: [lon, lat] },
    });
    return {
      substations: {
        type: "FeatureCollection" as const,
        features: dataset.meta.power_overlay.substations.map((s) => pt(s.lon, s.lat, { name: s.name, v: s.v })),
      },
      plants: {
        type: "FeatureCollection" as const,
        features: dataset.meta.power_overlay.plants.map((p) => pt(p.lon, p.lat, { name: p.name, mw: p.mw })),
      },
      landing: {
        type: "FeatureCollection" as const,
        features: dataset.meta.landing_stations.map((l) => pt(l.lon, l.lat, { name: l.name })),
      },
    };
  }, [dataset]);

  const fillExpr = useMemo(() => {
    const expr: unknown[] = ["match", ["get", "code"]];
    for (const r of dataset.regions) {
      expr.push(r.code, scoreColor(scores.byCode.get(r.code)?.total ?? null));
    }
    expr.push(dark ? NO_DATA_DARK : NO_DATA_LIGHT);
    return expr;
  }, [dataset, scores, dark]);

  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: { version: 8, sources: {}, layers: [{ id: "bg", type: "background", paint: { "background-color": "#f9f9f7" } }] },
      bounds: KR_BOUNDS,
      fitBoundsOptions: { padding: 24 },
      attributionControl: false,
      dragRotate: false,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(new maplibregl.AttributionControl({
      compact: true,
      customAttribution: "경계: 통계청·행안부(admdongkor) · 설비: © OpenStreetMap contributors (ODbL)",
    }));
    map.on("load", () => {
      map.addSource("regions", { type: "geojson", data: regionsGeo });
      map.addSource("sido", { type: "geojson", data: sidoGeo });
      map.addSource("substations", { type: "geojson", data: overlayGeo.substations });
      map.addSource("plants", { type: "geojson", data: overlayGeo.plants });
      map.addSource("landing", { type: "geojson", data: overlayGeo.landing });

      map.addLayer({ id: "regions-fill", type: "fill", source: "regions", paint: { "fill-color": "#ccc", "fill-opacity": 0.92 } });
      map.addLayer({ id: "regions-line", type: "line", source: "regions", paint: { "line-color": "#fcfcfb", "line-width": 0.5 } });
      map.addLayer({ id: "sido-line", type: "line", source: "sido", paint: { "line-color": "#c3c2b7", "line-width": 1.1 } });
      map.addLayer({
        id: "selected-line", type: "line", source: "regions",
        filter: ["==", ["get", "code"], ""],
        paint: { "line-color": "#0b0b0b", "line-width": 2.4 },
      });
      map.addLayer({
        id: "plants-pt", type: "circle", source: "plants",
        paint: {
          "circle-color": MARKER.plant.light, "circle-opacity": 0.9,
          "circle-radius": ["interpolate", ["linear"], ["get", "mw"], 500, 4, 6000, 13],
          "circle-stroke-color": "#fcfcfb", "circle-stroke-width": 1,
        },
      });
      map.addLayer({
        id: "substations-pt", type: "circle", source: "substations",
        paint: {
          "circle-color": MARKER.substation.light, "circle-radius": 3.5,
          "circle-stroke-color": "#fcfcfb", "circle-stroke-width": 1,
        },
      });
      map.addLayer({
        id: "landing-pt", type: "circle", source: "landing",
        paint: {
          "circle-color": MARKER.landing.light, "circle-radius": 6,
          "circle-stroke-color": "#fcfcfb", "circle-stroke-width": 2,
        },
      });

      map.on("mousemove", "regions-fill", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        map.getCanvas().style.cursor = "pointer";
        setHover({ code: f.properties!.code as string, x: e.point.x, y: e.point.y });
      });
      map.on("mouseleave", "regions-fill", () => {
        map.getCanvas().style.cursor = "";
        setHover(null);
      });
      map.on("click", "regions-fill", (e) => {
        const f = e.features?.[0];
        if (f) select(f.properties!.code as string);
      });
      map.resize();
      setReady(true);
    });
    (window as unknown as { __map?: maplibregl.Map }).__map = map;
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    map.setPaintProperty("regions-fill", "fill-color", fillExpr as never);
  }, [fillExpr, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const surface = dark ? "#1a1a19" : "#fcfcfb";
    map.setPaintProperty("bg", "background-color", dark ? "#0d0d0d" : "#f9f9f7");
    map.setPaintProperty("regions-line", "line-color", surface);
    map.setPaintProperty("sido-line", "line-color", dark ? "#383835" : "#c3c2b7");
    map.setPaintProperty("selected-line", "line-color", dark ? "#ffffff" : "#0b0b0b");
    map.setPaintProperty("substations-pt", "circle-color", dark ? MARKER.substation.dark : MARKER.substation.light);
    map.setPaintProperty("plants-pt", "circle-color", dark ? MARKER.plant.dark : MARKER.plant.light);
    map.setPaintProperty("landing-pt", "circle-color", dark ? MARKER.landing.dark : MARKER.landing.light);
    for (const id of ["substations-pt", "plants-pt", "landing-pt"]) {
      map.setPaintProperty(id, "circle-stroke-color", surface);
    }
  }, [dark, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    map.setFilter("selected-line", ["==", ["get", "code"], selected ?? ""]);
  }, [selected, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    map.setLayoutProperty("substations-pt", "visibility", layers.substation ? "visible" : "none");
    map.setLayoutProperty("plants-pt", "visibility", layers.plant ? "visible" : "none");
    map.setLayoutProperty("landing-pt", "visibility", layers.landing ? "visible" : "none");
  }, [layers, ready]);

  const hoverRegion = hover ? dataset.regions.find((r) => r.code === hover.code) : null;
  const hoverScore = hover ? scores.byCode.get(hover.code) : null;

  return (
    <div className="map-wrap">
      <div ref={containerRef} className="map-container" />
      {hoverRegion && hoverScore && hover && (
        <div className="map-tooltip" style={{ left: hover.x + 12, top: hover.y + 12 }}>
          <strong>{hoverRegion.label}</strong>
          <span className="tt-score">
            {hoverScore.total !== null ? Math.round(hoverScore.total) : "—"}점 · {hoverScore.grade ?? "—"} · {hoverScore.rank}위
          </span>
          {hoverRegion.evidence.recommend[0] && <span className="tt-ev">{hoverRegion.evidence.recommend[0].text}</span>}
        </div>
      )}
      <div className="map-legend">
        <div className="legend-title">적합도 (0~100)</div>
        <div className="legend-ramp">
          {legendStops().map((s) => (
            <span key={s.label} className="legend-stop">
              <i style={{ background: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
        <div className="legend-markers">
          {(Object.keys(MARKER) as Array<keyof typeof MARKER>).map((k) => (
            <label key={k} className="legend-marker-row">
              <input
                type="checkbox"
                checked={layers[k === "substation" ? "substation" : k === "plant" ? "plant" : "landing"]}
                onChange={() => toggleLayer(k === "substation" ? "substation" : k === "plant" ? "plant" : "landing")}
              />
              <i style={{ background: dark ? MARKER[k].dark : MARKER[k].light }} />
              {MARKER[k].label}
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
