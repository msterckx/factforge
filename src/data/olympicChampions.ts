import imageConfig from "@/config/olympicsImages.json";
import descriptionConfig from "@/config/olympicsDescriptions.json";
import type { PuzzleSubject } from "@/types/puzzle";

// Edit src/config/olympicsImages.json      → fix/replace images, hint, achievement
// Edit src/config/olympicsDescriptions.json → update descriptions (add more lang keys as needed)
const imageMap = new Map(imageConfig.map((e) => [e.id, e]));
const descMap   = new Map(descriptionConfig.map((e) => [e.id, e as unknown as Record<string, string>]));

const base: Pick<PuzzleSubject, "id" | "name">[] = [
  { id: 1, name: "Usain Bolt" },
  { id: 2, name: "Michael Phelps" },
  { id: 3, name: "Simone Biles" },
  { id: 4, name: "Carl Lewis" },
  { id: 5, name: "Nadia Comaneci" },
  { id: 6, name: "Mark Spitz" },
];

/** Returns the olympic champions with descriptions in the requested language (falls back to English). */
export function getOlympicChampions(lang: string): PuzzleSubject[] {
  return base.map((c) => {
    const img  = imageMap.get(c.id);
    const desc = descMap.get(c.id);
    return {
      ...c,
      imageUrl:    img?.imageUrl    ?? "",
      hint:        img?.hint        ?? "",
      achievement: img?.achievement ?? "",
      description: desc?.[lang] ?? desc?.["en"] ?? "",
    };
  });
}
