import imageConfig from "@/config/conquistadorImages.json";
import descriptionConfig from "@/config/conquistadorDescriptions.json";
import type { ChronologyItem } from "@/types/chronology";

// Edit src/config/conquistadorImages.json      → fix/replace images
// Edit src/config/conquistadorDescriptions.json → update hover descriptions (add more lang keys as needed)
const imageMap = new Map(imageConfig.map((e) => [e.id, e.imageUrl]));
const descMap   = new Map(descriptionConfig.map((e) => [e.id, e as unknown as Record<string, string>]));

/** Ordered chronologically by the year of each conquistador's defining expedition. */
const base: Omit<ChronologyItem, "imageUrl" | "description">[] = [
  { id: 1, name: "Christopher Columbus",    reign: "c.1451–1506", fact: "Reached the Americas in 1492 while sailing west for Spain, opening the New World to European colonisation." },
  { id: 2, name: "Vasco Núñez de Balboa",   reign: "c.1475–1519", fact: "Crossed the Isthmus of Darién in 1513 and became the first European to see the Pacific Ocean from the Americas." },
  { id: 3, name: "Hernán Cortés",           reign: "1485–1547",   fact: "Conquered the Aztec Empire in 1519–1521, bringing the most powerful civilisation in Mesoamerica under Spanish rule." },
  { id: 4, name: "Francisco Pizarro",       reign: "c.1471–1541", fact: "Toppled the Inca Empire in the 1530s by capturing Emperor Atahualpa and extorting a roomful of gold and silver as ransom." },
  { id: 5, name: "Diego de Almagro",        reign: "c.1475–1538", fact: "Co-led the conquest of Peru with Pizarro, then braved a 10,000-km round trip to Chile in 1535–36 in search of a second golden empire." },
  { id: 6, name: "Pedro de Valdivia",       reign: "c.1497–1553", fact: "Founded Santiago and a string of Chilean cities from 1541 onward; killed in a Mapuche ambush led by the chief Caupolicán." },
  { id: 7, name: "Gonzalo Pizarro",         reign: "c.1510–1548", fact: "Led 4,000 men into the Amazon basin in 1541 hunting El Dorado; the expedition collapsed, but it set the stage for Orellana's journey." },
  { id: 8, name: "Francisco de Orellana",   reign: "c.1511–1546", fact: "Broke away from Gonzalo Pizarro's starving column in 1541 and floated the entire length of the Amazon River to the Atlantic — a 6,000-km first." },
];

/** Returns the conquistadors with descriptions in the requested language (falls back to English). */
export function getConquistadors(lang: string): ChronologyItem[] {
  return base.map((c) => {
    const desc = descMap.get(c.id);
    return {
      ...c,
      imageUrl:    imageMap.get(c.id) ?? "",
      description: desc?.[lang] ?? desc?.["en"] ?? "",
    };
  });
}
