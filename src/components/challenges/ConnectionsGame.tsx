"use client";

import { useState, useMemo, useEffect } from "react";
import type { Dictionary } from "@/i18n/en";
import type { ConnectionItem } from "@/types/connections";
import { useCompletedChallenges } from "@/hooks/useCompletedChallenges";
import { resolveImageUrl } from "@/lib/imageUrl";

interface Props {
  items: ConnectionItem[];
  dict: Dictionary["challenges"];
  challengeId: string;
}

type Phase = "playing" | "checked" | "revealed";

// Distinct pair colors — bg for the card tint, dot for the color swatch
const PAIR_COLORS = [
  { dot: "bg-violet-500",  card: "border-violet-300 bg-violet-50",  text: "text-violet-700"  },
  { dot: "bg-sky-500",     card: "border-sky-300 bg-sky-50",        text: "text-sky-700"     },
  { dot: "bg-rose-500",    card: "border-rose-300 bg-rose-50",      text: "text-rose-700"    },
  { dot: "bg-emerald-500", card: "border-emerald-300 bg-emerald-50",text: "text-emerald-700" },
  { dot: "bg-orange-500",  card: "border-orange-300 bg-orange-50",  text: "text-orange-700"  },
  { dot: "bg-teal-500",    card: "border-teal-300 bg-teal-50",      text: "text-teal-700"    },
  { dot: "bg-pink-500",    card: "border-pink-300 bg-pink-50",      text: "text-pink-700"    },
  { dot: "bg-indigo-500",  card: "border-indigo-300 bg-indigo-50",  text: "text-indigo-700"  },
  { dot: "bg-lime-500",    card: "border-lime-300 bg-lime-50",      text: "text-lime-700"    },
  { dot: "bg-amber-500",   card: "border-amber-300 bg-amber-50",    text: "text-amber-700"   },
  { dot: "bg-cyan-500",    card: "border-cyan-300 bg-cyan-50",      text: "text-cyan-700"    },
  { dot: "bg-fuchsia-500", card: "border-fuchsia-300 bg-fuchsia-50",text: "text-fuchsia-700" },
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function ConnectionsGame({ items, dict, challengeId }: Props) {
  const { markComplete } = useCompletedChallenges();

  const shuffledItems   = useMemo(() => shuffle(items), [items]);
  const shuffledAnswers = useMemo(() => shuffle(items.map((i) => i.match)), [items]);

  // connections[itemId] = answer string the player has selected
  const [connections, setConnections] = useState<Record<number, string>>({});
  // pairColors[itemId] = index into PAIR_COLORS (assigned in order of connection)
  const [pairColors, setPairColors] = useState<Record<number, number>>({});
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [phase, setPhase] = useState<Phase>("playing");
  const [correctCount, setCorrectCount] = useState(0);

  useEffect(() => {
    setConnections({});
    setPairColors({});
    setSelectedItemId(null);
    setPhase("playing");
    setCorrectCount(0);
  }, [items]);

  function nextColorIndex(current: Record<number, number>): number {
    const used = new Set(Object.values(current));
    for (let i = 0; i < PAIR_COLORS.length; i++) {
      if (!used.has(i)) return i;
    }
    return 0;
  }

  function handleItemClick(itemId: number) {
    if (phase !== "playing") return;
    // If already connected, clicking disconnects it
    if (connections[itemId] !== undefined) {
      setConnections((prev) => { const n = { ...prev }; delete n[itemId]; return n; });
      setPairColors((prev)  => { const n = { ...prev }; delete n[itemId]; return n; });
      setSelectedItemId(null);
      return;
    }
    setSelectedItemId((prev) => (prev === itemId ? null : itemId));
  }

  function handleAnswerClick(answer: string) {
    if (phase !== "playing") return;
    if (selectedItemId === null) return;

    setConnections((prev) => {
      const next = { ...prev };
      // Free the answer if another item already claimed it
      for (const [k, v] of Object.entries(next)) {
        if (v === answer) {
          delete next[Number(k)];
          setPairColors((pc) => { const n = { ...pc }; delete n[Number(k)]; return n; });
        }
      }
      next[selectedItemId] = answer;
      return next;
    });

    setPairColors((prev) => {
      const colorIdx = nextColorIndex(prev);
      return { ...prev, [selectedItemId]: colorIdx };
    });

    setSelectedItemId(null);
  }

  function handleCheck() {
    const correct = items.filter((item) => connections[item.id] === item.match).length;
    setCorrectCount(correct);
    setPhase("checked");
    if (correct === items.length) {
      markComplete(challengeId, correct, items.length);
    }
  }

  function handleReset() {
    setConnections({});
    setPairColors({});
    setSelectedItemId(null);
    setPhase("playing");
    setCorrectCount(0);
  }

  const allConnected = items.every((item) => connections[item.id] !== undefined);
  const usedAnswers  = new Set(Object.values(connections));

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-500">{dict.connectionsInstruction}</p>

      {/* ── Playing / Checked view ──────────────────────────────────── */}
      {phase !== "revealed" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">

          {/* Left column — items */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Items</p>
            {shuffledItems.map((item) => {
              const isSelected  = selectedItemId === item.id;
              const colorIdx    = pairColors[item.id];
              const isPaired    = colorIdx !== undefined;
              const color       = isPaired ? PAIR_COLORS[colorIdx] : null;
              const isCorrect   = phase === "checked" && connections[item.id] === item.match;
              const isWrong     = phase === "checked" && isPaired && !isCorrect;

              let borderCls = "border-slate-200 bg-white hover:border-slate-300";
              if (isSelected) borderCls = "border-amber-400 bg-amber-50 ring-2 ring-amber-300";
              else if (isCorrect) borderCls = "border-emerald-400 bg-emerald-50";
              else if (isWrong)   borderCls = "border-red-400 bg-red-50";
              else if (color)     borderCls = color.card;

              return (
                <div
                  key={item.id}
                  onClick={() => handleItemClick(item.id)}
                  className={`flex items-center gap-3 border-2 rounded-xl p-3 cursor-pointer transition-all select-none ${borderCls}`}
                >
                  {/* Color dot — shows which pair this belongs to */}
                  <div className="flex-shrink-0 w-3 flex flex-col items-center">
                    {isCorrect && <span className="text-emerald-500 text-base leading-none">✓</span>}
                    {isWrong   && <span className="text-red-500 text-base leading-none">✗</span>}
                    {!isCorrect && !isWrong && color && (
                      <span className={`w-3 h-3 rounded-full ${color.dot}`} />
                    )}
                  </div>

                  {item.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={resolveImageUrl(item.imageUrl)}
                      alt={item.name}
                      className="w-14 h-14 object-cover rounded-lg flex-shrink-0"
                    />
                  )}

                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-800 text-sm leading-tight">{item.name}</p>
                    {isPaired && phase === "playing" && color && (
                      <p className={`text-xs mt-0.5 truncate font-medium ${color.text}`}>
                        → {connections[item.id]}
                      </p>
                    )}
                    {isCorrect && (
                      <p className="text-xs text-emerald-600 font-semibold mt-0.5">✓ {connections[item.id]}</p>
                    )}
                    {isWrong && (
                      <div>
                        <p className="text-xs text-red-500 line-through mt-0.5">{connections[item.id]}</p>
                        <p className="text-xs text-emerald-700 font-medium">{item.match}</p>
                      </div>
                    )}
                  </div>

                  {isSelected && <span className="text-amber-500 text-xs font-bold flex-shrink-0">◀ select answer</span>}
                </div>
              );
            })}
          </div>

          {/* Right column — answers */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Answers</p>
            {shuffledAnswers.map((answer) => {
              const isUsed = usedAnswers.has(answer);
              const connectedEntry = Object.entries(connections).find(([, v]) => v === answer);
              const connectedItemId = connectedEntry ? Number(connectedEntry[0]) : null;
              const colorIdx = connectedItemId !== null ? pairColors[connectedItemId] : undefined;
              const color    = colorIdx !== undefined ? PAIR_COLORS[colorIdx] : null;

              const connectedItem    = connectedItemId !== null ? items.find((i) => i.id === connectedItemId) : null;
              const isCorrectAnswer  = phase === "checked" && connectedItem?.match === answer;
              const isWrongAnswer    = phase === "checked" && isUsed && !isCorrectAnswer;
              const isHighlightable  = selectedItemId !== null && !isUsed && phase === "playing";

              let cls = "border-slate-200 bg-white text-slate-700";
              if (isHighlightable)  cls = "border-amber-300 bg-amber-50 text-slate-800 hover:border-amber-500 hover:bg-amber-100";
              else if (isCorrectAnswer) cls = "border-emerald-400 bg-emerald-50 text-emerald-700";
              else if (isWrongAnswer)   cls = "border-red-300 bg-red-50 text-red-600";
              else if (color)           cls = `${color.card} ${color.text}`;

              return (
                <div
                  key={answer}
                  onClick={() => isHighlightable ? handleAnswerClick(answer) : undefined}
                  className={`flex items-center gap-2.5 border-2 rounded-xl px-4 py-3 text-sm font-medium transition-all select-none ${cls} ${isHighlightable ? "cursor-pointer" : "cursor-default"}`}
                >
                  {/* Matching color dot */}
                  <div className="flex-shrink-0 w-3">
                    {isCorrectAnswer && <span className="text-emerald-500 text-base leading-none">✓</span>}
                    {isWrongAnswer   && <span className="text-red-500 text-base leading-none">✗</span>}
                    {!isCorrectAnswer && !isWrongAnswer && color && (
                      <span className={`block w-3 h-3 rounded-full ${color.dot}`} />
                    )}
                  </div>
                  <span className="flex-1">{answer}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Revealed view ─────────────────────────────────────────── */}
      {phase === "revealed" && (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="flex items-start gap-4 border border-emerald-200 bg-emerald-50 rounded-xl p-4">
              {item.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={resolveImageUrl(item.imageUrl)}
                  alt={item.name}
                  className="w-16 h-16 object-cover rounded-lg flex-shrink-0"
                />
              )}
              <div>
                <p className="font-semibold text-slate-800">{item.name}</p>
                <p className="text-sm text-emerald-700 font-medium">→ {item.match}</p>
                {item.description && (
                  <p className="text-xs text-slate-500 mt-1">{item.description}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Action bar ────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100">
        {phase === "playing" && (
          <>
            <button
              onClick={handleCheck}
              disabled={!allConnected}
              className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white rounded-xl text-sm font-semibold transition-colors"
            >
              {dict.connectionsCheckButton}
            </button>
            {Object.keys(connections).length > 0 && (
              <span className="text-xs text-slate-400">
                {Object.keys(connections).length}/{items.length} paired
              </span>
            )}
          </>
        )}

        {phase === "checked" && (
          <>
            <div className="flex items-center gap-2">
              <span className={`text-lg font-bold ${correctCount === items.length ? "text-emerald-600" : "text-slate-700"}`}>
                {dict.connectionsScore
                  .replace("{correct}", String(correctCount))
                  .replace("{total}", String(items.length))}
              </span>
              {correctCount === items.length && <span className="text-xl">🎉</span>}
            </div>
            <button
              onClick={() => setPhase("revealed")}
              className="px-4 py-2 border border-slate-300 text-slate-600 hover:bg-slate-50 rounded-xl text-sm font-medium transition-colors"
            >
              {dict.connectionsReveal}
            </button>
            <button
              onClick={handleReset}
              className="px-4 py-2 border border-slate-300 text-slate-600 hover:bg-slate-50 rounded-xl text-sm font-medium transition-colors"
            >
              {dict.connectionsPlayAgain}
            </button>
          </>
        )}

        {phase === "revealed" && (
          <button
            onClick={handleReset}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-medium transition-colors"
          >
            {dict.connectionsPlayAgain}
          </button>
        )}
      </div>
    </div>
  );
}
