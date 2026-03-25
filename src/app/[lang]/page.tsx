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
      <div className="text-center mb-10">
        <p className="text-xs uppercase tracking-widest text-amber-600 font-semibold mb-2">
          {dict.home.welcomeTo}
        </p>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-800 mb-2">
          Game<span className="text-amber-500"> of Trivia</span>
        </h1>
        <p className="text-slate-500 text-lg">{dict.home.subtitle}</p>
      </div>

      <GamePicker games={games} dict={d} scores={scores} categoryNames={categoryNames} />
    </div>
  );
}
