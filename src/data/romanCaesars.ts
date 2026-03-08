import imageConfig from "@/config/caesarImages.json";
import descriptionConfig from "@/config/caesarDescriptions.json";
import type { ChronologyItem } from "@/types/chronology";

/** @deprecated Use ChronologyItem */
export type Caesar = ChronologyItem;

// Edit src/config/caesarImages.json      → fix/replace images
// Edit src/config/caesarDescriptions.json → update hover descriptions (add more lang keys as needed)
const imageMap = new Map(imageConfig.map((e) => [e.id, e.imageUrl]));
const descMap   = new Map(descriptionConfig.map((e) => [e.id, e as unknown as Record<string, string>]));

const base: Omit<ChronologyItem, "imageUrl" | "description">[] = [
  { id: 1,  name: "Julius Caesar", reign: "49–44 BC",      fact: "Crossed the Rubicon in 49 BC, triggering a civil war that ended the Roman Republic." },
  { id: 2,  name: "Augustus",      reign: "27 BC–14 AD",   fact: "First Roman emperor; his 41-year reign was the longest of the Julio-Claudian dynasty." },
  { id: 3,  name: "Tiberius",      reign: "14–37 AD",      fact: "Spent the last decade of his reign in self-imposed exile on the island of Capri." },
  { id: 4,  name: "Caligula",      reign: "37–41 AD",      fact: "Reputedly made his horse Incitatus a consul — though historians debate the story." },
  { id: 5,  name: "Claudius",      reign: "41–54 AD",      fact: "Conquered Britain in 43 AD and was likely poisoned by his wife Agrippina the Younger." },
  { id: 6,  name: "Nero",          reign: "54–68 AD",      fact: "Last of the Julio-Claudians; famously blamed Christians for the Great Fire of Rome." },
  { id: 7,  name: "Galba",         reign: "68–69 AD",      fact: "Ruled for only seven months; his refusal to pay promised bonuses led to his murder." },
  { id: 8,  name: "Otho",          reign: "Jan–Apr 69 AD", fact: "Reigned for just 95 days before taking his own life after the Battle of Bedriacum." },
  { id: 9,  name: "Vitellius",     reign: "Apr–Dec 69 AD", fact: "Known for his gluttony; reportedly spent a fortune on lavish banquets during his reign." },
  { id: 10, name: "Vespasian",     reign: "69–79 AD",      fact: "Founded the Flavian dynasty and began construction of the Colosseum." },
  { id: 11, name: "Titus",         reign: "79–81 AD",      fact: "Oversaw the destruction of Jerusalem and the eruption of Mount Vesuvius in 79 AD." },
  { id: 12, name: "Domitian",      reign: "81–96 AD",      fact: "Last of the Twelve Caesars; his assassination led to the adoptive Antonine emperors." },
];

/** Returns the 12 Caesars with descriptions in the requested language (falls back to English). */
export function getRomanCaesars(lang: string): ChronologyItem[] {
  return base.map((c) => {
    const desc = descMap.get(c.id);
    return {
      ...c,
      imageUrl:    imageMap.get(c.id) ?? "",
      description: desc?.[lang] ?? desc?.["en"] ?? "",
    };
  });
}
