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

// ── Main component ─────────────────────────────────────────────────────────────
export default function MapChallenge({ regions, game, dict, challengeId, lang }: Props) {
  const mode = game.mapLabelMode ?? "country";
  const svgPath = game.mapSvg ?? "/maps/africa.svg";
  const pngPath = svgPath.replace(/\.svg$/i, ".png");  // visual layer

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
  const [hoverKey, setHoverKey]       = useState<string | null>(null);    // SVG path hover during drag
  const [mouseHoverKey, setMouseHoverKey] = useState<string | null>(null); // SVG path hover (idle)
  const [started, setStarted]         = useState(false);

  // SVG inline content
  const [svgContent, setSvgContent]   = useState<string | null>(null);
  const [svgReady, setSvgReady]       = useState(false);
  const svgRef                        = useRef<SVGSVGElement | null>(null);
  const containerRef                  = useRef<HTMLDivElement>(null);

  const { markComplete } = useCompletedChallenges();

  // ── Fetch SVG ────────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch(svgPath)
      .then((r) => r.text())
      .then((text) => {
        const inner = text.replace(/<\/?svg[^>]*>/gi, "").trim();
        setSvgContent(inner);
        // Wait one frame for dangerouslySetInnerHTML to flush before labels query the DOM
        requestAnimationFrame(() => setSvgReady(true));
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
    // Walk up to find path element with id
    let cur: Element | null = el;
    while (cur && cur !== svgRef.current) {
      if (cur.tagName === "path" && cur.id) return cur.id;
      cur = cur.parentElement;
    }
    return null;
  }, []);

  // ── Pointer handlers on chips ─────────────────────────────────────────────
  function onChipDown(e: React.PointerEvent, chip: Chip) {
    e.preventDefault();
    if (gameWon || gameLost) return;

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
      setHoverKey(key);
    };

    const onUp = (ue: PointerEvent) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      if (!dragging.current) return;
      dragging.current.ghost.remove();
      const dropKey = getPathAtPoint(ue.clientX, ue.clientY);
      dragging.current = null;
      setHoverKey(null);

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
    setMouseHoverKey(null);
    setStarted(false);
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
          <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-white">
            {/* PNG visual layer */}
            <img
              src={pngPath}
              alt=""
              className="w-full h-auto block"
              draggable={false}
              style={{ userSelect: "none" }}
            />
            {/* SVG hit areas — absolutely positioned over the PNG */}
            <svg
              ref={svgRef}
              viewBox={viewBox}
              className="absolute inset-0 w-full h-full"
              style={{ display: "block" }}
              onPointerOver={(e) => {
                if (dragging.current) return; // drag move handles hover during drag
                let cur: Element | null = e.target as Element;
                while (cur && cur !== e.currentTarget) {
                  if (cur.tagName === "path" && (cur as Element).id) {
                    setMouseHoverKey((cur as Element).id);
                    return;
                  }
                  cur = cur.parentElement;
                }
              }}
              onPointerOut={(e) => {
                if (dragging.current) return;
                let cur: Element | null = e.relatedTarget as Element | null;
                while (cur) {
                  if (cur === e.currentTarget) return; // still inside SVG
                  cur = cur.parentElement;
                }
                setMouseHoverKey(null);
              }}
              dangerouslySetInnerHTML={{ __html: buildSvgInner(svgContent, placed, wrongKey, hoverKey, mouseHoverKey) }}
            />
            {/* Labels for correctly placed chips */}
            <svg
              viewBox={viewBox}
              className="absolute inset-0 w-full h-full pointer-events-none"
            >
              {regions.map((r) => {
                if (!placed[r.regionKey]) return null;
                return (
                  <RegionLabel
                    key={r.regionKey}
                    regionKey={r.regionKey}
                    label={placed[r.regionKey]}
                    svgRef={svgRef}
                    viewBox={viewBox}
                    svgReady={svgReady}
                  />
                );
              })}
            </svg>
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
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Apply fill/stroke directly on each path element — no CSS classes needed */
function buildSvgInner(
  raw: string,
  placed: Record<string, string>,
  wrongKey: string | null,
  dragHoverKey: string | null,
  mouseHoverKey: string | null,
): string {
  // Strip any <style> block that would leak globally
  const noStyle = raw.replace(/<style[\s\S]*?<\/style>/gi, "");

  const paths = noStyle.replace(/<path\s+id="([^"]+)"([^>]*?)\/?>/g, (_match, id, rest) => {
    // Transparent by default — the PNG underneath shows the map
    let fill        = "transparent";
    let stroke      = "transparent";
    let strokeWidth = "0";

    if (placed[id]) {
      // Definitive correct-drop colour — solid green tint
      fill = "rgba(34,197,94,0.55)"; stroke = "#15803d"; strokeWidth = "2";
    } else if (id === wrongKey) {
      fill = "rgba(239,68,68,0.50)"; stroke = "#dc2626"; strokeWidth = "2";
    } else if (id === dragHoverKey) {
      // Drop target during drag — strong yellow highlight
      fill = "rgba(251,191,36,0.55)"; stroke = "#d97706"; strokeWidth = "2";
    } else if (id === mouseHoverKey) {
      // Idle mouse hover — subtle blue tint
      fill = "rgba(99,179,237,0.40)"; stroke = "#3b82f6"; strokeWidth = "1.5";
    }

    const cleaned = rest
      .replace(/\s+fill="[^"]*"/g, "")
      .replace(/\s+stroke="[^"]*"/g, "")
      .replace(/\s+stroke-width="[^"]*"/g, "")
      .replace(/\s+class="[^"]*"/g, "");

    return `<path id="${id}"${cleaned} fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" style="cursor:pointer;transition:fill 0.12s"/>`;
  });

  return paths;
}

/** Render a text label centred on the path's bounding box */
function RegionLabel({
  regionKey, label, svgRef, viewBox, svgReady,
}: {
  regionKey: string; label: string; svgRef: React.RefObject<SVGSVGElement | null>; viewBox: string; svgReady: boolean;
}) {
  const [center, setCenter] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!svgReady || !svgRef.current) return;
    const path = svgRef.current.querySelector<SVGGeometryElement>(`#${CSS.escape(regionKey)}`);
    if (!path) return;

    const svgEl  = svgRef.current;
    const svgBox = svgEl.getBoundingClientRect();
    const pBox   = path.getBoundingClientRect();

    if (svgBox.width === 0) return;

    // Convert pixel position to viewBox coordinates
    const [vbMinX, vbMinY, vbWidth, vbHeight] = viewBox.split(" ").map(Number);
    const scaleX = vbWidth  / svgBox.width;
    const scaleY = vbHeight / svgBox.height;

    const cx = vbMinX + (pBox.left + pBox.width  / 2 - svgBox.left) * scaleX;
    const cy = vbMinY + (pBox.top  + pBox.height / 2 - svgBox.top)  * scaleY;
    setCenter({ x: cx, y: cy });
  }, [regionKey, svgRef, viewBox, svgReady]);

  if (!center) return null;

  return (
    <>
      <text
        x={center.x}
        y={center.y}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="9"
        fontWeight="700"
        fill="white"
        stroke="#166534"
        strokeWidth="3"
        paintOrder="stroke"
        style={{ pointerEvents: "none", userSelect: "none" }}
      >
        {label}
      </text>
    </>
  );
}
