import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/db";
import { challengeGames, challengeItems } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import Link from "next/link";
import ChallengeEditForm from "./ChallengeEditForm";
import ItemsManager from "./ItemsManager";
import QuizQuestionSelector from "./QuizQuestionSelector";

interface Props { params: Promise<{ id: string }> }

export default async function AdminChallengeDetailPage({ params }: Props) {
  const session = await auth();
  if (!session) redirect("/admin/login");

  const { id } = await params;
  const game = db.select().from(challengeGames).where(eq(challengeGames.id, Number(id))).get();
  if (!game) notFound();

  const items = db.select().from(challengeItems).where(eq(challengeItems.gameId, game.id)).orderBy(asc(challengeItems.position)).all();

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/challenges" className="text-sm text-slate-500 hover:text-slate-700">← Challenges</Link>
        <span className="text-slate-300">/</span>
        <h1 className="text-2xl font-bold text-slate-800">{game.icon} {game.titleEn}</h1>
        <span className={`ml-auto inline-block px-2 py-0.5 rounded text-xs font-medium ${game.available ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-500"}`}>
          {game.available ? "Live" : "Hidden"}
        </span>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-8">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">Game Settings</h2>
        <ChallengeEditForm game={game} />
      </div>

      {game.gameType !== "quiz" && game.gameType !== "matching" && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">Items ({items.length})</h2>
          <ItemsManager gameId={game.id} gameType={game.gameType} initialItems={items} />
        </div>
      )}
      {game.gameType === "matching" && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">Items ({items.length})</h2>
          <ItemsManager gameId={game.id} gameType={game.gameType} initialItems={items} />
        </div>
      )}
      {game.gameType === "quiz" && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-1">Question Selection</h2>
          <p className="text-sm text-slate-400 mb-4">Choose which questions appear in this challenge. Save the category first if you haven&apos;t yet.</p>
          <QuizQuestionSelector
            gameId={game.id}
            initialSelectedIds={game.quizQuestionIds ? JSON.parse(game.quizQuestionIds) : null}
          />
        </div>
      )}
    </div>
  );
}
