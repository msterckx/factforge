"use client";

import { useEffect, useRef, useState } from "react";
import type { McqItem, McqRevealState } from "./McqQuizEngine";

export interface VideoMediaUrls {
  question: string;
  reveal: string;
}

// ── Video-backed media panel (pilot) ────────────────────────────────────────
// Reuses the item's HyperFrames-rendered "web variant" clips instead of
// re-implementing the reveal animation in CSS. The "question" clip plays the
// narration + Ken Burns hold and pauses on its own last frame once it ends —
// native <video> behavior, no JS needed — holding there for however long the
// visitor takes to answer. On a real answer, the "reveal" clip (preloaded in
// the background the whole time) swaps in and plays the baked crossfade +
// caption payoff. Neither clip has an answer panel or buttons baked in —
// McqQuizEngine's real buttons own that entirely.
export default function VideoMedia({
  item,
  revealState,
  urls,
}: {
  item: McqItem | null;
  revealState: McqRevealState;
  urls: VideoMediaUrls;
}) {
  const questionRef = useRef<HTMLVideoElement | null>(null);
  const revealRef   = useRef<HTMLVideoElement | null>(null);
  const [showReveal, setShowReveal] = useState(false);
  const [needsTap, setNeedsTap] = useState(false);

  // ── Start the question clip fresh whenever the item changes ─────────────────
  useEffect(() => {
    setShowReveal(false);
    setNeedsTap(false);
    const q = questionRef.current;
    if (!q) return;
    q.currentTime = 0;
    q.play().catch(() => setNeedsTap(true));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.key]);

  // ── On reveal: pause the question clip, swap to the (preloaded) reveal clip ──
  useEffect(() => {
    if (revealState === "idle") return;
    questionRef.current?.pause();
    if (revealState !== "correct") return; // no baked "wrong" branch — just hold where we are
    setShowReveal(true);
    const r = revealRef.current;
    if (!r) return;
    r.currentTime = 0;
    r.play().catch(() => setNeedsTap(true));
  }, [revealState]);

  // ── The very first clip of a session has no prior user gesture to ride on, so the
  //    browser blocks its unmuted autoplay and we fall back to the tap overlay above.
  //    Any real interaction anywhere on the page (e.g. the "Start Challenge" click)
  //    is enough to unlock audio for the rest of the session — so retry silently on
  //    the next one instead of forcing a redundant tap on this exact overlay.
  useEffect(() => {
    if (!needsTap) return;
    const retry = () => {
      const el = showReveal ? revealRef.current : questionRef.current;
      el?.play().then(() => setNeedsTap(false)).catch(() => {});
    };
    document.addEventListener("pointerdown", retry, { once: true });
    return () => document.removeEventListener("pointerdown", retry);
  }, [needsTap, showReveal]);

  if (!item) return null;

  // object-left: source clips are 16:9 inside this 16:10 box, so object-cover
  // must crop ~11% of width. Anchoring left keeps the baked bottom-left title
  // caption intact instead of the default centered crop chewing into it.
  return (
    <div className="relative w-full aspect-[16/10] overflow-hidden bg-slate-900">
      <video
        ref={questionRef}
        src={urls.question}
        playsInline
        preload="auto"
        className={`absolute inset-0 w-full h-full object-cover object-left transition-opacity duration-300 ${
          showReveal ? "opacity-0" : "opacity-100"
        }`}
      />
      <video
        ref={revealRef}
        src={urls.reveal}
        playsInline
        preload="auto"
        className={`absolute inset-0 w-full h-full object-cover object-left transition-opacity duration-300 ${
          showReveal ? "opacity-100" : "opacity-0"
        }`}
      />
      {needsTap && (
        <button
          type="button"
          onClick={() => {
            setNeedsTap(false);
            (showReveal ? revealRef.current : questionRef.current)?.play().catch(() => {});
          }}
          className="absolute inset-0 flex items-center justify-center bg-black/40 text-white text-4xl"
          aria-label="Play"
        >
          ▶
        </button>
      )}
    </div>
  );
}
