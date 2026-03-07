export interface Caesar {
  id: number; // 1-12, is the correct chronological position
  name: string;
  reign: string;
  fact: string;
  imageUrl: string;
}

// Special:FilePath URLs don't require the MD5 hash prefix and reliably redirect
// to the correct Wikimedia Commons file.
const fp = (filename: string) =>
  `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(filename)}?width=300`;

export const romanCaesars: Caesar[] = [
  {
    id: 1,
    name: "Julius Caesar",
    reign: "49–44 BC",
    fact: "Crossed the Rubicon in 49 BC, triggering a civil war that ended the Roman Republic.",
    imageUrl: fp("Julius_Caesar_Coustou_Louvre.jpg"),
  },
  {
    id: 2,
    name: "Augustus",
    reign: "27 BC–14 AD",
    fact: "First Roman emperor; his 41-year reign was the longest of the Julio-Claudian dynasty.",
    imageUrl: fp("Statue-Augustus.jpg"),
  },
  {
    id: 3,
    name: "Tiberius",
    reign: "14–37 AD",
    fact: "Spent the last decade of his reign in self-imposed exile on the island of Capri.",
    imageUrl: fp("Tiberius_Louvre.jpg"),
  },
  {
    id: 4,
    name: "Caligula",
    reign: "37–41 AD",
    fact: "Reputedly made his horse Incitatus a consul — though historians debate the story.",
    imageUrl: fp("MuseeNational_Caligula.jpg"),
  },
  {
    id: 5,
    name: "Claudius",
    reign: "41–54 AD",
    fact: "Conquered Britain in 43 AD and was likely poisoned by his wife Agrippina the Younger.",
    imageUrl: fp("Claudius_crop.jpg"),
  },
  {
    id: 6,
    name: "Nero",
    reign: "54–68 AD",
    fact: "Last of the Julio-Claudians; famously blamed Christians for the Great Fire of Rome.",
    imageUrl: fp("Nero_1.jpg"),
  },
  {
    id: 7,
    name: "Galba",
    reign: "68–69 AD",
    fact: "Ruled for only seven months; his refusal to pay promised bonuses led to his murder.",
    imageUrl: fp("Galba_rom.jpg"),
  },
  {
    id: 8,
    name: "Otho",
    reign: "Jan–Apr 69 AD",
    fact: "Reigned for just 95 days before taking his own life after the Battle of Bedriacum.",
    imageUrl: fp("Otho_Musei_Capitolini_MC1118.jpg"),
  },
  {
    id: 9,
    name: "Vitellius",
    reign: "Apr–Dec 69 AD",
    fact: "Known for his gluttony; reportedly spent a fortune on lavish banquets during his reign.",
    imageUrl: fp("Vitellius_Louvre_Ma1210_n4.jpg"),
  },
  {
    id: 10,
    name: "Vespasian",
    reign: "69–79 AD",
    fact: "Founded the Flavian dynasty and began construction of the Colosseum.",
    imageUrl: fp("Vespasianus01_pushkin.jpg"),
  },
  {
    id: 11,
    name: "Titus",
    reign: "79–81 AD",
    fact: "Oversaw the destruction of Jerusalem and the eruption of Mount Vesuvius in 79 AD.",
    imageUrl: fp("Titus_MAN_Napoli_Inv6067_n01.jpg"),
  },
  {
    id: 12,
    name: "Domitian",
    reign: "81–96 AD",
    fact: "Last of the Twelve Caesars; his assassination led to the adoptive Antonine emperors.",
    imageUrl: fp("Domitian.jpg"),
  },
];
