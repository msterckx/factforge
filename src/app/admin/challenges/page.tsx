import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getAllChallengeGames } from "@/data/challengeGame";
import Link from "next/link";
import NewChallengeForm from "./NewChallengeForm";

export default async function AdminChallengesPage() {
  const session = await auth();
  if (!session) redirect("/admin/login");

  const games = getAllChallengeGames();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Challenges</h1>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-8">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-slate-500">#</th>
              <th className="px-4 py-3 text-left font-medium text-slate-500">Game</th>
              <th className="px-4 py-3 text-left font-medium text-slate-500">Type</th>
              <th className="px-4 py-3 text-left font-medium text-slate-500">Category</th>
              <th className="px-4 py-3 text-left font-medium text-slate-500">Status</th>
              <th className="px-4 py-3 text-left font-medium text-slate-500"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {games.map((game) => (
              <tr key={game.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-400 font-mono">{game.sortOrder}</td>
                <td className="px-4 py-3">
                  <span className="mr-2">{game.icon}</span>
                  <span className="font-medium text-slate-800">{game.titleEn}</span>
                  <span className="ml-2 text-slate-400 text-xs font-mono">/{game.slug}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${game.gameType === "chronology" ? "bg-blue-50 text-blue-700" : "bg-purple-50 text-purple-700"}`}>
                    {game.gameType}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600 capitalize">{game.category}</td>
                <td className="px-4 py-3">
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${game.available ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                    {game.available ? "Live" : "Hidden"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/admin/challenges/${game.id}`} className="text-amber-600 hover:text-amber-700 font-medium text-xs">
                    Edit →
                  </Link>
                </td>
              </tr>
            ))}
            {games.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">No challenges yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">Add New Challenge</h2>
        <NewChallengeForm />
      </div>
    </div>
  );
}
