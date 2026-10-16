"use client";

import { CommandBlock, Step } from "./YoutubeVideoCommand";

interface Props {
  slug: string;
}

export default function ConnectionsYoutubeVideoCommand({ slug }: Props) {
  // Root DB — has the narration question text / audio columns the video
  // script relies on.
  const dbPath = "gameoftrivia.db";
  const videoDir = `videos/connections-challenge/${slug}`;

  const videoCommand = [
    "node scripts/gen-connections-video.js",
    `  --db=${dbPath}`,
    `  --game=${slug}`,
    "  --folder-images",
  ].join(" \\\n");

  // Only the YouTube ("full") segments — the web variant's -question/-reveal
  // folders live alongside them but aren't part of the final video.
  const renderCommand = (dir: string) => [
    "npx hyperframes browser ensure",
    `for d in ${dir}/segments/*/; do`,
    `  case "$d" in *-question/|*-reveal/) continue;; esac`,
    `  npx hyperframes render "$d" --fps=30`,
    "done",
  ].join("\n");

  const concatCommand = (dir: string) => `node scripts/concat-video-segments.js --dir=${dir}`;
  const packageCommand = `node scripts/gen-youtube-package.js --game=${slug}`;

  return (
    <div className="space-y-6">
      <Step n={1} title="Prepare the images">
        <p className="text-xs text-slate-400">
          Put each item&apos;s images in its folder under <code className="bg-slate-100 px-1 rounded">local-data/web-images/challenges/&lt;category&gt;/&lt;game&gt;/&lt;item&gt;/</code>:{" "}
          <code className="bg-slate-100 px-1 rounded">&lt;item&gt;.webp</code> is the question image, <code className="bg-slate-100 px-1 rounded">&lt;item&gt;-1.webp</code>, <code className="bg-slate-100 px-1 rounded">-2</code>, … the carousel.
          16:9, ideally 1600×900. These files are used as-is — no upscaling step.
        </p>
      </Step>

      <Step n={2} title="Generate the video segments + narration">
        <CommandBlock label="gen-connections-video.js" command={videoCommand} />
        <p className="text-xs text-slate-400">
          Takes each item&apos;s images from its folder (<code className="bg-slate-100 px-1 rounded">--folder-images</code>; add <code className="bg-slate-100 px-1 rounded">--fit=contain</code> to show portraits whole). Reads items directly from <code className="bg-slate-100 px-1 rounded">{dbPath}</code> — no export step needed — and writes one independent HyperFrames composition per artwork (plus one for the opening) under <code className="bg-slate-100 px-1 rounded">segments/</code>, so a single item can be regenerated without touching the rest (pass e.g. <code className="bg-slate-100 px-1 rounded">--only={"<item_id>"}</code>). After the reveal, it cycles through each item&apos;s &quot;Additional images&quot; — set those in the Items list below, or it&apos;ll just hold on the primary image. Generates narration audio via RunPod TTS from each item&apos;s &quot;Question (narration for video)&quot; field — set that too, or a scene&apos;s question will render silently. Cached so re-runs skip unchanged lines — add <code className="bg-slate-100 px-1 rounded">--skip-audio</code> to reuse existing WAVs as-is, or <code className="bg-slate-100 px-1 rounded">--force-audio</code> to force regeneration.
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
        <p className="text-xs text-slate-400">
          Adds the category intro in front and the outro at the end (render those once with <code className="bg-slate-100 px-1 rounded">node scripts/build-intros.js --render</code> and <code className="bg-slate-100 px-1 rounded">npx hyperframes render video-assets/outro/game-of-trivia-outro --fps=30</code>).
        </p>
      </Step>

      <Step n={5} title="YouTube thumbnail & description">
        <CommandBlock label="gen-youtube-package.js" command={packageCommand} />
        <p className="text-xs text-slate-400">
          Writes <code className="bg-slate-100 px-1 rounded">thumbnail.jpg</code> and <code className="bg-slate-100 px-1 rounded">description.txt</code> (title, description, chapters) to <code className="bg-slate-100 px-1 rounded">local-data/youtube/{slug}/</code>.
        </p>
      </Step>

      <p className="text-xs text-slate-400">
        None of these commands are run for you — copy and run them yourself in a terminal, in order.
      </p>
    </div>
  );
}
