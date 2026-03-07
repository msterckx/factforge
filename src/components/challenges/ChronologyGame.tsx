"use client";

import { useState, useRef } from "react";
import type { Caesar } from "@/data/romanCaesars";
import type { Dictionary } from "@/i18n/en";

interface Props {
  caesars: Caesar[];
  dict: Dictionary["challenges"];
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function ChronologyGame({ caesars, dict }: Props) {
  // slotIndex (0-11) → Caesar when correctly placed by the player
  const [placed, setPlaced] = useState<Record<number, Caesar>>({});
  // Names not yet placed
  const [pool, setPool] = useState<Caesar[]>(() => shuffle(caesars));
  // Tap-to-place: which chip is currently selected
  const [selectedCaesar, setSelectedCaesar] = useState<Caesar | null>(null);
  // Slot currently being dragged over
  const [dragOverSlot, setDragOverSlot] = useState<number | null>(null);
  // Slot that just had a wrong drop (for red flash animation)
  const [wrongSlot, setWrongSlot] = useState<number | null>(null);
  // Whether the player clicked "Give up"
  const [revealed, setRevealed] = useState(false);

  const dragging = useRef<Caesar | null>(null);
  const correctOrder = [...caesars].sort((a, b) => a.id - b.id);

  const placedCount = Object.keys(placed).length;
  const allCorrect = placedCount === caesars.length;

  // ── Core placement logic ──────────────────────────────────────────────────
  function tryPlace(caesar: Caesar, slotIndex: number) {
    if (placed[slotIndex]) return;
    if (caesar.id === slotIndex + 1) {
      setPlaced((prev) => ({ ...prev, [slotIndex]: caesar }));
      setPool((prev) => prev.filter((c) => c.id !== caesar.id));
      setSelectedCaesar(null);
    } else {
      // Flash the slot red, name stays in pool
      setWrongSlot(slotIndex);
      setTimeout(() => setWrongSlot(null), 600);
      setSelectedCaesar(null);
    }
  }

  // ── Tap / click interactions ──────────────────────────────────────────────
  function handleChipClick(caesar: Caesar) {
    setSelectedCaesar((prev) => (prev?.id === caesar.id ? null : caesar));
  }

  function handleSlotClick(slotIndex: number) {
    if (placed[slotIndex] || revealed) return;
    if (selectedCaesar) tryPlace(selectedCaesar, slotIndex);
  }

  // ── Drag interactions ─────────────────────────────────────────────────────
  function handleChipDragStart(caesar: Caesar) {
    dragging.current = caesar;
    setSelectedCaesar(null);
  }

  function handleChipDragEnd() {
    dragging.current = null;
  }

  function handleSlotDragOver(e: React.DragEvent, slotIndex: number) {
    if (placed[slotIndex] || revealed) return;
    e.preventDefault();
    setDragOverSlot(slotIndex);
  }

  function handleSlotDragLeave() {
    setDragOverSlot(null);
  }

  function handleSlotDrop(e: React.DragEvent, slotIndex: number) {
    e.preventDefault();
    setDragOverSlot(null);
    const caesar = dragging.current;
    if (!caesar) return;
    dragging.current = null;
    tryPlace(caesar, slotIndex);
  }

  // ── Game controls ─────────────────────────────────────────────────────────
  function handleReveal() {
    const next: Record<number, Caesar> = { ...placed };
    pool.forEach((c) => { next[c.id - 1] = c; });
    setPlaced(next);
    setPool([]);
    setRevealed(true);
  }

  function handleReset() {
    setPlaced({});
    setPool(shuffle(caesars));
    setSelectedCaesar(null);
    setRevealed(false);
    setWrongSlot(null);
  }

  // ── Render helpers ────────────────────────────────────────────────────────
  // Was this slot placed by the player (not revealed)?
  function isPlayerPlaced(slotIndex: number) {
    return !!placed[slotIndex] && !revealed;
  }

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
            box-shadow: 0 0 0 2px #4ade80, 0 0 8px 1px #4ade8088, 0 0 18px 2px #4ade8044;
          }
          50% {
            box-shadow: 0 0 0 2px #86efac, 0 0 16px 4px #4ade80bb, 0 0 32px 8px #4ade8033;
          }
        }
        @keyframes caesarShine {
          0%        { left: -80%; }
          40%, 100% { left: 130%; }
        }
        .caesar-correct {
          animation: caesarPop 0.35s ease-out, caesarGlow 2.2s ease-in-out 0.35s infinite;
          outline: 2px solid #4ade80;
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
        @keyframes wrongFlash {
          0%   { background-color: #fef2f2; border-color: #f87171; transform: translateX(0); }
          25%  { transform: translateX(-5px); }
          75%  { transform: translateX(5px); }
          100% { background-color: transparent; border-color: #cbd5e1; transform: translateX(0); }
        }
        .slot-wrong {
          animation: wrongFlash 0.55s ease-out forwards;
        }
      `}</style>

      {/* Status bar */}
      <div className="flex items-center justify-between mb-4">
        {allCorrect ? (
          <p className="text-sm font-semibold text-green-700">
            {revealed ? dict.revealAnswer : dict.perfectOrder}
          </p>
        ) : (
          <p className="text-sm text-slate-500">
            {dict.dragOrTap} &mdash; <span className="font-semibold text-amber-700">{placedCount}/12</span> placed
            <span className="font-semibold text-amber-700">{placedCount}/12</span>
          </p>
        )}
        {selectedCaesar && (
          <p className="text-xs text-amber-600 font-medium">
            &ldquo;{selectedCaesar.name}&rdquo; — tap a slot
          </p>
        )}
      </div>

      {/* 12-slot grid */}
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-6">
        {Array.from({ length: 12 }, (_, i) => {
          const caesar = placed[i];
          const isWrong = wrongSlot === i;
          const isDragOver = dragOverSlot === i;
          const playerPlaced = isPlayerPlaced(i);

          if (caesar) {
            // Filled slot — show image
            return (
              <div
                key={`filled-${i}`}
                className={`relative flex flex-col rounded-xl overflow-hidden border border-slate-200 select-none cursor-not-allowed ${
                  playerPlaced ? "caesar-correct caesar-shine" : "outline outline-2 outline-indigo-400"
                }`}
              >
                {/* Position badge */}
                <div className="absolute top-1.5 left-1.5 z-20 bg-black/50 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center leading-none">
                  {i + 1}
                </div>

                <div className="aspect-square w-full bg-stone-200 overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={caesar.imageUrl}
                    alt={caesar.name}
                    className="w-full h-full object-cover object-top"
                    draggable={false}
                  />
                </div>

                <div className={`px-1.5 py-1 text-center ${playerPlaced ? "bg-green-50" : "bg-indigo-50"}`}>
                  <p className="text-[11px] font-semibold text-slate-800 leading-tight truncate">
                    {caesar.name}
                  </p>
                  <p className="text-[10px] text-slate-400 leading-tight">{caesar.reign}</p>
                </div>
              </div>
            );
          }

          // Empty slot
          return (
            <div
              key={`empty-${i}`}
              onDragOver={(e) => handleSlotDragOver(e, i)}
              onDragLeave={handleSlotDragLeave}
              onDrop={(e) => handleSlotDrop(e, i)}
              onClick={() => handleSlotClick(i)}
              className={[
                "aspect-square rounded-xl border-2 border-dashed flex flex-col items-center justify-center transition-colors",
                selectedCaesar ? "cursor-pointer" : "cursor-default",
                isWrong ? "slot-wrong" : "",
                isDragOver && !isWrong ? "border-amber-400 bg-amber-50" : "",
                !isDragOver && !isWrong ? "border-slate-300 bg-slate-50 hover:border-slate-400" : "",
              ].join(" ")}
            >
              <span className="text-2xl font-bold text-slate-300">{i + 1}</span>
            </div>
          );
        })}
      </div>

      {/* Name chip pool */}
      {pool.length > 0 && (
        <div className="mb-5">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Drag a name to the correct slot
          </p>
          <div className="flex flex-wrap gap-2">
            {pool.map((caesar) => (
              <div
                key={caesar.id}
                draggable
                onDragStart={() => handleChipDragStart(caesar)}
                onDragEnd={handleChipDragEnd}
                onClick={() => handleChipClick(caesar)}
                className={[
                  "px-3 py-1.5 rounded-full border text-sm font-medium transition-all cursor-grab active:cursor-grabbing select-none",
                  selectedCaesar?.id === caesar.id
                    ? "bg-amber-100 border-amber-400 text-amber-800 ring-2 ring-amber-300"
                    : "bg-white border-slate-300 text-slate-700 hover:border-amber-300 hover:bg-amber-50",
                ].join(" ")}
              >
                {caesar.name}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-3">
        {!allCorrect && !revealed && (
          <button
            onClick={handleReveal}
            className="px-5 py-2 border border-slate-300 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors"
          >
            {dict.revealAnswer}
          </button>
        )}
        <button
          onClick={handleReset}
          className="px-5 py-2 bg-amber-500 text-white text-sm font-semibold rounded-lg hover:bg-amber-600 transition-colors"
        >
          {dict.tryAgain}
        </button>
      </div>
    </div>
  );
}
