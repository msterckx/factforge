import { writeFile, unlink, mkdir } from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { questionImagesDir, relativeImagePath, resolveImageFile, QUESTION_IMAGE_URL_PREFIX } from "@/lib/questionImages";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

export function getUploadDir(): string {
  return questionImagesDir();
}

/**
 * Saves a new image under incoming/<uuid>.<ext>; the question actions then
 * move it to its descriptive name with placeQuestionImage() once the
 * question's category and answer are known.
 */
export async function saveUploadedImage(file: File): Promise<string> {
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error("Invalid file type. Allowed: jpg, png, gif, webp.");
  }

  if (file.size > MAX_SIZE) {
    throw new Error("File too large. Maximum size is 5MB.");
  }

  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const rel = `incoming/${uuidv4()}.${ext}`;

  await mkdir(path.join(questionImagesDir(), "incoming"), { recursive: true });

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(questionImagesDir(), rel), buffer);

  return QUESTION_IMAGE_URL_PREFIX + rel;
}

export async function deleteImage(imagePath: string): Promise<void> {
  const rel = relativeImagePath(imagePath);
  if (!rel) return;

  // Security: resolveImageFile refuses paths outside the images folder
  const resolved = resolveImageFile(rel);
  if (!resolved) {
    throw new Error("Invalid image path.");
  }

  try {
    await unlink(resolved);
  } catch {
    // File might not exist, that's fine
  }
}
