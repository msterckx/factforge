"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { geoMercator, geoPath, geoGraticule } from "d3-geo";
import type { Dictionary } from "@/i18n/en";
import type { MapRegion, ChallengeGame } from "@/data/challengeGame";
import { useCompletedChallenges } from "@/hooks/useCompletedChallenges";
import { trackChallengeStart, trackChallengeComplete, trackChallengeFail } from "@/lib/gtag";

// ── Types ──────────────────────────────────────────────────────────────────────
interface Chip {
  regionKey: string;
  label: string;
}

interface Props {
  regions: MapRegion[];
  game: ChallengeGame;
  dict: Dictionary["challenges"];
  challengeId: string;
  lang: string;
}

// Minimal GeoJSON types (Natural Earth feature — CDN returns lowercase property names)
interface GeoFeature {
  type: "Feature";
  geometry: { type: string; coordinates: unknown } | null;
  properties: { iso_a2: string; iso_a2_eh?: string; name: string } | null;
}

const STARTING_LIVES = 5;

// SVG viewport for the D3 map
const VW = 960;
const VH = 600;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Glitter bomb overlay ───────────────────────────────────────────────────────
const GLITTER_COLORS = ["#fbbf24","#4ade80","#f59e0b","#86efac","#fde68a","#a3e635","#34d399","#fcd34d"];
const GLITTER_SHAPES = ["50%", "0%", "2px"];

interface Particle {
  id: number; x: number; y: number; size: number; color: string;
  radius: string; delay: number; duration: number; dx: number; dy: number; rot: number;
}

function GlitterBomb() {
  const particles = useMemo<Particle[]>(() =>
    Array.from({ length: 80 }, (_, id) => ({
      id,
      x: 10 + Math.random() * 80,
      y: 20 + Math.random() * 60,
      size: 4 + Math.random() * 7,
      color: GLITTER_COLORS[Math.floor(Math.random() * GLITTER_COLORS.length)],
      radius: GLITTER_SHAPES[Math.floor(Math.random() * GLITTER_SHAPES.length)],
      delay: Math.random() * 0.4,
      duration: 0.9 + Math.random() * 0.8,
      dx: (Math.random() - 0.5) * 260,
      dy: -(80 + Math.random() * 180),
      rot: Math.random() * 720,
    })), []);

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {particles.map((p) => (
        <div
          key={p.id}
          style={{
            position: "absolute",
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            borderRadius: p.radius,
            animation: `glitter-fly ${p.duration}s ease-out ${p.delay}s both`,
            "--dx": `${p.dx}px`,
            "--dy": `${p.dy}px`,
            "--rot": `${p.rot}deg`,
          } as React.CSSProperties}
        />
      ))}
      <style>{`
        @keyframes glitter-fly {
          0%   { transform: translate(0,0) rotate(0deg); opacity: 1; }
          100% { transform: translate(var(--dx), var(--dy)) rotate(var(--rot)); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

function GameOverOverlay({ message }: { message: string }) {
  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-red-600/30">
      <div className="rounded-2xl bg-red-600 px-10 py-8 text-center shadow-2xl">
        <p className="text-4xl font-extrabold text-white tracking-tight">{message}</p>
      </div>
    </div>
  );
}

// ── Lightbox ───────────────────────────────────────────────────────────────────
function Lightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 animate-fade-in"
      onClick={onClose}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className="max-w-[90vw] max-h-[90vh] rounded-2xl shadow-2xl object-contain"
        onClick={(e) => e.stopPropagation()}
      />
      <button
        onClick={onClose}
        aria-label="Close"
        className="absolute top-4 right-4 text-white/80 hover:text-white text-3xl leading-none"
      >
        ×
      </button>
    </div>
  );
}

// ── Info panel shown on chip click ────────────────────────────────────────────
function RegionInfoPanel({
  region,
  lang,
  didYouKnow,
  onDismiss,
}: {
  region: MapRegion;
  lang: string;
  didYouKnow: string;
  onDismiss: () => void;
}) {
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const image = lang === "nl" ? (region.infoImageNl ?? region.infoImageEn) : region.infoImageEn;
  const text  = lang === "nl" ? (region.infoTextNl  ?? region.infoTextEn)  : region.infoTextEn;
  const name  = lang === "nl" ? region.labelNl : region.labelEn;

  if (!image && !text) return null;

  return (
    <>
      {lightboxOpen && image && (
        <Lightbox src={image} alt={name} onClose={() => setLightboxOpen(false)} />
      )}
      <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[100] w-[min(480px,90vw)] rounded-2xl border border-emerald-300/60 overflow-hidden animate-fade-in shadow-2xl backdrop-blur-md bg-white/75">
        <div className="flex items-center justify-between px-4 py-2 bg-emerald-100/80 border-b border-emerald-200/60">
          <span className="text-sm font-semibold text-emerald-900">{name}</span>
          <button
            onClick={onDismiss}
            aria-label="Dismiss"
            className="text-emerald-700 hover:text-emerald-900 text-lg leading-none"
          >
            ×
          </button>
        </div>
        <div className="flex flex-col sm:flex-row gap-4 p-4">
          {image && (
            <button
              onClick={() => setLightboxOpen(true)}
              className="flex-shrink-0 w-full sm:w-40 h-28 rounded-xl overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 group"
              aria-label="Expand image"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image}
                alt={name}
                className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105 cursor-zoom-in"
              />
            </button>
          )}
          {text && (
            <div className="flex-1">
              <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-1">{didYouKnow}</p>
              <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-line">{text}</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function MapChallenge({ regions, game, dict, challengeId, lang }: Props) {
  const mode = game.mapLabelMode ?? "country";

  // Build chips from regions
  const allChips = useMemo<Chip[]>(() => {
    return regions.map((r) => {
      let label: string;
      if (mode === "capital") {
        label = lang === "nl" ? (r.capitalNl ?? r.capitalEn ?? r.labelEn) : (r.capitalEn ?? r.labelEn);
      } else {
        label = lang === "nl" ? r.labelNl : r.labelEn;
      }
      return { regionKey: r.regionKey.trim(), label };
    });
  }, [regions, mode, lang]);

  const [bank, setBank]               = useState<Chip[]>(() => shuffle(allChips));
  const [placed, setPlaced]           = useState<Record<string, string>>({});
  const [lives, setLives]             = useState(STARTING_LIVES);
  const [gameWon, setGameWon]         = useState(false);
  const [gameLost, setGameLost]       = useState(false);
  const [glitterActive, setGlitterActive] = useState(false);
  const [wrongKey, setWrongKey]       = useState<string | null>(null);
  const [started, setStarted]         = useState(false);
  const [hoveredChipKey, setHoveredChipKey] = useState<string | null>(null);
  const [geoReady, setGeoReady]       = useState(false);

  const regionsByKey = useMemo(() => {
    const map: Record<string, MapRegion> = {};
    for (const r of regions) map[r.regionKey.trim()] = r;
    return map;
  }, [regions]);

  const regionKeySet = useMemo(() => new Set(allChips.map((c) => c.regionKey)), [allChips]);

  const mouseHoverRef = useRef<string | null>(null);
  const dragHoverRef  = useRef<string | null>(null);
  const svgRef        = useRef<SVGSVGElement | null>(null);
  const containerRef  = useRef<HTMLDivElement>(null);
  // Track placed state in a ref so restart() can read current values without stale closure
  const placedRef = useRef(placed);
  useEffect(() => { placedRef.current = placed; }, [placed]);

  const { markComplete } = useCompletedChallenges();

  // ── Colour helpers ────────────────────────────────────────────────────────────
  // Unplaced interactive regions use the same light sage as before; background
  // land uses the animation's dark green so the ocean+land palette matches.
  const SVG_COLORS = {
    default: { fill: "#c8d8b4", stroke: "#6b7c52", sw: "0.5" },
    hover:   { fill: "#93c5fd", stroke: "#2563eb", sw: "0.8" },
    drag:    { fill: "#fbbf24", stroke: "#d97706", sw: "0.8" },
    placed:  { fill: "#4ade80", stroke: "#15803d", sw: "0.8" },
    wrong:   { fill: "#f87171", stroke: "#dc2626", sw: "0.8" },
  } as const;

  function setPathColor(id: string, c: { fill: string; stroke: string; sw: string }) {
    const el = svgRef.current?.querySelector<SVGElement>(`#${CSS.escape(id)}`);
    if (!el) return;
    el.setAttribute("fill", c.fill);
    el.setAttribute("stroke", c.stroke);
    el.setAttribute("stroke-width", c.sw);
  }

  function restorePath(id: string) {
    if (placedRef.current[id]) { setPathColor(id, SVG_COLORS.placed); return; }
    setPathColor(id, SVG_COLORS.default);
  }

  // ── D3 map render ─────────────────────────────────────────────────────────────
  // Runs once when regionKeySet is stable. Fetches GeoJSON, auto-fits projection,
  // draws ocean + background land + interactive regions.
  // Two modes:
  //   • game.mapSvg ends with ".geojson" → custom GeoJSON (parks, etc.) + NE background
  //   • otherwise → Natural Earth 50m, filtered by ISO code
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

    // Shared render: accepts the SVG element, feature sets, key extractor, padding,
    // an optional bgFill override, and directProject flag.
    // directProject=true: project each polygon vertex directly via projection() instead of
    // geoPath(). Needed for small polygon features where D3's spherical polygon winding
    // detection incorrectly fills the global complement (full-world bbox) instead of the
    // small interior area.
    // svgEl is passed explicitly so TypeScript retains its non-null narrowing inside the closure
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function renderMap(el: SVGSVGElement, bgFeatures: any[], gameFeatures: any[], getKey: (f: any) => string, padding: number, bgFill = "#3a7a4a", directProject = false) {
      if (gameFeatures.length === 0) {
        console.error("[MapChallenge] No features matched region keys:", [...regionKeySet]);
        return;
      }
      // Build a MultiPoint from all feature vertices for fitExtent.
      // D3's polygon bounding-box can produce a full-world bbox for small features
      // (great-circle arc interpolation issue), causing scale to be ~5× too small.
      // MultiPoint bboxes are computed from raw projected points — always correct.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const projection = geoMercator().fitExtent(
        [[padding, padding], [VW - padding, VH - padding]],
        fitTarget
      );
      const [tx, ty] = projection.translate();
      if (!Number.isFinite(tx) || !Number.isFinite(ty)) {
        console.error("[MapChallenge] Projection produced NaN — check feature geometry.");
        return;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pathGen = geoPath().projection(projection as any);

      while (el.firstChild) el.removeChild(el.firstChild);

      const defs = mkSvg("defs", {}, el);
      const grad = mkSvg("radialGradient", { id: "mc-ocean", cx: "50%", cy: "50%", r: "75%" }, defs);
      mkSvg("stop", { offset: "0%",   "stop-color": "#0d2048" }, grad);
      mkSvg("stop", { offset: "100%", "stop-color": "#060e1f" }, grad);

      mkSvg("rect", { width: VW, height: VH, fill: "url(#mc-ocean)" }, el);

      const gratPath = mkSvg("path", { fill: "none", stroke: "#0e2650", "stroke-width": "0.4" }, el);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      gratPath.setAttribute("d", pathGen(geoGraticule()() as any) ?? "");

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const f of bgFeatures) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const d = pathGen(f as any);
        if (!d) continue;
        mkSvg("path", { d, fill: bgFill, stroke: "#2d6038", "stroke-width": bgFill === "none" ? "0.6" : "0.3" }, el);
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const f of gameFeatures) {
        const key = getKey(f);

        // Point features → SVG circle (used for park/reserve location pins)
        if (directProject && f.geometry?.type === "Point") {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const pt = projection(f.geometry.coordinates as [number, number]);
          if (!pt) continue;
          mkSvg("circle", {
            id: key, cx: pt[0], cy: pt[1], r: 10,
            fill:           SVG_COLORS.default.fill,
            stroke:         SVG_COLORS.default.stroke,
            "stroke-width": "1.5",
            cursor:         "pointer",
          }, el);
          continue;
        }

        // Polygon features → path
        let d: string | null = null;
        if (directProject && f.geometry?.type === "Polygon") {
          // Project each vertex directly, bypassing D3's polygon winding pipeline
          // which misidentifies small CCW rings as their global complement.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const ring: number[][] = f.geometry.coordinates[0];
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
          cursor:         "pointer",
        }, el);
      }

      const vignette = mkSvg("rect", { width: VW, height: VH, fill: "url(#mc-vignette)" }, el);
      const vigGrad  = mkSvg("radialGradient", { id: "mc-vignette", cx: "50%", cy: "50%", r: "75%" }, defs);
      mkSvg("stop", { offset: "44%", "stop-color": "transparent" }, vigGrad);
      mkSvg("stop", { offset: "100%", "stop-color": "rgba(0,0,0,0.45)" }, vigGrad);
      vignette.setAttribute("pointer-events", "none");

      setGeoReady(true);
    }

    const NE_URL = "https://d2ad6b4ur7yvpq.cloudfront.net/naturalearth-3.3.0/ne_50m_admin_0_countries.geojson";

    // Continental North/Central America ISO codes — large enough that D3 polygon winding
    // is reliable (no complement misidentification) and none cross the antimeridian.
    const NA_ISO = new Set(["US","CA","MX","GT","BZ","HN","SV","NI","CR","PA",
      "CU","HT","DO","JM","GL"]);

    if (game.mapSvg?.endsWith(".geojson")) {
      // Custom GeoJSON mode (parks, reserves, etc.).
      // Game features are projected directly (bypassing D3's polygon pipeline).
      // Background: NA/Central American countries from Natural Earth for geographic context.
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
          const bgFeatures = (neGeo.features as GeoFeature[]).filter(
            (f) => f.geometry != null && NA_ISO.has(isoFn(f))
          );
          renderMap(svgEl, bgFeatures, gameFeatures, getKey, 40, "#3a7a4a", true);
        }).catch(console.error);
    } else {
      // Natural Earth ISO mode — country-level challenges
      fetch(NE_URL)
        .then((r) => r.json())
        .then((geojson: { features: GeoFeature[] }) => {
          if (aborted) return;
          const all          = geojson.features.filter((f) => f.geometry != null);
          const iso          = (f: GeoFeature) => f.properties?.iso_a2_eh ?? f.properties?.iso_a2 ?? "";
          const gameFeatures = all.filter((f) =>  regionKeySet.has(iso(f)));
          const bgFeatures   = all.filter((f) => !regionKeySet.has(iso(f)));
          if (gameFeatures.length === 0) {
            console.error(
              "[MapChallenge] No GeoJSON features matched region keys.\n" +
              "  Expected keys : " + JSON.stringify([...regionKeySet]) + "\n" +
              "  Sample iso_a2 : " + JSON.stringify(all.slice(0, 8).map(iso)) + "\n" +
              "  First feature : " + JSON.stringify(geojson.features[0]?.properties),
            );
            return;
          }
          renderMap(svgEl, bgFeatures, gameFeatures, iso, 40);
        })
        .catch(console.error);
    }

    return () => { aborted = true; };
  // regionKeySet identity is stable across renders for the same game
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regionKeySet]);

  // ── Drag state ───────────────────────────────────────────────────────────────
  const dragging = useRef<{ chip: Chip; ghost: HTMLDivElement } | null>(null);

  const getPathAtPoint = useCallback((clientX: number, clientY: number): string | null => {
    if (!svgRef.current) return null;
    const el = document.elementFromPoint(clientX, clientY);
    if (!el) return null;
    let cur: Element | null = el;
    while (cur && cur !== svgRef.current) {
      if (cur.id && regionKeySet.has(cur.id)) return cur.id;
      cur = cur.parentElement;
    }
    return null;
  }, [regionKeySet]);

  // ── Pointer handlers on chips ──────────────────────────────────────────────
  function onChipDown(e: React.PointerEvent, chip: Chip) {
    e.preventDefault();
    if (gameWon || gameLost) return;

    const startX = e.clientX;
    const startY = e.clientY;
    let dragStarted = false;

    const onMove = (me: PointerEvent) => {
      const dx = me.clientX - startX;
      const dy = me.clientY - startY;

      if (!dragStarted && Math.sqrt(dx * dx + dy * dy) > 6) {
        dragStarted = true;
        setHoveredChipKey(null);

        if (!started) {
          setStarted(true);
          trackChallengeStart(challengeId);
        }

        const ghost = document.createElement("div");
        ghost.textContent = chip.label;
        ghost.style.cssText = `
          position: fixed; z-index: 9999; pointer-events: none;
          padding: 6px 12px; border-radius: 8px; font-size: 13px; font-weight: 600;
          background: #1e293b; color: #f8fafc; white-space: nowrap;
          box-shadow: 0 4px 12px rgba(0,0,0,0.35); opacity: 0.95;
          transform: translate(-50%,-50%);
          left: ${me.clientX}px; top: ${me.clientY}px;
        `;
        document.body.appendChild(ghost);
        dragging.current = { chip, ghost };
      }

      if (dragStarted && dragging.current) {
        dragging.current.ghost.style.left = `${me.clientX}px`;
        dragging.current.ghost.style.top  = `${me.clientY}px`;
        const key = getPathAtPoint(me.clientX, me.clientY);
        if (key !== dragHoverRef.current) {
          if (dragHoverRef.current) restorePath(dragHoverRef.current);
          if (key) setPathColor(key, SVG_COLORS.drag);
          dragHoverRef.current = key ?? null;
        }
      }
    };

    const onUp = (ue: PointerEvent) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);

      if (!dragStarted) {
        if (!started) {
          setStarted(true);
          trackChallengeStart(challengeId);
        }
        setHoveredChipKey((prev) => (prev === chip.regionKey ? null : chip.regionKey));
        return;
      }

      if (!dragging.current) return;
      dragging.current.ghost.remove();
      const dropKey = getPathAtPoint(ue.clientX, ue.clientY);
      if (dragHoverRef.current) { restorePath(dragHoverRef.current); dragHoverRef.current = null; }
      dragging.current = null;

      if (!dropKey) return;
      handleDrop(chip, dropKey);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function handleDrop(chip: Chip, dropKey: string) {
    if (placed[dropKey]) return;

    if (dropKey === chip.regionKey) {
      const newPlaced = { ...placed, [dropKey]: chip.label };
      setPlaced(newPlaced);
      setBank((prev) => prev.filter((c) => c.regionKey !== chip.regionKey));

      // Apply placed colour immediately (no re-render needed)
      setPathColor(dropKey, SVG_COLORS.placed);

      // Pulse animation via CSS class
      const pathEl = svgRef.current?.querySelector(`#${CSS.escape(dropKey)}`);
      if (pathEl) {
        pathEl.classList.add("region-correct-pulse");
        setTimeout(() => pathEl.classList.remove("region-correct-pulse"), 750);
      }

      if (Object.keys(newPlaced).length === allChips.length) {
        setGameWon(true);
        setGlitterActive(true);
        setTimeout(() => setGlitterActive(false), 2200);
        markComplete(challengeId, allChips.length, allChips.length);
        trackChallengeComplete(challengeId, allChips.length, allChips.length);
        submitScore(allChips.length, allChips.length);
      }
    } else {
      const newLives = lives - 1;
      setLives(newLives);

      // Flash wrong region red then restore
      setPathColor(dropKey, SVG_COLORS.wrong);
      setTimeout(() => restorePath(dropKey), 600);
      setWrongKey(dropKey);
      setTimeout(() => setWrongKey(null), 600);

      if (newLives <= 0) {
        setGameLost(true);
        trackChallengeFail(challengeId);
        submitScore(Object.keys(placed).length, allChips.length);
      }
    }
  }

  async function submitScore(score: number, max: number) {
    try {
      await fetch("/api/challenges/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId, score, maxScore: max }),
      });
    } catch { /* ignore */ }
  }

  // ── Restart ───────────────────────────────────────────────────────────────────
  function restart() {
    // Reset all game region colours directly — no D3 re-render needed
    for (const key of regionKeySet) {
      setPathColor(key, SVG_COLORS.default);
    }
    setBank(shuffle(allChips));
    setPlaced({});
    setLives(STARTING_LIVES);
    setGameWon(false);
    setGameLost(false);
    setGlitterActive(false);
    mouseHoverRef.current = null;
    dragHoverRef.current = null;
    setStarted(false);
    setHoveredChipKey(null);
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  const gameOver = gameWon || gameLost;

  return (
    <div ref={containerRef} className="select-none">
      {glitterActive && <GlitterBomb />}
      {gameLost && <GameOverOverlay message="Game Over" />}

      {/* ── Pulse animation CSS ─────────────────────────────────────────── */}
      <style>{`
        @keyframes region-pulse {
          0%   { filter: brightness(1.8); }
          100% { filter: brightness(1); }
        }
        .region-correct-pulse { animation: region-pulse 0.75s ease-out; }
      `}</style>

      {/* ── Lives bar ───────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-sm text-slate-500 font-medium">Lives:</span>
        {Array.from({ length: STARTING_LIVES }, (_, i) => (
          <span key={i} className={`text-lg ${i < lives ? "opacity-100" : "opacity-20"}`}>❤️</span>
        ))}
        {gameWon && (
          <span className="ml-3 text-emerald-600 font-semibold text-sm">{dict.correct}</span>
        )}
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* ── Map ─────────────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0">
          <div className="relative rounded-2xl overflow-hidden border border-slate-700 bg-[#060e1f]">
            {/* Loading skeleton — same dark background so there's no flash */}
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
              onPointerOver={(e) => {
                if (dragging.current) return;
                let cur: Element | null = e.target as Element;
                while (cur && cur !== e.currentTarget) {
                  if (cur.id && regionKeySet.has(cur.id)) {
                    const id = cur.id;
                    if (id !== mouseHoverRef.current) {
                      if (mouseHoverRef.current) restorePath(mouseHoverRef.current);
                      if (!placed[id]) setPathColor(id, SVG_COLORS.hover);
                      mouseHoverRef.current = id;
                    }
                    return;
                  }
                  cur = cur.parentElement;
                }
              }}
              onPointerOut={(e) => {
                if (dragging.current) return;
                let cur: Element | null = e.relatedTarget as Element | null;
                while (cur) {
                  if (cur === e.currentTarget) return;
                  cur = cur.parentElement;
                }
                if (mouseHoverRef.current) { restorePath(mouseHoverRef.current); mouseHoverRef.current = null; }
              }}
              onClick={(e) => {
                if (dragging.current) return;
                const key = getPathAtPoint(e.clientX, e.clientY);
                if (!key || !placed[key]) return;
                setHoveredChipKey((prev) => (prev === key ? null : key));
              }}
            />
          </div>
        </div>

        {/* ── Chip bank ───────────────────────────────────────────────── */}
        <div className="lg:w-56 xl:w-64 flex-shrink-0">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
            Labels ({bank.length})
          </p>
          <div className="flex flex-wrap gap-2 lg:flex-col lg:flex-nowrap">
            {bank.map((chip) => (
              <div
                key={chip.regionKey}
                onPointerDown={(e) => onChipDown(e, chip)}
                className={`px-3 py-1.5 text-white text-sm font-medium rounded-lg cursor-grab active:cursor-grabbing shadow-sm select-none touch-none transition-colors ${
                  hoveredChipKey === chip.regionKey
                    ? "bg-emerald-700 ring-2 ring-emerald-400"
                    : "bg-slate-800 hover:bg-slate-700"
                }`}
              >
                {chip.label}
              </div>
            ))}
            {bank.length === 0 && !gameWon && (
              <p className="text-slate-400 text-sm italic">All placed!</p>
            )}
          </div>

          {(gameOver || bank.length === 0) && (
            <button
              onClick={restart}
              className="mt-4 w-full px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              {dict.playAgain}
            </button>
          )}
        </div>
      </div>

      {/* ── Info panel ──────────────────────────────────────────────────── */}
      {hoveredChipKey && regionsByKey[hoveredChipKey] && (
        <RegionInfoPanel
          region={regionsByKey[hoveredChipKey]}
          lang={lang}
          didYouKnow={dict.mapDidYouKnow}
          onDismiss={() => setHoveredChipKey(null)}
        />
      )}
    </div>
  );
}
