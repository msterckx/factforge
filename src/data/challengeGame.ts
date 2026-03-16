import { db } from "@/db";
import { challengeGames, challengeItems } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import type { ChronologyItem } from "@/types/chronology";
import type { PuzzleSubject } from "@/types/puzzle";

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
    fact:        item.fact ?? "",
    imageUrl:    item.imageUrl,
    description: lang === "nl" ? item.descriptionNl || item.descriptionEn : item.descriptionEn,
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
