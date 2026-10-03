"use client";

import { useState, useEffect } from "react";
import type { McqItem, McqRevealState } from "./McqQuizEngine";
import type { QuizTheme } from "@/lib/quizThemes";

export interface CarouselMediaItem extends McqItem {
  name: string;
  images: string[]; // primary image first, then any extras
  questionTextEn?: string | null;
  questionTextNl?: string | null;
}

// Slow, continuous scale+pan drift per image — ported from the video generator's
// Ken Burns table (gen-map-video.js), 4 varied directions cycled by index.
// Runs on every image regardless of which is currently visible, so whichever one
// fades in is already mid-drift instead of snapping to a fresh start each time.
const KEN_BURNS_CSS = `
  @keyframes cm-kb-0 { from { transform: scale(1.05) translate(1.5%, 0.5%); }   to { transform: scale(1.1)  translate(-1.5%, -1%); } }
  @keyframes cm-kb-1 { from { transform: scale(1.1)  translate(-1.5%, -1%); }   to { transform: scale(1.05) translate(1.5%, 0.5%); } }
  @keyframes cm-kb-2 { from { transform: scale(1.05) translate(-1%, 1.5%); }    to { transform: scale(1.1)  translate(1%, -1.5%); } }
  @keyframes cm-kb-3 { from { transform: scale(1.1)  translate(1%, 1%); }      to { transform: scale(1.05) translate(-1.5%, -0.5%); } }
`;

// ── Image carousel media panel ──────────────────────────────────────────────────
// Callers should pass `key={item?.key}` so slideIndex naturally resets on remount
// when the question changes, instead of resetting it via an effect.
export default function CarouselMedia({ item, revealState, theme }: { item: CarouselMediaItem | null; revealState: McqRevealState; theme?: QuizTheme }) {
  const [slideIndex, setSlideIndex] = useState(0);
  const images = item?.images ?? [];

  useEffect(() => {
    if (images.length <= 1) return;
    const id = setInterval(() => setSlideIndex((i) => (i + 1) % images.length), 3500);
    return () => clearInterval(id);
  }, [images.length]);

  if (!item) return null;

  return (
    <>
      {images.length > 0 ? (
        <div
          className="relative w-full aspect-[16/10] overflow-hidden transition-transform duration-500 ease-out"
          style={{ transform: revealState !== "idle" ? "scale(1.02)" : "scale(1)" }}
        >
          <style>{KEN_BURNS_CSS}</style>
          {images.map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={src}
              src={src}
              alt={item.name}
              className={`absolute inset-0 w-full h-full object-cover object-top transition-opacity duration-700 ${
                i === slideIndex ? "opacity-100" : "opacity-0"
              }`}
              style={{
                animationName: `cm-kb-${i % 4}`,
                animationDuration: "9s",
                animationTimingFunction: "ease-in-out",
                animationIterationCount: "infinite",
                animationDirection: "alternate",
                animationFillMode: "both",
              }}
            />
          ))}
          {images.length > 1 && (
            <div className="absolute top-3 left-3 z-20 flex gap-1.5">
              {images.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setSlideIndex(i)}
                  aria-label={`Image ${i + 1}`}
                  className="w-1.5 h-1.5 rounded-full transition-colors"
                  style={{ backgroundColor: i === slideIndex ? (theme?.panelAccent ?? "#fff") : "rgba(255,255,255,0.35)" }}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="w-full aspect-[16/10] flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900">
          <span className="text-slate-500 text-5xl font-bold select-none">
            {item.name.charAt(0)}
          </span>
        </div>
      )}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-4 pt-10 pb-3">
        <p className="text-white text-sm font-semibold">{item.name}</p>
      </div>
    </>
  );
}
