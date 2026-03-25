"use client";

import { usePathname } from "next/navigation";

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname.startsWith("/admin");

  if (isAdmin) {
    return <main className="max-w-6xl mx-auto px-4 py-8">{children}</main>;
  }

  return <main className="px-4 py-8">{children}</main>;
}
