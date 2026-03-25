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
    <div>
      {/* Hero */}
      <div className="relative overflow-hidden bg-stone-100 mb-10 -mx-4 -mt-8">
        {/* Capitol image — right-anchored, fades left */}
        <div className="absolute inset-y-0 right-0 w-full sm:w-3/4 md:w-2/3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logos/us_capitol.png"
            alt="US Capitol"
            className="w-full h-full object-cover object-left"
          />
          {/* gradient fade from stone-100 on left */}
          <div className="absolute inset-0 bg-gradient-to-r from-stone-100 via-stone-100/80 to-transparent" />
        </div>

        {/* Text content */}
        <div className="relative z-10 px-8 py-14 sm:py-20 max-w-lg">
          <h1
            className="text-5xl sm:text-6xl font-bold text-slate-800 leading-tight mb-4"
            style={{ fontFamily: "var(--font-playfair), serif" }}
          >
            Game <span className="text-amber-500">of Trivia</span>
          </h1>
          <p className="text-slate-600 text-lg mb-8">{dict.home.subtitle}</p>
        </div>
      </div>

      <div className="px-2">
        <GamePicker games={games} dict={d} scores={scores} categoryNames={categoryNames} />
      </div>
    </div>
  );
}
