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

// Roman numeral fallback when image fails to load
const ROMAN = ["I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII"];

export default function ChronologyGame({ caesars, dict }: Props) {
  const [order, setOrder] = useState<Caesar[]>(() => shuffle(caesars));
  const [gameState, setGameState] = useState<GameState>("playing");
  const [score, setScore] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [imgErrors, setImgErrors] = useState<Record<number, boolean>>({});
  const dragIndex = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const correctOrder = [...caesars].sort((a, b) => a.id - b.id);

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
    setScore(order.filter((c, i) => c.id === i + 1).length);
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

  // ── Per-card styles ───────────────────────────────────────────────────────
  function topBorderColor(index: number, caesar: Caesar) {
    if (gameState === "playing") return "border-t-slate-200";
    const correct = caesar.id === index + 1;
    if (gameState === "revealed") return correct ? "border-t-indigo-400" : "border-t-slate-200";
    return correct ? "border-t-green-400" : "border-t-red-400";
  }

  function cardRing(index: number) {
    if (selectedIndex === index) return "ring-2 ring-amber-400 ring-offset-1";
    if (dragOverIndex === index) return "ring-2 ring-amber-300 ring-offset-1 opacity-80";
    return "";
  }

  return (
    <div>
      {/* Status banner */}
      {gameState === "playing" && (
        <p className="text-sm text-slate-500 mb-4">{dict.dragOrTap}</p>
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
          "{order[selectedIndex].name}" selected — tap another to swap
        </p>
      )}

      {/* Grid of cards */}
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-5">
        {order.map((caesar, index) => {
          const isCorrect = gameState !== "playing" && caesar.id === index + 1;
          const isWrong = gameState === "submitted" && !isCorrect;
          const imgFailed = imgErrors[caesar.id];

          return (
            <div
              key={caesar.id}
              draggable={gameState === "playing"}
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              onClick={() => handleTap(index)}
              className={`
                relative flex flex-col rounded-xl border border-slate-200 overflow-hidden
                border-t-4 ${topBorderColor(index, caesar)}
                ${gameState === "playing" ? "cursor-grab active:cursor-grabbing" : "cursor-default"}
                ${cardRing(index)}
                transition-all select-none bg-white
              `}
            >
              {/* Position badge */}
              <div className="absolute top-1.5 left-1.5 z-10 bg-black/40 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center leading-none">
                {index + 1}
              </div>

              {/* Result badge */}
              {gameState === "submitted" && (
                <div className={`absolute top-1.5 right-1.5 z-10 text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center ${
                  isCorrect ? "bg-green-500 text-white" : "bg-red-500 text-white"
                }`}>
                  {isCorrect ? "✓" : "✗"}
                </div>
              )}

              {/* Image */}
              <div className="aspect-square w-full bg-stone-100 overflow-hidden">
                {!imgFailed ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={caesar.imageUrl}
                    alt={caesar.name}
                    className="w-full h-full object-cover object-top"
                    onError={() => setImgErrors((prev) => ({ ...prev, [caesar.id]: true }))}
                    draggable={false}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-2xl text-stone-400 font-serif">
                    {ROMAN[caesar.id - 1]}
                  </div>
                )}
              </div>

              {/* Name + reign */}
              <div className="px-1.5 py-1.5">
                <p className="text-[11px] font-semibold text-slate-800 leading-tight truncate">
                  {caesar.name}
                </p>
                <p className="text-[10px] text-slate-400 leading-tight truncate">
                  {gameState !== "playing" ? caesar.reign : ""}
                </p>
                {/* Show correct slot if wrong on submit */}
                {isWrong && (
                  <p className="text-[10px] text-red-400 leading-tight">
                    → #{caesar.id}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Facts after submission */}
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
