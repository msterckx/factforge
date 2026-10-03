"use client";

import { useState, useRef, useEffect, useMemo, forwardRef, useImperativeHandle } from "react";
import { geoMercator, geoPath, geoGraticule } from "d3-geo";
import type { MapRegion, ChallengeGame } from "@/data/challengeGame";
import type { McqItem, McqRevealState } from "./McqQuizEngine";
import { resolveImageUrl } from "@/lib/imageUrl";
import CarouselMedia, { type CarouselMediaItem } from "./CarouselMedia";

interface GeoFeature {
  type: "Feature";
  geometry: { type: string; coordinates: unknown } | null;
  properties: { iso_a2: string; iso_a2_eh?: string; name: string } | null;
}

const VW = 960;
const VH = 600;

const SVG_COLORS = {
  default: { fill: "#c8d8b4", stroke: "#6b7c52", sw: "0.5" },
  active:  { fill: "#fbbf24", stroke: "#d97706", sw: "1.5" },
  placed:  { fill: "#4ade80", stroke: "#15803d", sw: "0.8" },
  wrong:   { fill: "#f87171", stroke: "#dc2626", sw: "0.8" },
} as const;

export interface MapMediaItem extends McqItem {
  regionKey: string;
  questionTextEn?: string | null;
  questionTextNl?: string | null;
}

// ── Interactive map media panel ─────────────────────────────────────────────────
export interface MapMediaHandle {
  reveal: (key: string, correct: boolean) => void;
  resetZoom: () => void;
}

// ── Images stashed on a region's infograph data ({fields, images}) ────────────
export function getRegionCarouselImages(region: MapRegion | undefined): string[] {
  if (!region?.infographData) return [];
  try {
    const parsed = JSON.parse(region.infographData);
    if (Array.isArray(parsed?.images)) return parsed.images.filter(Boolean);
  } catch { /* ignore malformed data */ }
  return [];
}

// After the answer is revealed, how long to hold before advancing — matches
// the video generator's "cuts away to a full-screen slideshow" pacing when
// the region has carousel images: time for the zoom-in, then the slideshow.
const REVEAL_HOLD_PLAIN_MS = 2200; // gives the zoom-in room to actually play before advancing
const CAROUSEL_CUTAWAY_DELAY_MS = 1700; // ~matches ZOOM_DURATION_MS below, so the zoom mostly lands first
const CAROUSEL_VIEW_MS = 6000; // >1 auto-advance cycle (CarouselMedia switches every 3.5s), so at least 2 images show
const REVEAL_HOLD_CAROUSEL_MS = CAROUSEL_CUTAWAY_DELAY_MS + CAROUSEL_VIEW_MS;

// A CSS cubic-bezier approximating GSAP's power2.inOut, used by the video generator
// for its map zoom — smoother/slower than a flat ease-in-out.
const ZOOM_EASE = "cubic-bezier(0.65, 0, 0.35, 1)";
const ZOOM_DURATION_MS = 1600;
const ZOOM_OUT_DURATION_MS = 900;

export function getMapRevealHoldMs(item: MapMediaItem, regions: MapRegion[]): number {
  const region = regions.find((r) => r.regionKey.trim() === item.regionKey);
  return getRegionCarouselImages(region).length > 0 ? REVEAL_HOLD_CAROUSEL_MS : REVEAL_HOLD_PLAIN_MS;
}

interface MapMediaProps {
  regions: MapRegion[];
  game: ChallengeGame;
  currentItem: MapMediaItem | null;
  answeredKeys: Set<string>;
  revealState?: McqRevealState;
}

export default forwardRef<MapMediaHandle, MapMediaProps>(function MapMedia(
  { regions, game, currentItem, answeredKeys, revealState = "idle" },
  ref
) {
  const [geoReady, setGeoReady] = useState(false);
  const [showCarousel, setShowCarousel] = useState(false);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const regionKeySet = useMemo(() => new Set(regions.map((r) => r.regionKey.trim())), [regions]);

  // ── Photo carousel for the active region, sourced from its infograph images ───
  const carouselItem = useMemo<CarouselMediaItem | null>(() => {
    if (!currentItem) return null;
    const region = regions.find((r) => r.regionKey.trim() === currentItem.regionKey);
    const images = getRegionCarouselImages(region);
    if (images.length === 0) return null;
    return {
      key: currentItem.key,
      label: currentItem.label,
      name: currentItem.label,
      images: images.map(resolveImageUrl),
    };
  }, [currentItem, regions]);

  // ── Cut away from the map to the carousel a moment after the reveal starts,
  //    so the zoom-in animation gets to play first ─────────────────────────────
  useEffect(() => {
    if (revealState === "idle" || !carouselItem) {
      setShowCarousel(false);
      return;
    }
    const id = setTimeout(() => setShowCarousel(true), CAROUSEL_CUTAWAY_DELAY_MS);
    return () => clearTimeout(id);
  }, [revealState, carouselItem]);

  // ── Helper: set SVG path colour ───────────────────────────────────────────────
  function setPathColor(id: string, c: { fill: string; stroke: string; sw: string }) {
    const el = svgRef.current?.querySelector<SVGElement>(`#${CSS.escape(id)}`);
    if (!el) return;
    el.setAttribute("fill", c.fill);
    el.setAttribute("stroke", c.stroke);
    el.setAttribute("stroke-width", c.sw);
  }

  // ── Zoom to region ────────────────────────────────────────────────────────────
  function zoomToRegion(key: string) {
    const pathEl = svgRef.current?.querySelector<SVGGraphicsElement>(`#${CSS.escape(key)}`);
    const mapGroup = svgRef.current?.querySelector<SVGGElement>("#mq-map-group");
    if (!pathEl || !mapGroup) return;

    const bbox = pathEl.getBBox();
    if (!bbox.width || !bbox.height) return;

    const margin = 120;
    const rawScale = Math.min((VW - margin * 2) / bbox.width, (VH - margin * 2) / bbox.height) * 0.7;
    const scale = Math.min(Math.max(rawScale, 1), 8);
    const cx = bbox.x + bbox.width / 2;
    const cy = bbox.y + bbox.height / 2;
    const tx = VW / 2 - cx * scale;
    const ty = VH / 2 - cy * scale;

    mapGroup.style.transition = `transform ${ZOOM_DURATION_MS}ms ${ZOOM_EASE}`;
    mapGroup.style.transformOrigin = "0 0";
    mapGroup.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
  }

  function resetZoom() {
    const mapGroup = svgRef.current?.querySelector<SVGGElement>("#mq-map-group");
    if (!mapGroup) return;
    mapGroup.style.transition = `transform ${ZOOM_OUT_DURATION_MS}ms ${ZOOM_EASE}`;
    mapGroup.style.transformOrigin = "0 0";
    mapGroup.style.transform = "translate(0px, 0px) scale(1)";
  }

  useImperativeHandle(ref, () => ({
    reveal(key, correct) {
      setPathColor(key, SVG_COLORS.placed);
      setTimeout(() => zoomToRegion(key), correct ? 500 : 400);
    },
    resetZoom,
  }));

  // ── Sync region colours whenever question or answered set changes ─────────────
  useEffect(() => {
    if (!geoReady || !currentItem) return;
    for (const key of regionKeySet) {
      if (answeredKeys.has(key)) {
        setPathColor(key, SVG_COLORS.placed);
      } else if (key === currentItem.regionKey) {
        setPathColor(key, SVG_COLORS.active);
      } else {
        setPathColor(key, SVG_COLORS.default);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geoReady, currentItem?.regionKey, answeredKeys]);

  // ── D3 map render ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl || regionKeySet.size === 0) return;

    let aborted = false;

    function mkSvg(tag: string, a: Record<string, string | number> = {}, parent?: Element): SVGElement {
      const el = document.createElementNS("http://www.w3.org/2000/svg", tag) as SVGElement;
      for (const [k, v] of Object.entries(a)) el.setAttribute(k, String(v));
      parent?.appendChild(el);
      return el;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function renderMap(el: SVGSVGElement, bgFeatures: any[], gameFeatures: any[], getKey: (f: any) => string, padding: number, bgFill = "#3a7a4a", directProject = false, rotate: [number, number] = [0, 0]) {
      if (gameFeatures.length === 0) {
        console.error("[MapQuizChallenge] No features matched region keys:", [...regionKeySet]);
        return;
      }

      const bboxCoords: number[][] = [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const flattenCoords = (c: any): void => {
        if (!Array.isArray(c) || c.length === 0) return;
        if (typeof c[0] === "number") { bboxCoords.push(c as number[]); return; }
        for (const sub of c) flattenCoords(sub);
      };
      for (const f of gameFeatures) flattenCoords(f.geometry?.coordinates);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fitTarget: any = bboxCoords.length > 0
        ? { type: "Feature", geometry: { type: "MultiPoint", coordinates: bboxCoords }, properties: null }
        : { type: "FeatureCollection", features: gameFeatures };

      const projection = geoMercator().rotate([rotate[0], rotate[1]]).fitExtent(
        [[padding, padding], [VW - padding, VH - padding]],
        fitTarget
      );
      const [tx, ty] = projection.translate();
      if (!Number.isFinite(tx) || !Number.isFinite(ty)) {
        console.error("[MapQuizChallenge] Projection produced NaN.");
        return;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pathGen = geoPath().projection(projection as any);

      while (el.firstChild) el.removeChild(el.firstChild);

      const defs = mkSvg("defs", {}, el);
      const grad = mkSvg("radialGradient", { id: "mq-ocean", cx: "50%", cy: "50%", r: "75%" }, defs);
      mkSvg("stop", { offset: "0%",   "stop-color": "#0d2048" }, grad);
      mkSvg("stop", { offset: "100%", "stop-color": "#060e1f" }, grad);

      mkSvg("rect", { width: VW, height: VH, fill: "url(#mq-ocean)" }, el);

      // All map content goes in this group so we can zoom-transform it
      const mapGroup = mkSvg("g", { id: "mq-map-group" }, el);

      const gratPath = mkSvg("path", { fill: "none", stroke: "#0e2650", "stroke-width": "0.4" }, mapGroup);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      gratPath.setAttribute("d", pathGen(geoGraticule()() as any) ?? "");

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const f of bgFeatures) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const d = pathGen(f as any);
        if (!d) continue;
        mkSvg("path", { d, fill: bgFill, stroke: "#2d6038", "stroke-width": bgFill === "none" ? "0.6" : "0.3" }, mapGroup);
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const f of gameFeatures) {
        const key = getKey(f);

        if (directProject && f.geometry?.type === "Point") {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const pt = projection(f.geometry.coordinates as [number, number]);
          if (!pt) continue;
          const [cx, cy] = pt;
          const r = 12;
          mkSvg("circle", {
            id: key, cx, cy, r,
            fill:           SVG_COLORS.default.fill,
            stroke:         SVG_COLORS.default.stroke,
            "stroke-width": "1.5",
          }, mapGroup);
          continue;
        }

        let d: string | null = null;
        if (directProject && f.geometry?.type === "Polygon") {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const ring: number[][] = f.geometry.coordinates[0];
          const pts = ring.slice(0, -1).map((c: number[]) => projection(c as [number, number])).filter(Boolean) as [number, number][];
          if (pts.length >= 3) {
            d = `M${pts[0][0]},${pts[0][1]}` + pts.slice(1).map((p) => `L${p[0]},${p[1]}`).join("") + "Z";
          }
        } else {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          d = pathGen(f as any);
        }
        if (!d) continue;
        mkSvg("path", {
          id:             key,
          d,
          fill:           SVG_COLORS.default.fill,
          stroke:         SVG_COLORS.default.stroke,
          "stroke-width": SVG_COLORS.default.sw,
        }, mapGroup);
      }

      // Vignette stays outside map-group so it doesn't scale with zoom
      const vigGrad = mkSvg("radialGradient", { id: "mq-vignette", cx: "50%", cy: "50%", r: "75%" }, defs);
      mkSvg("stop", { offset: "44%", "stop-color": "transparent" }, vigGrad);
      mkSvg("stop", { offset: "100%", "stop-color": "rgba(0,0,0,0.45)" }, vigGrad);
      const vignette = mkSvg("rect", { width: VW, height: VH, fill: "url(#mq-vignette)" }, el);
      vignette.setAttribute("pointer-events", "none");

      setGeoReady(true);
    }

    const NE_URL = "https://d2ad6b4ur7yvpq.cloudfront.net/naturalearth-3.3.0/ne_50m_admin_0_countries.geojson";

    const BG_ISO: Record<string, Set<string>> = {
      africa: new Set(["ZA","NA","BW","ZW","ZM","TZ","KE","UG","RW","BI","CD",
        "AO","MZ","MG","MW","SO","ET","ER","DJ","SD","SS","CF","CG","GA","CM",
        "NG","GH","CI","SN","GN","SL","LR","TG","BJ","NE","ML","BF","MR","GM",
        "GW","TD","LY","DZ","MA","TN","EG","MU"]),
      south_america: new Set(["BR","AR","CL","CO","VE","PE","BO","PY","UY","EC",
        "GY","SR","FK","PA","CR"]),
      north_america: new Set(["US","CA","MX","GT","BZ","HN","SV","NI","CR","PA",
        "CU","HT","DO","JM","GL"]),
      europe: new Set(["PT","ES","FR","GB","IE","IS","NO","SE","FI","DK",
        "DE","NL","BE","LU","CH","AT","IT","PL","CZ","SK","HU","SI","HR",
        "BA","RS","ME","MK","AL","GR","BG","RO","MD","UA","BY","LT","LV","EE"]),
      // Straddles the antimeridian (Midway ~177°W to Hiroshima ~132°E) — see rotateFor().
      pacific: new Set(["US","JP","PH","SB","PG","FM","MH","PW","KI","TW",
        "KR","KP","CN","RU","AU","NZ","VU","ID","MY","TL"]),
    };
    const bgIso = (mapSvg: string): Set<string> => {
      if (mapSvg.includes("africa"))        return BG_ISO.africa;
      if (mapSvg.includes("south_america")) return BG_ISO.south_america;
      if (mapSvg.includes("europe"))        return BG_ISO.europe;
      if (mapSvg.includes("pacific"))       return BG_ISO.pacific;
      return BG_ISO.north_america;
    };
    // A plain (unrotated) Mercator fitExtent takes the raw min/max longitude of the
    // data as the bounding box — fine for every other continent, but a Pacific-Theater
    // map's points straddle ±180° (Midway ~-177°, Hiroshima ~132°), so the naive bbox
    // would span almost the whole globe the "long way" through the Atlantic instead of
    // the actual ~100°-wide slice of ocean. Rotating the reference meridian to the date
    // line (180°) recenters the sphere there first, so the same data now fits a normal,
    // non-wrapping bbox — same trick real Pacific-centered maps use.
    const rotateFor = (mapSvg: string): [number, number] => mapSvg.includes("pacific") ? [180, 0] : [0, 0];

    if (game.mapSvg?.endsWith(".geojson")) {
      Promise.all([
        fetch(game.mapSvg).then((r) => r.json()),
        fetch(NE_URL).then((r) => r.json()),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ]).then(([customGeo, neGeo]: any[]) => {
        if (aborted) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const gameFeatures = (customGeo.features as any[]).filter((f) => f.geometry != null);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const getKey = (f: any): string => String(f.id ?? f.properties?.regionKey ?? "");
        const isoFn = (f: GeoFeature) => f.properties?.iso_a2_eh ?? f.properties?.iso_a2 ?? "";
        const iso = bgIso(game.mapSvg!);
        const bgFeatures = (neGeo.features as GeoFeature[]).filter(
          (f) => f.geometry != null && iso.has(isoFn(f))
        );
        renderMap(svgEl, bgFeatures, gameFeatures, getKey, 40, "#3a7a4a", true, rotateFor(game.mapSvg!));
      }).catch(console.error);
    } else {
      fetch(NE_URL)
        .then((r) => r.json())
        .then((geojson: { features: GeoFeature[] }) => {
          if (aborted) return;
          const all          = geojson.features.filter((f) => f.geometry != null);
          const iso          = (f: GeoFeature) => f.properties?.iso_a2_eh ?? f.properties?.iso_a2 ?? "";
          const gameFeatures = all.filter((f) =>  regionKeySet.has(iso(f)));
          const bgFeatures   = all.filter((f) => !regionKeySet.has(iso(f)));
          if (gameFeatures.length === 0) {
            console.error("[MapQuizChallenge] No GeoJSON features matched region keys.");
            return;
          }
          renderMap(svgEl, bgFeatures, gameFeatures, iso, 40);
        })
        .catch(console.error);
    }

    return () => { aborted = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regionKeySet]);

  return (
    <>
      {/* Map stays mounted permanently — the D3 draw effect only runs once,
          so unmounting the <svg> on cut-away would leave it empty on return. */}
      <div style={{ opacity: showCarousel ? 0 : 1, visibility: showCarousel ? "hidden" : "visible" }}>
        {!geoReady && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-slate-400 text-sm animate-pulse">Loading map…</span>
          </div>
        )}
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VW} ${VH}`}
          className="w-full h-auto block"
          style={{ opacity: geoReady ? 1 : 0, transition: "opacity 0.4s ease" }}
        />
      </div>
      {carouselItem && (
        <div
          className={`absolute inset-0 transition-opacity duration-300 ${
            showCarousel ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
        >
          <CarouselMedia key={carouselItem.key} item={carouselItem} revealState={revealState} />
        </div>
      )}
    </>
  );
});
