"use client";

import { usePathname } from "next/navigation";
import Sidebar from "@/components/Sidebar";

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname.startsWith("/admin");

  if (isAdmin) {
    return <main className="max-w-6xl mx-auto px-4 py-8">{children}</main>;
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 flex gap-8">
      <Sidebar />
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
