import Link from "next/link";
import Image from "next/image";
import type { Lang } from "@/i18n";

const categoryLogos: Record<string, string> = {
  geography: "/logos/geography.jpg",
  science: "/logos/science.jpg",
  sports: "/logos/sports.jpg",
  television: "/logos/movies_tv.jpg",
  movies: "/logos/movies_tv.jpg",
  "movies-tv": "/logos/movies_tv.jpg",
  "movies-and-tv": "/logos/movies_tv.jpg",
  history: "/logos/history.jpg",
  art: "/logos/art_architecture.jpg",
  "art-architecture": "/logos/art_architecture.jpg",
};

const categoryIcons: Record<string, string> = {
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
  const logo = categoryLogos[slug];
  const icon = categoryIcons[slug] || "\u{2753}";

  return (
    <Link
      href={`/${lang}/category/${slug}`}
      className="flex items-center gap-4 bg-white rounded-xl shadow-sm hover:shadow-md transition-all p-4 border border-slate-200 hover:border-amber-400 group"
    >
      <div className="w-12 h-12 rounded-full overflow-hidden shrink-0 bg-amber-50 flex items-center justify-center text-2xl group-hover:ring-2 group-hover:ring-amber-400 transition-all">
        {logo ? (
          <Image
            src={logo}
            alt={name}
            width={48}
            height={48}
            className="w-full h-full object-cover"
          />
        ) : (
          icon
        )}
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
