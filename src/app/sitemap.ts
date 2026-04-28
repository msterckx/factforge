export const dynamic = "force-dynamic";

import type { MetadataRoute } from "next";
import { SUPPORTED_LANGS } from "@/i18n";
import { getAllChallengeGames } from "@/data/challengeGame";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.gameoftrivia.com";

const STATIC_PATHS = ["/", "/contact", "/challenges"];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const entries: MetadataRoute.Sitemap = [];

  // Static pages
  for (const lang of SUPPORTED_LANGS) {
    for (const path of STATIC_PATHS) {
      entries.push({
        url: `${BASE_URL}/${lang}${path === "/" ? "" : path}`,
        lastModified: now,
        changeFrequency: "weekly",
        priority: path === "/" ? 1.0 : 0.6,
      });
    }
  }

  // Challenge pages — only available (published) ones
  const challenges = getAllChallengeGames().filter((g) => g.available);
  for (const challenge of challenges) {
    for (const lang of SUPPORTED_LANGS) {
      entries.push({
        url: `${BASE_URL}/${lang}/challenges/${challenge.slug}`,
        lastModified: now,
        changeFrequency: "monthly",
        priority: 0.8,
      });
    }
  }

  return entries;
}
