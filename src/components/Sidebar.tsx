"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Sidebar() {
  const pathname = usePathname();
  // Derive lang from first path segment, e.g. "/en/..." → "en"
  const lang = pathname.split("/")[1] || "en";

  const menuItems = [
    { label: lang === "nl" ? "Home" : "Home", href: `/${lang}` },
    { label: lang === "nl" ? "Snelle Quiz" : "QuickQuiz", href: `/${lang}/quickquiz` },
  ];

  return (
    <aside className="w-52 shrink-0">
      <nav className="bg-white rounded-xl shadow-md border border-slate-200 p-4 sticky top-8">
        <ul className="flex flex-col gap-1">
          {menuItems.map((item) => {
            const isActive =
              item.href === `/${lang}`
                ? pathname === `/${lang}` || pathname === `/${lang}/`
                : pathname.startsWith(item.href);

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`block px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-amber-50 text-amber-700"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-800"
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
