import Link from "next/link";
import type { Lang } from "@/i18n";

const categoryIcons: Record<string, string> = {
  geography: "\u{1F30D}",
  history: "\u{1F3DB}\u{FE0F}",
  television: "\u{1F4FA}",
  science: "\u{1F52C}",
  sports: "\u{26BD}",
  movies: "\u{1F3AC}",
  music: "\u{1F3B5}",
  literature: "\u{1F4DA}",
  art: "\u{1F3A8}",
  technology: "\u{1F4BB}",
  nature: "\u{1F33F}",
  food: "\u{1F374}",
};

interface CategoryCardProps {
  name: string;
  slug: string;
  questionCount: number;
  lang: Lang;
  dict: { question: string; questions: string };
}

export default function CategoryCard({ name, slug, questionCount, lang, dict }: CategoryCardProps) {
  const icon = categoryIcons[slug] || "\u{2753}";

  return (
    <Link
      href={`/${lang}/category/${slug}`}
      className="flex items-center gap-4 bg-white rounded-xl shadow-sm hover:shadow-md transition-all p-4 border border-slate-200 hover:border-amber-400 group"
    >
      <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center text-2xl shrink-0 group-hover:bg-amber-100 transition-colors">
        {icon}
      </div>
      <div>
        <h2 className="text-base font-semibold text-slate-800 group-hover:text-amber-700 transition-colors">
          {name}
        </h2>
        <p className="text-xs text-slate-400">
          {questionCount} {questionCount === 1 ? dict.question : dict.questions}
        </p>
      </div>
    </Link>
  );
}
