"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

const navItems = [
  { label: "Dashboard", href: "/admin" },
  { label: "Categories", href: "/admin/categories" },
  { label: "Questions", href: "/admin/questions" },
  { label: "Generate Questions", href: "/admin/questions/generate" },
  { label: "Database", href: "/admin/database" },
];

export default function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 shrink-0">
      <div className="bg-white rounded-xl shadow-md border border-slate-200 p-4">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
          Admin Panel
        </h2>
        <nav className="flex flex-col gap-1">
          {navItems.map((item) => {
            const isActive =
              item.href === "/admin"
                ? pathname === "/admin"
                : item.href === "/admin/questions"
                  ? pathname === "/admin/questions" || (pathname.startsWith("/admin/questions/") && !pathname.startsWith("/admin/questions/generate"))
                  : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-amber-50 text-amber-700"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-6 pt-4 border-t border-slate-200">
          <button
            onClick={() => signOut({ callbackUrl: "/admin/login" })}
            className="w-full px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors text-left"
          >
            Log Out
          </button>
        </div>
      </div>
    </aside>
  );
}
