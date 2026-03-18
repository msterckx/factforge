"use client";

import { useState, useRef } from "react";
import type { PuzzleSubject } from "@/types/puzzle";
import type { Dictionary } from "@/i18n/en";
import { useCompletedChallenges } from "@/hooks/useCompletedChallenges";

const GRID = 3;
const TILE = 100; // px — each tile width & height
const SIZE = GRID * TILE; // 300 px — total puzzle width & height

function scramble(n: number): number[] {
  const arr = Array.from({ length: n }, (_, i) => i);
  do {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  } while (arr.every((v, i) => v === i)); // never start already-solved
  return arr;
}

interface Props {
  subjects: PuzzleSubject[];
  dict: Dictionary["challenges"];
  challengeId: string;
}

export default function PuzzleGame({ subjects, dict, challengeId }: Props) {
  const { markComplete } = useCompletedChallenges();
  const [current, setCurrent]           = useState(0);
  const [tiles, setTiles]               = useState<number[]>(() => scramble(GRID * GRID));
  const [selected, setSelected]         = useState<number | null>(null);
  const [dragOver, setDragOver]         = useState<number | null>(null);
  const [solved, setSolved]             = useState(false);
  const [allDone, setAllDone]           = useState(false);
  const [showHint, setShowHint]         = useState(false);
  const [puzzleShuffles, setPuzzleShuffles] = useState(0);
  const [totalScore, setTotalScore]     = useState(0);

  const maxScore = subjects.length * 100;

  const dragging = useRef<number | null>(null);
  const subject  = subjects[current];

  function swap(a: number, b: number) {
    if (a === b) return;
    setTiles((prev) => {
      const next = [...prev];
      [next[a], next[b]] = [next[b], next[a]];
      if (next.every((v, i) => v === i)) setSolved(true);
      return next;
    });
  }

  function handleTileClick(pos: number) {
    if (solved) return;
    if (selected === null) {
      setSelected(pos);
    } else {
      swap(selected, pos);
      setSelected(null);
    }
  }

  function handleNext() {
    const puzzleScore = Math.max(0, 100 - puzzleShuffles * 5);
    const newTotal = totalScore + puzzleScore;
    setTotalScore(newTotal);

    if (current + 1 >= subjects.length) {
      setAllDone(true);
      markComplete(challengeId, newTotal, maxScore);
      fetch("/api/challenges/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId, score: newTotal, maxScore }),
      }).catch(() => {}); // silent — user may not be logged in
    } else {
      setCurrent((c) => c + 1);
      setTiles(scramble(GRID * GRID));
      setSelected(null);
      setSolved(false);
      setShowHint(false);
      setPuzzleShuffles(0);
    }
  }

  function handleReset() {
    setCurrent(0);
    setTiles(scramble(GRID * GRID));
    setSelected(null);
    setSolved(false);
    setShowHint(false);
    setAllDone(false);
    setPuzzleShuffles(0);
    setTotalScore(0);
  }

  // ── All done screen ──────────────────────────────────────────────────────
  if (allDone) {
    return (
      <div className="text-center py-16">
        <div className="text-5xl mb-4">🏅</div>
        <p className="text-xl font-bold text-slate-800 mb-1">{dict.allPuzzlesSolved}</p>
        <button
          onClick={handleReset}
          className="mt-6 px-6 py-2.5 bg-amber-500 text-white font-semibold rounded-lg hover:bg-amber-600 transition-colors"
        >
          {dict.tryAgain}
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Status bar */}
      <div className="flex items-center justify-between mb-4 min-h-[24px]">
        <p className="text-sm text-slate-500">
          {dict.puzzleProgress}{" "}
          <span className="font-semibold text-amber-700">{current + 1}/{subjects.length}</span>
        </p>
        {solved && (
          <p className="text-sm font-semibold text-green-700">{dict.puzzleSolved} 🎉</p>
        )}
      </div>

      {/* Hint row */}
      {!solved && (
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => setShowHint((h) => !h)}
            className="text-xs px-3 py-1.5 border border-slate-300 rounded-full text-slate-500 hover:border-amber-400 hover:text-amber-700 transition-colors"
          >
            💡 {dict.hint}
          </button>
          {showHint && (
            <span className="text-sm text-slate-600 font-medium">{subject.hint}</span>
          )}
        </div>
      )}

      {/* Puzzle grid */}
      <div
        className={[
          "inline-grid bg-white rounded-xl overflow-hidden transition-all duration-300",
          solved
            ? "gap-0 outline outline-2 outline-green-400 shadow-lg shadow-green-100"
            : "gap-[2px] shadow-md",
        ].join(" ")}
        style={{ gridTemplateColumns: `repeat(${GRID}, ${TILE}px)` }}
      >
        {tiles.map((correctPos, displayPos) => {
          const row = Math.floor(correctPos / GRID);
          const col = correctPos % GRID;
          const isSelected  = selected === displayPos;
          const isDragOver  = dragOver === displayPos;

          return (
            <div
              key={displayPos}
              draggable={!solved}
              onDragStart={() => { dragging.current = displayPos; setSelected(null); }}
              onDragEnd={() => { dragging.current = null; setDragOver(null); }}
              onDragOver={(e) => { e.preventDefault(); setDragOver(displayPos); }}
              onDragLeave={() => setDragOver(null)}
              onDrop={() => {
                if (dragging.current === null || solved) return;
                swap(dragging.current, displayPos);
                dragging.current = null;
                setDragOver(null);
              }}
              onClick={() => handleTileClick(displayPos)}
              className={[
                "select-none transition-all duration-150",
                solved ? "cursor-default" : "cursor-pointer active:scale-95",
                isSelected ? "brightness-125 ring-2 ring-amber-400 ring-inset z-10" : "",
                isDragOver && !solved ? "brightness-110 ring-2 ring-amber-300 ring-inset" : "",
                !isSelected && !isDragOver && !solved ? "hover:brightness-110" : "",
              ].join(" ")}
              style={{
                width: TILE,
                height: TILE,
                backgroundImage: `url(${subject.imageUrl})`,
                backgroundSize: `${SIZE}px ${SIZE}px`,
                backgroundPosition: `-${col * TILE}px -${row * TILE}px`,
              }}
            />
          );
        })}
      </div>

      {/* Solved reveal panel */}
      {solved && (
        <div className="mt-5 p-5 bg-green-50 border border-green-200 rounded-xl max-w-sm">
          <p className="text-xl font-bold text-slate-800">{subject.name}</p>
          <p className="text-sm font-medium text-amber-700 mt-0.5">{subject.achievement}</p>
          <p className="text-sm text-slate-500 mt-2 leading-relaxed">{subject.description}</p>
          <button
            onClick={handleNext}
            className="mt-4 px-5 py-2 bg-amber-500 text-white text-sm font-semibold rounded-lg hover:bg-amber-600 transition-colors"
          >
            {current + 1 < subjects.length ? `${dict.nextPuzzle} →` : `${dict.finish} 🏅`}
          </button>
        </div>
      )}

      {/* Controls when unsolved */}
      {!solved && (
        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={() => { setTiles(scramble(GRID * GRID)); setSelected(null); setPuzzleShuffles((s) => s + 1); }}
            className="px-4 py-2 border border-slate-300 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors"
          >
            {dict.shufflePuzzle}
          </button>
        </div>
      )}
    </div>
  );
}
