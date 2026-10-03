'use strict';
/**
 * video-themes.js
 * Color presets for gen-connections-video.js / gen-map-video.js,
 * keyed by the same challenge_games.theme_key values as src/lib/quizThemes.ts
 * on the web side. Kept as a separate plain-CommonJS table (rather than
 * imported from the TS file) because these scripts aren't part of the Next
 * build — panelAccent/correct hex values must be kept in sync with
 * quizThemes.ts by hand when either changes.
 *
 * Only 3 roles are needed per theme (unlike the web's 8+ Tailwind classes):
 * every video color is either the panel/card background tint, the secondary
 * "panelAccent" used for card borders + eyebrow tags, or the single "correct"
 * accent reused for the highlighted option, the answer badge/name, and the
 * fact/caption artist line. There is no "wrong" role — the video only ever
 * reveals the correct answer, it never shows a wrong pick. The countdown
 * bar's green→amber→red depletion is intentionally NOT themed here — it's
 * an identical hardcoded animation on the web side too (see
 * src/app/globals.css's timer-deplete keyframes).
 *
 * A theme may also carry a full-identity override for the 3 answer buttons
 * (font/shape/casing, not just color) via buttonFont/buttonRadius/
 * buttonTextTransform/googleFontHref — mirrors QuizTheme's same-named fields
 * on the web side. Most themes omit these and keep the original Georgia/
 * 10px-radius/normal-case look.
 */

const VIDEO_THEMES = {
  default:          { panelBgRgb: '15,30,43',  panelAccent: '#a7c957', correct: '#4ade80' },
  midnight_gold:    { panelBgRgb: '18,16,10',  panelAccent: '#b45309', correct: '#fbbf24' },
  gallery_warm:     { panelBgRgb: '28,23,18',  panelAccent: '#b08d57', correct: '#2dd4bf' },
  concrete_gallery: { panelBgRgb: '23,24,26',  panelAccent: '#52606d', correct: '#38bdf8' },
  pop_punch: {
    panelBgRgb: '13,13,16', panelAccent: '#22d3ee', correct: '#a3e635',
    buttonFont: "'Archivo Black', sans-serif",
    buttonRadius: '999px',
    buttonTextTransform: 'text-transform: uppercase; letter-spacing: 0.05em;',
    googleFontHref: 'https://fonts.googleapis.com/css2?family=Archivo+Black&display=swap',
  },
};

function getVideoTheme(key) {
  return VIDEO_THEMES[key] || VIDEO_THEMES.default;
}

function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) throw new Error(`Not a hex color: ${hex}`);
  return `${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)}`;
}

/** e.g. rgba('#4ade80', 0.18) -> 'rgba(74,222,128,0.18)' */
function rgba(hex, alpha) {
  return `rgba(${hexToRgb(hex)},${alpha})`;
}

module.exports = { VIDEO_THEMES, getVideoTheme, rgba };
