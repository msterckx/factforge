"use client";

import { CommandBlock, Step } from "./YoutubeVideoCommand";

interface Props {
  slug: string;
}

export default function ConnectionsYoutubeVideoCommand({ slug }: Props) {
  // Root DB — has the narration question text / audio columns the video
  // script relies on.
  const dbPath = "gameoftrivia.db";
  const imagesDir = `local-data/challenges/${slug}`;
  const videoDir = `videos/connections-challenge/${slug}`;

  const upscaleCommand = [
    "node scripts/upscale-images-runpod.js",
    `  --db=${dbPath}`,
    `  --game=${slug}`,
  ].join(" \\\n");

  const videoCommand = [
    "node scripts/gen-connections-video.js",
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
      <Step n={1} title="Upscale the artwork images (RunPod, 4x)">
        <CommandBlock label="upscale-images-runpod.js" command={upscaleCommand} />
        <p className="text-xs text-slate-400">
          Reads each item&apos;s <code className="bg-slate-100 px-1 rounded">image_url</code>, upscales it via RunPod, and writes a 4x PNG to <code className="bg-slate-100 px-1 rounded">{imagesDir}/&lt;item-id&gt;/images/</code> — the exact layout the video generator below looks for via <code className="bg-slate-100 px-1 rounded">--images-dir</code>. Needs <code className="bg-slate-100 px-1 rounded">RUNPOD_API_KEY</code>, <code className="bg-slate-100 px-1 rounded">RUNPOD_UPSCALE_ENDPOINT_ID</code> and the <code className="bg-slate-100 px-1 rounded">RUNPOD_S3_*</code> vars in <code className="bg-slate-100 px-1 rounded">.env.local</code>.
        </p>
      </Step>

      <Step n={2} title="Generate the video segments + narration">
        <CommandBlock label="gen-connections-video.js" command={videoCommand} />
        <p className="text-xs text-slate-400">
          Reads items directly from <code className="bg-slate-100 px-1 rounded">{dbPath}</code> — no export step needed — and writes one independent HyperFrames composition per artwork (plus one for the opening) under <code className="bg-slate-100 px-1 rounded">segments/</code>, so a single item can be regenerated without touching the rest (pass e.g. <code className="bg-slate-100 px-1 rounded">--only={"<item_id>"}</code>). After the reveal, it cycles through each item&apos;s &quot;Additional images&quot; — set those in the Items list below, or it&apos;ll just hold on the primary image. Generates narration audio via RunPod TTS from each item&apos;s &quot;Question (narration for video)&quot; field — set that too, or a scene&apos;s question will render silently. Cached so re-runs skip unchanged lines — add <code className="bg-slate-100 px-1 rounded">--skip-audio</code> to reuse existing WAVs as-is, or <code className="bg-slate-100 px-1 rounded">--force-audio</code> to force regeneration.
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
