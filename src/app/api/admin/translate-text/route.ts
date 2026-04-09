import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { translateText } from "@/lib/openai";

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { text } = await req.json() as { text?: string };
  if (!text?.trim()) return NextResponse.json({ error: "text is required" }, { status: 400 });

  try {
    const translated = await translateText(text.trim(), "nl");
    return NextResponse.json({ text: translated });
  } catch {
    return NextResponse.json({ error: "Translation failed" }, { status: 500 });
  }
}
