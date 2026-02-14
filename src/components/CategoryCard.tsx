import Link from "next/link";

interface CategoryCardProps {
  name: string;
  slug: string;
  questionCount: number;
}

export default function CategoryCard({ name, slug, questionCount }: CategoryCardProps) {
  return (
    <Link
      href={`/category/${slug}`}
      className="block bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow p-6 border border-slate-200 hover:border-amber-400"
    >
      <h2 className="text-xl font-semibold text-slate-800 mb-2">{name}</h2>
      <p className="text-sm text-slate-500">
        {questionCount} {questionCount === 1 ? "question" : "questions"}
      </p>
    </Link>
  );
}
