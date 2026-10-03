import fs from "fs";
import path from "path";

/**
 * Quiz question images — stored under descriptive names that mirror the
 * content: <category>/<subcategory>/<answer>.<ext> (subcategory "general" when
 * a question has none; "-2", "-3", … when two questions share an answer), and
 * referenced from questions.image_path as /uploads/questions/<that path>.
 *
 * Files live in QUESTION_IMAGES_DIR — <DATABASE_DIR>/uploads/questions unless
 * set (on the server /var/data/uploads/questions; locally the masters in
 * local-data/question-images).
 */

export const QUESTION_IMAGE_URL_PREFIX = "/uploads/questions/";

export function questionImagesDir(): string {
  return path.resolve(
    process.env.QUESTION_IMAGES_DIR ||
      path.join(process.env.DATABASE_DIR || process.cwd(), "uploads", "questions")
  );
}

export function slugify(text: string, maxLength = 60): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, maxLength)
    .replace(/-$/, "") || "image";
}

/** "/uploads/questions/a/b.jpg" → "a/b.jpg" (null if not a question image path). */
export function relativeImagePath(imagePath: string | null | undefined): string | null {
  if (!imagePath?.startsWith(QUESTION_IMAGE_URL_PREFIX)) return null;
  return imagePath.slice(QUESTION_IMAGE_URL_PREFIX.length);
}

/** Absolute file path for a relative image path, or null if it escapes the folder. */
export function resolveImageFile(relPath: string): string | null {
  const dir = questionImagesDir();
  const abs = path.resolve(dir, relPath);
  return abs.startsWith(dir + path.sep) ? abs : null;
}

export interface QuestionImageContext {
  categorySlug: string;
  subcategoryName: string | null;
  answer: string;
}

/** Folder + base name (no extension, no -N suffix) the image should have. */
export function descriptiveStem(ctx: QuestionImageContext): { folder: string; base: string } {
  return {
    folder: `${slugify(ctx.categorySlug)}/${ctx.subcategoryName ? slugify(ctx.subcategoryName) : "general"}`,
    base: slugify(ctx.answer),
  };
}

/**
 * Moves the image at imagePath to its descriptive name (unique within its
 * folder) and returns the new image_path. Leaves it in place when it already
 * has the right folder and name (allowing a -N suffix). Non-question-image
 * paths (e.g. external URLs) are returned unchanged.
 */
export function placeQuestionImage(imagePath: string, ctx: QuestionImageContext): string {
  const rel = relativeImagePath(imagePath);
  const current = rel ? resolveImageFile(rel) : null;
  if (!rel || !current || !fs.existsSync(current)) return imagePath;

  const { folder, base } = descriptiveStem(ctx);
  const ext = path.extname(rel).toLowerCase();
  const currentFolder = path.posix.dirname(rel);
  const currentName = path.posix.basename(rel, path.extname(rel));
  if (currentFolder === folder && new RegExp(`^${base}(-\\d+)?$`).test(currentName)) {
    return imagePath;
  }

  const dir = questionImagesDir();
  fs.mkdirSync(path.join(dir, folder), { recursive: true });
  const name = uniqueStem(fs.readdirSync(path.join(dir, folder)), base);
  const target = `${folder}/${name}${ext}`;
  fs.renameSync(current, path.join(dir, target));
  return QUESTION_IMAGE_URL_PREFIX + target;
}

/**
 * First free name among base, base-2, base-3, … — a name counts as taken
 * whatever its extension, so brazil.webp and brazil.jpg never both exist.
 */
export function uniqueStem(existingFiles: Iterable<string>, base: string): string {
  const taken = new Set([...existingFiles].map((f) => f.replace(/\.[^.]+$/, "").toLowerCase()));
  let name = base;
  for (let n = 2; taken.has(name); n++) name = `${base}-${n}`;
  return name;
}
