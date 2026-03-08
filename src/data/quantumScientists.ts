import imageConfig from "@/config/quantumImages.json";
import descriptionConfig from "@/config/quantumDescriptions.json";
import type { ChronologyItem } from "@/types/chronology";

// Edit src/config/quantumImages.json      → fix/replace images
// Edit src/config/quantumDescriptions.json → update hover descriptions (add more lang keys as needed)
const imageMap = new Map(imageConfig.map((e) => [e.id, e.imageUrl]));
const descMap   = new Map(descriptionConfig.map((e) => [e.id, e as unknown as Record<string, string>]));

/** Ordered chronologically by each scientist's defining quantum contribution. */
const base: Omit<ChronologyItem, "imageUrl" | "description">[] = [
  { id: 1, name: "Max Planck",        reign: "1858–1947", fact: "Introduced the concept of the quantum in 1900, proposing that energy is emitted in discrete packets to explain blackbody radiation." },
  { id: 2, name: "Albert Einstein",   reign: "1879–1955", fact: "Explained the photoelectric effect in 1905 using photons, providing the first concrete evidence for Planck's quantum hypothesis." },
  { id: 3, name: "Niels Bohr",        reign: "1885–1962", fact: "Proposed quantised electron orbits in 1913, explaining why atoms emit light at specific wavelengths and launching modern atomic theory." },
  { id: 4, name: "Louis de Broglie",  reign: "1892–1987", fact: "Proposed in 1924 that all matter has wave-like properties, extending wave–particle duality from light to electrons and all particles." },
  { id: 5, name: "Werner Heisenberg", reign: "1901–1976", fact: "Formulated matrix mechanics in 1925 and the uncertainty principle in 1927 — you cannot simultaneously know a particle's exact position and momentum." },
  { id: 6, name: "Erwin Schrödinger", reign: "1887–1961", fact: "Developed wave mechanics and the Schrödinger equation in 1926, the central equation governing how quantum states evolve over time." },
  { id: 7, name: "Max Born",          reign: "1882–1970", fact: "Gave the wave function its probabilistic meaning in 1926 — its squared amplitude gives the probability of finding a particle at a given place." },
  { id: 8, name: "Paul Dirac",        reign: "1902–1984", fact: "Combined quantum mechanics with special relativity in the Dirac equation (1928), which predicted the existence of antimatter." },
];

/** Returns the quantum scientists with descriptions in the requested language (falls back to English). */
export function getQuantumScientists(lang: string): ChronologyItem[] {
  return base.map((c) => {
    const desc = descMap.get(c.id);
    return {
      ...c,
      imageUrl:    imageMap.get(c.id) ?? "",
      description: desc?.[lang] ?? desc?.["en"] ?? "",
    };
  });
}
