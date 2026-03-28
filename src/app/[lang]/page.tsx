export const dynamic = "force-dynamic";

import { isValidLang, getDictionary, type Lang } from "@/i18n";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { challengeScores, categories } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { getAllChallengeGames } from "@/data/challengeGame";
import GamePicker from "@/components/challenges/GamePicker";
import type { GameEntry, ScoreMap } from "@/components/challenges/GamePicker";

interface Props {
  params: Promise<{ lang: string }>;
}

export default async function HomePage({ params }: Props) {
  const { lang } = await params;
  if (!isValidLang(lang)) notFound();
  const dict = await getDictionary(lang as Lang);
  const d = dict.challenges;

  const session = await auth();
  const scores: ScoreMap = {};
  if (session?.user?.email) {
    const rows = db
      .select()
      .from(challengeScores)
      .where(eq(challengeScores.userEmail, session.user.email))
      .all();
    for (const row of rows) {
      const existing = scores[row.challengeId];
      if (!existing || row.score > existing.score) {
        scores[row.challengeId] = { score: row.score, maxScore: row.maxScore };
      }
    }
  }

  const dbGames = getAllChallengeGames();
  const dbCategories = db.select({ slug: categories.slug, name: categories.name }).from(categories).orderBy(asc(categories.name)).all();
  const categoryNames: Record<string, string> = Object.fromEntries(dbCategories.map((c) => [c.slug, c.name]));

  const games: GameEntry[] = dbGames.map((game) => ({
    challengeId: game.slug,
    href:        game.available ? `/${lang}/challenges/${game.slug}` : "#",
    icon:        game.icon,
    label:       lang === "nl" ? game.titleNl    || game.titleEn    : game.titleEn,
    subtitle:    lang === "nl" ? game.subtitleNl || game.subtitleEn : game.subtitleEn,
    category:    game.category,
    gameType:    game.gameType,
    available:   game.available,
  }));

  return (
    <div className="max-w-7xl mx-auto">
      {/* Hero */}
      <div className="relative overflow-hidden bg-[#FCF5F6] rounded-xl mb-10">
        {/* Capitol image — full width, bleeds under title */}
        <div className="absolute inset-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logos/us_capitol_long.png"
            alt="US Capitol"
            className="w-full h-full object-cover object-center"
          />
          {/* smooth gradient: fully opaque on left edge, fades to transparent */}
          <div className="absolute inset-0" style={{ background: "linear-gradient(to right, #FCF5F6 0%, #FCF5F6 18%, rgba(252,245,246,0.85) 35%, rgba(252,245,246,0.3) 55%, transparent 70%)" }} />
        </div>

        {/* Text content */}
        <div className="relative z-10 px-10 py-5 sm:py-12 max-w-xl">
          <h1
            className="text-6xl sm:text-7xl font-bold leading-tight mb-5"
            style={{ fontFamily: "var(--font-cormorant), serif", color: "#28324E" }}
          >
            Game of Trivia
          </h1>
          <p className="text-slate-600 text-lg mb-8 max-w-sm">{dict.home.subtitle}</p>
          <a
            href="#challenges"
            className="inline-block text-white font-semibold px-6 py-3 rounded-lg transition-colors"
            style={{ backgroundColor: "#D7AA50" }}
          >
            {dict.home.startQuiz}
          </a>
        </div>
      </div>

      <div id="challenges">
        <GamePicker games={games} dict={d} scores={scores} categoryNames={categoryNames} />
      </div>
    </div>
  );
}
