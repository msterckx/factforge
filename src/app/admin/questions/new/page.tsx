export const dynamic = "force-dynamic";

import { db } from "@/db";
import { categories } from "@/db/schema";
import QuestionForm from "@/components/QuestionForm";

export default async function NewQuestionPage() {
  const allCategories = db
    .select({ id: categories.id, name: categories.name })
    .from(categories)
    .orderBy(categories.name)
    .all();

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Add New Question</h1>
      <QuestionForm categories={allCategories} />
    </div>
  );
}
