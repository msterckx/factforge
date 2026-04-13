"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
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

const STARTING_LIVES = 5;

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
  // Close on Escape
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

// ── Info panel shown on chip hover ────────────────────────────────────────────
function RegionInfoPanel({
  region,
  lang,
  didYouKnow,
}: {
  region: MapRegion;
  lang: string;
  didYouKnow: string;
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
      <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 overflow-hidden animate-fade-in">
        <div className="px-4 py-2 bg-emerald-100 border-b border-emerald-200">
          <span className="text-sm font-semibold text-emerald-800">{name}</span>
        </div>
        <div className="flex flex-col sm:flex-row gap-4 p-4">
          {image && (
            <button
              onClick={() => setLightboxOpen(true)}
              className="flex-shrink-0 w-full sm:w-48 h-36 rounded-xl overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 group"
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
              <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide mb-1">{didYouKnow}</p>
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">{text}</p>
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
  const svgPath = game.mapSvg ?? "/maps/africa.svg";

  // Build chips from regions
  const allChips = useMemo<Chip[]>(() => {
    return regions.map((r) => {
      let label: string;
      if (mode === "capital") {
        label = lang === "nl" ? (r.capitalNl ?? r.capitalEn ?? r.labelEn) : (r.capitalEn ?? r.labelEn);
      } else {
        label = lang === "nl" ? r.labelNl : r.labelEn;
      }
      return { regionKey: r.regionKey, label };
    });
  }, [regions, mode, lang]);

  const [bank, setBank]               = useState<Chip[]>(() => shuffle(allChips));
  const [placed, setPlaced]           = useState<Record<string, string>>({}); // regionKey → label
  const [lives, setLives]             = useState(STARTING_LIVES);
  const [gameWon, setGameWon]         = useState(false);
  const [gameLost, setGameLost]       = useState(false);
  const [glitterActive, setGlitterActive] = useState(false);
  const [wrongKey, setWrongKey]       = useState<string | null>(null);    // briefly flash red
  const [started, setStarted]         = useState(false);
  const [hoveredChipKey, setHoveredChipKey] = useState<string | null>(null);
  const [justPlacedKey, setJustPlacedKey]   = useState<string | null>(null); // triggers pulse anim

  // Lookup map for quick access by regionKey
  const regionsByKey = useMemo(() => {
    const map: Record<string, MapRegion> = {};
    for (const r of regions) map[r.regionKey] = r;
    return map;
  }, [regions]);

  // Set of valid drop-target IDs — only these get colored/hovered
  const regionKeySet = useMemo(() => new Set(allChips.map((c) => c.regionKey)), [allChips]);

  // Hover tracked as refs — direct DOM manipulation avoids re-rendering 62 paths on every move
  const mouseHoverRef = useRef<string | null>(null);
  const dragHoverRef  = useRef<string | null>(null);

  // SVG inline content
  const [svgContent, setSvgContent]   = useState<string | null>(null);
  const svgRef                        = useRef<SVGSVGElement | null>(null);
  const containerRef                  = useRef<HTMLDivElement>(null);

  const { markComplete } = useCompletedChallenges();

  // ── Direct DOM colour helpers (bypass React re-render for hover) ─────────────
  const SVG_COLORS = {
    default: { fill: "#c8d8b4", stroke: "#6b7c52", sw: "0.4" },
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
    setPathColor(id, placed[id] ? SVG_COLORS.placed : SVG_COLORS.default);
  }

  // After dangerouslySetInnerHTML re-renders (placed/wrongKey change), re-apply hover
  useEffect(() => {
    if (mouseHoverRef.current) setPathColor(mouseHoverRef.current, SVG_COLORS.hover);
    if (dragHoverRef.current)  setPathColor(dragHoverRef.current,  SVG_COLORS.drag);
  }); // runs after every render

  // ── Fetch SVG ────────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch(svgPath)
      .then((r) => r.text())
      .then((text) => {
        const inner = text.replace(/<\/?svg[^>]*>/gi, "").trim();
        setSvgContent(rewriteInkscapeLabels(inner));
      })
      .catch(console.error);
  }, [svgPath]);

  // Extract viewBox from fetched SVG text
  const [viewBox, setViewBox] = useState("0 0 239.05701 217.31789");
  useEffect(() => {
    if (!svgContent) return;
    fetch(svgPath)
      .then((r) => r.text())
      .then((text) => {
        const vbMatch = text.match(/viewBox="([^"]+)"/);
        if (vbMatch) {
          setViewBox(vbMatch[1]);
        } else {
          // Fall back to width/height attributes (e.g. Inkscape SVGs)
          const wMatch = text.match(/\bwidth="([^"a-z%]+)"/);
          const hMatch = text.match(/\bheight="([^"a-z%]+)"/);
          if (wMatch && hMatch) {
            setViewBox(`0 0 ${parseFloat(wMatch[1])} ${parseFloat(hMatch[1])}`);
          }
        }
      });
  }, [svgContent, svgPath]);

  // ── Drag state ───────────────────────────────────────────────────────────────
  const dragging     = useRef<{ chip: Chip; ghost: HTMLDivElement } | null>(null);

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

  // ── Pointer handlers on chips ─────────────────────────────────────────────
  function onChipDown(e: React.PointerEvent, chip: Chip) {
    e.preventDefault();
    if (gameWon || gameLost) return;
    setHoveredChipKey(null); // hide info panel while dragging

    if (!started) {
      setStarted(true);
      trackChallengeStart(challengeId);
    }

    // Build ghost
    const ghost = document.createElement("div");
    ghost.textContent = chip.label;
    ghost.style.cssText = `
      position: fixed; z-index: 9999; pointer-events: none;
      padding: 6px 12px; border-radius: 8px; font-size: 13px; font-weight: 600;
      background: #1e293b; color: #f8fafc; white-space: nowrap;
      box-shadow: 0 4px 12px rgba(0,0,0,0.35); opacity: 0.95;
      transform: translate(-50%,-50%);
      left: ${e.clientX}px; top: ${e.clientY}px;
    `;
    document.body.appendChild(ghost);
    dragging.current = { chip, ghost };

    const onMove = (me: PointerEvent) => {
      if (!dragging.current) return;
      dragging.current.ghost.style.left = `${me.clientX}px`;
      dragging.current.ghost.style.top  = `${me.clientY}px`;
      const key = getPathAtPoint(me.clientX, me.clientY);
      if (key !== dragHoverRef.current) {
        if (dragHoverRef.current) restorePath(dragHoverRef.current);
        if (key) setPathColor(key, SVG_COLORS.drag);
        dragHoverRef.current = key;
      }
    };

    const onUp = (ue: PointerEvent) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
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
    // Already correctly placed
    if (placed[dropKey]) return;

    if (dropKey === chip.regionKey) {
      // Correct!
      const newPlaced = { ...placed, [dropKey]: chip.label };
      setPlaced(newPlaced);
      setBank((prev) => prev.filter((c) => c.regionKey !== chip.regionKey));
      // Pulse animation on the circle/path
      setJustPlacedKey(chip.regionKey);
      setTimeout(() => setJustPlacedKey(null), 750);

      if (Object.keys(newPlaced).length === allChips.length) {
        setGameWon(true);
        setGlitterActive(true);
        setTimeout(() => setGlitterActive(false), 2200);
        markComplete(challengeId, allChips.length, allChips.length);
        trackChallengeComplete(challengeId, allChips.length, allChips.length);
        submitScore(allChips.length, allChips.length);
      }
    } else {
      // Wrong
      const newLives = lives - 1;
      setLives(newLives);
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

  // ── Restart ──────────────────────────────────────────────────────────────────
  function restart() {
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
    setJustPlacedKey(null);
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  if (!svgContent) {
    return <div className="text-center py-20 text-slate-400">Loading map…</div>;
  }

  const gameOver = gameWon || gameLost;

  return (
    <div ref={containerRef} className="select-none">
      {glitterActive && <GlitterBomb />}
      {gameLost && <GameOverOverlay message="Game Over" />}

      {/* ── Lives bar ─────────────────────────────────────────────────────── */}
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
        {/* ── SVG map ────────────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0">
          <div className={svgPath.includes("south_america") ? "max-w-[90%]" : undefined}>
          <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-700">
            <svg
              ref={svgRef}
              viewBox={viewBox}
              className="w-full h-auto block"
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
              dangerouslySetInnerHTML={{ __html: buildSvgInner(svgContent, placed, wrongKey, regionKeySet, justPlacedKey) }}
            />
          </div>
          </div>
        </div>

        {/* ── Chip bank ──────────────────────────────────────────────────── */}
        <div className="lg:w-56 xl:w-64 flex-shrink-0">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
            Labels ({bank.length})
          </p>
          <div className="flex flex-wrap gap-2 lg:flex-col lg:flex-nowrap">
            {bank.map((chip) => (
              <div
                key={chip.regionKey}
                onPointerDown={(e) => onChipDown(e, chip)}
                onMouseEnter={() => setHoveredChipKey(chip.regionKey)}
                onMouseLeave={() => setHoveredChipKey(null)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium rounded-lg cursor-grab active:cursor-grabbing shadow-sm select-none touch-none"
              >
                {chip.label}
              </div>
            ))}
            {bank.length === 0 && !gameWon && (
              <p className="text-slate-400 text-sm italic">All placed!</p>
            )}
          </div>

          {/* Restart */}
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

      {/* ── Info panel (shown while hovering a chip) ──────────────────── */}
      {hoveredChipKey && regionsByKey[hoveredChipKey] && (
        <RegionInfoPanel
          region={regionsByKey[hoveredChipKey]}
          lang={lang}
          didYouKnow={dict.mapDidYouKnow}
        />
      )}
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * When Inkscape duplicates a circle it keeps the original id and puts the
 * real name in inkscape:label. Rewrite the id to match the label so that
 * region keys can be set from the label value directly.
 */
function rewriteInkscapeLabels(svgInner: string): string {
  return svgInner.replace(/<circle([\s\S]*?)\/>/g, (_match, attrs) => {
    const labelMatch = attrs.match(/inkscape:label="([^"]+)"/);
    if (!labelMatch) return _match;
    const label = labelMatch[1].trim();
    if (!label) return _match;
    // Replace whatever id= is there with the label value
    const newAttrs = attrs.replace(/\bid="[^"]*"/, `id="${label}"`);
    return `<circle${newAttrs}/>`;
  });
}

/**
 * Apply game colours only to elements whose IDs are in regionKeySet.
 * Background paths (country shapes etc.) are left completely unchanged.
 * Circle elements (point markers) are handled alongside paths.
 */
function buildSvgInner(
  raw: string,
  placed: Record<string, string>,
  wrongKey: string | null,
  regionKeySet: Set<string>,
  justPlacedKey: string | null = null,
): string {
  // Strip any <style> block that would leak globally
  const noStyle = raw.replace(/<style[\s\S]*?<\/style>/gi, "");

  function gameColors(id: string, isCircle: boolean) {
    if (placed[id])       return { fill: "#4ade80", stroke: "#15803d", sw: isCircle ? "2" : "0.8" };
    if (id === wrongKey)  return { fill: "#f87171", stroke: "#dc2626", sw: isCircle ? "2" : "0.8" };
    if (isCircle)         return { fill: "#fbbf24", stroke: "#d97706", sw: "2" };   // amber dot = unplaced target
    return                       { fill: "#c8d8b4", stroke: "#6b7c52", sw: "0.4" }; // soft green = unplaced country
  }

  function applyColors(tag: string, attrs: string): string {
    const idMatch = attrs.match(/\bid="([^"]+)"/);
    const isGameElement = idMatch && regionKeySet.has(idMatch[1]);

    // Non-game circles (decorative): leave completely unchanged
    if (tag === "circle" && !isGameElement) return `<${tag}${attrs}/>`;

    const cleaned = attrs
      .replace(/\s*fill="[^"]*"/g, "")
      .replace(/\s*stroke="[^"]*"/g, "")
      .replace(/\s*stroke-width="[^"]*"/g, "")
      .replace(/\s*class="[^"]*"/g, "")
      .replace(/\s*style="[^"]*"/g, "");

    if (!isGameElement) {
      // Background country path — render in the same green as before
      return `<path${cleaned} fill="#c8d8b4" stroke="#6b7c52" stroke-width="0.4"/>`;
    }

    const id = idMatch[1];
    const isCircle = tag === "circle";
    const { fill, stroke, sw } = gameColors(id, isCircle);
    // Boost circle radius so small dots are actually clickable
    const radiusAttr = isCircle
      ? ` r="4"` + cleaned.replace(/\s*\br="[^"]*"/g, "")
      : cleaned;
    // Pulse animation class for just-placed elements
    const pulseClass = id === justPlacedKey ? ` class="circle-correct-pulse"` : "";
    return `<${tag}${radiusAttr}${pulseClass} fill="${fill}" stroke="${stroke}" stroke-width="${sw}" style="cursor:pointer"/>`;
  }

  return noStyle
    .replace(/<path([\s\S]*?)\/>/g,   (_m, attrs) => applyColors("path",   attrs))
    .replace(/<circle([\s\S]*?)\/>/g, (_m, attrs) => applyColors("circle", attrs));
}

