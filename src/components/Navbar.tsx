import Link from "next/link";
import type { Lang } from "@/i18n";
import LangSwitcher from "./LangSwitcher";

interface NavbarProps {
  lang: Lang;
}

export default function Navbar({ lang }: NavbarProps) {
  return (
    <nav className="bg-slate-900 text-white shadow-lg">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        <Link href={`/${lang}`} className="text-xl sm:text-2xl font-bold tracking-tight hover:text-amber-400 transition-colors shrink-0">
          Game of Trivia
        </Link>
        <div className="flex items-center gap-3">
          {/* Nav links visible only on mobile — sidebar handles desktop */}
          <div className="flex items-center gap-1 md:hidden">
            <Link href={`/${lang}`} className="text-sm text-slate-300 hover:text-white transition-colors px-2 py-1 rounded hover:bg-slate-800">
              Home
            </Link>
            <Link href={`/${lang}/quickquiz`} className="text-sm text-slate-300 hover:text-white transition-colors px-2 py-1 rounded hover:bg-slate-800">
              Quiz
            </Link>
          </div>
          <LangSwitcher currentLang={lang} />
        </div>
      </div>
    </nav>
  );
}
