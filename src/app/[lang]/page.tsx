export const dynamic = "force-dynamic";

import { db } from "@/db";
import { categories, questions, categoryTranslations } from "@/db/schema";
import { eq, count, and } from "drizzle-orm";
import CategoryCard from "@/components/CategoryCard";
import Link from "next/link";
import { isValidLang, getDictionary, type Lang } from "@/i18n";
import { notFound } from "next/navigation";

interface Props {
  params: Promise<{ lang: string }>;
}

export default async function HomePage({ params }: Props) {
  const { lang } = await params;
  if (!isValidLang(lang)) notFound();
  const dict = await getDictionary(lang as Lang);

  let results;

  if (lang === "en") {
    results = await db
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
  } else {
    const rows = await db
      .select({
        id: categories.id,
        name: categories.name,
        slug: categories.slug,
        questionCount: count(questions.id),
        translatedName: categoryTranslations.name,
      })
      .from(categories)
      .leftJoin(questions, eq(categories.id, questions.categoryId))
      .leftJoin(
        categoryTranslations,
        and(
          eq(categoryTranslations.categoryId, categories.id),
          eq(categoryTranslations.language, lang)
        )
      )
      .groupBy(categories.id)
      .orderBy(categories.name);

    results = rows.map((r) => ({
      id: r.id,
      name: r.translatedName ?? r.name,
      slug: r.slug,
      questionCount: r.questionCount,
    }));
  }

  const [totalQuestions] = await db.select({ value: count() }).from(questions);

  return (
    <div>
      {/* Hero Section */}
      <div className="text-center mb-10">
        <p className="text-xs uppercase tracking-widest text-amber-600 font-semibold mb-2">
          {dict.home.welcomeTo}
        </p>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-800 mb-2">
          Game<span className="text-amber-500"> of Trivia</span>
        </h1>
        <p className="text-slate-500 text-lg">{dict.home.subtitle}</p>
      </div>

      {/* Stats Bar */}
      <div className="flex justify-center gap-4 mb-10 flex-wrap">
        <div className="flex items-center gap-2 bg-white rounded-full px-4 py-2 shadow-sm border border-slate-200">
          <span className="w-2.5 h-2.5 rounded-full bg-green-400"></span>
          <span className="text-sm font-semibold text-slate-700">{totalQuestions.value}</span>
          <span className="text-xs text-slate-400">{dict.home.questionsAvailable}</span>
        </div>
        <div className="flex items-center gap-2 bg-white rounded-full px-4 py-2 shadow-sm border border-slate-200">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
          <span className="text-sm font-semibold text-slate-700">{results.length}</span>
          <span className="text-xs text-slate-400">{dict.home.categories}</span>
        </div>
      </div>

      {/* Section Heading */}
      <div className="text-center mb-6">
        <h2 className="text-xl font-bold text-slate-800">{dict.home.chooseCategory}</h2>
        <p className="text-sm text-slate-400 mt-1">{dict.home.pickCategory}</p>
      </div>

      {/* Category Grid */}
      {results.length === 0 ? (
        <p className="text-slate-400 text-center py-12">{dict.home.noCategories}</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {/* Quick Quiz card */}
          <Link
            href={`/${lang}/quickquiz`}
            className="flex items-center gap-4 bg-amber-50 rounded-xl shadow-sm hover:shadow-md transition-all p-4 border border-amber-200 hover:border-amber-400 group"
          >
            <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center text-2xl shrink-0 group-hover:bg-amber-200 transition-colors">
              {"\u{26A1}"}
            </div>
            <div>
              <h2 className="text-base font-semibold text-amber-800 group-hover:text-amber-900 transition-colors">
                {dict.home.quickQuizTitle}
              </h2>
              <p className="text-xs text-amber-500">{dict.home.quickQuizSubtitle}</p>
            </div>
          </Link>

          {/* Regular categories */}
          {results.map((cat) => (
            <CategoryCard
              key={cat.id}
              name={cat.name}
              slug={cat.slug}
              questionCount={cat.questionCount}
              lang={lang as Lang}
              dict={dict.categoryCard}
            />
          ))}
        </div>
      )}

      {/* Start Button */}
      <div className="text-center">
        <Link
          href={`/${lang}/quickquiz`}
          className="inline-block px-8 py-3 bg-amber-500 text-white font-bold rounded-full shadow-md hover:bg-amber-600 hover:shadow-lg transition-all text-lg"
        >
          {dict.home.startQuiz} &rsaquo;
        </Link>
      </div>
    </div>
  );
}
