import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

// IMAGE_SEARCH_PROVIDER: "unsplash" (default), "pexels", or "pixabay"
const provider = (process.env.IMAGE_SEARCH_PROVIDER || "unsplash").toLowerCase();

interface SearchImage {
  id: string;
  thumbUrl: string;
  regularUrl: string;
  alt: string;
  photographer: string;
  downloadLocation: string;
}

// --- Unsplash ---

interface UnsplashPhoto {
  id: string;
  alt_description: string | null;
  urls: { thumb: string; regular: string };
  links: { download_location: string };
  user: { name: string };
}

async function searchUnsplash(query: string): Promise<SearchImage[]> {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!accessKey) throw new Error("Unsplash API key not configured (UNSPLASH_ACCESS_KEY)");

  const url = new URL("https://api.unsplash.com/search/photos");
  url.searchParams.set("query", query);
  url.searchParams.set("per_page", "9");
  url.searchParams.set("orientation", "landscape");

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Client-ID ${accessKey}` },
  });

  if (!res.ok) throw new Error("Unsplash API request failed");

  const data = await res.json();
  return (data.results as UnsplashPhoto[]).map((photo) => ({
    id: photo.id,
    thumbUrl: photo.urls.thumb,
    regularUrl: photo.urls.regular,
    alt: photo.alt_description || "Photo",
    photographer: photo.user.name,
    downloadLocation: photo.links.download_location,
  }));
}

// --- Pexels ---

interface PexelsPhoto {
  id: number;
  alt: string;
  src: { tiny: string; large: string };
  photographer: string;
}

async function searchPexels(query: string): Promise<SearchImage[]> {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) throw new Error("Pexels API key not configured (PEXELS_API_KEY)");

  const url = new URL("https://api.pexels.com/v1/search");
  url.searchParams.set("query", query);
  url.searchParams.set("per_page", "9");
  url.searchParams.set("orientation", "landscape");

  const res = await fetch(url.toString(), {
    headers: { Authorization: apiKey },
  });

  if (!res.ok) throw new Error("Pexels API request failed");

  const data = await res.json();
  return (data.photos as PexelsPhoto[]).map((photo) => ({
    id: String(photo.id),
    thumbUrl: photo.src.tiny,
    regularUrl: photo.src.large,
    alt: photo.alt || "Photo",
    photographer: photo.photographer,
    downloadLocation: "",
  }));
}

// --- Pixabay ---

interface PixabayHit {
  id: number;
  previewURL: string;
  largeImageURL: string;
  tags: string;
  user: string;
}

async function searchPixabay(query: string): Promise<SearchImage[]> {
  const apiKey = process.env.PIXABAY_API_KEY;
  if (!apiKey) throw new Error("Pixabay API key not configured (PIXABAY_API_KEY)");

  const url = new URL("https://pixabay.com/api/");
  url.searchParams.set("key", apiKey);
  url.searchParams.set("q", query);
  url.searchParams.set("per_page", "9");
  url.searchParams.set("orientation", "horizontal");
  url.searchParams.set("image_type", "photo");
  url.searchParams.set("safesearch", "true");

  const res = await fetch(url.toString());

  if (!res.ok) throw new Error("Pixabay API request failed");

  const data = await res.json();
  return (data.hits as PixabayHit[]).map((hit) => ({
    id: String(hit.id),
    thumbUrl: hit.previewURL,
    regularUrl: hit.largeImageURL,
    alt: hit.tags || "Photo",
    photographer: hit.user,
    downloadLocation: "",
  }));
}

// --- Route handler ---

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { query } = await request.json();
  if (!query || typeof query !== "string") {
    return NextResponse.json({ error: "Search query is required" }, { status: 400 });
  }

  try {
    const searchFn = provider === "pexels"
      ? searchPexels
      : provider === "pixabay"
        ? searchPixabay
        : searchUnsplash;
    const images = await searchFn(query);

    if (images.length === 0) {
      return NextResponse.json({ images: [], message: "No images found" });
    }

    return NextResponse.json({ images });
  } catch (error) {
    console.error("Image search error:", error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 502 }
    );
  }
}
