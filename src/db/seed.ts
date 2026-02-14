import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import path from "path";

const dbPath = path.join(process.cwd(), "factforge.db");
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
    },
    {
      questionText: "What is the longest river in the world?",
      answer: "The Nile",
      categoryId: catMap["geography"],
    },
    {
      questionText: "What is the smallest country in the world?",
      answer: "Vatican City",
      categoryId: catMap["geography"],
    },
    // History
    {
      questionText: "In what year did World War II end?",
      answer: "1945",
      categoryId: catMap["history"],
    },
    {
      questionText: "Who was the first president of the United States?",
      answer: "George Washington",
      categoryId: catMap["history"],
    },
    {
      questionText: "In what year did the Berlin Wall fall?",
      answer: "1989",
      categoryId: catMap["history"],
    },
    // Television
    {
      questionText: "What is the name of the coffee shop in Friends?",
      answer: "Central Perk",
      categoryId: catMap["television"],
    },
    {
      questionText: "Who played Walter White in Breaking Bad?",
      answer: "Bryan Cranston",
      categoryId: catMap["television"],
    },
    // Science
    {
      questionText: "What is the chemical symbol for gold?",
      answer: "Au",
      categoryId: catMap["science"],
    },
    {
      questionText: "What planet is known as the Red Planet?",
      answer: "Mars",
      categoryId: catMap["science"],
    },
    {
      questionText: "What is the speed of light in km/s (approximately)?",
      answer: "300000",
      categoryId: catMap["science"],
    },
    // Sports
    {
      questionText: "In which sport would you perform a slam dunk?",
      answer: "Basketball",
      categoryId: catMap["sports"],
    },
    {
      questionText: "How many players are on a soccer team on the field?",
      answer: "11",
      categoryId: catMap["sports"],
    },
  ];

  for (const q of questionData) {
    db.insert(schema.questions).values(q).run();
  }

  console.log(`Seeded ${cats.length} categories and ${questionData.length} questions.`);
  sqlite.close();
}

seed().catch(console.error);
