"use client";

import { useMemo } from "react";
import type { Dictionary } from "@/i18n/en";
import type { ConnectionItem } from "@/types/connections";
import type { ChallengeGame } from "@/data/challengeGame";
import { resolveImageUrl } from "@/lib/imageUrl";
import McqQuizEngine from "./McqQuizEngine";
import CarouselMedia, { type CarouselMediaItem } from "./CarouselMedia";
import VideoMedia, { type VideoMediaUrls } from "./VideoMedia";

interface Props {
  items: ConnectionItem[];
  game: ChallengeGame;
  dict: Dictionary["challenges"];
  challengeId: string;
}

// ── PILOT: web-variant video clips for every contemporary-art item,
// rendered via `gen-connections-video.js --variant=web`. Items not listed
// here (i.e. any other connections_quiz game) fall back to the existing
// CarouselMedia panel. Remove this once the pilot is validated and either
// extend the map per-game or wire it up via the DB instead of a hardcoded
// lookup. revealHoldMs matches each rendered reveal clip's actual duration
// (ffprobe), so McqQuizEngine holds long enough for the clip to finish
// instead of cutting it off at the default 1.4s.
const PILOT_VIDEO: Record<string, VideoMediaUrls & { revealHoldMs: number }> = {
  "193": { question: "/api/videos/contemporary-art/connections-193-question.v2.mp4", reveal: "/api/videos/contemporary-art/connections-193-reveal.v2.mp4", revealHoldMs: 12700 }, // The Physical Impossibility of Death in the Mind of Someone Living
  "194": { question: "/api/videos/contemporary-art/connections-194-question.v2.mp4", reveal: "/api/videos/contemporary-art/connections-194-reveal.v2.mp4", revealHoldMs: 12700 }, // Balloon Dog
  "195": { question: "/api/videos/contemporary-art/connections-195-question.v2.mp4", reveal: "/api/videos/contemporary-art/connections-195-reveal.v2.mp4", revealHoldMs: 12700 }, // Obliteration Room
  "196": { question: "/api/videos/contemporary-art/connections-196-question.v2.mp4", reveal: "/api/videos/contemporary-art/connections-196-reveal.v2.mp4", revealHoldMs: 9700 },  // 727
  "197": { question: "/api/videos/contemporary-art/connections-197-question.v2.mp4", reveal: "/api/videos/contemporary-art/connections-197-reveal.v2.mp4", revealHoldMs: 12700 }, // Untitled (Cowboy)
  "198": { question: "/api/videos/contemporary-art/connections-198-question.v2.mp4", reveal: "/api/videos/contemporary-art/connections-198-reveal.v2.mp4", revealHoldMs: 12700 }, // Companion
  "199": { question: "/api/videos/contemporary-art/connections-199-question.v2.mp4", reveal: "/api/videos/contemporary-art/connections-199-reveal.v2.mp4", revealHoldMs: 12700 }, // Sunflower Seeds
  "200": { question: "/api/videos/contemporary-art/connections-200-question.v2.mp4", reveal: "/api/videos/contemporary-art/connections-200-reveal.v2.mp4", revealHoldMs: 12700 }, // Comedian
  "201": { question: "/api/videos/contemporary-art/connections-201-question.v2.mp4", reveal: "/api/videos/contemporary-art/connections-201-reveal.v2.mp4", revealHoldMs: 12700 }, // Cloud Gate
};

// ── Main component ─────────────────────────────────────────────────────────────
export default function ConnectionsQuizChallenge({ items, game, dict, challengeId }: Props) {
  const mcqItems = useMemo<CarouselMediaItem[]>(() => items.map((it) => {
    const images = Array.from(new Set(
      [it.imageUrl, ...(it.images ?? [])].filter(Boolean).map((src) => resolveImageUrl(src))
    ));
    return { key: String(it.id), label: it.match, name: it.name, images };
  }), [items]);

  // Video items read life-size at full column width — cap to roughly a
  // default YouTube embed's footprint instead, like the rest of the web.
  return (
    <div className="max-w-3xl mx-auto">
      <McqQuizEngine
        items={mcqItems}
        liveRevealDelay={game.liveRevealDelay ?? 0}
        challengeId={challengeId}
        promptText={dict.connectionsQuizPrompt}
        perfectScoreText={`🎉 ${dict.perfectScore}`}
        scoreText={(correct, total) => dict.connectionsScore.replace("{correct}", String(correct)).replace("{total}", String(total))}
        tryAgainLabel={(wrongCount) => `${dict.tryAgain} (${wrongCount})`}
        playAgainLabel={dict.playAgain}
        revealHoldMs={(item, correct) => (correct && PILOT_VIDEO[item.key]?.revealHoldMs) || 1400}
        renderMedia={({ currentItem, revealState }) => {
          const pilot = currentItem ? PILOT_VIDEO[currentItem.key] : null;
          return pilot ? (
            <VideoMedia key={currentItem!.key} item={currentItem} revealState={revealState} urls={pilot} />
          ) : (
            <CarouselMedia key={currentItem?.key} item={currentItem} revealState={revealState} />
          );
        }}
      />
    </div>
  );
}
