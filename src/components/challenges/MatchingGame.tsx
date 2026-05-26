"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import type { ChronologyItem } from "@/types/chronology";
import type { Dictionary } from "@/i18n/en";
import { useCompletedChallenges } from "@/hooks/useCompletedChallenges";
import { trackChallengeStart, trackChallengeComplete, trackChallengeFail } from "@/lib/gtag";
import { resolveImageUrl } from "@/lib/imageUrl";

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

// ── Person silhouette (solid fill matching the design mockup) ─────────────────
function PersonSilhouette() {
  return (
    <svg viewBox="0 0 160 160" aria-hidden="true" className="w-full h-full">
      <rect width="160" height="160" fill="#eef2f6" />
      <circle cx="80" cy="59" r="34" fill="#aeb8c2" />
      <path d="M33 150c6-39 27-57 47-57s41 18 47 57H33Z" fill="#aeb8c2" />
    </svg>
  );
}

// ── Drag handle (6 dots) ──────────────────────────────────────────────────────
function DragHandle() {
  return (
    <div className="grid grid-cols-2 gap-[4px] opacity-40 w-fit mx-auto">
      {Array.from({ length: 6 }, (_, i) => (
        <span key={i} className="w-[5px] h-[5px] rounded-full bg-[#6f7e91] block" />
      ))}
    </div>
  );
}

// ── Glitter bomb ──────────────────────────────────────────────────────────────
const COLORS = ["#fbbf24","#4ade80","#f59e0b","#86efac","#fde68a","#a3e635","#34d399","#fcd34d"];
const SHAPES = ["50%","0%","2px"];

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
        >
          ♥
        </span>
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function MatchingGame({ items, dict, challengeId, startingLives = 5 }: Props) {
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

  const dragItem  = useRef<ChronologyItem | null>(null);
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const isDragging = useRef(false);
  const ghostRef  = useRef<HTMLDivElement | null>(null);

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

  // ── Placement — any tile, any order ───────────────────────────────────────
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

  // ── Reveal a random unplaced tile (costs 2 lives) ────────────────────────
  function handleRevealRandom() {
    if (gameOver || allCorrect || lives < 2) return;
    const emptySlots = Array.from({ length: items.length }, (_, i) => i).filter((i) => placed[i] === undefined);
    if (emptySlots.length === 0) return;

    const slotIndex = emptySlots[Math.floor(Math.random() * emptySlots.length)];
    const item = items[slotIndex];
    const isLastItem = emptySlots.length === 1;

    setPlaced((prev) => ({ ...prev, [slotIndex]: item }));
    setPool((prev) => prev.filter((c) => c.id !== item.id));
    setHintedSlots((prev) => { const s = new Set(prev); s.add(slotIndex); return s; });
    setSelectedItem(null);
    setInfoItem(null);

    const newLives = Math.max(0, lives - 2);
    setLives(newLives);
    if (newLives === 0 && !isLastItem) setGameOver(true);
  }

  // ── Ghost helpers ─────────────────────────────────────────────────────────
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

  function handleSlotClick(slotIndex: number) {
    if (placed[slotIndex] !== undefined || gameOver || allCorrect) return;
    if (selectedItem) tryPlace(selectedItem, slotIndex);
  }

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
          0%   { background: #fef2f2; transform: translateX(0); }
          25%  { transform: translateX(-5px); }
          75%  { transform: translateX(5px); }
          100% { background: white; transform: translateX(0); }
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
        /* Responsive card image column */
        .match-card { grid-template-columns: 100px 1fr; }
        @media (min-width: 480px) { .match-card { grid-template-columns: 120px 1fr; } }
        @media (min-width: 640px) { .match-card { grid-template-columns: 150px 1fr; } }
      `}</style>

      {/* Status bar */}
      <div className="flex items-center justify-between mb-4 min-h-[28px]">
        <div className="flex items-center gap-3">
          {allCorrect ? (
            <p className="text-sm font-semibold text-green-700">{dict.perfectOrder} 🎉</p>
          ) : gameOver ? (
            <p className="text-sm font-semibold text-red-600">Game Over</p>
          ) : (
            <p className="text-sm text-slate-500">
              <span className="font-semibold text-amber-700">{placedCount}/{items.length}</span> matched
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {selectedItem && !allCorrect && !gameOver && (
            <p className="text-xs text-amber-600 font-medium truncate max-w-[160px]">
              &ldquo;{selectedItem.name}&rdquo; — tap a card
            </p>
          )}
          {!allCorrect && <Lives current={lives} max={maxLives} />}
        </div>
      </div>

      {/* Main game area: cards grid + dark answer panel */}
      <div className="relative mb-6">
        {glitterActive && <GlitterBomb />}
        {gameOver && <GameOverOverlay />}
        <div className="flex flex-col xl:flex-row gap-5 xl:gap-6">

          {/* ── Clue cards grid ─────────────────────────────────────────── */}
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-4 sm:gap-5 content-start">
            {Array.from({ length: items.length }, (_, i) => {
              const item      = placed[i];
              const isWrong   = wrongSlot === i;
              const isDragOver = dragOverSlot === i;
              const wasHinted = hintedSlots.has(i);
              const wasPlayerPlaced = !!item && !wasHinted;

              // ── Filled card ──────────────────────────────────────────────
              if (item) {
                return (
                  <div
                    key={`filled-${i}`}
                    onClick={() => { setInfoItem((prev) => prev?.id === item.id ? null : item); setSelectedItem(null); }}
                    className={[
                      "match-card relative grid grid-rows-[1fr_auto] gap-x-5 gap-y-3.5 p-5 pb-4 min-h-[180px] sm:min-h-[210px]",
                      "bg-gradient-to-b from-white to-slate-50/80 rounded-xl overflow-hidden select-none cursor-pointer",
                      "border shadow-[0_10px_22px_rgba(18,35,52,0.10)] transition-all",
                      infoItem?.id === item.id
                        ? "border-amber-400 ring-2 ring-amber-300/60"
                        : wasPlayerPlaced
                        ? "caesar-correct caesar-shine border-slate-200"
                        : "outline outline-2 outline-indigo-400 border-transparent",
                    ].join(" ")}
                  >
                    {/* Number badge */}
                    <div className="absolute top-3 left-3 z-10 min-w-[36px] sm:min-w-[44px] h-[32px] sm:h-[38px] px-2 flex items-center justify-center rounded-[9px] bg-[#e8f1fb] text-[#18558f] border border-[#cad8e7] font-black text-sm sm:text-base shadow-[inset_0_2px_0_rgba(255,255,255,0.8)]">
                      {String(i + 1).padStart(2, "0")}
                    </div>
                    {wasHinted && (
                      <div className="absolute top-3 right-3 z-10 text-[11px] text-indigo-400 font-black">💡</div>
                    )}

                    {/* Photo — col 1, row 1 */}
                    <div className="w-full aspect-square self-start mt-1 rounded-lg overflow-hidden border border-slate-200 flex-shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={resolveImageUrl(item.imageUrl)} alt={item.name} className="w-full h-full object-cover object-top" draggable={false} />
                    </div>

                    {/* Clue text — col 2, row 1 */}
                    <div className="pt-9 sm:pt-11 pr-1 text-sm sm:text-[15px] font-bold text-[#13253b] leading-snug">
                      {items[i]?.clue || item.name}
                    </div>

                    {/* Answer pill — row 2, spans both columns */}
                    <div className="col-span-2 flex items-center justify-center gap-2 min-h-[40px] sm:min-h-[46px] rounded-lg border border-[#a7d7b7] bg-[#eaf7ee] text-sm font-black text-[#152f20]">
                      <span className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-[#2f9b58] text-white flex items-center justify-center text-xs sm:text-sm font-black flex-shrink-0">✓</span>
                      <span className="truncate text-xs sm:text-sm">{item.name}</span>
                    </div>
                  </div>
                );
              }

              // ── Empty card (drop target) ─────────────────────────────────
              return (
                <div
                  key={`empty-${i}`}
                  data-slot={i}
                  className={[
                    "match-card relative grid grid-rows-[1fr_auto] gap-x-5 gap-y-3.5 p-5 pb-4 min-h-[180px] sm:min-h-[210px]",
                    "bg-gradient-to-b from-white to-slate-50/80 rounded-xl overflow-hidden select-none cursor-default",
                    "border shadow-[0_10px_22px_rgba(18,35,52,0.10)] transition-all",
                    isWrong ? "slot-wrong" : "",
                    isDragOver && !isWrong
                      ? "border-amber-400 ring-2 ring-amber-400/50"
                      : selectedItem && !isWrong
                      ? "border-amber-300/60 ring-1 ring-amber-300/40"
                      : !isWrong
                      ? "border-slate-300/50"
                      : "",
                  ].join(" ")}
                >
                  {/* Number badge */}
                  <div className="absolute top-3 left-3 z-10 min-w-[36px] sm:min-w-[44px] h-[32px] sm:h-[38px] px-2 flex items-center justify-center rounded-[9px] bg-[#e8f1fb] text-[#18558f] border border-[#cad8e7] font-black text-sm sm:text-base shadow-[inset_0_2px_0_rgba(255,255,255,0.8)]">
                    {String(i + 1).padStart(2, "0")}
                  </div>

                  {/* Silhouette — col 1, row 1 */}
                  <div className="w-full aspect-square self-start mt-1 rounded-lg overflow-hidden border border-[#d8e1ea] flex-shrink-0">
                    <PersonSilhouette />
                  </div>

                  {/* Clue text — col 2, row 1 */}
                  <div className="pt-9 sm:pt-11 pr-1 text-sm sm:text-[15px] font-bold text-[#13253b] leading-snug">
                    {items[i]?.clue || "?"}
                  </div>

                  {/* Drop zone — row 2, spans both columns, owns the click */}
                  <div
                    onClick={() => handleSlotClick(i)}
                    className={[
                      "col-span-2 flex items-center justify-center min-h-[40px] sm:min-h-[46px] rounded-lg border-2 border-dashed",
                      "text-[10px] sm:text-[11px] font-black uppercase tracking-wider transition-colors",
                      selectedItem && !gameOver ? "cursor-pointer" : "cursor-default",
                      isDragOver
                        ? "border-amber-400 bg-amber-100/60 text-amber-700"
                        : selectedItem && !gameOver
                        ? "border-amber-400 bg-amber-50/60 text-amber-600"
                        : "border-[#c8d3df] bg-slate-50/70 text-[#7c8ba0]",
                    ].join(" ")}
                  >
                    Drop answer here
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Answer panel (dark navy) ─────────────────────────────────── */}
          <aside className="xl:w-[310px] flex-shrink-0 bg-gradient-to-b from-[#162938] to-[#112230] rounded-2xl p-6 sm:p-7 text-white border border-white/10 shadow-[0_16px_35px_rgba(11,24,38,0.25)]">
            {/* Title */}
            <h2 className="flex items-center justify-center gap-4 m-0 mb-2 text-[#eef6ff] text-lg sm:text-xl font-black uppercase tracking-widest leading-none">
              <span className="flex-1 h-0.5 rounded-full bg-white/40" />
              Answer Options
              <span className="flex-1 h-0.5 rounded-full bg-white/40" />
            </h2>
            <p className="text-center text-[#d1dde9] text-xs sm:text-sm mb-5 mt-0">
              {dict.dragOrTap}
            </p>

            {/* All answer options — matched ones show checkmark */}
            <div className="flex flex-col gap-2.5">
              {items.map((answerItem) => {
                const isMatched   = placed[answerItem.id - 1] !== undefined;
                const isSelected  = selectedItem?.id === answerItem.id;
                const isAvailable = !isMatched && !gameOver && !allCorrect;

                return (
                  <div
                    key={answerItem.id}
                    onPointerDown={isAvailable ? (e) => handleChipPointerDown(e, answerItem) : undefined}
                    onPointerMove={isAvailable ? handleChipPointerMove : undefined}
                    onPointerUp={isAvailable ? handleChipPointerUp : undefined}
                    onPointerCancel={isAvailable ? handleChipPointerCancel : undefined}
                    style={{
                      gridTemplateColumns: "34px 1fr 30px",
                      ...(isAvailable ? { touchAction: "none", userSelect: "none" } : {}),
                    }}
                    className={[
                      "grid items-center min-h-[50px] sm:min-h-[54px] px-3 sm:px-3.5 rounded-lg text-slate-800 text-xs sm:text-[15px] font-semibold border",
                      "shadow-[0_5px_12px_rgba(0,0,0,0.12)] transition-all",
                      isMatched
                        ? "bg-gradient-to-b from-slate-50 to-[#edf2f7] border-[#d5dee8] opacity-75"
                        : isSelected
                        ? "bg-amber-50 border-amber-400 ring-2 ring-amber-300/60 text-amber-900 cursor-grab"
                        : "bg-gradient-to-b from-slate-50 to-[#edf2f7] border-[#d5dee8] cursor-grab active:cursor-grabbing hover:from-white hover:to-slate-100",
                    ].join(" ")}
                  >
                    <DragHandle />
                    <span className="truncate px-1">{answerItem.name}</span>
                    {isMatched ? (
                      <span className="w-[26px] h-[26px] rounded-full bg-[#2f9b58] text-white flex items-center justify-center text-xs font-black mx-auto">✓</span>
                    ) : (
                      <span className="text-[#a8b4c2] text-xl text-center leading-none mx-auto select-none">☆</span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Tip box */}
            <div className="mt-5 grid grid-cols-[auto_1fr] gap-3 sm:gap-4 p-4 rounded-xl bg-black/30 border border-white/[0.06]">
              <span className="text-2xl leading-none">💡</span>
              <p className="text-xs sm:text-sm text-slate-200 leading-relaxed m-0">
                <strong className="text-white font-black">TIP:</strong> Read the clues carefully and match each one to the best answer.
              </p>
            </div>
          </aside>

        </div>
      </div>

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
              <img src={resolveImageUrl(infoItem.imageUrl)} alt={infoItem.name} className="w-14 h-14 sm:w-16 sm:h-16 rounded-lg object-cover object-top flex-shrink-0" draggable={false} />
            )}
            <div className="min-w-0">
              <p className="font-semibold text-slate-800 text-sm leading-tight">{infoItem.name}</p>
              {infoItem.reign && <p className="text-xs text-amber-700 font-medium mt-0.5">{infoItem.reign}</p>}
              {infoItem.clue && <p className="text-xs text-slate-600 leading-relaxed mt-1">{infoItem.clue}</p>}
            </div>
          </div>
        </div>
      )}

      {/* Buttons */}
      <div className="flex flex-wrap gap-2 sm:gap-3">
        {!allCorrect && !gameOver && (
          <button
            onClick={handleRevealRandom}
            disabled={lives < 2 || pool.length === 0}
            className="px-4 sm:px-5 py-2 border border-indigo-300 text-indigo-600 text-sm font-medium rounded-lg hover:bg-indigo-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            💡 Reveal a tile
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
