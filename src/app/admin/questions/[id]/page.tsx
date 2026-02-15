export const dynamic = "force-dynamic";

import { db } from "@/db";
import { questions, categories } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import QuestionForm from "@/components/QuestionForm";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditQuestionPage({ params }: Props) {
  const { id } = await params;
  const questionId = parseInt(id);

  if (isNaN(questionId)) {
    notFound();
  }

  const question = db.select().from(questions).where(eq(questions.id, questionId)).get();

  if (!question) {
    notFound();
  }

  const allCategories = db
    .select({ id: categories.id, name: categories.name })
    .from(categories)
    .orderBy(categories.name)
    .all();

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Edit Question</h1>
      <QuestionForm categories={allCategories} question={question} />
    </div>
  );
}
