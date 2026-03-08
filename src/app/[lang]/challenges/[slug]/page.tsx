import { isValidLang, getDictionary, type Lang } from "@/i18n";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  getChallengeGameBySlug,
  getChallengeItems,
  mapToChronologyItems,
  mapToPuzzleSubjects,
} from "@/data/challengeGame";
import ChronologyGame from "@/components/challenges/ChronologyGame";
import PuzzleGame from "@/components/challenges/PuzzleGame";

interface Props {
  params: Promise<{ lang: string; slug: string }>;
}

export default async function ChallengePage({ params }: Props) {
  const { lang, slug } = await params;
  if (!isValidLang(lang)) notFound();

  const game = getChallengeGameBySlug(slug);
  if (!game || !game.available) notFound();

  const dict = await getDictionary(lang as Lang);
  const d = dict.challenges;

  const items = getChallengeItems(game.id);
  const title    = lang === "nl" ? game.titleNl    || game.titleEn    : game.titleEn;
  const subtitle = lang === "nl" ? game.subtitleNl || game.subtitleEn : game.subtitleEn;

  return (
    <div>
      <Link
        href={`/${lang}/challenges`}
        className="inline-flex items-center text-sm text-slate-500 hover:text-slate-700 mb-6 transition-colors"
      >
        &larr; {d.backToChallenges}
      </Link>

      <h1 className="text-2xl font-bold text-slate-800 mb-1">{title}</h1>
      <p className="text-slate-500 text-sm mb-6">{subtitle}</p>

      {game.gameType === "chronology" && (
        <ChronologyGame
          items={mapToChronologyItems(items, lang)}
          dict={d}
          challengeId={game.slug}
        />
      )}
      {game.gameType === "puzzle" && (
        <PuzzleGame
          subjects={mapToPuzzleSubjects(items, lang)}
          dict={d}
          challengeId={game.slug}
        />
      )}
    </div>
  );
}
