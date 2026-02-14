import Link from "next/link";

export default function Navbar() {
  return (
    <nav className="bg-slate-900 text-white shadow-lg">
      <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
        <Link href="/" className="text-2xl font-bold tracking-tight hover:text-amber-400 transition-colors">
          FactForge
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/" className="text-sm text-slate-300 hover:text-white transition-colors">
            Categories
          </Link>
        </div>
      </div>
    </nav>
  );
}
