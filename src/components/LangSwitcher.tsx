"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { SUPPORTED_LANGS, type Lang } from "@/i18n";

interface Props {
  currentLang: Lang;
}

export default function LangSwitcher({ currentLang }: Props) {
  const pathname = usePathname();

  // Swap the first path segment (the lang prefix)
  function getPathForLang(lang: Lang) {
    return pathname.replace(/^\/[a-z]{2}(\/|$)/, `/${lang}$1`);
  }

  return (
    <div className="flex items-center gap-1 text-sm">
      {SUPPORTED_LANGS.map((lang) => (
        <Link
          key={lang}
          href={getPathForLang(lang)}
          className={`px-2 py-1 rounded font-medium uppercase transition-colors ${
            lang === currentLang
              ? "bg-amber-500 text-white"
              : "text-slate-300 hover:text-white"
          }`}
        >
          {lang}
        </Link>
      ))}
    </div>
  );
}
