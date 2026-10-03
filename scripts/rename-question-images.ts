/**
 * rename-question-images.ts — one-off migration
 * Gives quiz question images descriptive names (<category>/<subcategory>/
 * <answer>.<ext>, see src/lib/questionImages.ts) instead of random UUIDs.
 *
 * Reads the originals from local-data/question-images-original/ (a copy of the
 * server's uploads/questions, left untouched), writes the renamed masters to
 * local-data/question-images/, updates questions.image_path in the local
 * database, and writes rename-map.csv (question id, old name, new name).
 *
 *   npx tsx scripts/rename-question-images.ts          # dry run: show the plan
 *   npx tsx scripts/rename-question-images.ts --go     # do it
 */

import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { descriptiveStem, uniqueStem, QUESTION_IMAGE_URL_PREFIX } from "../src/lib/questionImages";

const go = process.argv.includes("--go");
const root = path.resolve(__dirname, "..");
const ORIGINALS = path.join(root, "local-data", "question-images-original");
const MASTERS = path.join(root, "local-data", "question-images");
const db = new Database(path.join(root, "gameoftrivia.db"));

const rows = db.prepare(`
  SELECT q.id, q.answer, q.image_path, c.slug AS category_slug, s.name AS subcategory_name
  FROM questions q
  JOIN categories c ON c.id = q.category_id
  LEFT JOIN subcategories s ON s.id = q.subcategory_id
  WHERE q.image_path LIKE '${QUESTION_IMAGE_URL_PREFIX}%'
  ORDER BY q.id
`).all() as { id: number; answer: string; image_path: string; category_slug: string; subcategory_name: string | null }[];

const used = new Map<string, string[]>(); // folder → names given out so far
const plan: { id: number; from: string; to: string; numbered: boolean }[] = [];
const problems: string[] = [];

for (const r of rows) {
  const oldRel = r.image_path.slice(QUESTION_IMAGE_URL_PREFIX.length);
  if (oldRel.includes("/")) continue; // already in a descriptive folder
  const src = path.join(ORIGINALS, oldRel);
  if (!fs.existsSync(src)) {
    problems.push(`question ${r.id}: original ${oldRel} not found — left unchanged`);
    continue;
  }
  const { folder, base } = descriptiveStem({ categorySlug: r.category_slug, subcategoryName: r.subcategory_name, answer: r.answer });
  const ext = path.extname(oldRel).toLowerCase();
  const onDisk = fs.existsSync(path.join(MASTERS, folder)) ? fs.readdirSync(path.join(MASTERS, folder)) : [];
  const given = used.get(folder) ?? [];
  const name = uniqueStem([...onDisk, ...given], base);
  used.set(folder, [...given, name]);
  plan.push({ id: r.id, from: oldRel, to: `${folder}/${name}${ext}`, numbered: name !== base });
}

console.log(`${plan.length} image(s) to rename${go ? "" : " (dry run — pass --go to apply)"}:`);
for (const p of plan.slice(0, 8)) console.log(`  q${p.id}  ${p.from}  →  ${p.to}`);
if (plan.length > 8) console.log(`  … and ${plan.length - 8} more`);
const suffixed = plan.filter((p) => p.numbered);
if (suffixed.length) console.log(`\nShared answers got a number: ${suffixed.map((p) => p.to).join(", ")}`);
for (const p of problems) console.log(`  ⚠ ${p}`);

if (!go) process.exit(0);

const update = db.prepare("UPDATE questions SET image_path = ? WHERE id = ?");
const apply = db.transaction(() => {
  for (const p of plan) {
    const dest = path.join(MASTERS, p.to);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(path.join(ORIGINALS, p.from), dest);
    update.run(QUESTION_IMAGE_URL_PREFIX + p.to, p.id);
  }
});
apply();

const mapFile = path.join(MASTERS, "rename-map.csv");
const existing = fs.existsSync(mapFile) ? fs.readFileSync(mapFile, "utf-8") : "question_id,old_name,new_name\n";
fs.writeFileSync(mapFile, existing + plan.map((p) => `${p.id},${p.from},${p.to}`).join("\n") + "\n");
console.log(`\n✓ Renamed ${plan.length} image(s); database updated; map in ${path.relative(root, mapFile)}`);
