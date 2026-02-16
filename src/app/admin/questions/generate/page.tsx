export const dynamic = "force-dynamic";

import { db } from "@/db";
import { categories } from "@/db/schema";
import AIQuestionGenerator from "@/components/AIQuestionGenerator";

export default async function GenerateQuestionsPage() {
  const allCategories = db
    .select({ id: categories.id, name: categories.name })
    .from(categories)
    .orderBy(categories.name)
    .all();

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Generate Questions with AI</h1>
      <AIQuestionGenerator categories={allCategories} />
    </div>
  );
}
