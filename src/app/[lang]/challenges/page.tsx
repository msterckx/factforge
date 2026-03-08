import { isValidLang, getDictionary, type Lang } from "@/i18n";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { challengeScores } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getAllChallengeGames } from "@/data/challengeGame";
import GamePicker from "@/components/challenges/GamePicker";
import type { GameEntry, ScoreMap } from "@/components/challenges/GamePicker";

interface Props {
  params: Promise<{ lang: string }>;
}

export default async function ChallengesPage({ params }: Props) {
  const { lang } = await params;
  if (!isValidLang(lang)) notFound();
  const dict = await getDictionary(lang as Lang);
  const d = dict.challenges;

  // Fetch personal best scores for logged-in users
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
      <h1 className="text-3xl font-bold text-slate-800 mb-2">{d.title}</h1>
      <p className="text-slate-500 mb-8">{d.subtitle}</p>

      <GamePicker games={games} dict={d} scores={scores} />
    </div>
  );
}
