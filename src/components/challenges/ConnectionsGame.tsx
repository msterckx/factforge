"use client";

import { useState, useRef, useEffect, useMemo } from "react";
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

// ── Glitter bomb overlay ──────────────────────────────────────────────────────
const GLITTER_COLORS = ["#fbbf24", "#4ade80", "#f59e0b", "#86efac", "#fde68a", "#a3e635", "#34d399", "#fcd34d"];
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
      rot: (Math.random() - 0.5) * 720,
    }))
  , []);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-xl z-30">
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
            animationName: "glitterFly",
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
            animationTimingFunction: "ease-out",
            animationFillMode: "forwards",
            ["--dx" as string]: `${p.dx}px`,
            ["--dy" as string]: `${p.dy}px`,
            ["--rot" as string]: `${p.rot}deg`,
          }}
        />
      ))}
    </div>
  );
}

// ── Game Over overlay ─────────────────────────────────────────────────────────
function GameOverOverlay() {
  return (
    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center rounded-xl overflow-hidden">
      <div className="absolute inset-0 bg-red-950/75" style={{ animation: "gameOverFade 0.35s ease-out forwards" }} />
      <div className="relative z-10 text-center px-4">
        <p className="text-5xl mb-3" style={{ animation: "gameOverBounce 0.5s ease-out forwards" }}>💔</p>
        <p className="text-white font-bold text-xl tracking-wide" style={{ animation: "gameOverSlideUp 0.35s ease-out 0.1s both" }}>Game Over</p>
        <p className="text-red-300 text-sm mt-1" style={{ animation: "gameOverSlideUp 0.35s ease-out 0.2s both" }}>No lives remaining</p>
      </div>
    </div>
  );
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

  const colRight = rightLabel || "Answers";

  const [fixedItems,           setFixedItems]           = useState<ConnectionItem[]>(items);
  const [answerBank,           setAnswerBank]            = useState<string[]>(items.map((i) => i.match));
  const [lockedMap,            setLockedMap]             = useState<Record<number, string>>({});
  const [lives,                setLives]                 = useState(STARTING_LIVES);
  const [wrongAttempts,        setWrongAttempts]         = useState(0);
  const [gameOver,             setGameOver]              = useState(false);
  const [scoreSubmitted,       setScoreSubmitted]        = useState(false);
  const [revealed,             setRevealed]              = useState(false);
  const [lightbox,             setLightbox]              = useState<{ url: string; alt: string } | null>(null);
  const [wrongFlashQuestion,   setWrongFlashQuestion]    = useState<number | null>(null);
  const [correctFlashQuestion, setCorrectFlashQuestion]  = useState<number | null>(null);
  const [dragOverQuestion,     setDragOverQuestion]      = useState<number | null>(null);
  const [glitterActive,        setGlitterActive]         = useState(false);

  const correctCount = Object.keys(lockedMap).length;
  const allCorrect   = correctCount === items.length;
  const maxScore     = items.length * 10;
  const currentScore = Math.max(0, correctCount * 10 - wrongAttempts * 2);

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

  // Uses both X and Y — required now that tiles are laid out in a 2-D grid
  function getHoveredQuestion(clientX: number, clientY: number): number | null {
    // Direct hit test first
    for (let i = 0; i < questionRefs.current.length; i++) {
      const el = questionRefs.current[i];
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom) return i;
    }
    // Closest tile center fallback (for small misses near tile edges)
    let closest: number | null = null;
    let minDist = Infinity;
    for (let i = 0; i < questionRefs.current.length; i++) {
      const el = questionRefs.current[i];
      if (!el) continue;
      const r  = el.getBoundingClientRect();
      const cx = (r.left + r.right)  / 2;
      const cy = (r.top  + r.bottom) / 2;
      const d  = Math.sqrt((clientX - cx) ** 2 + (clientY - cy) ** 2);
      if (d < minDist) { minDist = d; closest = i; }
    }
    return minDist < 80 ? closest : null;
  }

  // ── Ghost helpers ─────────────────────────────────────────────────────────
  function createGhost(text: string, x: number, y: number) {
    const el = document.createElement("div");
    Object.assign(el.style, {
      position: "fixed", left: `${x - 64}px`, top: `${y - 20}px`,
      zIndex: "9999", pointerEvents: "none",
      background: "#fffbeb", border: "2px solid #f59e0b", borderRadius: "10px",
      padding: "4px 12px", fontSize: "12px", fontWeight: "600", color: "#92400e",
      maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      boxShadow: "0 4px 16px rgba(0,0,0,0.2)", opacity: "0.93",
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
        setDragOverQuestion(getHoveredQuestion(ev.clientX, ev.clientY));
      }
    }

    function onUp(ev: PointerEvent) {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup",   onUp);

      if (isDragging.current) {
        removeGhost();
        setDragOverQuestion(null);

        const ans         = dragAnswer.current;
        const questionIdx = getHoveredQuestion(ev.clientX, ev.clientY);

        if (ans !== null && questionIdx !== null && !(questionIdx in lockedMap)) {
          const correct = fixedItems[questionIdx]?.match === ans;

          if (correct) {
            const newLockedMap = { ...lockedMap, [questionIdx]: ans };
            setLockedMap(newLockedMap);
            setAnswerBank((bank) => bank.filter((a) => a !== ans));
            setCorrectFlashQuestion(questionIdx);
            setTimeout(() => setCorrectFlashQuestion(null), 850);
            if (Object.keys(newLockedMap).length === fixedItems.length) {
              setGlitterActive(true);
              setTimeout(() => setGlitterActive(false), 2200);
            }
          } else {
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
    setGlitterActive(false);
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
          0%   { box-shadow: 0 0 0 3px #4ade80, 0 0 10px 2px #4ade8088; }
          50%  { box-shadow: 0 0 0 3px #86efac, 0 0 20px 6px #4ade80bb; }
          100% { box-shadow: 0 0 0 3px #4ade80, 0 0 8px  2px #4ade8033; }
        }
        @keyframes caesarShine {
          0%   { left: -80%; }
          100% { left: 130%; }
        }
        .conn-correct {
          animation: caesarGlow 1.4s ease-in-out forwards;
          outline: 3px solid #4ade80;
        }
        .conn-correct::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.45) 50%, transparent 70%);
          animation: caesarShine 0.8s ease-in-out forwards;
          pointer-events: none;
          border-radius: inherit;
        }

        /* ── Wrong: shake ─────────────────────────────────────────────── */
        @keyframes wrongFlash {
          0%   { outline: 3px solid #f87171; transform: scale(1) rotate(0deg); }
          25%  { transform: scale(0.97) rotate(-2deg); }
          75%  { transform: scale(0.97) rotate(2deg); }
          100% { outline: none; transform: scale(1) rotate(0deg); }
        }
        .conn-wrong { animation: wrongFlash 0.55s ease-out forwards; }

        /* ── Glitter + game-over overlay ──────────────────────────────── */
        @keyframes glitterFly {
          0%   { opacity: 1; transform: translate(0, 0) rotate(0deg); }
          100% { opacity: 0; transform: translate(var(--dx), var(--dy)) rotate(var(--rot)); }
        }
        @keyframes gameOverFade {
          from { opacity: 0; } to { opacity: 1; }
        }
        @keyframes gameOverBounce {
          0%   { transform: scale(0) rotate(-20deg); opacity: 0; }
          60%  { transform: scale(1.25) rotate(8deg); opacity: 1; }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        @keyframes gameOverSlideUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* ── Drag-target pulse on a tile ──────────────────────────────── */
        @keyframes tileTargetPulse {
          0%, 100% { box-shadow: 0 0 0 3px #f59e0b; }
          50%       { box-shadow: 0 0 0 5px #fbbf24; }
        }
        .conn-drag-target { animation: tileTargetPulse 0.7s ease-in-out infinite; }
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

      {/* ── Playing area ─────────────────────────────────────────────── */}
      {!revealed && (
        <div className="relative">
          {glitterActive && <GlitterBomb />}
          {gameOver && <GameOverOverlay />}

          <div className="flex gap-3 sm:gap-4 items-start">

            {/* Question tile grid — multi-column, square tiles */}
            <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-2.5">
              {fixedItems.map((item, i) => {
                const isLocked      = i in lockedMap;
                const matchedAnswer = lockedMap[i];
                const isDragTarget  = dragOverQuestion === i && gameActive && !isLocked;
                const isWrong       = wrongFlashQuestion === i;
                const isCorrect     = correctFlashQuestion === i;
                const resolvedImg   = item.imageUrl ? resolveImageUrl(item.imageUrl) : "";

                return (
                  <div
                    key={item.id}
                    ref={(el) => { questionRefs.current[i] = el; }}
                    style={{ aspectRatio: "1" }}
                    className={[
                      "relative rounded-xl border-2 overflow-hidden transition-all duration-150",
                      isLocked
                        ? "border-emerald-400"
                        : isDragTarget
                        ? "border-amber-400 conn-drag-target"
                        : "border-slate-200",
                      isWrong   ? "conn-wrong"   : "",
                      isCorrect ? "conn-correct" : "",
                    ].join(" ")}
                  >
                    {/* Image fills the tile */}
                    {resolvedImg ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={resolvedImg}
                        alt={item.name}
                        onClick={() => setLightbox({ url: resolvedImg, alt: item.name })}
                        className="absolute inset-0 w-full h-full object-cover cursor-zoom-in"
                      />
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                        <span className="text-slate-400 text-3xl font-bold select-none">
                          {item.name.charAt(0)}
                        </span>
                      </div>
                    )}

                    {/* Drag-target dim overlay */}
                    {isDragTarget && (
                      <div className="absolute inset-0 bg-amber-400/20 pointer-events-none" />
                    )}

                    {/* Locked overlay tint */}
                    {isLocked && (
                      <div className="absolute inset-0 bg-emerald-900/20 pointer-events-none" />
                    )}

                    {/* Bottom label: name + matched answer */}
                    <div
                      className={[
                        "absolute bottom-0 left-0 right-0 px-2 py-1.5 backdrop-blur-[1px]",
                        isLocked
                          ? "bg-emerald-950/80"
                          : isDragTarget
                          ? "bg-amber-950/75"
                          : "bg-black/65",
                      ].join(" ")}
                    >
                      <p className="text-white text-xs font-semibold leading-tight truncate">{item.name}</p>
                      {isLocked && matchedAnswer && (
                        <p className="text-emerald-300 text-xs leading-tight truncate">✓ {matchedAnswer}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Answer bank — vertical chip list */}
            <div className="w-28 sm:w-36 flex-shrink-0">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">{colRight}</p>
              <div className="flex flex-col gap-1.5">
                {answerBank.map((answer) => (
                  <div
                    key={answer}
                    onPointerDown={(e) => handleAnswerPointerDown(e, answer)}
                    className={[
                      "flex items-center gap-1 border-2 rounded-lg px-2 py-1.5 select-none touch-none transition-colors",
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
                {answerBank.length === 0 && !allCorrect && (
                  <p className="text-xs text-slate-400 italic">All placed!</p>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ── Revealed view ─────────────────────────────────────────────── */}
      {revealed && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {items.map((item) => {
            const resolvedImg = item.imageUrl ? resolveImageUrl(item.imageUrl) : "";
            return (
              <div key={item.id} className="flex items-start gap-3 border border-emerald-200 bg-emerald-50 rounded-xl p-3">
                {resolvedImg && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={resolvedImg} alt={item.name} onClick={() => setLightbox({ url: resolvedImg, alt: item.name })} className="w-14 h-14 object-cover rounded-lg flex-shrink-0 cursor-zoom-in hover:opacity-90 transition-all" />
                )}
                <div className="min-w-0">
                  <p className="font-semibold text-slate-800 text-sm truncate">{item.name}</p>
                  <p className="text-sm text-emerald-700 font-medium truncate">→ {item.match}</p>
                  {item.description && <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{item.description}</p>}
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
            <span className={`text-base font-bold ${allCorrect ? "text-emerald-600" : "text-slate-700"}`}>
              Score: {currentScore}/{maxScore}
            </span>
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
