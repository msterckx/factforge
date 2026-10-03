import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { spawn } from "child_process";
import path from "path";

// Root DB — has the narration question text / audio columns the video and
// live-site scripts rely on. The old restore/remote_db/ copy is a stale
// snapshot that predates those columns entirely.
const DB_PATH = "gameoftrivia.db";

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await req.json().catch(() => ({}));

  const scriptArgs = slug
    ? [
        "scripts/gen-map-challenge.js",
        `--db=${DB_PATH}`,
        `--game=${slug}`,
        `--images-dir=local-data/challenges/${slug}`,
        "--score-url=",
      ]
    : ["scripts/gen-all-challenges.js", `--db=${DB_PATH}`, "--score-url="];

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (obj: object) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));

      const child = spawn("node", scriptArgs, { cwd: path.resolve(process.cwd()) });

      child.stdout.on("data", (chunk: Buffer) => send({ line: chunk.toString() }));
      child.stderr.on("data", (chunk: Buffer) => send({ line: chunk.toString(), err: true }));
      child.on("close", (code: number | null) => {
        send({ done: true, ok: code === 0 });
        controller.close();
      });
      child.on("error", (err: Error) => {
        send({ line: `Process error: ${err.message}`, err: true });
        send({ done: true, ok: false });
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
    },
  });
}
