"use client";

import { useState, useRef } from "react";
import type { Caesar } from "@/data/romanCaesars";
import type { Dictionary } from "@/i18n/en";

interface Props {
  caesars: Caesar[];
  dict: Dictionary["challenges"];
}

type GameState = "playing" | "submitted" | "revealed";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function ChronologyGame({ caesars, dict }: Props) {
  const [order, setOrder] = useState<Caesar[]>(() => shuffle(caesars));
  const [gameState, setGameState] = useState<GameState>("playing");
  const [score, setScore] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const dragIndex = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const correctOrder = [...caesars].sort((a, b) => a.id - b.id);

  // Real-time: a card is correct whenever its id matches its current position
  const isCorrectAt = (caesar: Caesar, index: number) => caesar.id === index + 1;
  const allCorrect = order.every((c, i) => isCorrectAt(c, i));

  // ── Tap-to-swap ───────────────────────────────────────────────────────────
  function handleTap(index: number) {
    if (gameState !== "playing") return;
    if (selectedIndex === null) {
      setSelectedIndex(index);
    } else if (selectedIndex === index) {
      setSelectedIndex(null);
    } else {
      const newOrder = [...order];
      [newOrder[selectedIndex], newOrder[index]] = [newOrder[index], newOrder[selectedIndex]];
      setOrder(newOrder);
      setSelectedIndex(null);
    }
  }

  // ── Drag-and-drop ─────────────────────────────────────────────────────────
  function handleDragStart(index: number) {
    dragIndex.current = index;
    setSelectedIndex(null);
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverIndex(index);
  }

  function handleDrop(e: React.DragEvent, targetIndex: number) {
    e.preventDefault();
    const from = dragIndex.current;
    if (from === null || from === targetIndex) { setDragOverIndex(null); return; }
    const newOrder = [...order];
    const [moved] = newOrder.splice(from, 1);
    newOrder.splice(targetIndex, 0, moved);
    setOrder(newOrder);
    dragIndex.current = null;
    setDragOverIndex(null);
  }

  function handleDragEnd() {
    dragIndex.current = null;
    setDragOverIndex(null);
  }

  // ── Game actions ──────────────────────────────────────────────────────────
  function handleSubmit() {
    setScore(order.filter((c, i) => isCorrectAt(c, i)).length);
    setGameState("submitted");
  }

  function handleReset() {
    setOrder(shuffle(caesars));
    setGameState("playing");
    setScore(0);
    setSelectedIndex(null);
  }

  function handleReveal() {
    setOrder(correctOrder);
    setGameState("revealed");
  }

  const isPerfect = score === caesars.length;

  return (
    <div>
      {/* CSS animations */}
      <style>{`
        @keyframes caesarPop {
          0%   { transform: scale(1); }
          35%  { transform: scale(1.08); }
          100% { transform: scale(1); }
        }
        @keyframes caesarGlow {
          0%, 100% {
            box-shadow:
              0 0 0 2px #4ade80,
              0 0 8px 1px #4ade8088,
              0 0 18px 2px #4ade8044;
          }
          50% {
            box-shadow:
              0 0 0 2px #86efac,
              0 0 16px 4px #4ade80bb,
              0 0 32px 8px #4ade8033;
          }
        }
        @keyframes caesarShine {
          0%        { left: -80%; }
          40%, 100% { left: 130%; }
        }
        .caesar-correct {
          animation: caesarPop 0.35s ease-out, caesarGlow 2.2s ease-in-out 0.35s infinite;
          outline: 2px solid #4ade80;
          outline-offset: 0px;
        }
        .caesar-shine::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(
            110deg,
            transparent 30%,
            rgba(255,255,255,0.55) 50%,
            transparent 70%
          );
          animation: caesarShine 2.2s ease-in-out 0.35s infinite;
          pointer-events: none;
          border-radius: inherit;
        }
      `}</style>

      {/* Status banner */}
      {gameState === "playing" && !allCorrect && (
        <p className="text-sm text-slate-500 mb-4">{dict.dragOrTap}</p>
      )}
      {gameState === "playing" && allCorrect && (
        <div className="mb-4 p-3 rounded-xl border bg-green-50 border-green-300 text-green-800 text-sm font-semibold">
          {dict.perfectOrder}
        </div>
      )}
      {gameState === "submitted" && (
        <div className={`mb-4 p-3 rounded-xl border text-sm font-semibold ${
          isPerfect
            ? "bg-green-50 border-green-300 text-green-800"
            : "bg-amber-50 border-amber-300 text-amber-800"
        }`}>
          {isPerfect ? dict.perfectOrder : dict.correctPositions.replace("{correct}", String(score))}
        </div>
      )}
      {gameState === "revealed" && (
        <div className="mb-4 p-3 rounded-xl border bg-indigo-50 border-indigo-200 text-indigo-800 text-sm font-semibold">
          {dict.revealAnswer}
        </div>
      )}

      {/* Selection hint */}
      {selectedIndex !== null && (
        <p className="text-xs text-amber-600 mb-3 font-medium">
          &ldquo;{order[selectedIndex].name}&rdquo; selected — tap another to swap
        </p>
      )}

      {/* Grid */}
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-5">
        {order.map((caesar, index) => {
          const correct = isCorrectAt(caesar, index);
          const isSelected = selectedIndex === index;
          const isDragOver = dragOverIndex === index;

          // After submit: show red for wrong positions
          const showWrong = gameState === "submitted" && !correct;

          return (
            <div
              // Key includes index so animation replays when the card lands in a new slot
              key={`${caesar.id}-${index}`}
              draggable={gameState === "playing"}
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              onClick={() => handleTap(index)}
              className={[
                "relative flex flex-col rounded-xl overflow-hidden border transition-all select-none",
                gameState === "playing" ? "cursor-grab active:cursor-grabbing" : "cursor-default",
                correct ? "caesar-correct caesar-shine" : "",
                showWrong ? "border-red-400 ring-1 ring-red-300" : "",
                !correct && !showWrong && isSelected ? "ring-2 ring-amber-400 ring-offset-1 border-amber-300" : "",
                !correct && !showWrong && isDragOver ? "ring-2 ring-amber-300 border-dashed border-amber-300 opacity-70" : "",
                !correct && !showWrong && !isSelected && !isDragOver ? "border-slate-200" : "",
              ].join(" ")}
            >
              {/* Position badge */}
              <div className="absolute top-1.5 left-1.5 z-20 bg-black/50 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center leading-none">
                {index + 1}
              </div>

              {/* Wrong position indicator after submit */}
              {showWrong && (
                <div className="absolute top-1.5 right-1.5 z-20 bg-red-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                  ✗
                </div>
              )}

              {/* Image — fills the square */}
              <div className="aspect-square w-full bg-stone-200 overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={caesar.imageUrl}
                  alt={caesar.name}
                  className="w-full h-full object-cover object-top"
                  draggable={false}
                />
              </div>

              {/* Name strip */}
              <div className={`px-1.5 py-1 text-center ${correct ? "bg-green-50" : showWrong ? "bg-red-50" : "bg-white"}`}>
                <p className="text-[11px] font-semibold text-slate-800 leading-tight truncate">
                  {caesar.name}
                </p>
                {gameState !== "playing" && (
                  <p className="text-[10px] text-slate-400 leading-tight truncate">{caesar.reign}</p>
                )}
                {showWrong && (
                  <p className="text-[10px] text-red-400 leading-tight">→ #{caesar.id}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Facts */}
      {(gameState === "submitted" || gameState === "revealed") && (
        <div className="mb-5 p-4 bg-slate-50 border border-slate-200 rounded-xl">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Did you know?</p>
          <ul className="flex flex-col gap-1.5">
            {correctOrder.map((c) => (
              <li key={c.id} className="text-xs text-slate-600">
                <span className="font-semibold text-slate-700">{c.name}</span> — {c.fact}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Buttons */}
      <div className="flex gap-3 flex-wrap">
        {gameState === "playing" && (
          <button onClick={handleSubmit}
            className="px-6 py-2.5 bg-amber-500 text-white font-semibold rounded-lg hover:bg-amber-600 transition-colors">
            {dict.checkOrder}
          </button>
        )}
        {gameState === "submitted" && !isPerfect && (
          <>
            <button onClick={handleReset}
              className="px-6 py-2.5 bg-amber-500 text-white font-semibold rounded-lg hover:bg-amber-600 transition-colors">
              {dict.tryAgain}
            </button>
            <button onClick={handleReveal}
              className="px-6 py-2.5 border border-slate-300 text-slate-600 font-medium rounded-lg hover:bg-slate-50 transition-colors">
              {dict.revealAnswer}
            </button>
          </>
        )}
        {((gameState === "submitted" && isPerfect) || gameState === "revealed") && (
          <button onClick={handleReset}
            className="px-6 py-2.5 bg-amber-500 text-white font-semibold rounded-lg hover:bg-amber-600 transition-colors">
            {dict.tryAgain}
          </button>
        )}
      </div>
    </div>
  );
}
