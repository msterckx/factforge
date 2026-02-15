import { db } from "@/db";
import { questions, categories } from "@/db/schema";
import { eq } from "drizzle-orm";
import AnswerChecker from "@/components/AnswerChecker";

export default async function QuickQuizPage() {
  const allQuestions = await db
    .select({
      id: questions.id,
      questionText: questions.questionText,
      answer: questions.answer,
      imagePath: questions.imagePath,
      didYouKnow: questions.didYouKnow,
      difficulty: questions.difficulty,
    })
    .from(questions)
    .orderBy(questions.id);

  // Shuffle questions for a random quiz experience
  const shuffled = [...allQuestions].sort(() => Math.random() - 0.5);

  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Quick Quiz</h1>
      <p className="text-slate-500 mb-8">
        Random questions from all categories. How many can you get right?
      </p>

      {shuffled.length === 0 ? (
        <p className="text-slate-400 text-center py-12">
          No questions available yet.
        </p>
      ) : (
        <AnswerChecker questions={shuffled} categoryName="All Categories" />
      )}
    </div>
  );
}
