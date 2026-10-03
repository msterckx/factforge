"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useCompletedChallenges } from "@/hooks/useCompletedChallenges";
import { trackChallengeStart, trackChallengeComplete } from "@/lib/gtag";
import { getQuizTheme, type QuizTheme } from "@/lib/quizThemes";

// ── Shared 3-option "spot the answer" quiz engine ──────────────────────────────
// Used by MapQuizChallenge (media = interactive map) and ConnectionsQuizChallenge
// (media = image carousel). Owns timing, scoring, retry and celebration; the
// media panel itself is supplied by the caller via `renderMedia`.

export interface McqItem {
  key: string;   // stable unique id (region key / item id)
  label: string; // correct-answer option text
}

export type McqPhase = "question" | "revealed" | "done";
export type McqOptionState = "idle" | "correct" | "wrong";
export type McqRevealState = "idle" | "correct" | "wrong";

const QUESTION_TIME_MS = 10000;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Glitter bomb ───────────────────────────────────────────────────────────────
const GLITTER_COLORS = ["#fbbf24","#4ade80","#f59e0b","#86efac","#fde68a","#a3e635","#34d399","#fcd34d"];
const GLITTER_SHAPES = ["50%", "0%", "2px"];

interface Particle {
  id: number; x: number; y: number; size: number; color: string;
  radius: string; delay: number; duration: number; dx: number; dy: number; rot: number;
}

function GlitterBomb() {
  const particles = useMemo<Particle[]>(() =>
    Array.from({ length: 80 }, (_, id) => ({
      id,
      x: 10 + Math.random() * 80,
      y: 20 + Math.random() * 60,
      size: 4 + Math.random() * 7,
      color: GLITTER_COLORS[Math.floor(Math.random() * GLITTER_COLORS.length)],
      radius: GLITTER_SHAPES[Math.floor(Math.random() * GLITTER_SHAPES.length)],
      delay: Math.random() * 0.4,
      duration: 0.9 + Math.random() * 0.8,
      dx: (Math.random() - 0.5) * 260,
      dy: -(80 + Math.random() * 180),
      rot: Math.random() * 720,
    })), []);

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {particles.map((p) => (
        <div
          key={p.id}
          style={{
            position: "absolute",
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            borderRadius: p.radius,
            animation: `mcq-glitter-fly ${p.duration}s ease-out ${p.delay}s both`,
            "--dx": `${p.dx}px`,
            "--dy": `${p.dy}px`,
            "--rot": `${p.rot}deg`,
          } as React.CSSProperties}
        />
      ))}
      <style>{`
        @keyframes mcq-glitter-fly {
          0%   { transform: translate(0,0) rotate(0deg); opacity: 1; }
          100% { transform: translate(var(--dx), var(--dy)) rotate(var(--rot)); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

// ── Per-question progress dots (upper-right corner of the media panel) ─────────
function ProgressDots({ items, results }: { items: McqItem[]; results: Record<string, boolean> }) {
  return (
    <div className="absolute top-3 right-3 z-20 flex max-w-[55%] flex-wrap justify-end gap-1.5">
      {items.map((it) => {
        const status = results[it.key];
        const cls =
          status === true  ? "bg-emerald-400" :
          status === false ? "bg-red-400"     :
                              "bg-white/25";
        return (
          <span
            key={it.key}
            className={`h-2.5 w-2.5 rounded-full ring-1 ring-black/30 ${cls}`}
          />
        );
      })}
    </div>
  );
}

export interface McqRenderArgs<T extends McqItem> {
  currentItem: T | null;
  roundQueue: T[];
  results: Record<string, boolean>;
  answeredKeys: Set<string>;
  phase: McqPhase;
  revealState: McqRevealState;
  roundId: number;
}

export interface McqQuizEngineProps<T extends McqItem> {
  items: T[];
  /** How long to hold the options back after a question starts, so a baked-in narration
   *  clip can finish before the countdown (and the options themselves) appear — same
   *  pacing as the YouTube cut, where the timer only starts once the question's been
   *  fully asked. A flat number is seconds (legacy, DB-configured, game-wide); pass a
   *  per-item function returning milliseconds when narration length varies by item
   *  (e.g. matched to each rendered video clip's actual duration). */
  liveRevealDelay: number | ((item: T) => number);
  /** Countdown length once options appear. Default 10000ms. */
  questionTimeMs?: number;
  challengeId: string;
  /** Prompt shown above the answer options. Pass a function to vary it per item (e.g. a per-item question). */
  promptText: string | ((item: T) => string);
  perfectScoreText: string;
  scoreText: (correct: number, total: number) => string;
  tryAgainLabel: (wrongCount: number) => string;
  playAgainLabel: string;
  /** Media panel border reacts to reveal state (emerald/red) — connections_quiz style. Default true. */
  mediaBorderReveal?: boolean;
  /** Randomize question order each round/retry/restart. Default true. Set false for content
   *  that only makes sense in a fixed sequence (e.g. a chronological run of historical events). */
  shuffleItems?: boolean;
  /** Visual preset — colors for the media panel, timer track and option buttons. Default: original look. */
  theme?: QuizTheme;
  renderMedia: (args: McqRenderArgs<T>) => React.ReactNode;
  /** Called synchronously the moment an answer/timeout is revealed. */
  onReveal?: (key: string, correct: boolean) => void;
  /** Called right before advancing to the next question, and on restart. */
  onAdvance?: () => void;
  /** How long to stay on the reveal screen before advancing, per item. `correct` is false for
   *  both a wrong pick and a timeout — only a correct answer plays a reveal clip worth waiting
   *  on, so implementations should return a short hold for the wrong/timeout case. Default 1400ms. */
  revealHoldMs?: (item: T, correct: boolean) => number;
}

export default function McqQuizEngine<T extends McqItem>({
  items,
  liveRevealDelay,
  questionTimeMs,
  challengeId,
  promptText,
  perfectScoreText,
  scoreText,
  tryAgainLabel,
  playAgainLabel,
  mediaBorderReveal = true,
  theme = getQuizTheme(),
  shuffleItems = true,
  renderMedia,
  onReveal,
  onAdvance,
  revealHoldMs,
}: McqQuizEngineProps<T>) {
  const order = useCallback((arr: T[]) => (shuffleItems ? shuffle(arr) : arr), [shuffleItems]);
  const initialQueue = useMemo(() => order(items), [items, order]);

  const [roundQueue, setRoundQueue] = useState<T[]>(initialQueue);
  const [qIndex,      setQIndex]      = useState(0);
  const [answered,    setAnswered]    = useState<Set<string>>(() => new Set());
  const [results,     setResults]     = useState<Record<string, boolean>>({});
  const [phase,       setPhase]       = useState<McqPhase>("question");
  const [optionStates, setOptionStates] = useState<McqOptionState[]>(["idle","idle","idle"]);
  const [glitterActive, setGlitterActive] = useState(false);
  const [started,     setStarted]     = useState(false);
  const [roundId,     setRoundId]     = useState(0);
  const [optionsReady, setOptionsReady] = useState(false);
  const [revealState, setRevealState] = useState<McqRevealState>("idle");

  const phaseRef = useRef(phase);
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  const resultsRef = useRef(results);
  useEffect(() => { resultsRef.current = results; }, [results]);

  // ── Load a theme's button font on demand — most themes don't set one ─────────
  useEffect(() => {
    if (!theme.googleFontHref) return;
    const id = `quiz-theme-font-${theme.key}`;
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = theme.googleFontHref;
    document.head.appendChild(link);
  }, [theme.googleFontHref, theme.key]);

  const correctSoundRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    correctSoundRef.current = new Audio("/sounds/correct.mp3");
  }, []);
  function playCorrectSound() {
    const audio = correctSoundRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    audio.play().catch(() => {});
  }

  const { markComplete } = useCompletedChallenges();

  const currentItem = roundQueue[qIndex] ?? null;

  // ── 3 options for current question ────────────────────────────────────────────
  const options = useMemo(() => {
    if (!currentItem) return [];
    // Dedupe by label (and exclude anything textually identical to the correct
    // answer) — two items can legitimately share a real-world fact (e.g. two
    // structures from the same World's Fair), but the option buttons can't show
    // the same text twice, and a "wrong" option identical to the correct one
    // would be unanswerable.
    const pool = Array.from(new Set(
      items
        .filter((it) => it.key !== currentItem.key && it.label !== currentItem.label)
        .map((it) => it.label)
    ));
    const wrong = shuffle(pool).slice(0, 2);
    return shuffle([currentItem.label, ...wrong]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qIndex, roundQueue, items]);

  // ── Hold options/countdown back until the configured reveal delay elapses ─────
  useEffect(() => {
    if (phase !== "question") return;
    const delayMs = typeof liveRevealDelay === "function"
      ? Math.max(0, currentItem ? liveRevealDelay(currentItem) : 0)
      : Math.max(0, liveRevealDelay ?? 0) * 1000;
    if (delayMs <= 0) {
      setOptionsReady(true);
      return;
    }
    setOptionsReady(false);
    const id = setTimeout(() => setOptionsReady(true), delayMs);
    return () => clearTimeout(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundId]);

  // ── Per-question countdown — doesn't start until options are revealed ────────
  useEffect(() => {
    if (phase !== "question" || !optionsReady) return;
    const id = setTimeout(() => handleTimeout(), questionTimeMs ?? QUESTION_TIME_MS);
    return () => clearTimeout(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundId, optionsReady]);

  // ── Answer handler ────────────────────────────────────────────────────────────
  function handleAnswer(label: string, idx: number) {
    if (phase !== "question" || !currentItem) return;

    if (!started) {
      setStarted(true);
      trackChallengeStart(challengeId);
    }

    const isCorrect = label === currentItem.label;

    const next = ["idle","idle","idle"] as McqOptionState[];
    if (isCorrect) {
      next[idx] = "correct";
    } else {
      const correctIdx = options.indexOf(currentItem.label);
      next[idx] = "wrong";
      if (correctIdx !== -1) next[correctIdx] = "correct";
    }
    setOptionStates(next);
    setPhase("revealed");
    setRevealState(isCorrect ? "correct" : "wrong");
    setResults((prev) => ({ ...prev, [currentItem.key]: isCorrect }));
    onReveal?.(currentItem.key, isCorrect);

    if (isCorrect) playCorrectSound();

    setTimeout(() => handleNext(), revealHoldMs ? revealHoldMs(currentItem, isCorrect) : 1400);
  }

  // ── Countdown timeout — ran out of time on the current question ───────────────
  function handleTimeout() {
    if (phaseRef.current !== "question" || !currentItem) return;

    const correctIdx = options.indexOf(currentItem.label);
    const next = ["idle","idle","idle"] as McqOptionState[];
    if (correctIdx !== -1) next[correctIdx] = "correct";
    setOptionStates(next);
    setPhase("revealed");
    setRevealState("wrong");
    setResults((prev) => ({ ...prev, [currentItem.key]: false }));
    onReveal?.(currentItem.key, false);

    setTimeout(() => handleNext(), revealHoldMs ? revealHoldMs(currentItem, false) : 1400);
  }

  // ── Advance to next question ──────────────────────────────────────────────────
  function handleNext() {
    if (!currentItem) return;
    onAdvance?.();

    const newAnswered = new Set(answered);
    newAnswered.add(currentItem.key);
    setAnswered(newAnswered);

    setOptionStates(["idle","idle","idle"]);
    setRevealState("idle");

    const nextIndex = qIndex + 1;
    if (nextIndex >= roundQueue.length) {
      finishRound();
    } else {
      setQIndex(nextIndex);
      setPhase("question");
      setRoundId((r) => r + 1);
    }
  }

  // ── Round finished — celebrate if every item has ever been answered
  //    correctly, otherwise just show the summary (retry button handles the rest) ─
  function finishRound() {
    setPhase("done");
    const allCorrect = items.every((it) => resultsRef.current[it.key] === true);
    if (allCorrect) {
      setGlitterActive(true);
      setTimeout(() => setGlitterActive(false), 2200);
      markComplete(challengeId, items.length, items.length);
      trackChallengeComplete(challengeId, items.length, items.length);
      submitScore(items.length, items.length);
    }
  }

  async function submitScore(score: number, max: number) {
    try {
      await fetch("/api/challenges/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId, score, maxScore: max }),
      });
    } catch { /* ignore */ }
  }

  // ── Retry only the items that are still wrong ─────────────────────────────────
  function handleRetry() {
    const wrongOnes = roundQueue.filter((it) => resultsRef.current[it.key] !== true);
    const newQueue = order(wrongOnes.length > 0 ? wrongOnes : roundQueue);

    const cleared = { ...resultsRef.current };
    const newAnswered = new Set(answered);
    newQueue.forEach((it) => {
      delete cleared[it.key];
      newAnswered.delete(it.key);
    });
    resultsRef.current = cleared;
    setResults(cleared);
    setAnswered(newAnswered);

    setRoundQueue(newQueue);
    setQIndex(0);
    setPhase("question");
    setOptionStates(["idle","idle","idle"]);
    setRevealState("idle");
    setRoundId((r) => r + 1);
  }

  function restart() {
    onAdvance?.();

    const newQueue = order(items);
    resultsRef.current = {};
    setResults({});
    setAnswered(new Set());
    setRoundQueue(newQueue);
    setQIndex(0);
    setPhase("question");
    setOptionStates(["idle","idle","idle"]);
    setRevealState("idle");
    setGlitterActive(false);
    setStarted(false);
    setRoundId((r) => r + 1);
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  const correctCount    = items.filter((it) => results[it.key] === true).length;
  const wrongCount      = items.length - correctCount;
  const isFullyComplete = phase === "done" && wrongCount === 0;

  return (
    <div className="select-none">
      {glitterActive && <GlitterBomb />}

      <div className="flex flex-col gap-4">
        {/* Media, with per-question countdown bar on the left */}
        <div className="flex gap-2">
          <div className={`w-2 shrink-0 rounded-full ${theme.trackBg} overflow-hidden flex flex-col justify-end`}>
            <div
              key={roundId}
              className={phase === "question" && optionsReady ? "w-full animate-timer-deplete" : "w-full"}
              style={{
                height: phase === "question" && optionsReady ? undefined : "100%",
                animationDuration: `${QUESTION_TIME_MS}ms`,
                animationPlayState: phase === "question" && optionsReady ? "running" : "paused",
              }}
            />
          </div>
          <div
            className={[
              "relative flex-1 rounded-2xl overflow-hidden",
              theme.panelBg,
              mediaBorderReveal
                ? [
                    "border-2 transition-colors duration-300",
                    revealState === "correct" ? theme.borderCorrect :
                    revealState === "wrong"   ? theme.borderWrong   :
                                                 theme.borderIdle,
                  ].join(" ")
                : `border ${theme.borderIdle}`,
            ].join(" ")}
          >
            {currentItem && <ProgressDots items={roundQueue} results={results} />}
            {renderMedia({ currentItem, roundQueue, results, answeredKeys: answered, phase, revealState, roundId })}
          </div>
        </div>

        {/* Answer panel — bottom, buttons side by side */}
        {currentItem && ((phase === "question" && optionsReady) || phase === "revealed") && (
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
              {typeof promptText === "function" ? promptText(currentItem) : promptText}
            </p>
            <div className="flex gap-2">
              {options.map((label, idx) => {
                const state = optionStates[idx];
                let cls = theme.optionIdle;
                if (state === "correct") cls = theme.optionCorrect;
                if (state === "wrong")   cls = theme.optionWrong;
                return (
                  <button
                    key={label}
                    onClick={() => handleAnswer(label, idx)}
                    disabled={phase !== "question"}
                    className={`flex-1 px-4 py-3 text-sm font-medium ${theme.buttonRadius ?? "rounded-xl"} ${theme.buttonTextTransform ?? ""} transition-colors text-center shadow-sm ${cls} disabled:cursor-default`}
                    style={theme.buttonFontFamily ? { fontFamily: theme.buttonFontFamily } : undefined}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Round summary — shown once every item in the round has been answered */}
        {phase === "done" && (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-slate-700 bg-slate-800/40 p-6 text-center">
            <p className="text-lg font-semibold text-white">
              {isFullyComplete ? perfectScoreText : scoreText(correctCount, items.length)}
            </p>
            {!isFullyComplete && (
              <button
                onClick={handleRetry}
                className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                {tryAgainLabel(wrongCount)}
              </button>
            )}
            <button
              onClick={restart}
              className="text-sm font-medium text-slate-300 hover:text-white transition-colors"
            >
              {playAgainLabel}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
