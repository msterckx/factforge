"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import type { ChronologyItem } from "@/types/chronology";
import type { Dictionary } from "@/i18n/en";
import { useCompletedChallenges } from "@/hooks/useCompletedChallenges";
import { trackChallengeStart, trackChallengeComplete, trackChallengeFail } from "@/lib/gtag";

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
  const [pool, setPool] = useState<ChronologyItem[]>(() => shuffle(items));
  const [selectedItem, setSelectedItem] = useState<ChronologyItem | null>(null);
  const [infoItem, setInfoItem] = useState<ChronologyItem | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<number | null>(null);
  const [wrongSlot, setWrongSlot] = useState<number | null>(null);
  const [glitterActive, setGlitterActive] = useState(false);
  const [wrongAttempts, setWrongAttempts] = useState(0);
  const [playerPlaced, setPlayerPlaced] = useState(0);
  const [scoreSubmitted, setScoreSubmitted] = useState(false);
  const [lives, setLives] = useState(maxLives);
  const [hintedSlots, setHintedSlots] = useState<Set<number>>(new Set());
  const [gameOver, setGameOver] = useState(false);

  // Pointer drag state
  const dragItem   = useRef<ChronologyItem | null>(null);
  const dragStart  = useRef<{ x: number; y: number } | null>(null);
  const isDragging = useRef(false);
  const ghostRef   = useRef<HTMLDivElement | null>(null);

  const placedCount = Object.keys(placed).length;
  const allCorrect  = placedCount === items.length && !gameOver;
  const maxScore    = items.length * 10;
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
      if (allCorrect) { markComplete(challengeId, currentScore, maxScore); trackChallengeComplete(challengeId, currentScore, maxScore); }
      else { trackChallengeFail(challengeId); }
      fetch("/api/challenges/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId, score: currentScore, maxScore }),
      }).catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allCorrect, gameOver]);

  // ── Core placement logic ──────────────────────────────────────────────────
  function tryPlace(item: ChronologyItem, slotIndex: number) {
    if (placed[slotIndex] !== undefined || gameOver || allCorrect) return;
    if (item.id === slotIndex + 1) {
      setPlaced((prev) => ({ ...prev, [slotIndex]: item }));
      setPool((prev) => prev.filter((c) => c.id !== item.id));
      setSelectedItem(null);
      setInfoItem(null);
      setPlayerPlaced((p) => p + 1);
    } else {
      const newLives = lives - 1;
      setLives(newLives);
      setWrongAttempts((w) => w + 1);
      setWrongSlot(slotIndex);
      setTimeout(() => setWrongSlot(null), 600);
      setSelectedItem(null);
      setInfoItem(null);
      if (newLives <= 0) setGameOver(true);
    }
  }

  // ── Reveal next tile (costs 2 lives) ─────────────────────────────────────
  function handleRevealNext() {
    if (gameOver || allCorrect || lives < 2) return;
    const item = items[placedCount];
    if (!item) return;

    const isLastItem = placedCount + 1 === items.length;
    setPlaced((prev) => ({ ...prev, [placedCount]: item }));
    setPool((prev) => prev.filter((c) => c.id !== item.id));
    setHintedSlots((prev) => { const s = new Set(prev); s.add(placedCount); return s; });
    setSelectedItem(null);
    setInfoItem(null);

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
      setInfoItem(null);
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
      setInfoItem(isAlreadySelected ? null : tapped);
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

  // ── Milestone card tap ────────────────────────────────────────────────────
  function handleMilestoneClick(slotIndex: number) {
    if (placed[slotIndex] !== undefined || gameOver || allCorrect) return;
    if (selectedItem) tryPlace(selectedItem, slotIndex);
  }

  // ── Reset ─────────────────────────────────────────────────────────────────
  function handleReset() {
    setPlaced({});
    setPool(shuffle(items));
    setSelectedItem(null);
    setInfoItem(null);
    setWrongSlot(null);
    setGlitterActive(false);
    setWrongAttempts(0);
    setPlayerPlaced(0);
    setScoreSubmitted(false);
    setLives(maxLives);
    setHintedSlots(new Set());
    setGameOver(false);
    removeGhost();
    dragItem.current = null;
    isDragging.current = false;
  }

  return (
    <div className="overflow-x-hidden">
      <style>{`
        @keyframes caesarPop {
          0%   { transform: scale(1); }
          35%  { transform: scale(1.08); }
          100% { transform: scale(1); }
        }
        @keyframes caesarGlow {
          0%   { box-shadow: 0 0 0 2px #4ade80, 0 0 8px 1px #4ade8088; }
          50%  { box-shadow: 0 0 0 2px #86efac, 0 0 16px 4px #4ade80bb; }
          100% { box-shadow: 0 0 0 2px #4ade80, 0 0 6px 1px #4ade8033; }
        }
        @keyframes caesarShine {
          0%   { left: -80%; }
          100% { left: 130%; }
        }
        .caesar-correct {
          animation: caesarPop 0.35s ease-out, caesarGlow 1.4s ease-in-out 0.35s 1 forwards;
          outline: 2px solid #4ade80;
        }
        .caesar-shine::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.55) 50%, transparent 70%);
          animation: caesarShine 0.9s ease-in-out 0.35s 1 forwards;
          pointer-events: none;
          border-radius: inherit;
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
        @keyframes msAppear {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .ms-appear { animation: msAppear 0.3s ease-out forwards; }
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
        @keyframes heartLose {
          0%   { transform: scale(1); }
          30%  { transform: scale(1.4); }
          60%  { transform: scale(0.8); }
          100% { transform: scale(1); }
        }
        .heart-lose { animation: heartLose 0.4s ease-out forwards; }
      `}</style>

      {/* Status bar */}
      <div className="flex items-center justify-between mb-3 min-h-[28px]">
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
              &ldquo;{selectedItem.name}&rdquo; — tap tile
            </p>
          )}
          {!allCorrect && (
            <Lives current={lives} max={maxLives} />
          )}
        </div>
      </div>

      {/* Tile grid */}
      <div className="relative mb-4">
        {glitterActive && <GlitterBomb />}
        {gameOver && <GameOverOverlay />}
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 sm:gap-2">

          {/* Placed tiles */}
          {Array.from({ length: placedCount }, (_, i) => {
            const item = placed[i];
            if (!item) return null;
            const wasHinted = hintedSlots.has(i);
            const wasPlayerPlaced = !wasHinted;
            return (
              <div
                key={`placed-${i}`}
                onClick={() => { setInfoItem((prev) => prev?.id === item.id ? null : item); setSelectedItem(null); }}
                className={`relative flex flex-col rounded-lg sm:rounded-xl overflow-hidden border select-none cursor-pointer ${
                  infoItem?.id === item.id
                    ? "border-amber-400 ring-2 ring-amber-300"
                    : wasPlayerPlaced
                    ? "caesar-correct caesar-shine border-slate-200"
                    : "outline outline-2 outline-indigo-400 border-transparent"
                }`}
              >
                <div className="absolute top-1 left-1 z-20 bg-black/50 text-white text-[9px] sm:text-[10px] font-bold w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center leading-none">
                  {i + 1}
                </div>
                {wasHinted && (
                  <div className="absolute top-1 right-1 z-20 text-[9px] text-indigo-300 font-bold leading-none">💡</div>
                )}
                <div className="aspect-square w-full bg-stone-200 overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover object-top" draggable={false} />
                </div>
                <div className={`px-1 py-0.5 sm:px-1.5 sm:py-1 text-center ${wasPlayerPlaced ? "bg-green-50" : "bg-indigo-50"}`}>
                  <p className="text-[10px] sm:text-[11px] font-semibold text-slate-800 leading-tight truncate">{item.name}</p>
                  <p className="text-[9px] sm:text-[10px] text-slate-400 leading-tight">{item.reign}</p>
                </div>
              </div>
            );
          })}

          {/* Active milestone tile — shows clue, is the drop target */}
          {!allCorrect && !gameOver && (() => {
            const activeItem = items[placedCount];
            if (!activeItem) return null;
            const isWrong = wrongSlot === placedCount;
            const isDragOver = dragOverSlot === placedCount;
            return (
              <div
                key={`active-${placedCount}`}
                data-slot={placedCount}
                onClick={() => handleMilestoneClick(placedCount)}
                className={[
                  "relative flex flex-col rounded-lg sm:rounded-xl overflow-hidden border-2 border-dashed select-none",
                  selectedItem ? "cursor-pointer" : "cursor-default",
                  isWrong ? "slot-wrong" : "",
                  isDragOver && !isWrong ? "border-amber-400 bg-amber-100" : !isWrong ? "border-amber-300 bg-amber-50" : "",
                ].join(" ")}
              >
                <div className="absolute top-1 left-1 z-20 bg-amber-500/70 text-white text-[9px] sm:text-[10px] font-bold w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center leading-none">
                  {placedCount + 1}
                </div>
                <div className="aspect-square w-full flex items-center justify-center p-2">
                  <p className="text-center text-[10px] sm:text-[11px] font-medium text-amber-800 leading-snug">
                    {activeItem.milestone || "?"}
                  </p>
                </div>
                <div className="px-1 py-0.5 sm:px-1.5 sm:py-1 text-center bg-amber-100 border-t border-amber-200">
                  <p className="text-[9px] sm:text-[10px] text-amber-600 font-semibold leading-tight">Who is this?</p>
                </div>
              </div>
            );
          })()}

        </div>
      </div>

      {/* Chip pool */}
      {pool.length > 0 && !allCorrect && !gameOver && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            {dict.dragOrTap}
          </p>
          <div className="flex flex-wrap gap-1.5 sm:gap-2">
            {pool.map((item) => (
              <div
                key={item.id}
                onPointerDown={(e) => handleChipPointerDown(e, item)}
                onPointerMove={handleChipPointerMove}
                onPointerUp={handleChipPointerUp}
                onPointerCancel={handleChipPointerCancel}
                style={{ touchAction: "none", userSelect: "none" }}
                className={[
                  "px-2.5 py-1.5 sm:px-3 rounded-full border text-xs sm:text-sm font-medium transition-all cursor-grab active:cursor-grabbing",
                  selectedItem?.id === item.id
                    ? "bg-amber-100 border-amber-400 text-amber-800 ring-2 ring-amber-300"
                    : "bg-white border-slate-300 text-slate-700 hover:border-amber-300 hover:bg-amber-50",
                ].join(" ")}
              >
                {item.name}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Info panel */}
      {infoItem && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 sm:p-4 relative">
          <button
            onClick={() => { setInfoItem(null); setSelectedItem(null); }}
            className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center text-slate-400 hover:text-slate-600 text-base leading-none rounded-full hover:bg-amber-100"
            aria-label="Close"
          >×</button>
          <div className="flex gap-3 pr-6">
            {infoItem.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={infoItem.imageUrl} alt={infoItem.name} className="w-14 h-14 sm:w-16 sm:h-16 rounded-lg object-cover object-top flex-shrink-0" draggable={false} />
            )}
            <div className="min-w-0">
              <p className="font-semibold text-slate-800 text-sm leading-tight">{infoItem.name}</p>
              {infoItem.reign && <p className="text-xs text-amber-700 font-medium mt-0.5">{infoItem.reign}</p>}
              {infoItem.description && <p className="text-xs text-slate-600 leading-relaxed mt-1">{infoItem.description}</p>}
            </div>
          </div>
        </div>
      )}

      {/* Buttons */}
      <div className="flex flex-wrap gap-2 sm:gap-3">
        {!allCorrect && !gameOver && (
          <button
            onClick={handleRevealNext}
            disabled={lives < 2 || pool.length === 0}
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
  );
}
