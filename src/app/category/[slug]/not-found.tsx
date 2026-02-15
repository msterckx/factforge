import Link from "next/link";

export default function CategoryNotFound() {
  return (
    <div className="text-center py-20">
      <h1 className="text-2xl font-bold text-slate-800 mb-4">Category Not Found</h1>
      <p className="text-slate-500 mb-6">The category you are looking for does not exist.</p>
      <Link
        href="/"
        className="inline-block px-6 py-2.5 bg-amber-500 text-white font-medium rounded-lg hover:bg-amber-600 transition-colors"
      >
        Back to Categories
      </Link>
    </div>
  );
}
