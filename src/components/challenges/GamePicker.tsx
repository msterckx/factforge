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

const categoryColors: Record<GameCategory, string> = {
  geography:  "bg-emerald-700",
  history:    "bg-amber-800",
  television: "bg-purple-700",
  science:    "bg-blue-700",
  sports:     "bg-orange-600",
  other:      "bg-slate-700",
};

function CardInner({ game, isDone }: { game: GameEntry; isDone: boolean }) {
  const colorClass = categoryColors[game.category];
  const isImage = game.icon?.startsWith("http");

  return (
    <div className={`relative aspect-[3/4] overflow-hidden rounded-xl ${colorClass}`}>
      {isImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={game.icon}
          alt={game.label}
          className="absolute inset-0 w-full h-full object-contain"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-7xl">{game.icon}</span>
        </div>
      )}
      {/* bottom label */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-3 pt-8 pb-3">
        <p className="font-semibold text-white text-center text-sm leading-tight">{game.label}</p>
      </div>
      {isDone && (
        <span className="absolute top-2 right-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-white/20 text-white backdrop-blur-sm">
          ✓ done
        </span>
      )}
    </div>
  );
}

function GameCard({ game, completed }: { game: GameEntry; completed: CompletedMap }) {
  const isDone = !!completed[game.challengeId];

  if (game.available) {
    return (
      <Link
        href={game.href}
        className="block rounded-xl shadow-sm hover:shadow-lg hover:brightness-110 transition-all"
      >
        <CardInner game={game} isDone={isDone} />
      </Link>
    );
  }

  return (
    <div className="rounded-xl opacity-40 grayscale">
      <CardInner game={game} isDone={false} />
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
