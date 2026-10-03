// Visual presets for the generic 3-option quiz engine (McqQuizEngine). Pick one
// per challenge via challenge_games.theme_key; null/unknown falls back to "default",
// which reproduces the original map_quiz / connections_quiz look exactly.
//
// The video generators (gen-connections-video.js / gen-map-video.js)
// mirror these same keys via scripts/lib/video-themes.js — that file is plain
// CommonJS (the video scripts aren't part of the Next build) so it can't import
// this one directly; panelAccent's hex must be kept in sync by hand between the two.

export interface QuizTheme {
  key: string;
  label: string;
  panelBg: string;       // media panel background (Tailwind class)
  borderIdle: string;
  borderCorrect: string;
  borderWrong: string;
  trackBg: string;       // countdown timer track background
  optionIdle: string;
  optionCorrect: string;
  optionWrong: string;
  /** Raw hex — secondary accent for card borders / eyebrow tags. Only the video
   *  generator has multiple stacked cards that need it; on web it's used just
   *  for the carousel media panel's active slide-dot. */
  panelAccent: string;
  /** Full-identity overrides for the 3 answer buttons — font, shape, casing —
   *  beyond just color. Optional: most themes leave these unset and inherit
   *  the original look (Tailwind default font, rounded-xl, normal case). */
  buttonFontFamily?: string;      // CSS font-family value (web inline style + video CSS)
  buttonRadius?: string;          // Tailwind class, e.g. "rounded-full" (web only)
  buttonTextTransform?: string;   // Tailwind classes, e.g. "uppercase tracking-wide" (web only)
  googleFontHref?: string;        // <link> URL for buttonFontFamily, loaded on demand
}

const DEFAULT: QuizTheme = {
  key: "default",
  label: "Default",
  panelBg: "bg-[#060e1f]",
  borderIdle: "border-slate-700",
  borderCorrect: "border-emerald-400",
  borderWrong: "border-red-400",
  trackBg: "bg-slate-800/60",
  optionIdle: "bg-slate-800 hover:bg-slate-700 text-white",
  optionCorrect: "bg-emerald-600 text-white",
  optionWrong: "bg-red-500 text-white",
  panelAccent: "#a7c957",
};

const MIDNIGHT_GOLD: QuizTheme = {
  key: "midnight_gold",
  label: "Midnight & Gold",
  panelBg: "bg-[#12100a]",
  borderIdle: "border-amber-900/60",
  borderCorrect: "border-amber-400",
  borderWrong: "border-red-400",
  trackBg: "bg-amber-950/60",
  optionIdle: "bg-amber-950 hover:bg-amber-900 text-amber-50",
  optionCorrect: "bg-amber-500 text-amber-950",
  optionWrong: "bg-red-500 text-white",
  panelAccent: "#b45309",
};

const GALLERY_WARM: QuizTheme = {
  key: "gallery_warm",
  label: "Gallery Warm",
  panelBg: "bg-[#1c1712]",
  borderIdle: "border-stone-700",
  borderCorrect: "border-teal-400",
  borderWrong: "border-rose-400",
  trackBg: "bg-stone-800/60",
  optionIdle: "bg-stone-800 hover:bg-stone-700 text-stone-50",
  optionCorrect: "bg-teal-600 text-white",
  optionWrong: "bg-rose-500 text-white",
  panelAccent: "#b08d57",
};

const CONCRETE_GALLERY: QuizTheme = {
  key: "concrete_gallery",
  label: "Concrete Gallery",
  panelBg: "bg-[#17181a]",
  borderIdle: "border-zinc-700",
  borderCorrect: "border-sky-400",
  borderWrong: "border-orange-400",
  trackBg: "bg-zinc-800/60",
  optionIdle: "bg-zinc-800 hover:bg-zinc-700 text-zinc-50",
  optionCorrect: "bg-sky-600 text-white",
  optionWrong: "bg-orange-500 text-white",
  panelAccent: "#52606d",
};

const POP_PUNCH: QuizTheme = {
  key: "pop_punch",
  label: "Pop Punch",
  panelBg: "bg-[#0d0d10]",
  borderIdle: "border-fuchsia-900/60",
  borderCorrect: "border-lime-400",
  borderWrong: "border-fuchsia-500",
  trackBg: "bg-fuchsia-950/60",
  optionIdle: "bg-[#1a1a1f] hover:bg-[#26262c] text-white",
  optionCorrect: "bg-lime-400 text-black",
  optionWrong: "bg-fuchsia-500 text-white",
  panelAccent: "#22d3ee",
  buttonFontFamily: "'Archivo Black', sans-serif",
  buttonRadius: "rounded-full",
  buttonTextTransform: "uppercase tracking-wide",
  googleFontHref: "https://fonts.googleapis.com/css2?family=Archivo+Black&display=swap",
};

export const QUIZ_THEMES: Record<string, QuizTheme> = {
  default: DEFAULT,
  midnight_gold: MIDNIGHT_GOLD,
  gallery_warm: GALLERY_WARM,
  concrete_gallery: CONCRETE_GALLERY,
  pop_punch: POP_PUNCH,
};

export function getQuizTheme(key?: string | null): QuizTheme {
  return (key && QUIZ_THEMES[key]) || DEFAULT;
}
