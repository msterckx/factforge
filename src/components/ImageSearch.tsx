"use client";

import { useState } from "react";
import Image from "next/image";

interface SearchResult {
  id: string;
  thumbUrl: string;
  regularUrl: string;
  alt: string;
  photographer: string;
  downloadLocation: string;
}

export default function ImageSearch({
  onImageSelected,
}: {
  onImageSelected: (imagePath: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selecting, setSelecting] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function handleSearch(e?: React.SyntheticEvent) {
    e?.preventDefault();
    if (!query.trim()) return;
    setError("");
    setResults([]);
    setLoading(true);

    try {
      const res = await fetch("/api/admin/search-images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Search failed");
        return;
      }

      setResults(data.images);
      if (data.images.length === 0) {
        setError("No images found. Try a different search term.");
      }
    } catch {
      setError("Failed to search images");
    } finally {
      setLoading(false);
    }
  }

  async function handleSelect(image: SearchResult) {
    setSelecting(image.id);
    setError("");

    try {
      const res = await fetch("/api/admin/select-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl: image.regularUrl,
          downloadLocation: image.downloadLocation,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to save image");
        return;
      }

      onImageSelected(data.imagePath);
      setResults([]);
      setQuery("");
    } catch {
      setError("Failed to save image");
    } finally {
      setSelecting(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleSearch(e); } }}
          placeholder="Search for an image..."
          className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
        />
        <button
          type="button"
          onClick={handleSearch}
          disabled={loading || !query.trim()}
          className="px-4 py-2 bg-slate-700 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50"
        >
          {loading ? "Searching..." : "Search"}
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      {results.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {results.map((image) => (
            <button
              key={image.id}
              type="button"
              onClick={() => handleSelect(image)}
              disabled={selecting !== null}
              className={`relative aspect-video rounded-lg overflow-hidden border-2 transition-all hover:border-amber-400 focus:outline-none focus:border-amber-400 ${
                selecting === image.id
                  ? "border-amber-500 opacity-70"
                  : "border-slate-200"
              }`}
            >
              <Image
                src={image.thumbUrl}
                alt={image.alt}
                fill
                className="object-cover"
                sizes="200px"
              />
              {selecting === image.id && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                  <svg className="animate-spin h-6 w-6 text-white" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                </div>
              )}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-1">
                <p className="text-[10px] text-white truncate">{image.photographer}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
