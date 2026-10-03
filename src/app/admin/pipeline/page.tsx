import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getAllChallengeGames } from "@/data/challengeGame";
import { db } from "@/db";
import { challengeItems, mapRegions } from "@/db/schema";
import { asc } from "drizzle-orm";
import PipelineConsole from "@/components/admin/PipelineConsole";

// Mirrors scripts/gen-connections-video.js's slugify() exactly, so a computed
// segmentDir below matches the real folder name on disk.
function slugify(name: string, maxLen = 24): string {
  const slug = name
    .toLowerCase()
    .normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug.slice(0, maxLen).replace(/-+$/g, "") || "item";
}

export default async function AdminPipelinePage() {
  const session = await auth();
  if (!session) redirect("/admin/login");

  const gameRows = getAllChallengeGames();
  const games = gameRows.map((g) => ({
    slug: g.slug,
    title: g.titleEn,
    gameType: g.gameType,
    mediaType: g.mediaType,
    category: g.category,
  }));

  // Every item/region, grouped by slug — lets the console offer a "just this
  // one" --only=<value> picker without a per-selection fetch. --only takes an
  // item id for the carousel-quiz family, or a region_key for the map family.
  const allItems   = db.select().from(challengeItems).orderBy(asc(challengeItems.position)).all();
  const allRegions = db.select().from(mapRegions).orderBy(asc(mapRegions.regionKey)).all();

  const unitsBySlug: Record<string, { value: string; label: string; segmentDir?: string }[]> = {};
  for (const g of gameRows) {
    // segmentDir mirrors segmentDirName() in gen-connections-video.js / gen-map-video.js:
    // index (1-based, padded) + slug for items, or the bare region_key for regions —
    // only computable for units that actually clear the same filter the generator
    // applies before assigning indices (an item needs an image + answer; a region
    // needs to be enabled). Units that don't clear it get no segmentDir — there's no
    // segment for them to point at.
    const qualifyingItems = allItems
      .filter((it) => it.gameId === g.id && it.imageUrl && it.clueEn)
      .map((it, i) => [it.id, `${String(i + 1).padStart(3, "0")}-${slugify(it.name)}`] as const);
    const qualifyingRegionsByKey = new Map(
      allRegions
        .filter((r) => r.gameId === g.id && r.enabled)
        .sort((a, b) => a.id - b.id)
        .map((r, i) => [r.regionKey, `${String(i + 1).padStart(3, "0")}-${r.regionKey}`] as const)
    );
    const segmentDirByItemId = new Map(qualifyingItems);

    const items = allItems.filter((it) => it.gameId === g.id)
      .map((it) => ({ value: String(it.id), label: it.name, segmentDir: segmentDirByItemId.get(it.id) }));
    const regions = allRegions.filter((r) => r.gameId === g.id)
      .map((r) => ({ value: r.regionKey, label: r.labelEn, segmentDir: qualifyingRegionsByKey.get(r.regionKey) }));
    unitsBySlug[g.slug] = items.length > 0 ? items : regions;
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Pipeline Commands</h1>
        <p className="text-sm text-slate-500 mt-1">
          Pick a challenge to get the exact upscale, video-segment, render and concat commands for it — always reading the live database, so this never drifts from what&apos;s actually in it.
        </p>
      </div>
      <PipelineConsole games={games} unitsBySlug={unitsBySlug} />
    </div>
  );
}
