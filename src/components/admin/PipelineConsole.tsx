"use client";

import { useMemo, useRef, useState } from "react";

type Game = {
  slug: string;
  title: string;
  gameType: string;
  mediaType: string | null;
  category: string;
};

type Unit = { value: string; label: string; segmentDir?: string };

type Family = "map" | "carousel-quiz" | null;

function family(g: Game): Family {
  if (g.gameType === "connections_quiz" || (g.gameType === "generic_quiz" && g.mediaType === "carousel")) return "carousel-quiz";
  if (g.gameType === "map" || g.gameType === "map_quiz") return "map";
  return null;
}

type Row = { tag?: string; cmd: string };
type Step = { title: string; note?: React.ReactNode; rows: Row[]; hint?: React.ReactNode };

function buildSteps(
  game: Game,
  db: string,
  unit: string,
  segmentDir: string | undefined,
  refreshImages: boolean,
  refreshAudio: boolean
): Step[] {
  const fam = family(game);
  if (fam === null) return [];

  const slug = game.slug;
  const outBase = fam === "map" ? `videos/map-challenge/${slug}` : `videos/connections-challenge/${slug}`;
  const genScript = fam === "map" ? "gen-map-video.js" : "gen-connections-video.js";
  const only = unit ? ` --only=${unit}` : "";
  const onlyPlaceholder = unit || "<id>";
  const segDirPlaceholder = segmentDir || "<segment-dir>";
  const refreshImagesFlag = refreshImages ? " --refresh-images" : "";
  const refreshAudioFlag = refreshAudio ? " --refresh-audio" : "";

  const steps: Step[] = [
    {
      title: "Upscale source photos",
      note: (
        <>
          4× AI-upscales every image_url (+ extra carousel photos) for this {fam === "map" ? "region" : "item"}, writing to{" "}
          <code className="bg-slate-100 px-1 rounded text-xs">local-data/challenges/{slug}/&lt;id&gt;/images/</code> — the layout{" "}
          <code className="bg-slate-100 px-1 rounded text-xs">--images-dir</code> below expects.
        </>
      ),
      rows: [{ cmd: `node scripts/upscale-images-runpod.js --db=${db} --game=${slug}${only}` }],
      hint: (
        <>
          Add <code className="bg-slate-100 px-1 rounded">--only=&lt;id&gt;</code> to limit to one item/region, or{" "}
          <code className="bg-slate-100 px-1 rounded">--force</code> to re-upscale files that already exist.
        </>
      ),
    },
    {
      title: "Clean stale image cache",
      note: "upscale-images-runpod.js never deletes — run this after an image_url changes in the DB, so the generator below doesn't pick up a leftover file.",
      rows: [
        { tag: "preview", cmd: `node scripts/clean-images-cache.js --db=${db} --game=${slug}${only} --dry-run` },
        { tag: "apply", cmd: `node scripts/clean-images-cache.js --db=${db} --game=${slug}${only}` },
      ],
      hint: (
        <>
          Add <code className="bg-slate-100 px-1 rounded">--only=&lt;id&gt;</code> for one item, or{" "}
          <code className="bg-slate-100 px-1 rounded">--all</code> to wipe a unit&apos;s cache entirely before a from-scratch re-upscale.
        </>
      ),
    },
    {
      title: "Regenerate narration audio",
      note: "Runs the same generator in audio-only mode — refreshes narration WAVs via RunPod TTS without touching video segments or images. Use after editing an item's question/answer text.",
      rows: [
        { tag: "fill in missing", cmd: `node scripts/${genScript} --db=${db} --game=${slug}${only} --audio-only${refreshAudioFlag}` },
        { tag: "force one item/region", cmd: `node scripts/${genScript} --db=${db} --game=${slug} --audio-only --force-audio --only=${onlyPlaceholder}` },
      ],
      hint: (
        <>
          <code className="bg-slate-100 px-1 rounded">--audio-only</code> exits right after refreshing audio — no HTML/segments are written. Without{" "}
          <code className="bg-slate-100 px-1 rounded">--force-audio</code> it only fills in clips that are missing; existing cached WAVs (this video&apos;s own{" "}
          <code className="bg-slate-100 px-1 rounded">audio/</code> dir, or the durable audio store) are left alone. If a segment is still playing old
          narration after refreshing it here, that&apos;s this video&apos;s own audio cache — check &quot;Refresh audio&quot; above and re-run the
          &quot;Generate video segments&quot; command below to re-sync it from the durable store (cheap — no new TTS call) instead of re-running
          this step with <code className="bg-slate-100 px-1 rounded">--force-audio</code>.
        </>
      ),
    },
    {
      title: "Generate video segments",
      note: `One independent HTML composition per ${fam === "map" ? "region" : "item"} (plus a shared opening card) — regenerate any single segment without touching the rest. After the answer reveal, a full-screen carousel cycles through any extra photos for that ${fam === "map" ? "region" : "item"}; one with only a single photo just holds on it.`,
      rows: [{ cmd: `node scripts/${genScript} --db=${db} --game=${slug} --images-dir=local-data/challenges/${slug}${only}${refreshImagesFlag}${refreshAudioFlag}` }],
      hint: (
        <>
          Writes to <code className="bg-slate-100 px-1 rounded">{outBase}/segments/</code>. Narration audio is generated via RunPod TTS
          and cached — reruns with <code className="bg-slate-100 px-1 rounded">--only=&lt;id&gt;</code> are cheap. A regenerated segment only
          ever fills in what&apos;s missing from its own image/audio cache — check &quot;Refresh images&quot; / &quot;Refresh audio&quot; above to
          pick up newer source images or narration instead of silently keeping the old ones.
        </>
      ),
    },
    {
      title: "Preview & render a segment",
      note: "Each segment is a standalone HyperFrames composition — preview it in-browser, then render frames once it looks right.",
      rows: [
        { tag: "preview", cmd: `npx hyperframes preview ${outBase}/segments/${segDirPlaceholder}` },
        { tag: "render", cmd: `npx hyperframes render ${outBase}/segments/${segDirPlaceholder} --fps=30` },
      ],
      hint: segmentDir ? undefined : (
        <>
          <code className="bg-slate-100 px-1 rounded">&lt;segment-dir&gt;</code> is one of the folders written above, e.g.{" "}
          <code className="bg-slate-100 px-1 rounded">001-&lt;name&gt;</code>.
        </>
      ),
    },
    {
      title: "Concatenate into the final video",
      note: "Stitches every rendered segment (in folder order) into one MP4, normalizing audio tracks first.",
      rows: [{ cmd: `node scripts/concat-video-segments.js --dir=${outBase}` }],
    },
  ];

  if (fam === "map") {
    steps.push({
      title: "Build the interactive web challenge",
      note: "Generates the self-contained HTML package the website embeds — separate from the video pipeline above.",
      rows: [
        { tag: "single game", cmd: `node scripts/gen-map-challenge.js --db=${db} --game=${slug} --topic=${game.category || "other"} --images-dir=local-data/challenges/${slug}` },
        { tag: "bulk (this game only)", cmd: `node scripts/gen-all-challenges.js --db=${db} --game=${slug}` },
      ],
      hint: (
        <>
          The bulk form also refreshes <code className="bg-slate-100 px-1 rounded">public/challenges/manifest.json</code>. Drop{" "}
          <code className="bg-slate-100 px-1 rounded">--game</code> from it to rebuild every map challenge.
        </>
      ),
    });
  }

  return steps;
}

function CopyButton({ cmd }: { cmd: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function copy() {
    try {
      await navigator.clipboard.writeText(cmd);
      setCopied(true);
    } catch {
      setCopied(false);
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1200);
  }

  return (
    <button
      onClick={copy}
      type="button"
      className="shrink-0 px-3 border-l border-slate-700 text-xs font-mono text-slate-400 hover:text-amber-400 transition-colors"
    >
      {copied ? "copied" : "copy"}
    </button>
  );
}

function CommandRow({ row }: { row: Row }) {
  return (
    <div className="mb-2 last:mb-0">
      {row.tag && (
        <span className="block text-[10px] uppercase tracking-wide text-slate-400 mb-1">{row.tag}</span>
      )}
      <div className="flex items-stretch bg-slate-900 rounded-lg overflow-hidden">
        <code className="flex-1 px-3 py-2 text-xs font-mono text-slate-100 overflow-x-auto whitespace-pre">{row.cmd}</code>
        <CopyButton cmd={row.cmd} />
      </div>
    </div>
  );
}

function StepCard({ n, total, step }: { n: number; total: number; step: Step }) {
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div className="w-8 h-8 rounded-full border border-slate-200 bg-white flex items-center justify-center text-xs font-mono font-semibold text-slate-500 shrink-0">
          {String(n).padStart(2, "0")}
        </div>
        {n < total && <div className="w-px flex-1 bg-slate-200 my-1" />}
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 mb-6 flex-1">
        <h3 className="text-sm font-semibold text-slate-800 mb-1">{step.title}</h3>
        {step.note && <p className="text-xs text-slate-500 mb-3 leading-relaxed max-w-2xl">{step.note}</p>}
        {step.rows.map((row, i) => (
          <CommandRow key={i} row={row} />
        ))}
        {step.hint && <p className="text-xs text-slate-400 mt-3 leading-relaxed">{step.hint}</p>}
      </div>
    </div>
  );
}

export default function PipelineConsole({ games, unitsBySlug }: { games: Game[]; unitsBySlug: Record<string, Unit[]> }) {
  const defaultGame = games.find((g) => g.slug === "contemporary-art") ?? games[0];
  const [slug, setSlug] = useState(defaultGame?.slug ?? "");
  const [db, setDb] = useState("gameoftrivia.db");
  const [unit, setUnit] = useState("");
  const [refreshImages, setRefreshImages] = useState(false);
  const [refreshAudio, setRefreshAudio] = useState(false);
  const [query, setQuery] = useState(defaultGame?.title ?? "");
  const [open, setOpen] = useState(false);
  const [typing, setTyping] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const game = games.find((g) => g.slug === slug);
  const fam = game ? family(game) : null;
  const units = unitsBySlug[slug] ?? [];
  const segmentDir = units.find((u) => u.value === unit)?.segmentDir;
  const steps = useMemo(
    () => (game ? buildSteps(game, db.trim() || "gameoftrivia.db", unit, segmentDir, refreshImages, refreshAudio) : []),
    [game, db, unit, segmentDir, refreshImages, refreshAudio]
  );

  // Until the user actually types something, the box just shows every
  // challenge — filtering by the pre-filled title (the current selection)
  // would otherwise make the list collapse to a single match on open.
  const filtered = typing
    ? games.filter((g) => g.title.toLowerCase().includes(query.toLowerCase()) || g.slug.toLowerCase().includes(query.toLowerCase()))
    : games;

  function select(g: Game) {
    setSlug(g.slug);
    setQuery(g.title);
    setUnit("");
    setOpen(false);
    setTyping(false);
  }

  if (!defaultGame) {
    return <p className="text-slate-400">No challenges in the database yet.</p>;
  }

  return (
    <div>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-wrap gap-4 items-end mb-6">
        <div className="relative flex-1 min-w-64" ref={boxRef}>
          <label className="block text-xs font-medium text-slate-500 mb-1">Challenge</label>
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setTyping(true);
              setOpen(true);
            }}
            onFocus={(e) => {
              setOpen(true);
              e.target.select();
            }}
            onBlur={() => setTimeout(() => setOpen(false), 120)}
            placeholder="Search by name or slug…"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-400"
          />
          {open && (
            <ul className="absolute left-0 right-0 top-full mt-1 max-h-72 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-md z-10 py-1">
              {filtered.length === 0 && <li className="px-3 py-2 text-sm text-slate-400">No challenge matches</li>}
              {filtered.map((g) => (
                <li
                  key={g.slug}
                  onMouseDown={() => select(g)}
                  className={`px-3 py-2 text-sm cursor-pointer flex items-center justify-between gap-3 hover:bg-slate-50 ${g.slug === slug ? "bg-amber-50" : ""}`}
                >
                  <span className="text-slate-800">{g.title}</span>
                  <span className="text-xs font-mono text-slate-400">{g.slug}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            {fam === "map" ? "Region" : "Item"} <span className="text-slate-400 font-normal">(optional)</span>
          </label>
          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            disabled={units.length === 0}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-400 disabled:bg-slate-50 disabled:text-slate-400"
          >
            <option value="">— all (no --only) —</option>
            {units.map((u) => (
              <option key={u.value} value={u.value}>{u.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Database path</label>
          <input
            value={db}
            onChange={(e) => setDb(e.target.value)}
            spellCheck={false}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono w-56 focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-400"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            Cache <span className="text-slate-400 font-normal">(optional)</span>
          </label>
          <div className="flex items-center gap-3 h-[38px]">
            <label className="flex items-center gap-1.5 text-sm text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={refreshImages}
                onChange={(e) => setRefreshImages(e.target.checked)}
                className="w-3.5 h-3.5"
              />
              Refresh images
            </label>
            <label className="flex items-center gap-1.5 text-sm text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={refreshAudio}
                onChange={(e) => setRefreshAudio(e.target.checked)}
                className="w-3.5 h-3.5"
              />
              Refresh audio
            </label>
          </div>
        </div>
      </div>

      {game && (
        <div className="flex items-center gap-2 flex-wrap mb-5">
          <h2 className="text-base font-semibold text-slate-800">{game.title}</h2>
          <span className="px-2 py-0.5 rounded text-xs font-mono font-medium bg-amber-50 text-amber-700">{game.slug}</span>
          <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600">
            {game.gameType}{game.mediaType ? ` · ${game.mediaType}` : ""}
          </span>
          <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600">
            {fam === "map" ? "map pipeline" : fam === "carousel-quiz" ? "carousel-quiz pipeline" : "no pipeline"}
          </span>
        </div>
      )}

      {game && fam === null && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-700 mb-3">No CLI pipeline yet</span>
          <p className="text-sm text-slate-600 leading-relaxed mb-2">
            <strong className="text-slate-800">{game.title}</strong> runs as an in-app <strong className="text-slate-800">{game.gameType}</strong> —
            none of the video or image scripts in <code className="bg-slate-100 px-1 rounded text-xs">scripts/</code> target this game type today.
          </p>
          {game.gameType === "connections" && (
            <p className="text-sm text-slate-600 leading-relaxed">
              Note the naming trap: <code className="bg-slate-100 px-1 rounded text-xs">gen-connections-video.js</code> matches{" "}
              <code className="bg-slate-100 px-1 rounded text-xs">game_type = &apos;connections_quiz&apos;</code>, not{" "}
              <code className="bg-slate-100 px-1 rounded text-xs">&apos;connections&apos;</code> — so despite the name, it doesn&apos;t apply
              to this game. Only <code className="bg-slate-100 px-1 rounded text-xs">generic_quiz</code> games with{" "}
              <code className="bg-slate-100 px-1 rounded text-xs">media_type = &apos;carousel&apos;</code> currently qualify for that script.
            </p>
          )}
        </div>
      )}

      {steps.length > 0 && (
        <div>
          {steps.map((step, i) => (
            <StepCard key={i} n={i + 1} total={steps.length} step={step} />
          ))}
        </div>
      )}
    </div>
  );
}
