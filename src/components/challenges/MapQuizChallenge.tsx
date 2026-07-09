"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { geoMercator, geoPath, geoGraticule } from "d3-geo";
import type { Dictionary } from "@/i18n/en";
import type { MapRegion, ChallengeGame } from "@/data/challengeGame";
import { useCompletedChallenges } from "@/hooks/useCompletedChallenges";
import { trackChallengeStart, trackChallengeComplete, trackChallengeFail } from "@/lib/gtag";
import ParkInfographPanel from "./ParkInfographPanel";

interface Props {
  regions: MapRegion[];
  game: ChallengeGame;
  dict: Dictionary["challenges"];
  challengeId: string;
  lang: string;
}

interface GeoFeature {
  type: "Feature";
  geometry: { type: string; coordinates: unknown } | null;
  properties: { iso_a2: string; iso_a2_eh?: string; name: string } | null;
}

const STARTING_LIVES = 5;
const VW = 960;
const VH = 600;

const SVG_COLORS = {
  default: { fill: "#c8d8b4", stroke: "#6b7c52", sw: "0.5" },
  active:  { fill: "#fbbf24", stroke: "#d97706", sw: "1.5" },
  placed:  { fill: "#4ade80", stroke: "#15803d", sw: "0.8" },
  wrong:   { fill: "#f87171", stroke: "#dc2626", sw: "0.8" },
} as const;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Glitter bomb ───────────────────────────────────────────────────────────────
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

// ── Inline info panel for regions without full infographData ───────────────────
function RegionInfoPanel({
  region,
  lang,
  didYouKnow,
  onNext,
}: {
  region: MapRegion;
  lang: string;
  didYouKnow: string;
  onNext: () => void;
}) {
  const image = lang === "nl" ? (region.infoImageNl ?? region.infoImageEn) : region.infoImageEn;
  const text  = lang === "nl" ? (region.infoTextNl  ?? region.infoTextEn)  : region.infoTextEn;
  const name  = lang === "nl" ? region.labelNl : region.labelEn;

  return (
    <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[100] w-[min(480px,90vw)] rounded-2xl border border-emerald-300/60 overflow-hidden animate-pop-in shadow-2xl backdrop-blur-md bg-white/75">
      <div className="flex items-center justify-between px-4 py-2 bg-emerald-100/80 border-b border-emerald-200/60">
        <span className="text-sm font-semibold text-emerald-900">{name}</span>
        <button
          onClick={onNext}
          aria-label="Next"
          className="text-emerald-700 hover:text-emerald-900 text-lg leading-none"
        >
          ×
        </button>
      </div>
      <div className="flex flex-col sm:flex-row gap-4 p-4">
        {image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt={name}
            className="flex-shrink-0 w-full sm:w-40 h-28 rounded-xl object-cover"
          />
        )}
        {text && (
          <div className="flex-1">
            <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-1">{didYouKnow}</p>
            <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-line">{text}</p>
          </div>
        )}
      </div>
      <div className="px-4 pb-4 flex justify-end">
        <button
          onClick={onNext}
          className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          Next →
        </button>
      </div>
    </div>
  );
}

// ── ParkInfoPanel wrapper that adds a "Next →" footer ─────────────────────────
function ParkInfoWithNext({
  region,
  lang,
  onNext,
}: {
  region: MapRegion;
  lang: string;
  onNext: () => void;
}) {
  return (
    <>
      <ParkInfographPanel region={region} lang={lang} onDismiss={onNext} />
    </>
  );
}

type Phase = "question" | "revealed" | "info" | "won" | "lost";
type OptionState = "idle" | "correct" | "wrong";

// ── Main component ─────────────────────────────────────────────────────────────
export default function MapQuizChallenge({ regions, game, dict, challengeId, lang }: Props) {
  const queue = useMemo(() => shuffle(regions), [regions]);

  const [qIndex, setQIndex]         = useState(0);
  const [answered, setAnswered]     = useState<Set<string>>(() => new Set());
  const [lives, setLives]           = useState(STARTING_LIVES);
  const [phase, setPhase]           = useState<Phase>("question");
  const [optionStates, setOptionStates] = useState<OptionState[]>(["idle","idle","idle"]);
  const [glitterActive, setGlitterActive] = useState(false);
  const [geoReady, setGeoReady]     = useState(false);
  const [started, setStarted]       = useState(false);

  const svgRef      = useRef<SVGSVGElement | null>(null);
  const regionKeySet = useMemo(() => new Set(regions.map((r) => r.regionKey.trim())), [regions]);
  const answeredRef  = useRef(answered);
  useEffect(() => { answeredRef.current = answered; }, [answered]);

  const { markComplete } = useCompletedChallenges();

  const currentRegion = queue[qIndex] ?? null;

  // ── 3 options for current question ────────────────────────────────────────────
  const options = useMemo(() => {
    if (!currentRegion) return [];
    const correctLabel = lang === "nl" ? currentRegion.labelNl : currentRegion.labelEn;
    const pool = regions
      .filter((r) => r.regionKey.trim() !== currentRegion.regionKey.trim())
      .map((r) => (lang === "nl" ? r.labelNl : r.labelEn));
    const wrong = shuffle(pool).slice(0, 2);
    return shuffle([correctLabel, ...wrong]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qIndex, regions, lang]);

  const correctLabel = currentRegion
    ? (lang === "nl" ? currentRegion.labelNl : currentRegion.labelEn)
    : "";

  // ── Helper: set SVG path colour ───────────────────────────────────────────────
  function setPathColor(id: string, c: { fill: string; stroke: string; sw: string }) {
    const el = svgRef.current?.querySelector<SVGElement>(`#${CSS.escape(id)}`);
    if (!el) return;
    el.setAttribute("fill", c.fill);
    el.setAttribute("stroke", c.stroke);
    el.setAttribute("stroke-width", c.sw);
  }

  // ── Sync region colours whenever question or answered set changes ─────────────
  useEffect(() => {
    if (!geoReady || !currentRegion) return;
    for (const key of regionKeySet) {
      if (answeredRef.current.has(key)) {
        setPathColor(key, SVG_COLORS.placed);
      } else if (key === currentRegion.regionKey.trim()) {
        setPathColor(key, SVG_COLORS.active);
      } else {
        setPathColor(key, SVG_COLORS.default);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geoReady, qIndex, answered]);

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

    mapGroup.style.transition = "transform 1s ease-in-out";
    mapGroup.style.transformOrigin = "0 0";
    mapGroup.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
  }

  function resetZoom() {
    const mapGroup = svgRef.current?.querySelector<SVGGElement>("#mq-map-group");
    if (!mapGroup) return;
    mapGroup.style.transition = "transform 0.7s ease-in-out";
    mapGroup.style.transformOrigin = "0 0";
    mapGroup.style.transform = "translate(0px, 0px) scale(1)";
  }

  // ── Answer handler ────────────────────────────────────────────────────────────
  function handleAnswer(label: string, idx: number) {
    if (phase !== "question" || !currentRegion) return;

    if (!started) {
      setStarted(true);
      trackChallengeStart(challengeId);
    }

    if (label === correctLabel) {
      const next = ["idle","idle","idle"] as OptionState[];
      next[idx] = "correct";
      setOptionStates(next);
      setPhase("revealed");

      const key = currentRegion.regionKey.trim();
      setPathColor(key, SVG_COLORS.placed);

      setTimeout(() => zoomToRegion(key), 500);
      setTimeout(() => setPhase("info"), 1400);
    } else {
      const next = [...optionStates] as OptionState[];
      next[idx] = "wrong";
      setOptionStates(next);

      const newLives = lives - 1;
      setLives(newLives);

      setTimeout(() => {
        setOptionStates(["idle","idle","idle"]);
      }, 600);

      if (newLives <= 0) {
        setPhase("lost");
        trackChallengeFail(challengeId);
        submitScore(answered.size, queue.length);
      }
    }
  }

  // ── Advance to next question ──────────────────────────────────────────────────
  function handleNext() {
    if (!currentRegion) return;
    const key = currentRegion.regionKey.trim();
    const newAnswered = new Set(answered);
    newAnswered.add(key);
    setAnswered(newAnswered);

    resetZoom();
    setOptionStates(["idle","idle","idle"]);

    const nextIndex = qIndex + 1;
    if (nextIndex >= queue.length) {
      setPhase("won");
      setGlitterActive(true);
      setTimeout(() => setGlitterActive(false), 2200);
      markComplete(challengeId, queue.length, queue.length);
      trackChallengeComplete(challengeId, queue.length, queue.length);
      submitScore(queue.length, queue.length);
    } else {
      setQIndex(nextIndex);
      setPhase("question");
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

  function restart() {
    setQIndex(0);
    setAnswered(new Set());
    setLives(STARTING_LIVES);
    setPhase("question");
    setOptionStates(["idle","idle","idle"]);
    setGlitterActive(false);
    setStarted(false);
    resetZoom();
  }

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
    function renderMap(el: SVGSVGElement, bgFeatures: any[], gameFeatures: any[], getKey: (f: any) => string, padding: number, bgFill = "#3a7a4a", directProject = false) {
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

      const projection = geoMercator().fitExtent(
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
          const w = 13, h = 18;
          const d = `M${cx},${cy + h * 0.45} L${cx - w},${cy - h * 0.55} L${cx + w},${cy - h * 0.55} Z`;
          mkSvg("path", {
            id: key, d,
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
    };
    const bgIso = (mapSvg: string): Set<string> => {
      if (mapSvg.includes("africa"))        return BG_ISO.africa;
      if (mapSvg.includes("south_america")) return BG_ISO.south_america;
      return BG_ISO.north_america;
    };

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
        renderMap(svgEl, bgFeatures, gameFeatures, getKey, 40, "#3a7a4a", true);
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

  // ── Render ────────────────────────────────────────────────────────────────────
  const gameOver = phase === "won" || phase === "lost";

  return (
    <div className="select-none">
      {glitterActive && <GlitterBomb />}
      {phase === "lost" && <GameOverOverlay message="Game Over" />}

      {/* Lives bar */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-sm text-slate-500 font-medium">Lives:</span>
        {Array.from({ length: STARTING_LIVES }, (_, i) => (
          <span key={i} className={`text-lg ${i < lives ? "opacity-100" : "opacity-20"}`}>❤️</span>
        ))}
        {phase === "won" && (
          <span className="ml-3 text-emerald-600 font-semibold text-sm">{dict.correct}</span>
        )}
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Map */}
        <div className="flex-1 min-w-0">
          <div className="relative rounded-2xl overflow-hidden border border-slate-700 bg-[#060e1f]">
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
        </div>

        {/* Answer panel */}
        <div className="lg:w-64 xl:w-72 flex-shrink-0 flex flex-col gap-3">
          {phase === "question" || phase === "revealed" ? (
            <>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                Where is this?
              </p>
              <div className="flex flex-col gap-2">
                {options.map((label, idx) => {
                  const state = optionStates[idx];
                  let cls = "bg-slate-800 hover:bg-slate-700 text-white";
                  if (state === "correct") cls = "bg-emerald-600 text-white";
                  if (state === "wrong")   cls = "bg-red-500 text-white";
                  return (
                    <button
                      key={label}
                      onClick={() => handleAnswer(label, idx)}
                      disabled={phase !== "question"}
                      className={`w-full px-4 py-3 text-sm font-medium rounded-xl transition-colors text-left shadow-sm ${cls} disabled:cursor-default`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </>
          ) : null}

          {gameOver && (
            <button
              onClick={restart}
              className="mt-2 w-full px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              {dict.playAgain}
            </button>
          )}
        </div>
      </div>

      {/* Info panel — shown after correct answer zoom */}
      {phase === "info" && currentRegion && (
        currentRegion.infographData ? (
          <ParkInfoWithNext region={currentRegion} lang={lang} onNext={handleNext} />
        ) : (currentRegion.infoImageEn || currentRegion.infoTextEn) ? (
          <RegionInfoPanel
            region={currentRegion}
            lang={lang}
            didYouKnow={dict.mapDidYouKnow}
            onNext={handleNext}
          />
        ) : (
          // No info content — just advance automatically after a beat
          (() => { setTimeout(handleNext, 800); return null; })()
        )
      )}
    </div>
  );
}
