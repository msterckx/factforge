"use client";

import Link from "next/link";
import type { Dictionary } from "@/i18n/en";
import { useCompletedChallenges, type CompletedMap } from "@/hooks/useCompletedChallenges";

export type GameCategory = "geography" | "history" | "television" | "science" | "sports" | "other";
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

interface Props {
  games: GameEntry[];
  dict: Dictionary["challenges"];
  scores: ScoreMap;
}

function GameCard({ game, completed }: { game: GameEntry; completed: CompletedMap }) {
  if (game.available) {
    return (
      <Link
        href={game.href}
        className={`relative flex flex-col items-center gap-2 p-4 bg-white rounded-xl border shadow-sm hover:shadow-md hover:border-amber-400 transition-all group ${completed[game.challengeId] ? "border-green-300" : "border-slate-200"}`}
      >
        {completed[game.challengeId] && (
          <span className="absolute top-2 right-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
            ✓ done
          </span>
        )}
        {game.icon?.startsWith("http") ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={game.icon} alt={game.label} className="w-12 h-12 rounded-lg object-cover" />
        ) : (
          <span className="text-3xl">{game.icon}</span>
        )}
        <p className="font-semibold text-slate-800 group-hover:text-amber-700 transition-colors text-center">
          {game.label}
        </p>
      </Link>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2 p-4 bg-slate-50 rounded-xl border border-slate-100 opacity-50">
      {game.icon?.startsWith("http") ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={game.icon} alt={game.label} className="w-12 h-12 rounded-lg object-cover grayscale" />
      ) : (
        <span className="text-3xl grayscale">{game.icon}</span>
      )}
      <p className="font-semibold text-slate-500 text-center">{game.label}</p>
    </div>
  );
}

export default function GamePicker({ games, dict }: Props) {
  const { completed } = useCompletedChallenges();

  const categoryLabels: Record<GameCategory, string> = {
    geography:  dict.categoryGeography,
    history:    dict.categoryHistory,
    television: dict.categoryTelevision,
    science:    dict.categoryScience,
    sports:     dict.categorySports,
    other:      dict.filterAll,
  };

  const categories: GameCategory[] = ["geography", "history", "television", "science", "sports", "other"];
  const grouped = categories
    .map((cat) => ({ cat, items: games.filter((g) => g.category === cat) }))
    .filter(({ items }) => items.length > 0);

  return (
    <div className="space-y-10">
      {grouped.map(({ cat, items }) => (
        <section key={cat}>
          {cat !== "other" && (
            <h2 className="text-lg font-bold text-slate-700 mb-4 capitalize">
              {categoryLabels[cat]}
            </h2>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((game) => (
              <GameCard key={game.label} game={game} completed={completed} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
