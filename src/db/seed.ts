import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import path from "path";

const dbDir = process.env.DATABASE_DIR || process.cwd();
const dbPath = path.join(dbDir, "factforge.db");
const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");
const db = drizzle(sqlite, { schema });

async function seed() {
  console.log("Seeding database...");

  // Clear existing data (questions first due to FK)
  db.delete(schema.questions).run();
  db.delete(schema.categories).run();

  // Insert categories
  const categoryData = [
    { name: "Geography", slug: "geography" },
    { name: "History", slug: "history" },
    { name: "Television", slug: "television" },
    { name: "Science", slug: "science" },
    { name: "Sports", slug: "sports" },
  ];

  for (const cat of categoryData) {
    db.insert(schema.categories).values(cat).run();
  }

  // Fetch inserted categories to get IDs
  const cats = db.select().from(schema.categories).all();
  const catMap = Object.fromEntries(cats.map((c) => [c.slug, c.id]));

  // Insert sample questions
  const questionData = [
    // Geography
    {
      questionText: "What is the highest mountain in the world?",
      answer: "Mount Everest",
      categoryId: catMap["geography"],
      difficulty: "easy" as const,
      didYouKnow: "Mount Everest stands at 8,848.86 meters above sea level and grows a few millimeters every year due to tectonic movement. It lies on the border between Nepal and Tibet.",
    },
    {
      questionText: "What is the longest river in the world?",
      answer: "The Nile",
      categoryId: catMap["geography"],
      difficulty: "intermediate" as const,
      didYouKnow: "The Nile stretches approximately 6,650 km through 11 countries. Ancient Egyptians depended on its annual flooding to fertilize their farmland, making it the cradle of one of the world's earliest civilizations.",
    },
    {
      questionText: "What is the smallest country in the world?",
      answer: "Vatican City",
      categoryId: catMap["geography"],
      difficulty: "intermediate" as const,
      didYouKnow: "Vatican City covers just 0.44 square kilometers and has a population of about 800. Despite its tiny size, it has its own postal service, radio station, and even a small railway station.",
    },
    // History
    {
      questionText: "In what year did World War II end?",
      answer: "1945",
      categoryId: catMap["history"],
      difficulty: "easy" as const,
      didYouKnow: "WWII ended with Japan's formal surrender on September 2, 1945, aboard the USS Missouri in Tokyo Bay. The war involved over 70 million military personnel and resulted in an estimated 70-85 million total deaths.",
    },
    {
      questionText: "Who was the first president of the United States?",
      answer: "George Washington",
      categoryId: catMap["history"],
      difficulty: "easy" as const,
      didYouKnow: "George Washington was unanimously elected by the Electoral College and refused a salary of $25,000 per year (though Congress eventually insisted). He also famously refused to serve a third term, setting a tradition that lasted until FDR.",
    },
    {
      questionText: "In what year did the Berlin Wall fall?",
      answer: "1989",
      categoryId: catMap["history"],
      difficulty: "intermediate" as const,
      didYouKnow: "The Berlin Wall stood for 28 years. Its fall on November 9, 1989 was partly triggered by a mistaken announcement by an East German official, who said border crossings were open \"immediately, without delay.\"",
    },
    // Television
    {
      questionText: "What is the name of the coffee shop in Friends?",
      answer: "Central Perk",
      categoryId: catMap["television"],
      difficulty: "easy" as const,
      didYouKnow: "The orange couch at Central Perk was found in the basement of the Warner Bros. studio. The show's creators originally wanted the characters to hang out at a diner, but changed it to a coffeehouse to reflect 1990s culture.",
    },
    {
      questionText: "Who played Walter White in Breaking Bad?",
      answer: "Bryan Cranston",
      categoryId: catMap["television"],
      difficulty: "intermediate" as const,
      didYouKnow: "Bryan Cranston was mostly known for his comedic role as Hal in Malcolm in the Middle before Breaking Bad. The show's creator Vince Gilligan had to convince AMC executives to cast him, as they wanted a more traditionally dramatic actor.",
    },
    // Science
    {
      questionText: "What is the chemical symbol for gold?",
      answer: "Au",
      categoryId: catMap["science"],
      difficulty: "intermediate" as const,
      didYouKnow: "The symbol Au comes from the Latin word \"aurum,\" meaning \"shining dawn.\" Gold is so malleable that a single ounce can be stretched into a wire 80 km long, or hammered into a sheet thin enough to be transparent.",
    },
    {
      questionText: "What planet is known as the Red Planet?",
      answer: "Mars",
      categoryId: catMap["science"],
      difficulty: "easy" as const,
      didYouKnow: "Mars appears red because its surface is rich in iron oxide (rust). It has the tallest volcano in the solar system \u2014 Olympus Mons, at nearly 22 km high, about 2.5 times the height of Mount Everest.",
    },
    {
      questionText: "What is the speed of light in km/s (approximately)?",
      answer: "300000",
      categoryId: catMap["science"],
      difficulty: "difficult" as const,
      didYouKnow: "Light travels at exactly 299,792.458 km/s in a vacuum. At that speed, it takes sunlight about 8 minutes and 20 seconds to reach Earth, and over 4 years to reach the nearest star, Proxima Centauri.",
    },
    // Sports
    {
      questionText: "In which sport would you perform a slam dunk?",
      answer: "Basketball",
      categoryId: catMap["sports"],
      difficulty: "easy" as const,
      didYouKnow: "The slam dunk was actually banned in college basketball from 1967 to 1976, largely because of Lew Alcindor (later Kareem Abdul-Jabbar), who dominated with the move at UCLA.",
    },
    {
      questionText: "How many players are on a soccer team on the field?",
      answer: "11",
      categoryId: catMap["sports"],
      difficulty: "easy" as const,
      didYouKnow: "The 11-a-side format became standard in 1897. The earliest known games had up to 30 players per side! A soccer ball travels faster than any player \u2014 the fastest recorded shot reached 211 km/h.",
    },
  ];

  for (const q of questionData) {
    db.insert(schema.questions).values(q).run();
  }

  console.log(`Seeded ${cats.length} categories and ${questionData.length} questions.`);
  sqlite.close();
}

seed().catch(console.error);
