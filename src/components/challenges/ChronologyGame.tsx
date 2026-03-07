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
  // Tap-to-swap selection
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  // Drag state
  const dragIndex = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const correctOrder = [...caesars].sort((a, b) => a.id - b.id);

  // ── Tap / click interaction ───────────────────────────────────────────────
  function handleTap(index: number) {
    if (gameState !== "playing") return;
    if (selectedIndex === null) {
      setSelectedIndex(index);
    } else if (selectedIndex === index) {
      setSelectedIndex(null);
    } else {
      // Swap the two items
      const newOrder = [...order];
      [newOrder[selectedIndex], newOrder[index]] = [newOrder[index], newOrder[selectedIndex]];
      setOrder(newOrder);
      setSelectedIndex(null);
    }
  }

  // ── Drag interaction ──────────────────────────────────────────────────────
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
    if (from === null || from === targetIndex) {
      setDragOverIndex(null);
      return;
    }
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

  // ── Submit ────────────────────────────────────────────────────────────────
  function handleSubmit() {
    const correct = order.filter((c, i) => c.id === i + 1).length;
    setScore(correct);
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

  // ── Rendering ─────────────────────────────────────────────────────────────
  const isPerfect = score === caesars.length;

  function cardStyle(index: number, caesar: Caesar) {
    if (gameState === "revealed") {
      return "border-indigo-200 bg-indigo-50";
    }
    if (gameState === "submitted") {
      return caesar.id === index + 1
        ? "border-green-300 bg-green-50"
        : "border-red-300 bg-red-50";
    }
    if (selectedIndex === index) {
      return "border-amber-400 bg-amber-50 ring-2 ring-amber-300";
    }
    if (dragOverIndex === index) {
      return "border-amber-400 bg-amber-50 border-dashed";
    }
    return "border-slate-200 bg-white hover:border-amber-300 hover:bg-amber-50/40";
  }

  return (
    <div>
      {/* Instruction / score banner */}
      {gameState === "playing" && (
        <p className="text-sm text-slate-500 mb-4">{dict.dragOrTap}</p>
      )}

      {gameState === "submitted" && (
        <div
          className={`mb-4 p-4 rounded-xl border ${
            isPerfect
              ? "bg-green-50 border-green-300 text-green-800"
              : "bg-amber-50 border-amber-300 text-amber-800"
          }`}
        >
          <p className="font-semibold text-base">
            {isPerfect
              ? dict.perfectOrder
              : dict.correctPositions.replace("{correct}", String(score))}
          </p>
        </div>
      )}

      {gameState === "revealed" && (
        <div className="mb-4 p-4 rounded-xl border bg-indigo-50 border-indigo-200 text-indigo-800">
          <p className="font-semibold">{dict.revealAnswer}</p>
        </div>
      )}

      {/* Selection hint */}
      {selectedIndex !== null && (
        <p className="text-xs text-amber-600 mb-3 font-medium">
          {order[selectedIndex].name} selected — tap another to swap
        </p>
      )}

      {/* Caesar list */}
      <ol className="flex flex-col gap-2 mb-6">
        {order.map((caesar, index) => {
          const isCorrect = gameState !== "playing" && caesar.id === index + 1;
          const isWrong =
            (gameState === "submitted" || gameState === "revealed") && caesar.id !== index + 1;

          return (
            <li
              key={caesar.id}
              draggable={gameState === "playing"}
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              onClick={() => handleTap(index)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all select-none ${
                gameState === "playing" ? "cursor-grab active:cursor-grabbing" : "cursor-default"
              } ${cardStyle(index, caesar)}`}
            >
              {/* Position number */}
              <span className="text-xs font-bold text-slate-400 w-5 shrink-0 text-right">
                {index + 1}
              </span>

              {/* Drag handle dots */}
              {gameState === "playing" && (
                <span className="text-slate-300 shrink-0 text-xs leading-none select-none">
                  ⠿
                </span>
              )}

              {/* Correct/wrong indicator */}
              {gameState === "submitted" && (
                <span className={`shrink-0 text-sm ${isCorrect ? "text-green-600" : "text-red-500"}`}>
                  {isCorrect ? "✓" : "✗"}
                </span>
              )}
              {gameState === "revealed" && (
                <span className="shrink-0 text-sm text-indigo-400">
                  {caesar.id}.
                </span>
              )}

              {/* Name + reign */}
              <div className="flex-1 min-w-0">
                <span className="font-semibold text-slate-800 text-sm">{caesar.name}</span>
                {(gameState === "submitted" || gameState === "revealed") && (
                  <span className="ml-2 text-xs text-slate-400">{caesar.reign}</span>
                )}
              </div>

              {/* On submit: show correct position if wrong */}
              {gameState === "submitted" && isWrong && (
                <span className="text-xs text-slate-400 shrink-0">
                  #{caesar.id}
                </span>
              )}
            </li>
          );
        })}
      </ol>

      {/* Fact reveal after submission */}
      {(gameState === "submitted" || gameState === "revealed") && (
        <div className="mb-6 p-4 bg-slate-50 border border-slate-200 rounded-xl">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Did you know?
          </p>
          <ul className="flex flex-col gap-1.5">
            {correctOrder.map((c) => (
              <li key={c.id} className="text-xs text-slate-600">
                <span className="font-semibold text-slate-700">{c.name}</span> — {c.fact}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-3 flex-wrap">
        {gameState === "playing" && (
          <button
            onClick={handleSubmit}
            className="px-6 py-2.5 bg-amber-500 text-white font-semibold rounded-lg hover:bg-amber-600 transition-colors"
          >
            {dict.checkOrder}
          </button>
        )}
        {gameState === "submitted" && !isPerfect && (
          <>
            <button
              onClick={handleReset}
              className="px-6 py-2.5 bg-amber-500 text-white font-semibold rounded-lg hover:bg-amber-600 transition-colors"
            >
              {dict.tryAgain}
            </button>
            <button
              onClick={handleReveal}
              className="px-6 py-2.5 border border-slate-300 text-slate-600 font-medium rounded-lg hover:bg-slate-50 transition-colors"
            >
              {dict.revealAnswer}
            </button>
          </>
        )}
        {(gameState === "submitted" && isPerfect) || gameState === "revealed" ? (
          <button
            onClick={handleReset}
            className="px-6 py-2.5 bg-amber-500 text-white font-semibold rounded-lg hover:bg-amber-600 transition-colors"
          >
            {dict.tryAgain}
          </button>
        ) : null}
      </div>
    </div>
  );
}
