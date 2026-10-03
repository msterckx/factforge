"use client";

import { useState } from "react";

interface Props {
  slug: string;
  mapSvg: string | null;
}

export function CommandBlock({ label, command }: { label: string; command: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-semibold text-slate-500">{label}</p>
        <button
          type="button"
          onClick={handleCopy}
          className="text-xs px-2 py-0.5 rounded bg-indigo-50 text-indigo-600 hover:bg-indigo-100"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <pre className="bg-slate-900 text-slate-200 text-xs rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">
        {command}
      </pre>
    </div>
  );
}

export function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-sm font-semibold text-slate-700 mb-2">
        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-800 text-white text-xs mr-2">{n}</span>
        {title}
      </p>
      <div className="pl-7 space-y-3">{children}</div>
    </div>
  );
}

export default function YoutubeVideoCommand({ slug, mapSvg }: Props) {
  if (!mapSvg) {
    return <p className="text-sm text-slate-400">Set a map file above first.</p>;
  }

  // Root DB — has the narration question text / audio columns the video
  // scripts rely on. The old restore/remote_db/ copy is a stale snapshot
  // that predates those columns entirely.
  const dbPath = "gameoftrivia.db";
  const imagesDir = `local-data/challenges/${slug}`;
  const videoDir = `videos/map-challenge/${slug}`;

  const upscaleCommand = [
    "node scripts/upscale-images-runpod.js",
    `  --db=${dbPath}`,
    `  --game=${slug}`,
  ].join(" \\\n");

  const videoCommand = [
    "node scripts/gen-map-video.js",
    `  --db=${dbPath}`,
    `  --game=${slug}`,
    `  --images-dir=${imagesDir}`,
  ].join(" \\\n");

  const renderCommand = (dir: string) => [
    "npx hyperframes browser ensure",
    `for d in ${dir}/segments/*/; do`,
    `  npx hyperframes render "$d" --fps=30`,
    "done",
  ].join("\n");

  const concatCommand = (dir: string) => `node scripts/concat-video-segments.js --dir=${dir}`;

  return (
    <div className="space-y-6">
      <Step n={1} title="Upscale the source images (RunPod, 4x)">
        <CommandBlock label="upscale-images-runpod.js" command={upscaleCommand} />
        <p className="text-xs text-slate-400">
          Reads source photo URLs from each region&apos;s infograph data, upscales them via RunPod, and writes 4x PNGs to <code className="bg-slate-100 px-1 rounded">{imagesDir}/&lt;region&gt;/images/</code> — the exact layout the video generator below looks for via <code className="bg-slate-100 px-1 rounded">--images-dir</code>. Needs <code className="bg-slate-100 px-1 rounded">RUNPOD_API_KEY</code>, <code className="bg-slate-100 px-1 rounded">RUNPOD_UPSCALE_ENDPOINT_ID</code> and the <code className="bg-slate-100 px-1 rounded">RUNPOD_S3_*</code> vars in <code className="bg-slate-100 px-1 rounded">.env.local</code>.
        </p>
      </Step>

      <Step n={2} title="Generate the video segments + narration">
        <CommandBlock label="gen-map-video.js" command={videoCommand} />
        <p className="text-xs text-slate-400">
          Reads regions and map data directly from <code className="bg-slate-100 px-1 rounded">{dbPath}</code> — no export step needed — and writes one independent HyperFrames composition per park (plus one for the opening) under <code className="bg-slate-100 px-1 rounded">segments/</code>, so a single park can be regenerated without touching the rest (pass e.g. <code className="bg-slate-100 px-1 rounded">--only={"<region_key>"}</code>). After the reveal, it cuts away to a full-screen slideshow of the location&apos;s extra photos — a park with only one photo just holds on it. Generates narration audio via RunPod TTS (<code className="bg-slate-100 px-1 rounded">RUNPOD_API_KEY</code>, <code className="bg-slate-100 px-1 rounded">RUNPOD_ENDPOINT_ID</code>, <code className="bg-slate-100 px-1 rounded">RUNPOD_S3_*</code> in <code className="bg-slate-100 px-1 rounded">.env.local</code>), cached so re-runs skip unchanged lines — add <code className="bg-slate-100 px-1 rounded">--skip-audio</code> to reuse existing WAVs as-is, or <code className="bg-slate-100 px-1 rounded">--force-audio</code> to force regeneration.
        </p>
      </Step>

      <Step n={3} title="Render every segment">
        <CommandBlock label={`Render all (→ ${videoDir}/)`} command={renderCommand(videoDir)} />
        <p className="text-xs text-slate-400">
          Re-run for a single segment with <code className="bg-slate-100 px-1 rounded">npx hyperframes render &lt;segment-dir&gt; --fps=30</code>.
        </p>
      </Step>

      <Step n={4} title="Stitch the rendered segments into the final video">
        <CommandBlock label={`${videoDir}/`} command={concatCommand(videoDir)} />
      </Step>

      <p className="text-xs text-slate-400">
        None of these commands are run for you — copy and run them yourself in a terminal, in order.
      </p>
    </div>
  );
}
