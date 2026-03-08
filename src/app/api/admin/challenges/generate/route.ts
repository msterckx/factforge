import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { generateChallenge } from "@/lib/openai";

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { description, gameType } = await req.json();
  if (!description || !gameType) {
    return NextResponse.json({ error: "description and gameType are required" }, { status: 400 });
  }

  try {
    const challenge = await generateChallenge(description, gameType);
    return NextResponse.json(challenge);
  } catch (error) {
    console.error("Challenge generation error:", error);
    return NextResponse.json({ error: "Failed to generate challenge. Check your OpenAI API key." }, { status: 500 });
  }
}
