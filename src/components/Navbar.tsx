import Link from "next/link";
import type { Lang } from "@/i18n";
import LangSwitcher from "./LangSwitcher";

interface NavbarProps {
  lang: Lang;
}

export default function Navbar({ lang }: NavbarProps) {
  return (
    <nav className="bg-white border-b border-stone-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        <Link
          href={`/${lang}`}
          className="text-xl font-bold tracking-tight transition-colors shrink-0"
          style={{ fontFamily: "var(--font-cormorant), serif", color: "#D7AA50" }}
        >
          Game of Trivia
        </Link>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <Link href={`/${lang}`} className="text-sm text-slate-600 hover:text-slate-900 transition-colors px-3 py-1.5 rounded hover:bg-stone-100">
              Home
            </Link>
            <Link href={`/${lang}/contact`} className="text-sm text-slate-600 hover:text-slate-900 transition-colors px-3 py-1.5 rounded hover:bg-stone-100">
              Contact
            </Link>
          </div>
          <LangSwitcher currentLang={lang} />
        </div>
      </div>
    </nav>
  );
}
