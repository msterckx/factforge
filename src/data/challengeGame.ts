import { db } from "@/db";
import { challengeGames, challengeItems, mapRegions } from "@/db/schema";
import { eq, asc, and } from "drizzle-orm";
import type { ChronologyItem } from "@/types/chronology";
import type { PuzzleSubject } from "@/types/puzzle";
import type { ConnectionItem } from "@/types/connections";

export type MapRegion = typeof mapRegions.$inferSelect;

export type ChallengeGame = typeof challengeGames.$inferSelect;
export type ChallengeItem = typeof challengeItems.$inferSelect;

export function getAllChallengeGames(): ChallengeGame[] {
  return db.select().from(challengeGames).orderBy(asc(challengeGames.sortOrder)).all();
}

export function getChallengeGameBySlug(slug: string): ChallengeGame | undefined {
  const exact = db.select().from(challengeGames).where(eq(challengeGames.slug, slug)).get();
  if (exact) return exact;

  // Testing convenience: "<slug>-v2" etc. with no game of its own falls back
  // to the base game, so a variant URL can be shared without duplicating DB rows.
  const variantMatch = slug.match(/^(.+)-v\d+$/);
  if (variantMatch) {
    return db.select().from(challengeGames).where(eq(challengeGames.slug, variantMatch[1])).get();
  }
  return undefined;
}

export function getChallengeItems(gameId: number): ChallengeItem[] {
  return db.select().from(challengeItems).where(eq(challengeItems.gameId, gameId)).orderBy(asc(challengeItems.position)).all();
}

export function mapToChronologyItems(items: ChallengeItem[], lang: string): ChronologyItem[] {
  return items.map((item) => ({
    id:          item.position,
    name:        item.name,
    reign:       item.dates ?? "",
    imageUrl:    item.imageUrl,
    description: lang === "nl" ? item.descriptionNl || item.descriptionEn : item.descriptionEn,
    milestone:   lang === "nl"
      ? (item.milestoneNl || item.milestoneEn) ?? undefined
      : item.milestoneEn ?? undefined,
    clue:         lang === "nl"
      ? (item.clueNl || item.clueEn) ?? undefined
      : item.clueEn ?? undefined,
    infographData: item.infographData ?? null,
  }));
}

export function mapToConnectionItems(items: ChallengeItem[], lang: string): ConnectionItem[] {
  return items.map((item) => {
    // infographData for connections_quiz items is a bare JSON array of
    // additional carousel image URLs (imageUrl stays the primary image).
    let images: string[] | undefined;
    if (item.infographData) {
      try {
        const parsed = JSON.parse(item.infographData);
        if (Array.isArray(parsed) && parsed.length > 0) images = parsed;
      } catch { /* ignore malformed data */ }
    }

    return {
      id:          item.id,
      name:        item.name,
      imageUrl:    item.imageUrl,
      images,
      match:       lang === "nl"
        ? (item.clueNl || item.clueEn) ?? ""
        : item.clueEn ?? "",
      description: lang === "nl" ? item.descriptionNl || item.descriptionEn : item.descriptionEn,
    };
  });
}

// Ordered by id (creation order), matching gen-map-video.js/gen-connections-video.js's
// own "ORDER BY id" query — so a game's rendered video and the live site agree on
// sequence, which matters for content that's inherently ordered (e.g. a chronological
// run of historical events), not just alphabetically-named regions.
export function getMapRegions(gameId: number): MapRegion[] {
  return db.select().from(mapRegions)
    .where(and(eq(mapRegions.gameId, gameId), eq(mapRegions.enabled, true)))
    .orderBy(asc(mapRegions.id)).all();
}

export function getAllMapRegions(gameId: number): MapRegion[] {
  return db.select().from(mapRegions)
    .where(eq(mapRegions.gameId, gameId))
    .orderBy(asc(mapRegions.id)).all();
}

export type MapChip = {
  regionKey: string;
  label: string;      // what's printed on the draggable chip
  answer: string;     // correct regionKey to match
};

export function mapToMapChips(regions: MapRegion[], lang: string, mode: string): MapChip[] {
  return regions.map((r) => ({
    regionKey: r.regionKey,
    label: mode === "capital"
      ? (lang === "nl" ? r.capitalNl ?? r.capitalEn ?? r.labelEn : r.capitalEn ?? r.labelEn)
      : (lang === "nl" ? r.labelNl : r.labelEn),
    answer: r.regionKey,
  }));
}

export function mapToPuzzleSubjects(items: ChallengeItem[], lang: string): PuzzleSubject[] {
  return items.map((item) => ({
    id:          item.id,
    name:        item.name,
    imageUrl:    item.imageUrl,
    hint:        item.hint ?? "",
    achievement: item.achievement ?? "",
    description: lang === "nl" ? item.descriptionNl || item.descriptionEn : item.descriptionEn,
  }));
}
