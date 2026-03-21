import { sqliteTable, text, integer, uniqueIndex, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const categories = sqliteTable("categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const subcategories = sqliteTable("subcategories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  categoryId: integer("category_id")
    .notNull()
    .references(() => categories.id, { onDelete: "cascade" }),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const questions = sqliteTable("questions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  questionText: text("question_text").notNull(),
  answer: text("answer").notNull(),
  categoryId: integer("category_id")
    .notNull()
    .references(() => categories.id, { onDelete: "cascade" }),
  subcategoryId: integer("subcategory_id")
    .references(() => subcategories.id, { onDelete: "set null" }),
  difficulty: text("difficulty", { enum: ["easy", "intermediate", "difficult"] }).notNull().default("easy"),
  didYouKnow: text("did_you_know"),
  imagePath: text("image_path"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const categoryTranslations = sqliteTable(
  "category_translations",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    categoryId: integer("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    language: text("language", { enum: ["nl"] }).notNull(),
    name: text("name").notNull(),
    isAutoTranslated: integer("is_auto_translated", { mode: "boolean" })
      .notNull()
      .default(true),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => ({
    uniqCategoryLang: uniqueIndex("category_translations_category_id_language_unique").on(
      table.categoryId,
      table.language
    ),
  })
);

export const subcategoryTranslations = sqliteTable(
  "subcategory_translations",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    subcategoryId: integer("subcategory_id")
      .notNull()
      .references(() => subcategories.id, { onDelete: "cascade" }),
    language: text("language", { enum: ["nl"] }).notNull(),
    name: text("name").notNull(),
    isAutoTranslated: integer("is_auto_translated", { mode: "boolean" })
      .notNull()
      .default(true),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => ({
    uniqSubcategoryLang: uniqueIndex("subcategory_translations_subcategory_id_language_unique").on(
      table.subcategoryId,
      table.language
    ),
  })
);

export const questionTranslations = sqliteTable(
  "question_translations",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    questionId: integer("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    language: text("language", { enum: ["nl"] }).notNull(),
    questionText: text("question_text").notNull(),
    answer: text("answer").notNull(),
    didYouKnow: text("did_you_know"),
    isAutoTranslated: integer("is_auto_translated", { mode: "boolean" })
      .notNull()
      .default(true),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => ({
    uniqQuestionLang: uniqueIndex("question_translations_question_id_language_unique").on(
      table.questionId,
      table.language
    ),
  })
);

export const challengeGames = sqliteTable("challenge_games", {
  id:          integer("id").primaryKey({ autoIncrement: true }),
  slug:        text("slug").notNull().unique(),
  gameType:    text("game_type", { enum: ["chronology", "puzzle", "quiz", "matching"] }).notNull(),
  icon:        text("icon").notNull().default("🎮"),
  category:    text("category", { enum: ["geography", "history", "television", "science", "sports", "other"] }).notNull().default("other"),
  titleEn:     text("title_en").notNull(),
  titleNl:     text("title_nl").notNull(),
  subtitleEn:  text("subtitle_en").notNull().default(""),
  subtitleNl:  text("subtitle_nl").notNull().default(""),
  available:         integer("available", { mode: "boolean" }).notNull().default(true),
  sortOrder:         integer("sort_order").notNull().default(0),
  // Quiz-type specific: pull questions from an existing category
  quizCategoryId:    integer("quiz_category_id").references(() => categories.id, { onDelete: "set null" }),
  quizSubcategoryId: integer("quiz_subcategory_id").references(() => subcategories.id, { onDelete: "set null" }),
  quizQuestionLimit: integer("quiz_question_limit"), // null = all questions
  quizQuestionIds:   text("quiz_question_ids"),      // JSON array of question IDs; null = all
  startingLives:     integer("starting_lives").notNull().default(5), // lives for chronology game
  createdAt:         text("created_at").notNull().default(sql`(datetime('now'))`),
});

export const challengeItems = sqliteTable("challenge_items", {
  id:            integer("id").primaryKey({ autoIncrement: true }),
  gameId:        integer("game_id").notNull().references(() => challengeGames.id, { onDelete: "cascade" }),
  position:      integer("position").notNull(), // sort order within the game
  name:          text("name").notNull(),
  imageUrl:      text("image_url").notNull().default(""),
  descriptionEn: text("description_en").notNull().default(""),
  descriptionNl: text("description_nl").notNull().default(""),
  // Chronology fields
  dates:         text("dates"),           // e.g. "27 BC–14 AD"
  milestoneEn:   text("milestone_en"),
  milestoneNl:   text("milestone_nl"),
  // Matching fields
  clueEn:        text("clue_en"),
  clueNl:        text("clue_nl"),
  // Puzzle fields
  hint:          text("hint"),            // e.g. "Athletics · Jamaica"
  achievement:   text("achievement"),     // e.g. "9 Olympic gold medals"
  createdAt:     text("created_at").notNull().default(sql`(datetime('now'))`),
});

export const challengeScores = sqliteTable(
  "challenge_scores",
  {
    id:          integer("id").primaryKey({ autoIncrement: true }),
    userEmail:   text("user_email").notNull(),
    challengeId: text("challenge_id").notNull(), // e.g. "twelve-caesars"
    score:       integer("score").notNull(),
    maxScore:    integer("max_score").notNull(),
    completedAt: text("completed_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => ({
    userChallengeIdx: index("challenge_scores_user_challenge_idx").on(
      table.userEmail,
      table.challengeId
    ),
  })
);
