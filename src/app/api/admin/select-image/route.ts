import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { imageUrl, downloadLocation } = await request.json();

  if (!imageUrl || typeof imageUrl !== "string") {
    return NextResponse.json({ error: "Image URL is required" }, { status: 400 });
  }

  try {
    // Trigger Unsplash download tracking (required by API guidelines)
    if (downloadLocation) {
      const accessKey = process.env.UNSPLASH_ACCESS_KEY;
      if (accessKey) {
        fetch(`${downloadLocation}?client_id=${accessKey}`).catch(() => {});
      }
    }

    // Download the image
    const res = await fetch(imageUrl);
    if (!res.ok) {
      return NextResponse.json({ error: "Failed to download image" }, { status: 502 });
    }

    const contentType = res.headers.get("content-type") || "image/jpeg";
    const extMap: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/gif": "gif",
      "image/webp": "webp",
    };
    const ext = extMap[contentType] || "jpg";

    const dataDir = process.env.DATABASE_DIR || process.cwd();
    const uploadDir = path.join(dataDir, "uploads", "questions");
    await mkdir(uploadDir, { recursive: true });

    const filename = `${uuidv4()}.${ext}`;
    const filePath = path.join(uploadDir, filename);

    const buffer = Buffer.from(await res.arrayBuffer());
    await writeFile(filePath, buffer);

    const imagePath = `/uploads/questions/${filename}`;
    return NextResponse.json({ imagePath });
  } catch (error) {
    console.error("Image download error:", error);
    return NextResponse.json(
      { error: "Failed to save image" },
      { status: 500 }
    );
  }
}
