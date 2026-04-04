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

  // Questions are fixed; answers live in a bank until matched
  const [fixedItems,          setFixedItems]          = useState<ConnectionItem[]>(items);
  const [answerBank,          setAnswerBank]           = useState<string[]>(items.map((i) => i.match));
  // lockedMap: questionIndex → matched answer string
  const [lockedMap,           setLockedMap]            = useState<Record<number, string>>({});
  const [lives,               setLives]                = useState(STARTING_LIVES);
  const [wrongAttempts,       setWrongAttempts]        = useState(0);
  const [gameOver,            setGameOver]             = useState(false);
  const [scoreSubmitted,      setScoreSubmitted]       = useState(false);
  const [revealed,            setRevealed]             = useState(false);
  const [lightbox,            setLightbox]             = useState<{ url: string; alt: string } | null>(null);
  const [wrongFlashQuestion,  setWrongFlashQuestion]   = useState<number | null>(null);
  const [correctFlashQuestion,setCorrectFlashQuestion] = useState<number | null>(null);
  const [dragOverQuestion,    setDragOverQuestion]     = useState<number | null>(null);

  // Derived
  const correctCount = Object.keys(lockedMap).length;
  const allCorrect   = correctCount === items.length;
  const maxScore     = items.length * 10;
  const currentScore = Math.max(0, correctCount * 10 - wrongAttempts * 2);

  // Re-shuffle on mount (client-only) and whenever items change
  useEffect(() => {
    setFixedItems(shuffle([...items]));
    setAnswerBank(shuffle(items.map((i) => i.match)));
    setLockedMap({});
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
  const dragAnswer   = useRef<string | null>(null);
  const dragStart    = useRef<{ x: number; y: number } | null>(null);
  const isDragging   = useRef(false);
  const ghostRef     = useRef<HTMLDivElement | null>(null);
  const questionRefs = useRef<(HTMLDivElement | null)[]>([]);

  function getHoveredQuestion(clientY: number): number | null {
    let closest: number | null = null;
    let minDist = Infinity;
    for (let i = 0; i < questionRefs.current.length; i++) {
      const el = questionRefs.current[i];
      if (!el) continue;
      const rect   = el.getBoundingClientRect();
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
      padding:       "4px 12px",
      fontSize:      "12px",
      fontWeight:    "600",
      color:         "#92400e",
      maxWidth:      "200px",
      overflow:      "hidden",
      textOverflow:  "ellipsis",
      whiteSpace:    "nowrap",
      boxShadow:     "0 4px 16px rgba(0,0,0,0.2)",
      opacity:       "0.93",
    });
    el.textContent = text;
    document.body.appendChild(el);
    ghostRef.current = el as unknown as HTMLDivElement;
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

  // ── Pointer down on an answer chip ───────────────────────────────────────
  // State values captured via closure are safe here: no state changes mid-drag;
  // only dragOverQuestion is updated during pointermove.
  function handleAnswerPointerDown(e: React.PointerEvent, answer: string) {
    if (gameOver || allCorrect) return;
    e.preventDefault();

    const startX = e.clientX;
    const startY = e.clientY;
    dragAnswer.current  = answer;
    dragStart.current   = { x: startX, y: startY };
    isDragging.current  = false;

    function onMove(ev: PointerEvent) {
      if (!dragAnswer.current) return;
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;

      if (!isDragging.current && Math.sqrt(dx * dx + dy * dy) > 6) {
        isDragging.current = true;
        createGhost(dragAnswer.current, ev.clientX, ev.clientY);
      }

      if (isDragging.current) {
        moveGhost(ev.clientX, ev.clientY);
        setDragOverQuestion(getHoveredQuestion(ev.clientY));
      }
    }

    function onUp(ev: PointerEvent) {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup",   onUp);

      if (isDragging.current) {
        removeGhost();
        setDragOverQuestion(null);

        const ans         = dragAnswer.current;
        const questionIdx = getHoveredQuestion(ev.clientY);

        if (ans !== null && questionIdx !== null && !(questionIdx in lockedMap)) {
          const correct = fixedItems[questionIdx]?.match === ans;

          if (correct) {
            setLockedMap((prev) => ({ ...prev, [questionIdx]: ans }));
            setAnswerBank((bank) => bank.filter((a) => a !== ans));
            setCorrectFlashQuestion(questionIdx);
            setTimeout(() => setCorrectFlashQuestion(null), 850);
          } else {
            // Wrong: flash the question row; answer stays in bank
            const newLives = lives - 1;
            setLives(newLives);
            setWrongAttempts((w) => w + 1);
            if (newLives <= 0) setGameOver(true);
            setWrongFlashQuestion(questionIdx);
            setTimeout(() => setWrongFlashQuestion(null), 600);
          }
        }
      }

      dragAnswer.current  = null;
      dragStart.current   = null;
      isDragging.current  = false;
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup",   onUp);
  }

  // ── Reset ─────────────────────────────────────────────────────────────────
  function handleReset() {
    setFixedItems(shuffle([...items]));
    setAnswerBank(shuffle(items.map((i) => i.match)));
    setLockedMap({});
    setLives(STARTING_LIVES);
    setWrongAttempts(0);
    setGameOver(false);
    setScoreSubmitted(false);
    setRevealed(false);
    setWrongFlashQuestion(null);
    setCorrectFlashQuestion(null);
    removeGhost();
    dragAnswer.current  = null;
    isDragging.current  = false;
  }

  const gameActive = !allCorrect && !gameOver;

  return (
    <div className="space-y-4">
      <style>{`
        /* ── Correct: glow ring + shimmer ────────────────────────────── */
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

        /* ── Wrong: shake on question row ────────────────────────────── */
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

      {/* ── Playing area: questions left, answer bank right ───────────── */}
      {!revealed && (
        <div className="flex gap-3 sm:gap-4 items-start">

          {/* Left: question rows — also act as drop targets */}
          <div className="flex-1 space-y-1.5">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{colLeft}</p>
            {fixedItems.map((item, i) => {
              const isLocked       = i in lockedMap;
              const matchedAnswer  = lockedMap[i];
              const isDragTarget   = dragOverQuestion === i && gameActive && !isLocked;
              const isWrong        = wrongFlashQuestion === i;
              const isCorrect      = correctFlashQuestion === i;
              const resolvedImg    = item.imageUrl ? resolveImageUrl(item.imageUrl) : "";

              return (
                <div
                  key={item.id}
                  ref={(el) => { questionRefs.current[i] = el; }}
                  className={[
                    "relative flex items-center gap-1.5 border-2 rounded-lg p-1.5 overflow-hidden transition-colors",
                    isLocked
                      ? "border-emerald-300 bg-emerald-50"
                      : isDragTarget
                      ? "border-amber-400 bg-amber-50"
                      : "border-slate-200 bg-white",
                    isWrong   ? "conn-wrong"   : "",
                    isCorrect ? "conn-correct" : "",
                  ].join(" ")}
                >
                  {resolvedImg && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={resolvedImg}
                      alt={item.name}
                      onClick={() => setLightbox({ url: resolvedImg, alt: item.name })}
                      className="w-7 h-7 sm:w-9 sm:h-9 object-cover rounded flex-shrink-0 cursor-zoom-in hover:opacity-90 hover:ring-2 hover:ring-amber-400 transition-all"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-800 leading-tight truncate">{item.name}</p>
                    {isLocked && matchedAnswer && (
                      <p className="text-xs text-emerald-700 font-medium leading-tight truncate mt-0.5">✓ {matchedAnswer}</p>
                    )}
                  </div>
                  {isDragTarget && (
                    <span className="text-amber-400 text-xs flex-shrink-0">↙</span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Right: answer bank — chips to drag from */}
          <div className="w-32 sm:w-40 flex-shrink-0">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{colRight}</p>
            <div className="flex flex-col gap-1.5">
              {answerBank.map((answer) => (
                <div
                  key={answer}
                  onPointerDown={(e) => handleAnswerPointerDown(e, answer)}
                  className={[
                    "flex items-center gap-1 border-2 rounded-lg px-2 py-1 select-none touch-none transition-colors",
                    gameActive
                      ? "border-slate-200 bg-white cursor-grab active:cursor-grabbing hover:border-amber-300 hover:bg-amber-50"
                      : "border-slate-100 bg-slate-50 cursor-default",
                  ].join(" ")}
                >
                  {gameActive && (
                    <span className="text-slate-300 flex-shrink-0 text-xs leading-none select-none">⠿</span>
                  )}
                  <p className="text-xs font-medium text-slate-700 leading-tight">{answer}</p>
                </div>
              ))}
              {answerBank.length === 0 && gameActive && (
                <p className="text-xs text-slate-400 italic">All placed!</p>
              )}
            </div>
          </div>

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
