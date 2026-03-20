"use client";

import { useState } from "react";
import Link from "next/link";
import type { Dictionary } from "@/i18n/en";
import { useCompletedChallenges } from "@/hooks/useCompletedChallenges";

export type GameCategory = "history" | "science" | "other";
export type GameType = "chronology" | "matching" | "puzzle" | "quiz" | "other";

export interface GameEntry {
  challengeId: string;
  href: string;
  icon: string;
  label: string;
  subtitle: string;
  category: GameCategory;
  gameType: GameType;
  available: boolean;
}

export type ScoreMap = Record<string, { score: number; maxScore: number } | undefined>;

type FilterMode = "category" | "gametype";
type CategoryFilter = "all" | GameCategory;
type TypeFilter = "all" | "chronology" | "puzzle" | "quiz";

interface Props {
  games: GameEntry[];
  dict: Dictionary["challenges"];
  scores: ScoreMap;
}

export default function GamePicker({ games, dict, scores }: Props) {
  const { completed } = useCompletedChallenges();
  const [mode, setMode] = useState<FilterMode>("category");
  const [cat, setCat] = useState<CategoryFilter>("all");
  const [type, setType] = useState<TypeFilter>("all");

  const categoryLabels: Record<string, string> = {
    all: dict.filterAll,
    history: dict.categoryHistory,
    science: dict.categoryScience,
    other: dict.filterAll,
  };

  const typeLabels: Record<string, string> = {
    all:        dict.filterAll,
    chronology: dict.gameTypeChronology,
    puzzle:     dict.gameTypePuzzle,
    quiz:       dict.gameTypeQuiz,
    other:      dict.filterAll,
  };

  const visible = games.filter((g) => {
    if (mode === "category" && cat !== "all") return g.category === cat;
    if (mode === "gametype" && type !== "all") return g.gameType === type;
    return true;
  });

  return (
    <div>
      {/* Filter mode toggle */}
      <div className="flex items-center gap-3 mb-5">
        <span className="text-sm font-medium text-slate-500">{dict.filterBy}:</span>
        <div className="flex gap-1 p-1 bg-slate-100 rounded-lg">
          {(["category", "gametype"] as FilterMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={[
                "px-3 py-1 text-sm rounded-md transition-all",
                mode === m
                  ? "bg-white shadow-sm text-slate-800 font-semibold"
                  : "text-slate-500 hover:text-slate-700",
              ].join(" ")}
            >
              {m === "category" ? dict.filterByCategory : dict.filterByGameType}
            </button>
          ))}
        </div>
      </div>

      {/* Sub-filter pills */}
      <div className="flex flex-wrap gap-2 mb-8">
        {mode === "category"
          ? (["all", "history", "science"] as CategoryFilter[]).map((c) => (
              <button
                key={c}
                onClick={() => setCat(c)}
                className={[
                  "px-4 py-1.5 text-sm rounded-full border font-medium transition-all",
                  cat === c
                    ? "bg-amber-500 border-amber-500 text-white"
                    : "border-slate-300 text-slate-600 hover:border-amber-400 hover:bg-amber-50",
                ].join(" ")}
              >
                {categoryLabels[c]}
              </button>
            ))
          : (["all", "chronology", "puzzle", "quiz"] as TypeFilter[]).map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={[
                  "px-4 py-1.5 text-sm rounded-full border font-medium transition-all",
                  type === t
                    ? "bg-amber-500 border-amber-500 text-white"
                    : "border-slate-300 text-slate-600 hover:border-amber-400 hover:bg-amber-50",
                ].join(" ")}
              >
                {typeLabels[t]}
              </button>
            ))}
      </div>

      {/* Game grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {visible.map((game) =>
          game.available ? (
            <Link
              key={game.label}
              href={game.href}
              className={`relative flex flex-col items-center gap-3 p-6 bg-white rounded-xl border shadow-sm hover:shadow-md hover:border-amber-400 transition-all group ${completed[game.challengeId] ? "border-green-300" : "border-slate-200"}`}
            >
              {completed[game.challengeId] && (
                <span className="absolute top-2 right-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                  ✓ done
                </span>
              )}
              {game.icon?.startsWith("http") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={game.icon} alt={game.label} className="w-16 h-16 rounded-lg object-cover" />
              ) : (
                <span className="text-4xl">{game.icon}</span>
              )}
              <div className="text-center">
                <p className="font-semibold text-slate-800 group-hover:text-amber-700 transition-colors">
                  {game.label}
                </p>
                <p className="text-sm text-slate-400 mt-1 leading-snug">{game.subtitle}</p>
              </div>
              <div className="flex gap-1.5 mt-auto pt-1 flex-wrap justify-center">
                {game.category !== "other" && (
                  <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                    {categoryLabels[game.category]}
                  </span>
                )}
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                  {typeLabels[game.gameType] ?? game.gameType}
                </span>
              </div>
            </Link>
          ) : (
            <div
              key={game.label}
              className="flex flex-col items-center gap-3 p-6 bg-slate-50 rounded-xl border border-slate-100 opacity-50"
            >
              {game.icon?.startsWith("http") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={game.icon} alt={game.label} className="w-16 h-16 rounded-lg object-cover grayscale" />
              ) : (
                <span className="text-4xl grayscale">{game.icon}</span>
              )}
              <div className="text-center">
                <p className="font-semibold text-slate-500">{game.label}</p>
                <p className="text-sm text-slate-400 mt-1">{dict.comingSoon}</p>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}
