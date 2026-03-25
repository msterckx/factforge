"use client";

import Link from "next/link";
import type { Dictionary } from "@/i18n/en";
import { useCompletedChallenges, type CompletedMap } from "@/hooks/useCompletedChallenges";

export type GameCategory = string;
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
  categoryNames?: Record<string, string>;
}

const gameTypeIcons: Record<GameType, string> = {
  chronology: "⏳",
  matching:   "🔗",
  puzzle:     "🧩",
  quiz:       "❓",
  other:      "🎮",
};

const categoryColors: Record<string, string> = {
  geography:  "bg-emerald-700",
  history:    "bg-amber-800",
  television: "bg-purple-700",
  science:    "bg-blue-700",
  sports:     "bg-orange-600",
  other:      "bg-slate-700",
};

function CardInner({ game, isDone }: { game: GameEntry; isDone: boolean }) {
  const colorClass = categoryColors[game.category] ?? "bg-slate-700";
  const isImage = game.icon?.startsWith("http");

  return (
    <div className={`relative aspect-[16/10] overflow-hidden rounded-xl ${colorClass}`}>
      {isImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={game.icon}
          alt={game.label}
          className="absolute inset-0 w-full h-full object-cover"
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
      {/* game type badge */}
      <span className="absolute top-2 left-2 text-sm px-1.5 py-0.5 rounded-md bg-black/30 backdrop-blur-sm" title={game.gameType}>
        {gameTypeIcons[game.gameType]}
      </span>
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

export default function GamePicker({ games, dict, categoryNames = {} }: Props) {
  const { completed } = useCompletedChallenges();

  function getCategoryLabel(slug: string): string {
    if (categoryNames[slug]) return categoryNames[slug];
    // fallback: capitalize slug
    return slug.charAt(0).toUpperCase() + slug.slice(1);
  }

  // Derive unique categories from games, preserving first-seen order, "other" always last
  const seenCats = Array.from(new Set(games.map((g) => g.category)));
  const orderedCats = [...seenCats.filter((c) => c !== "other"), ...seenCats.filter((c) => c === "other")];
  const grouped = orderedCats
    .map((cat) => ({ cat, items: games.filter((g) => g.category === cat) }))
    .filter(({ items }) => items.length > 0);

  const gameTypeLabels: Record<GameType, string> = {
    chronology: dict.gameTypeChronology,
    matching:   dict.gameTypeMatching,
    puzzle:     dict.gameTypePuzzle,
    quiz:       dict.gameTypeQuiz,
    other:      "Other",
  };

  const presentTypes = (["chronology", "matching", "puzzle", "quiz"] as GameType[])
    .filter((t) => games.some((g) => g.gameType === t));

  return (
    <div className="space-y-10">
      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {presentTypes.map((t) => (
          <span key={t} className="flex items-center gap-1.5 text-sm text-slate-600">
            <span className="text-base">{gameTypeIcons[t]}</span>
            {gameTypeLabels[t]}
          </span>
        ))}
      </div>

      {grouped.map(({ cat, items }) => (
        <section key={cat}>
          {cat !== "other" && (
            <h2 className="text-lg font-bold text-slate-700 mb-4">
              {getCategoryLabel(cat)}
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
