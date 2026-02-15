import { writeFile, unlink, mkdir } from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";

const DATA_DIR = process.env.DATABASE_DIR || process.cwd();
const UPLOAD_DIR = path.join(DATA_DIR, "uploads", "questions");
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

export function getUploadDir(): string {
  return UPLOAD_DIR;
}

export async function saveUploadedImage(file: File): Promise<string> {
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error("Invalid file type. Allowed: jpg, png, gif, webp.");
  }

  if (file.size > MAX_SIZE) {
    throw new Error("File too large. Maximum size is 5MB.");
  }

  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const filename = `${uuidv4()}.${ext}`;

  await mkdir(UPLOAD_DIR, { recursive: true });

  const buffer = Buffer.from(await file.arrayBuffer());
  const filePath = path.join(UPLOAD_DIR, filename);
  await writeFile(filePath, buffer);

  return `/uploads/questions/${filename}`;
}

export async function deleteImage(imagePath: string): Promise<void> {
  if (!imagePath) return;

  // Extract filename from path like /uploads/questions/uuid.jpg
  const filename = path.basename(imagePath);
  const fullPath = path.join(UPLOAD_DIR, filename);

  // Security: ensure path is within uploads directory
  const resolved = path.resolve(fullPath);
  if (!resolved.startsWith(path.resolve(UPLOAD_DIR))) {
    throw new Error("Invalid image path.");
  }

  try {
    await unlink(resolved);
  } catch {
    // File might not exist, that's fine
  }
}
