import { db } from "@/db";
import { categories, questions } from "@/db/schema";
import { eq, count } from "drizzle-orm";
import CategoryCard from "@/components/CategoryCard";

export default async function HomePage() {
  const results = await db
    .select({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
      questionCount: count(questions.id),
    })
    .from(categories)
    .leftJoin(questions, eq(categories.id, questions.categoryId))
    .groupBy(categories.id)
    .orderBy(categories.name);

  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Choose a Category</h1>
      <p className="text-slate-500 mb-8">Select a category to start testing your knowledge.</p>

      {results.length === 0 ? (
        <p className="text-slate-400 text-center py-12">No categories available yet.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {results.map((cat) => (
            <CategoryCard
              key={cat.id}
              name={cat.name}
              slug={cat.slug}
              questionCount={cat.questionCount}
            />
          ))}
        </div>
      )}
    </div>
  );
}
