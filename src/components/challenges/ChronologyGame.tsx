"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import type { ChronologyItem } from "@/types/chronology";
import type { Dictionary } from "@/i18n/en";
import { useCompletedChallenges } from "@/hooks/useCompletedChallenges";
import { trackChallengeStart, trackChallengeComplete, trackChallengeFail } from "@/lib/gtag";
import { resolveImageUrl } from "@/lib/imageUrl";
import PersonInfographPanel, { type PersonInfographData } from "@/components/challenges/PersonInfographPanel";

interface Props {
  items: ChronologyItem[];
  dict: Dictionary["challenges"];
  challengeId: string;
  startingLives?: number;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Glitter bomb overlay ──────────────────────────────────────────────────────
const COLORS = ["#fbbf24", "#4ade80", "#f59e0b", "#86efac", "#fde68a", "#a3e635", "#34d399", "#fcd34d"];
const SHAPES = ["50%", "0%", "2px"];

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
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      radius: SHAPES[Math.floor(Math.random() * SHAPES.length)],
      delay: Math.random() * 0.4,
      duration: 0.9 + Math.random() * 0.8,
      dx: (Math.random() - 0.5) * 260,
      dy: -(80 + Math.random() * 180),
      rot: (Math.random() - 0.5) * 720,
    }))
  , []);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-xl z-30">
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
            animationName: "glitterFly",
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
            animationTimingFunction: "ease-out",
            animationFillMode: "forwards",
            ["--dx" as string]: `${p.dx}px`,
            ["--dy" as string]: `${p.dy}px`,
            ["--rot" as string]: `${p.rot}deg`,
          }}
        />
      ))}
    </div>
  );
}

// ── Game Over overlay ─────────────────────────────────────────────────────────
function GameOverOverlay() {
  return (
    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center rounded-xl overflow-hidden">
      <div
        className="absolute inset-0 bg-red-950/75"
        style={{ animation: "gameOverFade 0.35s ease-out forwards" }}
      />
      <div className="relative z-10 text-center px-4">
        <p className="text-5xl mb-3" style={{ animation: "gameOverBounce 0.5s ease-out forwards" }}>
          💔
        </p>
        <p
          className="text-white font-bold text-xl tracking-wide"
          style={{ animation: "gameOverSlideUp 0.35s ease-out 0.1s both" }}
        >
          Game Over
        </p>
        <p
          className="text-red-300 text-sm mt-1"
          style={{ animation: "gameOverSlideUp 0.35s ease-out 0.2s both" }}
        >
          No lives remaining
        </p>
      </div>
    </div>
  );
}

// ── Lives display ─────────────────────────────────────────────────────────────
function Lives({ current, max }: { current: number; max: number }) {
  return (
    <div className="flex items-center gap-0.5 sm:gap-1">
      {Array.from({ length: max }, (_, i) => (
        <span
          key={i}
          className={`text-sm sm:text-base transition-all duration-300 ${
            i < current ? "text-red-500" : "text-slate-200"
          }`}
          style={i >= current ? { filter: "grayscale(1)" } : undefined}
        >
          ♥
        </span>
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ChronologyGame({ items, dict, challengeId, startingLives = 5 }: Props) {
  const maxLives = Math.max(1, startingLives);
  const { markComplete } = useCompletedChallenges();

  const [placed, setPlaced] = useState<Record<number, ChronologyItem>>({});
  const [resetKey, setResetKey] = useState(0);
  const [selectedItem, setSelectedItem] = useState<ChronologyItem | null>(null);
  const [infographItem, setInfographItem] = useState<{ name: string; data: PersonInfographData } | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<number | null>(null);
  const [wrongSlot, setWrongSlot] = useState<number | null>(null);
  const [glitterActive, setGlitterActive] = useState(false);
  const [wrongAttempts, setWrongAttempts] = useState(0);
  const [playerPlaced, setPlayerPlaced] = useState(0);
  const [scoreSubmitted, setScoreSubmitted] = useState(false);
  const [lives, setLives] = useState(maxLives);
  const [hintedSlots, setHintedSlots] = useState<Set<number>>(new Set());
  const [gameOver, setGameOver] = useState(false);
  const [hoveredOptionId, setHoveredOptionId] = useState<number | null>(null);

  // Stable shuffled order for the options panel; re-shuffles on reset via resetKey
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const shuffledOptions = useMemo(() => shuffle([...items]), [resetKey]);

  const placedIds = useMemo(
    () => new Set(Object.values(placed).map((p) => p.id)),
    [placed]
  );
  const availableItems = shuffledOptions.filter((item) => !placedIds.has(item.id));

  // Pointer drag state
  const dragItem   = useRef<ChronologyItem | null>(null);
  const dragStart  = useRef<{ x: number; y: number } | null>(null);
  const isDragging = useRef(false);
  const ghostRef   = useRef<HTMLDivElement | null>(null);

  const placedCount  = Object.keys(placed).length;
  const allCorrect   = placedCount === items.length && !gameOver;
  const maxScore     = items.length * 10;
  const currentScore = Math.max(0, playerPlaced * 10 - wrongAttempts * 2);

  useEffect(() => { trackChallengeStart(challengeId); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (allCorrect) {
      setGlitterActive(true);
      const t = setTimeout(() => setGlitterActive(false), 2200);
      return () => clearTimeout(t);
    }
  }, [allCorrect]);

  useEffect(() => {
    if ((allCorrect || gameOver) && !scoreSubmitted) {
      setScoreSubmitted(true);
      if (allCorrect) {
        markComplete(challengeId, currentScore, maxScore);
        trackChallengeComplete(challengeId, currentScore, maxScore);
      } else {
        trackChallengeFail(challengeId);
      }
      fetch("/api/challenges/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId, score: currentScore, maxScore }),
      }).catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allCorrect, gameOver]);

  // ── Infograph ─────────────────────────────────────────────────────────────
  function openInfograph(item: ChronologyItem) {
    if (!item.infographData) return;
    try {
      const data = JSON.parse(item.infographData) as PersonInfographData;
      setInfographItem({ name: item.name, data });
    } catch { /* ignore parse errors */ }
  }

  // ── Core placement logic ──────────────────────────────────────────────────
  function tryPlace(item: ChronologyItem, slotIndex: number) {
    if (placed[slotIndex] !== undefined || gameOver || allCorrect) return;
    if (item.id === items[slotIndex].id) {
      setPlaced((prev) => ({ ...prev, [slotIndex]: item }));
      setSelectedItem(null);
      setPlayerPlaced((p) => p + 1);
    } else {
      const newLives = lives - 1;
      setLives(newLives);
      setWrongAttempts((w) => w + 1);
      setWrongSlot(slotIndex);
      setTimeout(() => setWrongSlot(null), 600);
      setSelectedItem(null);
      if (newLives <= 0) setGameOver(true);
    }
  }

  // ── Reveal next tile (costs 2 lives) ─────────────────────────────────────
  function handleRevealNext() {
    if (gameOver || allCorrect || lives < 2 || availableItems.length === 0) return;
    const item = items[placedCount];
    if (!item) return;
    const isLastItem = placedCount + 1 === items.length;
    setPlaced((prev) => ({ ...prev, [placedCount]: item }));
    setHintedSlots((prev) => { const s = new Set(prev); s.add(placedCount); return s; });
    setSelectedItem(null);
    const newLives = Math.max(0, lives - 2);
    setLives(newLives);
    if (newLives === 0 && !isLastItem) setGameOver(true);
  }

  // ── Ghost helper ──────────────────────────────────────────────────────────
  function createGhost(name: string, x: number, y: number) {
    const el = document.createElement("div");
    Object.assign(el.style, {
      position: "fixed",
      left: `${x - 60}px`,
      top: `${y - 22}px`,
      zIndex: "9999",
      pointerEvents: "none",
      background: "#fef3c7",
      border: "2px solid #f59e0b",
      borderRadius: "9999px",
      padding: "6px 14px",
      fontSize: "14px",
      fontWeight: "600",
      color: "#92400e",
      whiteSpace: "nowrap",
      boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
      userSelect: "none",
    });
    el.textContent = name;
    document.body.appendChild(el);
    ghostRef.current = el;
  }

  function moveGhost(x: number, y: number) {
    if (ghostRef.current) {
      ghostRef.current.style.left = `${x - 60}px`;
      ghostRef.current.style.top = `${y - 22}px`;
    }
  }

  function removeGhost() {
    if (ghostRef.current) {
      document.body.removeChild(ghostRef.current);
      ghostRef.current = null;
    }
  }

  function slotUnderPoint(x: number, y: number): number | null {
    if (ghostRef.current) ghostRef.current.style.display = "none";
    const el = document.elementFromPoint(x, y);
    if (ghostRef.current) ghostRef.current.style.display = "";
    const slotEl = el?.closest("[data-slot]");
    if (!slotEl) return null;
    const idx = parseInt(slotEl.getAttribute("data-slot") ?? "-1");
    return idx >= 0 ? idx : null;
  }

  // ── Pointer events ────────────────────────────────────────────────────────
  function handleChipPointerDown(e: React.PointerEvent, item: ChronologyItem) {
    if (gameOver || allCorrect) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragItem.current = item;
    dragStart.current = { x: e.clientX, y: e.clientY };
    isDragging.current = false;
  }

  function handleChipPointerMove(e: React.PointerEvent) {
    if (!dragItem.current || !dragStart.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;

    if (!isDragging.current && Math.sqrt(dx * dx + dy * dy) > 8) {
      isDragging.current = true;
      setSelectedItem(null);
      createGhost(dragItem.current.name, e.clientX, e.clientY);
    }

    if (isDragging.current) {
      moveGhost(e.clientX, e.clientY);
      setDragOverSlot(slotUnderPoint(e.clientX, e.clientY));
    }
  }

  function handleChipPointerUp(e: React.PointerEvent) {
    if (!dragItem.current) return;

    if (isDragging.current) {
      const idx = slotUnderPoint(e.clientX, e.clientY);
      removeGhost();
      setDragOverSlot(null);
      if (idx !== null) tryPlace(dragItem.current, idx);
    } else {
      const tapped = dragItem.current;
      const isAlreadySelected = selectedItem?.id === tapped.id;
      setSelectedItem(isAlreadySelected ? null : tapped);
    }

    dragItem.current = null;
    dragStart.current = null;
    isDragging.current = false;
  }

  function handleChipPointerCancel() {
    removeGhost();
    setDragOverSlot(null);
    dragItem.current = null;
    dragStart.current = null;
    isDragging.current = false;
  }

  // ── Reset ─────────────────────────────────────────────────────────────────
  function handleReset() {
    setPlaced({});
    setSelectedItem(null);
    setInfographItem(null);
    setWrongSlot(null);
    setGlitterActive(false);
    setWrongAttempts(0);
    setPlayerPlaced(0);
    setScoreSubmitted(false);
    setLives(maxLives);
    setHintedSlots(new Set());
    setGameOver(false);
    setHoveredOptionId(null);
    setResetKey((k) => k + 1);
    removeGhost();
    dragItem.current = null;
    isDragging.current = false;
  }

  // ── Hot/cold helper ───────────────────────────────────────────────────────
  function tempEmoji(item: ChronologyItem): string {
    const correctSlot = items.findIndex((x) => x.id === item.id);
    const diff = Math.abs(correctSlot - placedCount);
    if (diff === 0) return "🔥";
    if (diff === 1) return "♨️";
    if (diff <= 3) return "🌡️";
    return "❄️";
  }

  return (
    <div className="overflow-x-hidden">
      <style>{`
        @keyframes caesarPop {
          0%   { transform: scale(1); }
          35%  { transform: scale(1.08); }
          100% { transform: scale(1); }
        }
        @keyframes wrongFlash {
          0%   { background-color: #fef2f2; border-color: #f87171; transform: translateX(0); }
          25%  { transform: translateX(-4px); }
          75%  { transform: translateX(4px); }
          100% { background-color: transparent; border-color: inherit; transform: translateX(0); }
        }
        .slot-wrong { animation: wrongFlash 0.55s ease-out forwards; }
        @keyframes glitterFly {
          0%   { transform: translate(0,0) rotate(0deg) scale(1); opacity: 1; }
          60%  { opacity: 1; }
          100% { transform: translate(var(--dx), var(--dy)) rotate(var(--rot)) scale(0.3); opacity: 0; }
        }
        @keyframes gameOverFade {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes gameOverBounce {
          0%   { transform: scale(0) rotate(-20deg); opacity: 0; }
          60%  { transform: scale(1.25) rotate(8deg); opacity: 1; }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        @keyframes gameOverSlideUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Infograph panel */}
      {infographItem && (
        <PersonInfographPanel
          name={infographItem.name}
          data={infographItem.data}
          onDismiss={() => setInfographItem(null)}
        />
      )}

      {/* Status bar */}
      <div className="flex items-center justify-between mb-4 min-h-[28px]">
        <div className="flex items-center gap-3">
          {allCorrect ? (
            <p className="text-sm font-semibold text-green-700">{dict.perfectOrder} 🎉</p>
          ) : gameOver ? (
            <p className="text-sm font-semibold text-red-600">Game Over</p>
          ) : (
            <p className="text-sm text-slate-500">
              <span className="font-semibold text-amber-700">{placedCount}/{items.length}</span> placed
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {selectedItem && !allCorrect && !gameOver && (
            <p className="text-xs text-amber-600 font-medium truncate max-w-[120px] sm:max-w-none">
              &ldquo;{selectedItem.name}&rdquo; — tap slot
            </p>
          )}
          {!allCorrect && <Lives current={lives} max={maxLives} />}
        </div>
      </div>

      {/* Main two-column layout */}
      <div className="flex flex-col xl:flex-row gap-4 xl:gap-6">

        {/* ── Left: Timeline panel ── */}
        <div className="flex-1 min-w-0 relative">
          {glitterActive && <GlitterBomb />}
          {gameOver && <GameOverOverlay />}

          {/* Timeline rows with rail */}
          <div className="relative sm:pl-8">
            {/* Vertical rail line */}
            <div className="hidden sm:block absolute left-3 top-6 bottom-6 w-0.5 rounded-full bg-slate-300" />

            <div className="flex flex-col gap-2.5">
              {items.map((item, i) => {
                const isPlaced    = placed[i] !== undefined;
                const placedItem  = placed[i];
                const isActive    = !isPlaced && i === placedCount && !allCorrect && !gameOver;
                const isWrong     = wrongSlot === i;
                const isDragOver  = dragOverSlot === i;
                const wasHinted   = hintedSlots.has(i);

                return (
                  <div
                    key={i}
                    className={[
                      "relative flex flex-col gap-2 sm:grid sm:items-center sm:gap-3",
                      "p-3 rounded-xl border shadow-sm transition-colors",
                      "sm:grid-cols-[44px_minmax(130px,170px)_1fr]",
                      isActive  ? "bg-blue-50/80 border-blue-200" :
                      isPlaced  ? "bg-white border-slate-200" :
                                  "bg-white/50 border-slate-200/60",
                    ].join(" ")}
                  >
                    {/* Rail node */}
                    <div
                      className={[
                        "hidden sm:block absolute -left-5 top-1/2 -translate-y-1/2",
                        "w-3.5 h-3.5 rounded-full border-2 border-white shadow-sm",
                        isPlaced ? "bg-slate-700" :
                        isActive ? "bg-blue-500" :
                                   "bg-white border-slate-300",
                      ].join(" ")}
                    />

                    {/* Number + clue — side by side on mobile, grid cells on sm+ */}
                    <div className="flex gap-3 items-start sm:contents">
                      {/* Number badge */}
                      <div
                        className={[
                          "flex-shrink-0 w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center",
                          "rounded-lg font-black text-sm border",
                          isActive  ? "bg-blue-100 text-blue-700 border-blue-200" :
                          isPlaced  ? "bg-slate-100 text-slate-600 border-slate-200" :
                                      "bg-slate-50 text-slate-400 border-slate-200/70",
                        ].join(" ")}
                      >
                        {String(i + 1).padStart(2, "0")}
                      </div>

                      {/* Clue */}
                      <div className="flex-1 sm:flex-none min-w-0">
                        <span className="block text-[10px] font-extrabold text-blue-500 uppercase tracking-wide mb-0.5">
                          Clue
                        </span>
                        <span className="text-sm font-semibold text-slate-700 leading-snug">
                          {item.milestone || "?"}
                        </span>
                      </div>
                    </div>

                    {/* Drop zone or resolved answer */}
                    {isPlaced ? (
                      <div
                        onClick={() => openInfograph(placedItem)}
                        className={[
                          "flex items-center gap-3 px-3 py-2 rounded-lg bg-white/80 border border-transparent",
                          placedItem?.infographData
                            ? "cursor-pointer hover:border-slate-200 hover:bg-white transition-colors"
                            : "",
                        ].join(" ")}
                      >
                        <div className="w-16 h-12 flex-shrink-0 rounded-md overflow-hidden border border-slate-200 bg-slate-100">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={resolveImageUrl(placedItem.imageUrl)}
                            alt={placedItem.name}
                            className="w-full h-full object-cover object-top"
                            draggable={false}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-bold text-slate-800 leading-tight truncate">
                            {placedItem.name}
                          </div>
                          {placedItem.reign && (
                            <div className="text-xs text-slate-500 mt-0.5">{placedItem.reign}</div>
                          )}
                        </div>
                        <div
                          className={[
                            "flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-black text-white",
                            wasHinted ? "bg-indigo-500" : "bg-green-600",
                          ].join(" ")}
                        >
                          {wasHinted ? "💡" : "✓"}
                        </div>
                      </div>
                    ) : isActive ? (
                      <div
                        data-slot={i}
                        onClick={() => { if (selectedItem) tryPlace(selectedItem, i); }}
                        className={[
                          "flex items-center justify-center min-h-[56px] px-4 rounded-lg",
                          "border-2 border-dashed text-xs font-extrabold uppercase tracking-wide transition-colors",
                          isWrong ? "slot-wrong" : "",
                          isDragOver && !isWrong
                            ? "border-blue-400 bg-blue-100 text-blue-600"
                            : !isWrong
                            ? "border-blue-300 bg-blue-50/60 text-blue-400"
                            : "",
                          selectedItem && !isWrong ? "cursor-pointer" : "cursor-default",
                        ].join(" ")}
                      >
                        Drop answer here
                      </div>
                    ) : (
                      <div className="flex items-center justify-center min-h-[48px] rounded-lg border border-dashed border-slate-200/60">
                        <span className="text-slate-300 text-xs">—</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2 sm:gap-3 mt-4">
            {!allCorrect && !gameOver && (
              <button
                onClick={handleRevealNext}
                disabled={lives < 2 || availableItems.length === 0}
                className="px-4 sm:px-5 py-2 border border-indigo-300 text-indigo-600 text-sm font-medium rounded-lg hover:bg-indigo-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                💡 Reveal next
                <span className="text-xs text-indigo-400 font-normal">−2 ♥</span>
              </button>
            )}
            <button
              onClick={handleReset}
              className="px-4 sm:px-5 py-2 bg-amber-500 text-white text-sm font-semibold rounded-lg hover:bg-amber-600 transition-colors"
            >
              {dict.tryAgain}
            </button>
          </div>
        </div>

        {/* ── Right: Options panel ── */}
        <div className="xl:w-[360px] flex-shrink-0">
          <div
            className="rounded-2xl overflow-hidden border border-white/10"
            style={{ background: "linear-gradient(180deg, #162938 0%, #071522 100%)" }}
          >
            {/* Panel header */}
            <div className="px-5 pt-5 pb-3">
              <div className="flex items-center gap-3 mb-1.5">
                <div className="h-px flex-1 bg-white/20" />
                <h3 className="text-[11px] font-extrabold uppercase tracking-[0.15em] text-white whitespace-nowrap">
                  Timeline Options
                </h3>
                <div className="h-px flex-1 bg-white/20" />
              </div>
              <p className="text-center text-[11px] text-slate-400">
                Drag an option into the correct chronological slot
              </p>
            </div>

            {/* Options list */}
            <div className="mx-4 rounded-xl overflow-hidden bg-[#eef3f8] border border-slate-200/50">
              {shuffledOptions.map((item, idx) => {
                const isItemPlaced = placedIds.has(item.id);
                const isSelected   = selectedItem?.id === item.id;
                const isHovered    = !isItemPlaced && !gameOver && !allCorrect && hoveredOptionId === item.id;

                return (
                  <div
                    key={item.id}
                    onPointerDown={
                      !isItemPlaced && !gameOver && !allCorrect
                        ? (e) => handleChipPointerDown(e, item)
                        : undefined
                    }
                    onPointerMove={!isItemPlaced ? handleChipPointerMove : undefined}
                    onPointerUp={!isItemPlaced ? handleChipPointerUp : undefined}
                    onPointerCancel={!isItemPlaced ? handleChipPointerCancel : undefined}
                    onMouseEnter={!isItemPlaced && !gameOver && !allCorrect ? () => setHoveredOptionId(item.id) : undefined}
                    onMouseLeave={!isItemPlaced ? () => setHoveredOptionId(null) : undefined}
                    style={!isItemPlaced ? { touchAction: "none", userSelect: "none" } : undefined}
                    className={[
                      "flex items-center gap-2 min-h-[58px] px-2.5 py-2 border-b border-slate-200 last:border-b-0 transition-colors",
                      isItemPlaced
                        ? "bg-white/60 opacity-50"
                        : isSelected
                        ? "bg-amber-50 ring-2 ring-inset ring-amber-400"
                        : "bg-white cursor-grab active:cursor-grabbing hover:bg-slate-50",
                    ].join(" ")}
                  >
                    {/* Index */}
                    <div className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-md bg-slate-100 border border-slate-200 text-slate-600 text-xs font-black">
                      {idx + 1}
                    </div>

                    {/* Drag handle (3×2 dot grid) */}
                    {!isItemPlaced ? (
                      <div className="flex-shrink-0 opacity-40" style={{ display: "grid", gridTemplateColumns: "repeat(2, 4px)", gap: "3px" }}>
                        {Array.from({ length: 6 }).map((_, k) => (
                          <div key={k} className="w-1 h-1 rounded-full bg-slate-500" />
                        ))}
                      </div>
                    ) : (
                      <div className="flex-shrink-0 w-[14px]" />
                    )}

                    {/* Thumbnail */}
                    <div className="flex-shrink-0 w-14 h-10 rounded-md overflow-hidden border border-slate-200 bg-slate-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={resolveImageUrl(item.imageUrl)}
                        alt={item.name}
                        className="w-full h-full object-cover object-top"
                        draggable={false}
                      />
                    </div>

                    {/* Name + reign */}
                    <div className="flex-1 min-w-0">
                      <div className={`text-xs font-bold leading-tight truncate ${isItemPlaced ? "text-slate-400" : "text-slate-800"}`}>
                        {item.name}
                      </div>
                      {item.reign && (
                        <div className="text-[10px] text-slate-500 mt-0.5">{item.reign}</div>
                      )}
                    </div>

                    {/* Hot/cold indicator (hover) or status circle (placed) */}
                    {isHovered ? (
                      <span className="flex-shrink-0 text-base leading-none">{tempEmoji(item)}</span>
                    ) : (
                      <div
                        className={[
                          "flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black",
                          isItemPlaced ? "bg-green-600 text-white" : "border-2 border-slate-300",
                        ].join(" ")}
                      >
                        {isItemPlaced && "✓"}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Tip box */}
            <div className="mx-4 my-4 rounded-xl p-3.5 flex gap-3 items-start bg-black/30 border border-white/5">
              <span className="text-xl flex-shrink-0 leading-none mt-0.5">💡</span>
              <div className="text-[11px] text-slate-300 leading-relaxed">
                <strong className="text-white">TIP:</strong> The earliest event goes at position 01. Order from earliest to latest. Click a placed event to learn more about it.
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
