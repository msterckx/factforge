import { isValidLang, getDictionary, type Lang } from "@/i18n";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  getChallengeGameBySlug,
  getChallengeItems,
  mapToChronologyItems,
  mapToPuzzleSubjects,
} from "@/data/challengeGame";
import { db } from "@/db";
import { questions, questionTranslations, subcategories, subcategoryTranslations } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import ChronologyGame from "@/components/challenges/ChronologyGame";
import PuzzleGame from "@/components/challenges/PuzzleGame";
import QuizChallenge from "@/components/challenges/QuizChallenge";
import type { QuizQuestion } from "@/components/challenges/QuizChallenge";

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

  const title    = lang === "nl" ? game.titleNl    || game.titleEn    : game.titleEn;
  const subtitle = lang === "nl" ? game.subtitleNl || game.subtitleEn : game.subtitleEn;

  // ── Quiz type: fetch questions from the linked category ──────────────────
  let quizQuestions: QuizQuestion[] = [];
  if (game.gameType === "quiz" && game.quizCategoryId) {
    const catId = game.quizCategoryId;
    const subId = game.quizSubcategoryId ?? null;

    let rows: QuizQuestion[];
    if (lang === "en") {
      rows = db.select({
        id:           questions.id,
        questionText: questions.questionText,
        answer:       questions.answer,
        imagePath:    questions.imagePath,
        didYouKnow:   questions.didYouKnow,
        difficulty:   questions.difficulty,
      }).from(questions)
        .where(subId
          ? and(eq(questions.categoryId, catId), eq(questions.subcategoryId, subId))
          : eq(questions.categoryId, catId))
        .all();
    } else {
      const raw = db.select({
        id:                  questions.id,
        questionText:        questions.questionText,
        answer:              questions.answer,
        imagePath:           questions.imagePath,
        didYouKnow:          questions.didYouKnow,
        difficulty:          questions.difficulty,
        translatedText:      questionTranslations.questionText,
        translatedAnswer:    questionTranslations.answer,
        translatedDidYouKnow: questionTranslations.didYouKnow,
      }).from(questions)
        .leftJoin(questionTranslations, and(
          eq(questionTranslations.questionId, questions.id),
          eq(questionTranslations.language, lang)
        ))
        .where(subId
          ? and(eq(questions.categoryId, catId), eq(questions.subcategoryId, subId))
          : eq(questions.categoryId, catId))
        .all();
      rows = raw.map((r) => ({
        id:           r.id,
        questionText: r.translatedText   ?? r.questionText,
        answer:       r.translatedAnswer ?? r.answer,
        didYouKnow:   r.translatedDidYouKnow ?? r.didYouKnow,
        imagePath:    r.imagePath,
        difficulty:   r.difficulty,
      }));
    }

    // Shuffle + optionally cap
    const shuffled = [...rows].sort(() => Math.random() - 0.5);
    quizQuestions = game.quizQuestionLimit ? shuffled.slice(0, game.quizQuestionLimit) : shuffled;
  }

  // ── Chronology / puzzle items ──────────────────────────────────────────────
  const items = game.gameType !== "quiz" ? getChallengeItems(game.id) : [];

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
      {game.gameType === "quiz" && quizQuestions.length > 0 && (
        <QuizChallenge
          questions={quizQuestions}
          dict={dict}
          challengeId={game.slug}
        />
      )}
      {game.gameType === "quiz" && quizQuestions.length === 0 && (
        <p className="text-slate-400 text-center py-12">{dict.category.noQuestions}</p>
      )}
    </div>
  );
}
