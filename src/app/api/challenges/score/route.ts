import { db } from "@/db";
import { challengeScores } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    // Guest users — silently ignore, no score stored
    return NextResponse.json({ ok: false, reason: "not_logged_in" });
  }

  const { challengeId, score, maxScore } = await req.json() as {
    challengeId: string;
    score: number;
    maxScore: number;
  };

  db.insert(challengeScores).values({
    userEmail: session.user.email,
    challengeId,
    score,
    maxScore,
  }).run();

  return NextResponse.json({ ok: true });
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const scores = db
    .select()
    .from(challengeScores)
    .where(eq(challengeScores.userEmail, session.user.email))
    .all();

  return NextResponse.json({ scores });
}
