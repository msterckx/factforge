import Link from "next/link";
import type { Lang } from "@/i18n";
import LangSwitcher from "./LangSwitcher";

interface NavbarProps {
  lang: Lang;
}

export default function Navbar({ lang }: NavbarProps) {
  return (
    <nav className="bg-slate-900 text-white shadow-lg">
      <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
        <Link href={`/${lang}`} className="text-2xl font-bold tracking-tight hover:text-amber-400 transition-colors">
          Game of Trivia
        </Link>
        <LangSwitcher currentLang={lang} />
      </div>
    </nav>
  );
}
