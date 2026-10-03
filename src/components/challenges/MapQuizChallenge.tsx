"use client";

import { useRef, useMemo } from "react";
import type { Dictionary } from "@/i18n/en";
import type { MapRegion, ChallengeGame } from "@/data/challengeGame";
import McqQuizEngine from "./McqQuizEngine";
import MapMedia, { type MapMediaHandle, type MapMediaItem, getMapRevealHoldMs } from "./MapMedia";

interface Props {
  regions: MapRegion[];
  game: ChallengeGame;
  dict: Dictionary["challenges"];
  challengeId: string;
  lang: string;
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function MapQuizChallenge({ regions, game, dict, challengeId, lang }: Props) {
  const mediaRef = useRef<MapMediaHandle>(null);

  const mcqItems = useMemo<MapMediaItem[]>(() => regions.map((r) => {
    const key = r.regionKey.trim();
    return { key, regionKey: key, label: lang === "nl" ? r.labelNl : r.labelEn };
  }), [regions, lang]);

  return (
    <McqQuizEngine
      items={mcqItems}
      liveRevealDelay={game.liveRevealDelay ?? 0}
      challengeId={challengeId}
      promptText="Where is this?"
      perfectScoreText="🎉 Perfect score!"
      scoreText={(correct, total) => `${correct} / ${total} correct`}
      tryAgainLabel={(wrongCount) => `Retry ${wrongCount} wrong answer${wrongCount === 1 ? "" : "s"}`}
      playAgainLabel={dict.playAgain}
      mediaBorderReveal={false}
      onReveal={(key, correct) => mediaRef.current?.reveal(key, correct)}
      onAdvance={() => mediaRef.current?.resetZoom()}
      revealHoldMs={(item) => getMapRevealHoldMs(item, regions)}
      renderMedia={({ currentItem, answeredKeys, revealState }) => (
        <MapMedia ref={mediaRef} regions={regions} game={game} currentItem={currentItem} answeredKeys={answeredKeys} revealState={revealState} />
      )}
    />
  );
}
