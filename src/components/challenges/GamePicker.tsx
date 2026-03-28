"use client";

import Link from "next/link";
import { useRef, useState, useEffect, useCallback } from "react";
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
        className="block rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.18)] hover:shadow-[0_12px_32px_rgba(0,0,0,0.28)] hover:brightness-110 transition-all"
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

function CategoryRow({ items, completed }: { items: GameEntry[]; completed: CompletedMap }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft]   = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [currentPage, setCurrentPage]       = useState(0);
  const [totalPages, setTotalPages]         = useState(1);

  const update = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const left  = el.scrollLeft;
    const width = el.clientWidth;
    const full  = el.scrollWidth;
    setCanScrollLeft(left > 4);
    setCanScrollRight(Math.round(left + width) < full - 4);
    setTotalPages(Math.max(1, Math.ceil(full / width)));
    setCurrentPage(Math.round(left / width));
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [update]);

  const scroll = (dir: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === "right" ? el.clientWidth : -el.clientWidth, behavior: "smooth" });
  };

  const scrollToPage = (page: number) => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ left: page * el.clientWidth, behavior: "smooth" });
  };

  return (
    <div className="relative">
      {/* Left arrow — desktop only */}
      {canScrollLeft && (
        <button
          onClick={() => scroll("left")}
          aria-label="Scroll left"
          className="hidden sm:flex absolute left-0 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-white/90 shadow-lg items-center justify-center text-2xl leading-none text-slate-700 hover:bg-white transition-colors backdrop-blur-sm"
        >
          ‹
        </button>
      )}

      {/* Scrollable row — native swipe on mobile, snap per page */}
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto snap-x snap-mandatory [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: "none" }}
      >
        {items.map((game) => (
          <div
            key={game.challengeId}
            className="flex-none snap-start w-[calc(50%-8px)] xl:w-[calc(33.333%-10.667px)] 2xl:w-[calc(25%-12px)]"
          >
            <GameCard game={game} completed={completed} />
          </div>
        ))}
      </div>

      {/* Right arrow — desktop only */}
      {canScrollRight && (
        <button
          onClick={() => scroll("right")}
          aria-label="Scroll right"
          className="hidden sm:flex absolute right-0 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-white/90 shadow-lg items-center justify-center text-2xl leading-none text-slate-700 hover:bg-white transition-colors backdrop-blur-sm"
        >
          ›
        </button>
      )}

      {/* Page dots */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-1.5 mt-3">
          {Array.from({ length: totalPages }).map((_, i) => (
            <button
              key={i}
              onClick={() => scrollToPage(i)}
              aria-label={`Go to page ${i + 1}`}
              className={`rounded-full transition-all duration-200 ${
                i === currentPage
                  ? "w-2.5 h-2.5 bg-[#D7AA50]"
                  : "w-2 h-2 bg-slate-300 hover:bg-slate-400"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function GamePicker({ games, dict, categoryNames = {} }: Props) {
  const { completed } = useCompletedChallenges();

  function getCategoryLabel(slug: string): string {
    if (categoryNames[slug]) return categoryNames[slug];
    return slug.charAt(0).toUpperCase() + slug.slice(1);
  }

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
            <h2
              className="text-lg font-bold mb-4"
              style={{ fontFamily: "var(--font-cormorant), serif", color: "#28324E" }}
            >
              {getCategoryLabel(cat)}
            </h2>
          )}
          <CategoryRow items={items} completed={completed} />
        </section>
      ))}
    </div>
  );
}
