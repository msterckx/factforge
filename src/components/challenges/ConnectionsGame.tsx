"use client";

import { useState, useMemo, useEffect } from "react";
import type { Dictionary } from "@/i18n/en";
import type { ConnectionItem } from "@/types/connections";
import { useCompletedChallenges } from "@/hooks/useCompletedChallenges";

interface Props {
  items: ConnectionItem[];
  dict: Dictionary["challenges"];
  challengeId: string;
}

type Phase = "playing" | "checked" | "revealed";

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

  // Shuffled display order for left (items) and right (answers)
  const shuffledItems   = useMemo(() => shuffle(items), [items]);
  const shuffledAnswers = useMemo(() => shuffle(items.map((i) => i.match)), [items]);

  // connections[itemId] = answer string the player has selected
  const [connections, setConnections] = useState<Record<number, string>>({});
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [phase, setPhase] = useState<Phase>("playing");
  const [correctCount, setCorrectCount] = useState(0);

  // Reset when items change (new challenge loaded)
  useEffect(() => {
    setConnections({});
    setSelectedItemId(null);
    setPhase("playing");
    setCorrectCount(0);
  }, [items]);

  function handleItemClick(itemId: number) {
    if (phase !== "playing") return;
    setSelectedItemId((prev) => (prev === itemId ? null : itemId));
  }

  function handleAnswerClick(answer: string) {
    if (phase !== "playing") return;
    if (selectedItemId === null) return;

    setConnections((prev) => {
      const next = { ...prev };
      // Remove any other item that had this answer
      for (const [k, v] of Object.entries(next)) {
        if (v === answer) delete next[Number(k)];
      }
      next[selectedItemId] = answer;
      return next;
    });
    setSelectedItemId(null);
  }

  function handleDisconnect(itemId: number) {
    if (phase !== "playing") return;
    setConnections((prev) => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
  }

  function handleCheck() {
    const correct = items.filter((item) => connections[item.id] === item.match).length;
    setCorrectCount(correct);
    setPhase("checked");
    if (correct === items.length) {
      markComplete(challengeId, correct, items.length);
    }
  }

  function handleReveal() {
    setPhase("revealed");
  }

  function handleReset() {
    setConnections({});
    setSelectedItemId(null);
    setPhase("playing");
    setCorrectCount(0);
  }

  const allConnected = items.every((item) => connections[item.id] !== undefined);

  // Used answers (to dim them on the right side)
  const usedAnswers = new Set(Object.values(connections));

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
              const isConnected = connections[item.id] !== undefined;
              const isCorrect   = phase === "checked" && connections[item.id] === item.match;
              const isWrong     = phase === "checked" && isConnected && connections[item.id] !== item.match;

              let borderClass = "border-slate-200 bg-white hover:border-amber-300";
              if (isSelected)   borderClass = "border-amber-400 bg-amber-50 ring-2 ring-amber-300";
              if (isConnected && phase === "playing") borderClass = "border-amber-300 bg-amber-50";
              if (isCorrect)    borderClass = "border-emerald-400 bg-emerald-50";
              if (isWrong)      borderClass = "border-red-400 bg-red-50";

              return (
                <div
                  key={item.id}
                  onClick={() => isConnected && phase === "playing" ? handleDisconnect(item.id) : handleItemClick(item.id)}
                  className={`flex items-center gap-3 border-2 rounded-xl p-3 cursor-pointer transition-all select-none ${borderClass}`}
                >
                  {item.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="w-14 h-14 object-cover rounded-lg flex-shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-800 text-sm leading-tight">{item.name}</p>
                    {isConnected && phase === "playing" && (
                      <p className="text-xs text-amber-600 mt-0.5 truncate">→ {connections[item.id]}</p>
                    )}
                    {isCorrect && (
                      <p className="text-xs text-emerald-600 font-semibold mt-0.5">✓ {connections[item.id]}</p>
                    )}
                    {isWrong && (
                      <div>
                        <p className="text-xs text-red-500 line-through mt-0.5">{connections[item.id]}</p>
                        <p className="text-xs text-emerald-700 font-medium">{dict.connectionsReveal}: {item.match}</p>
                      </div>
                    )}
                  </div>
                  {isCorrect && <span className="text-emerald-500 text-lg flex-shrink-0">✓</span>}
                  {isWrong   && <span className="text-red-500 text-lg flex-shrink-0">✗</span>}
                  {isSelected && <span className="text-amber-500 text-sm flex-shrink-0">◀</span>}
                </div>
              );
            })}
          </div>

          {/* Right column — answers */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Answers</p>
            {shuffledAnswers.map((answer) => {
              const isUsed = usedAnswers.has(answer);
              const connectedItemId = Object.entries(connections).find(([, v]) => v === answer)?.[0];
              const connectedItem   = connectedItemId ? items.find((i) => i.id === Number(connectedItemId)) : null;

              const isCorrectAnswer = phase === "checked" && connectedItem?.match === answer;
              const isWrongAnswer   = phase === "checked" && isUsed && connectedItem?.match !== answer;
              const isHighlighted   = selectedItemId !== null && !isUsed;

              let cls = "border-slate-200 bg-white text-slate-700";
              if (isHighlighted) cls = "border-amber-200 bg-amber-50 text-slate-800 hover:border-amber-400 hover:bg-amber-100";
              if (isUsed && phase === "playing") cls = "border-amber-300 bg-amber-50 text-amber-700";
              if (isCorrectAnswer) cls = "border-emerald-400 bg-emerald-50 text-emerald-700";
              if (isWrongAnswer)   cls = "border-red-300 bg-red-50 text-red-600";

              return (
                <div
                  key={answer}
                  onClick={() => !isUsed ? handleAnswerClick(answer) : undefined}
                  className={`border-2 rounded-xl px-4 py-3 text-sm font-medium transition-all select-none ${cls} ${!isUsed && phase === "playing" ? "cursor-pointer" : "cursor-default"}`}
                >
                  {answer}
                  {isCorrectAnswer && <span className="float-right text-emerald-500">✓</span>}
                  {isWrongAnswer   && <span className="float-right text-red-500">✗</span>}
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
                  src={item.imageUrl}
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
          <button
            onClick={handleCheck}
            disabled={!allConnected}
            className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white rounded-xl text-sm font-semibold transition-colors"
          >
            {dict.connectionsCheckButton}
          </button>
        )}

        {phase === "checked" && (
          <>
            <div className="flex items-center gap-2">
              <span className={`text-lg font-bold ${correctCount === items.length ? "text-emerald-600" : "text-slate-700"}`}>
                {dict.connectionsScore
                  .replace("{correct}", String(correctCount))
                  .replace("{total}", String(items.length))}
              </span>
              {correctCount === items.length && <span className="text-emerald-600 text-xl">🎉</span>}
            </div>
            <button
              onClick={handleReveal}
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
