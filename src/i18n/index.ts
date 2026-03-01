import type { Dictionary } from "./en";

export type { Dictionary } from "./en";
export type Lang = "en" | "nl";

export const SUPPORTED_LANGS: Lang[] = ["en", "nl"];
export const DEFAULT_LANG: Lang = "en";

export function isValidLang(lang: string): lang is Lang {
  return SUPPORTED_LANGS.includes(lang as Lang);
}

export async function getDictionary(lang: Lang): Promise<Dictionary> {
  switch (lang) {
    case "nl":
      return (await import("./nl")).nl;
    case "en":
    default:
      return (await import("./en")).en;
  }
}
