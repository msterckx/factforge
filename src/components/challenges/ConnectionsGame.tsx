"use client";

import { useState, useRef, useEffect } from "react";
import type { Dictionary } from "@/i18n/en";
import type { ConnectionItem } from "@/types/connections";
import { useCompletedChallenges } from "@/hooks/useCompletedChallenges";
import { resolveImageUrl } from "@/lib/imageUrl";

interface Props {
  items: ConnectionItem[];
  dict: Dictionary["challenges"];
  challengeId: string;
  leftLabel?: string;
  rightLabel?: string;
}

type Phase = "playing" | "checked" | "revealed";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function ConnectionsGame({ items, dict, challengeId, leftLabel, rightLabel }: Props) {
  const { markComplete } = useCompletedChallenges();

  const colLeft  = leftLabel  || "Items";
  const colRight = rightLabel || "Answers";

  // Initialise unshuffled so SSR and hydration match, then shuffle on client mount
  const [fixedItems, setFixedItems] = useState<ConnectionItem[]>(items);
  const [answers,    setAnswers]    = useState<string[]>(items.map((i) => i.match));
  const [phase,      setPhase]      = useState<Phase>("playing");
  const [correctCount, setCorrectCount] = useState(0);
  const [lightbox, setLightbox]    = useState<{ url: string; alt: string } | null>(null);

  // Re-shuffle on mount (client-only) and whenever items change
  useEffect(() => {
    setFixedItems(shuffle([...items]));
    setAnswers(shuffle(items.map((i) => i.match)));
    setPhase("playing");
    setCorrectCount(0);
  }, [items]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!lightbox) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setLightbox(null); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [lightbox]);

  // ── Drag state ────────────────────────────────────────────────────────────
  const dragIndex   = useRef<number | null>(null);
  const dragStart   = useRef<{ x: number; y: number } | null>(null);
  const isDragging  = useRef(false);
  const ghostRef    = useRef<HTMLDivElement | null>(null);
  const answerRefs  = useRef<(HTMLDivElement | null)[]>([]);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Use bounding rects so we never rely on elementFromPoint or pointer-capture limits
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

  // ── Pointer down — attach window listeners so capture / element-hit don't matter
  function handlePointerDown(e: React.PointerEvent, index: number) {
    if (phase !== "playing") return;
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
        // answers state is captured at drag start; read via ref closure
        const idx = dragIndex.current;
        // We need the answer at drag time — read from latest state via the ref trick below
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
        if (target !== null && src !== null && target !== src) {
          setAnswers((prev) => {
            const next = [...prev];
            [next[src], next[target]] = [next[target], next[src]];
            return next;
          });
        }
      }

      dragIndex.current  = null;
      dragStart.current  = null;
      isDragging.current = false;
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup",   onUp);
  }

  // ── Game actions ──────────────────────────────────────────────────────────
  function handleCheck() {
    const correct = fixedItems.filter((item, i) => answers[i] === item.match).length;
    setCorrectCount(correct);
    setPhase("checked");
    if (correct === items.length) markComplete(challengeId, correct, items.length);
  }

  function handleReset() {
    setFixedItems(shuffle([...items]));
    setAnswers(shuffle(items.map((i) => i.match)));
    setPhase("playing");
    setCorrectCount(0);
  }

  return (
    <div className="space-y-4">
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

      {/* ── Column headers ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-2 sm:gap-4">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{colLeft}</p>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{colRight}</p>
      </div>

      {/* ── Playing / Checked rows ────────────────────────────────────── */}
      {phase !== "revealed" && (
        <div className="space-y-2">
          {fixedItems.map((item, i) => {
            const answer       = answers[i];
            const isCorrect    = phase === "checked" && answer === item.match;
            const isWrong      = phase === "checked" && answer !== item.match;
            const isDragTarget = dragOverIndex === i && phase === "playing";
            const resolvedImg  = item.imageUrl ? resolveImageUrl(item.imageUrl) : "";

            return (
              <div key={item.id} className="grid grid-cols-2 gap-2 sm:gap-4">
                {/* Left: fixed item */}
                <div className="flex items-center gap-1.5 sm:gap-2.5 border-2 border-slate-200 bg-white rounded-xl p-1.5 sm:p-2.5">
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

                {/* Right: draggable answer */}
                <div
                  ref={(el) => { answerRefs.current[i] = el; }}
                  onPointerDown={(e) => handlePointerDown(e, i)}
                  className={`flex items-center gap-2 border-2 rounded-xl px-2 sm:px-3 py-2 sm:py-2.5 transition-colors select-none touch-none
                    ${phase === "playing" ? "cursor-grab active:cursor-grabbing" : "cursor-default"}
                    ${isDragTarget    ? "border-amber-400 bg-amber-50"
                    : isCorrect       ? "border-emerald-400 bg-emerald-50"
                    : isWrong         ? "border-red-300 bg-red-50"
                    :                   "border-slate-200 bg-white hover:border-amber-200"}`}
                >
                  {phase === "playing" && (
                    <span className="text-slate-300 flex-shrink-0 leading-none select-none">⠿</span>
                  )}
                  {isCorrect && <span className="text-emerald-500 flex-shrink-0">✓</span>}
                  {isWrong   && <span className="text-red-400 flex-shrink-0">✗</span>}

                  <div className="flex-1 min-w-0">
                    <p
                      data-answer-text
                      className={`text-xs sm:text-sm font-medium leading-tight truncate ${isCorrect ? "text-emerald-700" : isWrong ? "text-red-600" : "text-slate-700"}`}
                    >
                      {answer}
                    </p>
                    {isWrong && (
                      <p className="text-[10px] sm:text-xs text-emerald-700 font-medium mt-0.5 truncate">→ {item.match}</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Revealed view ─────────────────────────────────────────────── */}
      {phase === "revealed" && (
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
        {phase === "playing" && (
          <button onClick={handleCheck} className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-semibold transition-colors">
            {dict.connectionsCheckButton}
          </button>
        )}

        {phase === "checked" && (
          <>
            <div className="flex items-center gap-2">
              <span className={`text-lg font-bold ${correctCount === items.length ? "text-emerald-600" : "text-slate-700"}`}>
                {dict.connectionsScore.replace("{correct}", String(correctCount)).replace("{total}", String(items.length))}
              </span>
              {correctCount === items.length && <span className="text-xl">🎉</span>}
            </div>
            <button onClick={() => setPhase("revealed")} className="px-4 py-2 border border-slate-300 text-slate-600 hover:bg-slate-50 rounded-xl text-sm font-medium transition-colors">{dict.connectionsReveal}</button>
            <button onClick={handleReset} className="px-4 py-2 border border-slate-300 text-slate-600 hover:bg-slate-50 rounded-xl text-sm font-medium transition-colors">{dict.connectionsPlayAgain}</button>
          </>
        )}

        {phase === "revealed" && (
          <button onClick={handleReset} className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-medium transition-colors">{dict.connectionsPlayAgain}</button>
        )}
      </div>
    </div>
  );
}
