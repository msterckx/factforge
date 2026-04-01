"use client";

import { useState, useRef, useEffect } from "react";
import type { Dictionary } from "@/i18n/en";
import type { ConnectionItem } from "@/types/connections";
import { useCompletedChallenges } from "@/hooks/useCompletedChallenges";
import { resolveImageUrl } from "@/lib/imageUrl";
import { trackChallengeStart, trackChallengeComplete, trackChallengeFail } from "@/lib/gtag";

interface Props {
  items: ConnectionItem[];
  dict: Dictionary["challenges"];
  challengeId: string;
  leftLabel?: string;
  rightLabel?: string;
}

const STARTING_LIVES = 5;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function Lives({ current, max }: { current: number; max: number }) {
  return (
    <div className="flex items-center gap-0.5 sm:gap-1">
      {Array.from({ length: max }, (_, i) => (
        <span
          key={i}
          className={`text-sm sm:text-base transition-all duration-300 ${i < current ? "text-red-500" : "text-slate-200"}`}
          style={i >= current ? { filter: "grayscale(1)" } : undefined}
        >
          ♥
        </span>
      ))}
    </div>
  );
}

export default function ConnectionsGame({ items, dict, challengeId, leftLabel, rightLabel }: Props) {
  const { markComplete } = useCompletedChallenges();

  const colLeft  = leftLabel  || "Items";
  const colRight = rightLabel || "Answers";

  // Initialise unshuffled so SSR and hydration match, then shuffle on client mount
  const [fixedItems,       setFixedItems]       = useState<ConnectionItem[]>(items);
  const [answers,          setAnswers]           = useState<string[]>(items.map((i) => i.match));
  const [lockedPositions,  setLockedPositions]   = useState<Set<number>>(new Set());
  const [lives,            setLives]             = useState(STARTING_LIVES);
  const [wrongAttempts,    setWrongAttempts]      = useState(0);
  const [gameOver,         setGameOver]           = useState(false);
  const [scoreSubmitted,   setScoreSubmitted]     = useState(false);
  const [revealed,         setRevealed]           = useState(false);
  const [lightbox,         setLightbox]           = useState<{ url: string; alt: string } | null>(null);
  const [wrongFlashIndex,   setWrongFlashIndex]   = useState<number | null>(null);
  const [correctFlashIndex, setCorrectFlashIndex] = useState<number | null>(null);
  const [questionSnapBack,  setQuestionSnapBack]  = useState<number | null>(null);

  // Derived
  const correctCount = lockedPositions.size;
  const allCorrect   = correctCount === items.length;
  const maxScore     = items.length * 10;
  const currentScore = Math.max(0, correctCount * 10 - wrongAttempts * 2);

  // Re-shuffle on mount (client-only) and whenever items change
  useEffect(() => {
    setFixedItems(shuffle([...items]));
    setAnswers(shuffle(items.map((i) => i.match)));
    setLockedPositions(new Set());
    setLives(STARTING_LIVES);
    setWrongAttempts(0);
    setGameOver(false);
    setScoreSubmitted(false);
    setRevealed(false);
  }, [items]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { trackChallengeStart(challengeId); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!lightbox) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setLightbox(null); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [lightbox]);

  // Score submission
  useEffect(() => {
    if ((allCorrect || gameOver) && !scoreSubmitted) {
      setScoreSubmitted(true);
      if (allCorrect) {
        markComplete(challengeId, currentScore, maxScore);
        trackChallengeComplete(challengeId, currentScore, maxScore);
      } else {
        trackChallengeFail(challengeId);
      }
      fetch("/api/challenges/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId, score: currentScore, maxScore }),
      }).catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allCorrect, gameOver]);

  // ── Drag state ────────────────────────────────────────────────────────────
  const dragIndex   = useRef<number | null>(null);
  const dragStart   = useRef<{ x: number; y: number } | null>(null);
  const isDragging  = useRef(false);
  const ghostRef    = useRef<HTMLDivElement | null>(null);
  const answerRefs  = useRef<(HTMLDivElement | null)[]>([]);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  function getTargetIndex(clientY: number): number | null {
    let closest: number | null = null;
    let minDist = Infinity;
    for (let i = 0; i < answerRefs.current.length; i++) {
      const el = answerRefs.current[i];
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (clientY >= rect.top && clientY <= rect.bottom) return i;
      const center = (rect.top + rect.bottom) / 2;
      const dist   = Math.abs(clientY - center);
      if (dist < minDist) { minDist = dist; closest = i; }
    }
    return minDist < 56 ? closest : null;
  }

  // ── Ghost helpers ─────────────────────────────────────────────────────────
  function createGhost(text: string, x: number, y: number) {
    const el = document.createElement("div");
    Object.assign(el.style, {
      position:      "fixed",
      left:          `${x - 64}px`,
      top:           `${y - 20}px`,
      zIndex:        "9999",
      pointerEvents: "none",
      background:    "#fffbeb",
      border:        "2px solid #f59e0b",
      borderRadius:  "10px",
      padding:       "5px 14px",
      fontSize:      "13px",
      fontWeight:    "600",
      color:         "#92400e",
      maxWidth:      "220px",
      overflow:      "hidden",
      textOverflow:  "ellipsis",
      whiteSpace:    "nowrap",
      boxShadow:     "0 4px 16px rgba(0,0,0,0.2)",
      opacity:       "0.93",
    });
    el.textContent = text;
    document.body.appendChild(el);
    ghostRef.current = el;
  }

  function moveGhost(x: number, y: number) {
    if (ghostRef.current) {
      ghostRef.current.style.left = `${x - 64}px`;
      ghostRef.current.style.top  = `${y - 20}px`;
    }
  }

  function removeGhost() {
    if (ghostRef.current) { document.body.removeChild(ghostRef.current); ghostRef.current = null; }
  }

  // ── Pointer down — attach window listeners ────────────────────────────────
  // State values (answers, fixedItems, lockedPositions, lives) are captured via closure.
  // This is safe because no state changes occur mid-drag; onMove only updates dragOverIndex.
  function handlePointerDown(e: React.PointerEvent, index: number) {
    if (gameOver || allCorrect || lockedPositions.has(index)) return;
    e.preventDefault();

    const startX = e.clientX;
    const startY = e.clientY;
    dragIndex.current  = index;
    dragStart.current  = { x: startX, y: startY };
    isDragging.current = false;

    function onMove(ev: PointerEvent) {
      if (dragIndex.current === null) return;
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;

      if (!isDragging.current && Math.sqrt(dx * dx + dy * dy) > 6) {
        isDragging.current = true;
        const idx = dragIndex.current;
        createGhost(answerRefs.current[idx]?.querySelector("[data-answer-text]")?.textContent ?? "", ev.clientX, ev.clientY);
      }

      if (isDragging.current) {
        moveGhost(ev.clientX, ev.clientY);
        setDragOverIndex(getTargetIndex(ev.clientY));
      }
    }

    function onUp(ev: PointerEvent) {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup",   onUp);

      if (isDragging.current) {
        const target = getTargetIndex(ev.clientY);
        removeGhost();
        setDragOverIndex(null);
        const src = dragIndex.current;

        // Only allow drop onto unlocked, different positions
        if (target !== null && src !== null && target !== src && !lockedPositions.has(target)) {
          const newAnswers = [...answers];
          [newAnswers[src], newAnswers[target]] = [newAnswers[target], newAnswers[src]];
          setAnswers(newAnswers);

          const targetCorrect = newAnswers[target] === fixedItems[target]?.match;
          const srcCorrect    = newAnswers[src]    === fixedItems[src]?.match;

          const newLocked = new Set(lockedPositions);
          if (targetCorrect) newLocked.add(target);
          if (srcCorrect)    newLocked.add(src);
          // Scan all positions: auto-lock any that are correct. This handles the
          // last-item edge case where the final answer is already in its correct
          // row and the user has no valid drag target to confirm it.
          for (let j = 0; j < fixedItems.length; j++) {
            if (!newLocked.has(j) && newAnswers[j] === fixedItems[j]?.match) {
              newLocked.add(j);
            }
          }
          if (newLocked.size !== lockedPositions.size) setLockedPositions(newLocked);

          if (targetCorrect) {
            setCorrectFlashIndex(target);
            setTimeout(() => setCorrectFlashIndex(null), 850);
          } else {
            // Wrong placement: deduct a life
            const newLives = lives - 1;
            setLives(newLives);
            setWrongAttempts((w) => w + 1);
            if (newLives <= 0) setGameOver(true);
            setWrongFlashIndex(target);
            setQuestionSnapBack(target);
            setTimeout(() => { setWrongFlashIndex(null); setQuestionSnapBack(null); }, 600);
          }
        }
      }

      dragIndex.current  = null;
      dragStart.current  = null;
      isDragging.current = false;
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup",   onUp);
  }

  // ── Reset ─────────────────────────────────────────────────────────────────
  function handleReset() {
    setFixedItems(shuffle([...items]));
    setAnswers(shuffle(items.map((i) => i.match)));
    setLockedPositions(new Set());
    setLives(STARTING_LIVES);
    setWrongAttempts(0);
    setGameOver(false);
    setScoreSubmitted(false);
    setRevealed(false);
    setWrongFlashIndex(null);
    setCorrectFlashIndex(null);
    setQuestionSnapBack(null);
    removeGhost();
    dragIndex.current  = null;
    isDragging.current = false;
  }

  const gameActive = !allCorrect && !gameOver;

  return (
    <div className="space-y-4">
      <style>{`
        /* ── Question card snaps back after a wrong drop ─────────────── */
        @keyframes questionSnapBack {
          0%   { transform: translateX(10px); }
          45%  { transform: translateX(-3px); }
          72%  { transform: translateX(1px); }
          100% { transform: translateX(0); }
        }
        .question-snap-back { animation: questionSnapBack 0.38s ease-out forwards; }

        /* ── Answer card: glow ring + shimmer on correct drop ─────────── */
        @keyframes caesarGlow {
          0%   { box-shadow: 0 0 0 2px #4ade80, 0 0 8px 1px #4ade8088; }
          50%  { box-shadow: 0 0 0 2px #86efac, 0 0 16px 4px #4ade80bb; }
          100% { box-shadow: 0 0 0 2px #4ade80, 0 0 6px 1px #4ade8033; }
        }
        @keyframes caesarShine {
          0%   { left: -80%; }
          100% { left: 130%; }
        }
        .conn-correct {
          animation: caesarGlow 1.4s ease-in-out forwards;
          outline: 2px solid #4ade80;
        }
        .conn-correct::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.5) 50%, transparent 70%);
          animation: caesarShine 0.8s ease-in-out forwards;
          pointer-events: none;
          border-radius: inherit;
        }

        /* ── Answer card: shake on wrong drop ─────────────────────────── */
        @keyframes wrongFlash {
          0%   { background-color: #fef2f2; border-color: #f87171; transform: translateX(0); }
          25%  { transform: translateX(-4px); }
          75%  { transform: translateX(4px); }
          100% { background-color: transparent; border-color: inherit; transform: translateX(0); }
        }
        .conn-wrong { animation: wrongFlash 0.55s ease-out forwards; }
      `}</style>

      <p className="text-sm text-slate-500">{dict.connectionsInstruction}</p>

      {/* ── Lightbox ──────────────────────────────────────────────────── */}
      {lightbox && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setLightbox(null)}>
          <div className="relative max-w-3xl w-full" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={lightbox.url} alt={lightbox.alt} className="w-full max-h-[80vh] object-contain rounded-xl shadow-2xl" />
            {lightbox.alt && <p className="text-center text-white/90 text-sm mt-3 font-medium">{lightbox.alt}</p>}
            <button onClick={() => setLightbox(null)} className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-white text-slate-800 text-lg font-bold flex items-center justify-center shadow-lg hover:bg-slate-100">×</button>
          </div>
        </div>
      )}

      {/* ── Status bar ────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between min-h-[28px]">
        <div className="flex items-center gap-3">
          {allCorrect ? (
            <p className="text-sm font-semibold text-emerald-700">
              {dict.connectionsScore.replace("{correct}", String(correctCount)).replace("{total}", String(items.length))} 🎉
            </p>
          ) : gameOver ? (
            <p className="text-sm font-semibold text-red-600">Game Over</p>
          ) : (
            <p className="text-sm text-slate-500">
              <span className="font-semibold text-amber-700">{correctCount}/{items.length}</span> correct
            </p>
          )}
        </div>
        {gameActive && <Lives current={lives} max={STARTING_LIVES} />}
      </div>

      {/* ── Column headers ────────────────────────────────────────────── */}
      {!revealed && (
        <div className="flex gap-6 sm:gap-8">
          <p className="flex-1 text-xs font-semibold text-slate-400 uppercase tracking-wider">{colLeft}</p>
          <p className="flex-1 text-xs font-semibold text-slate-400 uppercase tracking-wider">{colRight}</p>
        </div>
      )}

      {/* ── Playing rows ──────────────────────────────────────────────── */}
      {!revealed && (
        <div className="space-y-2">
          {fixedItems.map((item, i) => {
            const answer         = answers[i];
            const isLocked       = lockedPositions.has(i);
            const isDragTarget   = dragOverIndex === i && gameActive && !isLocked;
            const isWrongFlash   = wrongFlashIndex === i;
            const isCorrectFlash = correctFlashIndex === i;
            const isSnappingBack = questionSnapBack === i;
            const resolvedImg    = item.imageUrl ? resolveImageUrl(item.imageUrl) : "";

            return (
              <div
                key={item.id}
                className="flex gap-6 sm:gap-8"
              >
                {/* Left: question card — slides right on hover; stays there when locked; snaps back on wrong */}
                <div
                  style={isSnappingBack ? undefined : {
                    transform: (isDragTarget || isLocked) ? "translateX(10px)" : "translateX(0)",
                    transition: "transform 0.15s ease-out",
                  }}
                  className={[
                    "flex flex-1 items-center gap-1.5 sm:gap-2.5 border-2 rounded-xl p-1.5 sm:p-2.5 transition-colors",
                    isLocked ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-white",
                    isSnappingBack ? "question-snap-back" : "",
                  ].join(" ")}
                >
                  {resolvedImg && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={resolvedImg}
                      alt={item.name}
                      onClick={() => setLightbox({ url: resolvedImg, alt: item.name })}
                      className="w-9 h-9 sm:w-12 sm:h-12 object-cover rounded-lg flex-shrink-0 cursor-zoom-in hover:opacity-90 hover:ring-2 hover:ring-amber-400 transition-all"
                    />
                  )}
                  <p className="text-xs sm:text-sm font-medium text-slate-800 leading-tight">{item.name}</p>
                </div>

                {/* Right: answer card — slides left to meet question card when locked */}
                <div
                  ref={(el) => { answerRefs.current[i] = el; }}
                  onPointerDown={(e) => handlePointerDown(e, i)}
                  style={isLocked ? { transform: "translateX(-10px)", transition: "transform 0.2s ease-out" } : undefined}
                  className={[
                    "relative flex flex-1 items-center gap-2 border-2 rounded-xl px-2 sm:px-3 py-2 sm:py-2.5 select-none touch-none overflow-hidden transition-colors",
                    isLocked     ? "border-emerald-400 bg-emerald-50 cursor-default"
                    : gameActive ? "cursor-grab active:cursor-grabbing"
                    :              "cursor-default",
                    isWrongFlash    ? "conn-wrong"
                    : isCorrectFlash ? "conn-correct"
                    : isDragTarget  ? "border-amber-400 bg-amber-50"
                    : isLocked      ? ""
                    :                 "border-slate-200 bg-white hover:border-amber-200",
                  ].join(" ")}
                >
                  {isLocked
                    ? <span className="text-emerald-500 flex-shrink-0">✓</span>
                    : gameActive && <span className="text-slate-300 flex-shrink-0 leading-none select-none">⠿</span>
                  }
                  <p
                    data-answer-text
                    className={`flex-1 min-w-0 text-xs sm:text-sm font-medium leading-tight truncate ${isLocked ? "text-emerald-700" : "text-slate-700"}`}
                  >
                    {answer}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Revealed view ─────────────────────────────────────────────── */}
      {revealed && (
        <div className="space-y-2">
          {items.map((item) => {
            const resolvedImg = item.imageUrl ? resolveImageUrl(item.imageUrl) : "";
            return (
              <div key={item.id} className="flex items-start gap-3 border border-emerald-200 bg-emerald-50 rounded-xl p-3">
                {resolvedImg && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={resolvedImg} alt={item.name} onClick={() => setLightbox({ url: resolvedImg, alt: item.name })} className="w-14 h-14 object-cover rounded-lg flex-shrink-0 cursor-zoom-in hover:opacity-90 transition-all" />
                )}
                <div>
                  <p className="font-semibold text-slate-800 text-sm">{item.name}</p>
                  <p className="text-sm text-emerald-700 font-medium">→ {item.match}</p>
                  {item.description && <p className="text-xs text-slate-500 mt-0.5">{item.description}</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Action bar ────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100">
        {!gameActive && !revealed && (
          <>
            <div className="flex items-center gap-2">
              <span className={`text-base font-bold ${allCorrect ? "text-emerald-600" : "text-slate-700"}`}>
                Score: {currentScore}/{maxScore}
              </span>
            </div>
            <button onClick={() => setRevealed(true)} className="px-4 py-2 border border-slate-300 text-slate-600 hover:bg-slate-50 rounded-xl text-sm font-medium transition-colors">
              {dict.connectionsReveal}
            </button>
            <button onClick={handleReset} className="px-4 py-2 border border-slate-300 text-slate-600 hover:bg-slate-50 rounded-xl text-sm font-medium transition-colors">
              {dict.connectionsPlayAgain}
            </button>
          </>
        )}

        {revealed && (
          <button onClick={handleReset} className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-medium transition-colors">
            {dict.connectionsPlayAgain}
          </button>
        )}
      </div>
    </div>
  );
}
