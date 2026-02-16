import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

interface UnsplashPhoto {
  id: string;
  alt_description: string | null;
  urls: { thumb: string; regular: string };
  links: { download_location: string };
  user: { name: string };
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!accessKey) {
    return NextResponse.json(
      { error: "Unsplash API key not configured" },
      { status: 500 }
    );
  }

  const { query } = await request.json();
  if (!query || typeof query !== "string") {
    return NextResponse.json({ error: "Search query is required" }, { status: 400 });
  }

  const url = new URL("https://api.unsplash.com/search/photos");
  url.searchParams.set("query", query);
  url.searchParams.set("per_page", "9");
  url.searchParams.set("orientation", "landscape");

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Client-ID ${accessKey}` },
  });

  if (!res.ok) {
    return NextResponse.json(
      { error: "Unsplash API request failed" },
      { status: 502 }
    );
  }

  const data = await res.json();

  const images = (data.results as UnsplashPhoto[]).map((photo) => ({
    id: photo.id,
    thumbUrl: photo.urls.thumb,
    regularUrl: photo.urls.regular,
    alt: photo.alt_description || "Photo",
    photographer: photo.user.name,
    downloadLocation: photo.links.download_location,
  }));

  return NextResponse.json({ images });
}
