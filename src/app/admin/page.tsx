export const dynamic = "force-dynamic";

import { db } from "@/db";
import { categories, questions } from "@/db/schema";
import { count, isNull } from "drizzle-orm";
import Link from "next/link";

export default async function AdminDashboard() {
  const [categoryCount] = await db.select({ value: count() }).from(categories);
  const [questionCount] = await db.select({ value: count() }).from(questions);
  const [noImageCount] = await db
    .select({ value: count() })
    .from(questions)
    .where(isNull(questions.imagePath));

  const stats = [
    { label: "Categories", value: categoryCount.value, href: "/admin/categories" },
    { label: "Questions", value: questionCount.value, href: "/admin/questions" },
    { label: "Without Images", value: noImageCount.value, href: "/admin/questions" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {stats.map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:border-amber-400 transition-colors"
          >
            <p className="text-3xl font-bold text-slate-800">{stat.value}</p>
            <p className="text-sm text-slate-500 mt-1">{stat.label}</p>
          </Link>
        ))}
      </div>

      <div className="flex gap-3">
        <Link
          href="/admin/categories"
          className="px-4 py-2 bg-amber-500 text-white text-sm font-medium rounded-lg hover:bg-amber-600 transition-colors"
        >
          Manage Categories
        </Link>
        <Link
          href="/admin/questions/new"
          className="px-4 py-2 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-900 transition-colors"
        >
          Add Question
        </Link>
      </div>
    </div>
  );
}
