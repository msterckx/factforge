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
  return db.select().from(challengeGames).where(eq(challengeGames.slug, slug)).get();
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
    clue:        lang === "nl"
      ? (item.clueNl || item.clueEn) ?? undefined
      : item.clueEn ?? undefined,
  }));
}

export function mapToConnectionItems(items: ChallengeItem[], lang: string): ConnectionItem[] {
  return items.map((item) => ({
    id:          item.id,
    name:        item.name,
    imageUrl:    item.imageUrl,
    match:       lang === "nl"
      ? (item.clueNl || item.clueEn) ?? ""
      : item.clueEn ?? "",
    description: lang === "nl" ? item.descriptionNl || item.descriptionEn : item.descriptionEn,
  }));
}

export function getMapRegions(gameId: number): MapRegion[] {
  return db.select().from(mapRegions)
    .where(and(eq(mapRegions.gameId, gameId), eq(mapRegions.enabled, true)))
    .orderBy(asc(mapRegions.regionKey)).all();
}

export function getAllMapRegions(gameId: number): MapRegion[] {
  return db.select().from(mapRegions)
    .where(eq(mapRegions.gameId, gameId))
    .orderBy(asc(mapRegions.regionKey)).all();
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
