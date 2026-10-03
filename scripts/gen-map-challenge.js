#!/usr/bin/env node
'use strict';
/**
 * gen-map-challenge.js
 * Generates a self-contained interactive HTML challenge package for the website.
 *
 * DB mode (recommended — reads directly from SQLite, no export step):
 *   node scripts/gen-map-challenge.js \
 *     --db=restore/remote_db/gameoftrivia.db \
 *     --game=south-america-parks \
 *     [--images-dir=path/to/images]
 *
 * JSON mode (legacy — requires prior DB export):
 *   node scripts/gen-map-challenge.js \
 *     --regions=path/to/regions.json \
 *     --geojson=public/maps/south_america_parks.geojson \
 *     --output=public/challenges/sa-parks/index.html \
 *     --title="South American National Parks" \
 *     --bg=south_america
 *
 * Shared options:
 *   --score-url     Score API endpoint (default: /api/challenges/score, "" to disable)
 *   --images-dir    Local directory of hi-res images (overrides DB image URLs)
 */

const fs   = require('fs');
const path = require('path');

// ── CLI args ──────────────────────────────────────────────────────────────────
const args = {};
for (const arg of process.argv.slice(2)) {
  if (arg.startsWith('--')) {
    const eq = arg.indexOf('=');
    if (eq !== -1) args[arg.slice(2, eq)] = arg.slice(eq + 1);
    else            args[arg.slice(2)]    = true;
  }
}

const imagesDirArg = args['images-dir'] || null;
const scoreUrl     = args['score-url'] !== undefined ? args['score-url'] : '/api/challenges/score';

// Mutable — DB mode overrides these
let outputPath     = args.output || 'public/challenges/other/map-challenge/index.html';
let challengeTitle = args.title  || 'National Parks Quiz';
let bgPreset       = args.bg     || 'south_america';
let topic          = args.topic  || 'other';
let allRegions     = null;
let geojson        = null;

// ── Helpers ───────────────────────────────────────────────────────────────────
function inferBg(mapSvg = '') {
  if (mapSvg.includes('africa'))        return 'africa';
  if (mapSvg.includes('north_america')) return 'north_america';
  return 'south_america';
}

// ── DB mode ───────────────────────────────────────────────────────────────────
if (args.db && args.game) {
  const Database = require('better-sqlite3');
  const db = new Database(path.resolve(args.db), { readonly: true });

  const game = db.prepare('SELECT * FROM challenge_games WHERE slug = ?').get(args.game);
  if (!game) {
    console.error(`Game not found: "${args.game}"`);
    console.error('Available:', db.prepare("SELECT slug FROM challenge_games WHERE game_type IN ('map','map_quiz')").all().map(r => r.slug).join(', '));
    db.close(); process.exit(1);
  }

  // Auto-derive everything from the game record
  if (!args.topic)  topic          = game.category || 'other';
  if (!args.output) outputPath     = `public/challenges/${topic}/${game.slug}/index.html`;
  if (!args.title)  challengeTitle = game.title_en;
  if (!args.bg)     bgPreset       = inferBg(game.map_svg || '');

  // Load regions as normalised objects matching the JSON export format
  allRegions = db.prepare(
    'SELECT * FROM map_regions WHERE game_id = ? ORDER BY id'
  ).all(game.id).map(r => ({
    enabled:       r.enabled === 1,
    regionKey:     r.region_key,
    labelEn:       r.label_en,
    labelNl:       r.label_nl,
    infoTextEn:    r.info_text_en,
    questionTextEn: r.question_text_en,
    infographData: r.infograph_data,
  }));

  // Resolve GeoJSON from local public/ path (map_svg = '/maps/...')
  const geoLocalPath = path.resolve('public' + game.map_svg);
  if (!fs.existsSync(geoLocalPath)) {
    console.error(`GeoJSON not found: ${geoLocalPath}`);
    db.close(); process.exit(1);
  }
  geojson = JSON.parse(fs.readFileSync(geoLocalPath, 'utf-8'));

  console.log(`DB mode: ${game.slug} (${game.title_en})`);
  console.log(`GeoJSON: ${geoLocalPath}`);
  db.close();

// ── JSON mode (legacy) ────────────────────────────────────────────────────────
} else if (args.regions && args.geojson) {
  allRegions = JSON.parse(fs.readFileSync(path.resolve(args.regions), 'utf-8'));
  geojson    = JSON.parse(fs.readFileSync(path.resolve(args.geojson), 'utf-8'));

} else {
  console.error([
    'DB mode:   node scripts/gen-map-challenge.js --db=restore/remote_db/gameoftrivia.db --game=south-america-parks',
    'JSON mode: node scripts/gen-map-challenge.js --regions=regions.json --geojson=public/maps/parks.geojson --output=... --title=... --bg=...',
  ].join('\n'));
  process.exit(1);
}

const outAbs      = path.resolve(outputPath);
const challengeId = args['challenge-id'] || path.basename(path.dirname(outAbs));

// ── Image helpers (mirrors gen-map-video.js) ──────────────────────────────────
function findLocalImages(regionKey, srcDir, destDir) {
  if (!srcDir) return [];
  const IMG_RE = /\.(jpe?g|png|webp)$/i;
  let matched = [];
  try {
    matched = fs.readdirSync(srcDir)
      .filter(f => f.toLowerCase().startsWith(regionKey.toLowerCase()) && IMG_RE.test(f))
      .sort().slice(0, 5)
      .map(f => ({ src: path.join(srcDir, f), dest: f }));
  } catch { /* srcDir unreadable */ }
  function resolveRegionSubDir() {
    let subDir = path.join(srcDir, regionKey);
    if (fs.existsSync(subDir)) return subDir;
    try {
      const entries = fs.readdirSync(srcDir, { withFileTypes: true });
      const found = entries.find(e => e.isDirectory() && e.name.toLowerCase() === regionKey.toLowerCase());
      if (found) return path.join(srcDir, found.name);
    } catch { /* ignore */ }
    return subDir;
  }
  // Layout 2: <srcDir>/<regionKey>/*.img
  if (matched.length === 0) {
    const subDir = resolveRegionSubDir();
    try {
      matched = fs.readdirSync(subDir)
        .filter(f => IMG_RE.test(f)).sort().slice(0, 5)
        .map(f => ({ src: path.join(subDir, f), dest: `${regionKey}_${f}` }));
    } catch { /* subDir missing */ }
  }
  // Layout 3: <srcDir>/<regionKey>/images/*.img (mirrors the audio-store's per-region typed subfolders)
  if (matched.length === 0) {
    const imagesSubDir = path.join(resolveRegionSubDir(), 'images');
    try {
      matched = fs.readdirSync(imagesSubDir)
        .filter(f => IMG_RE.test(f)).sort().slice(0, 5)
        .map(f => ({ src: path.join(imagesSubDir, f), dest: `${regionKey}_${f}` }));
    } catch { /* imagesSubDir missing */ }
  }
  if (matched.length === 0) return [];
  fs.mkdirSync(destDir, { recursive: true });
  return matched.map(({ src, dest }) => {
    const outPath = path.join(destDir, dest);
    if (!fs.existsSync(outPath)) fs.copyFileSync(src, outPath);
    return `images/${dest}`;
  });
}

// ── Build geo lookup ──────────────────────────────────────────────────────────
const geoMap = new Map(
  geojson.features.map(f => [(f.id ?? f.properties?.regionKey ?? '').trim(), f])
);

// ── Infograph normalisation ────────────────────────────────────────────────────
function parseInfograph(str) {
  if (!str) return null;
  try { return JSON.parse(str); } catch { return null; }
}

function normalizeInfograph(raw, infoText) {
  if (!raw && !infoText) return null;
  if (!raw) return { countryIso2: null, country: null, typeLabel: null, fields: [], images: [], description: infoText };
  if (Array.isArray(raw.fields)) {
    return {
      countryIso2: raw.countryIso2 || null,
      country:     raw.country     || null,
      typeLabel:   raw.typeLabel   || null,
      fields:      raw.fields,
      images:      raw.images || [],
      description: raw.description ?? infoText ?? null,
    };
  }
  // Legacy flat format
  const fields = [];
  if (raw.area)        fields.push({ label: 'Area',        value: raw.area,        barPct: raw.areaBarPct });
  if (raw.established) fields.push({ label: 'Established', value: raw.established });
  if (raw.landscape)   fields.push({ label: 'Landscape',   value: raw.landscape   });
  if (raw.wildlife)    fields.push({ label: 'Wildlife',    value: raw.wildlife    });
  return {
    countryIso2: raw.countryIso2 || null,
    country:     raw.country     || null,
    typeLabel:   'National Park',
    fields,
    images:      raw.images || [],
    description: infoText ?? null,
  };
}

// ── Build region records ───────────────────────────────────────────────────────
const imagesCopyDir = imagesDirArg ? path.join(path.dirname(outAbs), 'images') : null;

const regions = allRegions
  .filter(r => r.enabled && geoMap.has(r.regionKey.trim()))
  .map(r => {
    const key = r.regionKey.trim();
    const ig  = parseInfograph(r.infographData);
    const normalized = normalizeInfograph(ig, r.infoTextEn || null);
    const localImgs = findLocalImages(key, imagesDirArg, imagesCopyDir);
    const dbImgs    = (ig?.images || []).filter(Boolean).slice(0, 5);
    const images    = localImgs.length > 0 ? localImgs : dbImgs;
    if      (localImgs.length > 0) console.log(`  ${r.labelEn}: ${localImgs.length} local image(s)`);
    else if (dbImgs.length   > 0)  console.log(`  ${r.labelEn}: ${dbImgs.length} DB image(s)`);
    else                           console.log(`  ${r.labelEn}: no images`);
    return {
      regionKey:   key,
      labelEn:     r.labelEn,
      questionEn:  r.questionTextEn || null,
      infograph:   normalized ? { ...normalized, images } : null,
    };
  });

if (regions.length === 0) {
  console.error('No enabled regions matched GeoJSON features. Check --regions and --geojson paths.');
  process.exit(1);
}

console.log(`\nBuilding challenge for ${regions.length} parks:`);
regions.forEach(r => console.log(`  • ${r.labelEn}`));

// ── Background presets ─────────────────────────────────────────────────────────
const BG_ISO = {
  south_america: ['BR','AR','CL','CO','VE','PE','BO','PY','UY','EC','GY','SR','FK','PA','CR','GF','BQ','CW','AW','TT','SX','BB','LC','VC','GD'],
  africa:        ['ZA','NA','BW','ZW','ZM','TZ','KE','UG','RW','BI','CD','AO','MZ','MG','MW','SO','ET','ER','DJ','SD','SS','CF','CG','GA','CM','NG','GH','CI','SN','GN','SL','LR','TG','BJ','NE','ML','BF','MR','GM','GW','TD','LY','DZ','MA','TN','EG','MU'],
  north_america: ['US','CA','MX','GT','BZ','HN','SV','NI','CR','PA','CU','HT','DO','JM','GL'],
};
const FIT_COORDS = {
  south_america: [[-84, 14], [-34, -57], [-84, -57], [-34, 14]],
  africa:        [[-20, 38], [52, -35],  [-20, -35], [52, 38]],
  north_america: [[-170, 84], [-50, 5],  [-170, 5],  [-50, 84]],
};

const bgIsoJson   = JSON.stringify(BG_ISO[bgPreset] || BG_ISO.south_america);
const fitCoordsJson = JSON.stringify(FIT_COORDS[bgPreset] || FIT_COORDS.south_america);

// ── Bake data ──────────────────────────────────────────────────────────────────
const regionsJson  = JSON.stringify(regions);
const geojsonEmbed = JSON.stringify(geojson);

// ── Generate HTML ──────────────────────────────────────────────────────────────
const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${challengeTitle}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #0b1622; font-family: system-ui, sans-serif; color: white; min-height: 100vh; }

    #challenge-root {
      max-width: 920px; margin: 0 auto; padding: 16px;
      display: flex; flex-direction: column; gap: 12px;
      user-select: none;
    }

    /* ── Top bar — per-question progress dots, upper-right ──────────────── */
    #top-bar { display: flex; align-items: center; justify-content: flex-end; gap: 12px; flex-wrap: wrap; }
    #progress-row { display: flex; gap: 7px; flex-wrap: wrap; justify-content: flex-end; }
    .pd { width: 8px; height: 8px; border-radius: 50%; background: rgba(255,255,255,0.18); transition: background 0.4s; }
    .pd.done   { background: #4ade80; }
    .pd.wrong  { background: #f87171; }
    .pd.active { background: #fbbf24; }

    /* ── Map ─────────────────────────────────────────────────────────── */
    #map-row { display: flex; gap: 8px; }
    #timer-track {
      width: 8px; flex-shrink: 0; border-radius: 4px; overflow: hidden;
      background: rgba(148,163,184,0.15); display: flex; flex-direction: column; justify-content: flex-end;
      opacity: 0; transition: opacity 0.4s ease;
    }
    #timer-fill { width: 100%; height: 100%; background: #4ade80; }
    #timer-fill.running { animation: timer-deplete linear forwards; }
    @keyframes timer-deplete {
      from { height: 100%; background-color: #4ade80; }
      70%  { background-color: #fbbf24; }
      100% { height: 0%; background-color: #ef4444; }
    }
    #map-wrap {
      position: relative; border-radius: 16px; overflow: hidden;
      border: 1px solid #1e3a5f; background: #060e1f; flex: 1; min-width: 0;
    }
    #map-svg { width: 100%; display: block; aspect-ratio: 16/10; }
    #map-loading {
      position: absolute; inset: 0;
      display: flex; align-items: center; justify-content: center;
      color: #64748b; font-size: 13px;
    }
    /* Duration is set per-call in JS (4s zoom-in, 2s zoom-out, matching the
       YouTube video's pacing) — only the easing is fixed here. */
    #map-group { transition-property: transform; transition-timing-function: cubic-bezier(0.65,0,0.35,1); transform-origin: 0 0; }

    /* Photo carousel — overlays the map during the question, as a visual clue
       while guessing. Starts when the timer starts; no name/text (would spoil
       the answer). Fades out once the correct answer is given, revealing the
       map's zoom-to-region reveal underneath. */
    #quiz-carousel {
      position: absolute; inset: 0; z-index: 5; overflow: hidden;
      opacity: 0; transition: opacity 0.6s ease; pointer-events: none;
    }
    #quiz-carousel img {
      position: absolute; inset: 0; width: 100%; height: 100%;
      object-fit: cover; object-position: center;
      transform-origin: center center; will-change: transform;
      /* opacity + Ken Burns pan/zoom transition durations are set per-image in JS */
    }

    /* "Time's up" indicator — briefly shown over the map when the countdown
       runs out before the player answers. */
    #timeup-badge {
      position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%);
      z-index: 20; background: rgba(127,29,29,0.94); color: #fecaca;
      padding: 10px 22px; border-radius: 12px; font-size: 15px; font-weight: 700;
      letter-spacing: 0.03em; white-space: nowrap;
      opacity: 0; pointer-events: none; transition: opacity 0.3s ease;
    }
    #timeup-badge.visible { opacity: 1; }

    /* ── Answer section ──────────────────────────────────────────────── */
    #answer-section { display: flex; flex-direction: column; gap: 8px; }
    #question-label {
      font-size: 11px; font-weight: 600; color: #64748b;
      text-transform: uppercase; letter-spacing: 0.12em;
    }
    #question-text {
      font-size: 15px; line-height: 1.5; color: #e2e8f0;
      min-height: calc(15px * 1.5 * 2); /* reserve ~2 lines so option buttons don't jump per question */
      display: flex; align-items: center;
    }
    #options-row { display: flex; gap: 8px; opacity: 0; transition: opacity 0.4s ease; }
    .opt-btn {
      flex: 1; padding: 12px 10px;
      border-radius: 12px; border: none; cursor: pointer;
      font-size: 13px; font-weight: 500; text-align: center;
      transition: background 0.15s, transform 0.1s;
      background: #1e293b; color: #e2e8f0;
      line-height: 1.3;
    }
    .opt-btn:hover:not(:disabled) { background: #293d55; }
    .opt-btn:active:not(:disabled) { transform: scale(0.97); }
    .opt-btn:disabled { cursor: default; }
    .opt-btn.correct { background: #166534; color: #86efac; }
    .opt-btn.wrong   { background: #7f1d1d; color: #fca5a5; }

    /* ── End screen ──────────────────────────────────────────────────── */
    #end-section { display: none; flex-direction: column; gap: 10px; align-items: center; padding: 8px 0; }
    #end-message { font-size: 20px; font-weight: 700; text-align: center; }
    #retry-btn {
      display: none;
      padding: 11px 32px; background: #d97706; border: none;
      color: white; font-size: 14px; font-weight: 600;
      border-radius: 12px; cursor: pointer; transition: background 0.2s;
    }
    #retry-btn:hover { background: #b45309; }
    #restart-btn {
      background: none; border: none; color: #94a3b8;
      font-size: 13px; font-weight: 500; cursor: pointer;
      transition: color 0.2s;
    }
    #restart-btn:hover { color: #e2e8f0; }

    /* ── Glitter ─────────────────────────────────────────────────────── */
    #glitter-layer { pointer-events: none; position: fixed; inset: 0; z-index: 300; overflow: hidden; display: none; }
    .glitter-p { position: absolute; animation: g-fly var(--dur) ease-out var(--delay) both; }
    @keyframes g-fly {
      0%   { transform: translate(0,0) rotate(0deg); opacity: 1; }
      100% { transform: translate(var(--dx), var(--dy)) rotate(var(--rot)); opacity: 0; }
    }

    /* ── Mobile ──────────────────────────────────────────────────────── */
    @media (max-width: 480px) {
      #challenge-root { padding: 10px; gap: 10px; }
      .opt-btn { padding: 13px 6px; font-size: 12px; border-radius: 10px; }
      #options-row { gap: 5px; }
    }
  </style>
</head>
<body>
<div id="challenge-root">

  <div id="top-bar">
    <div id="progress-row"></div>
  </div>

  <div id="map-row">
    <div id="timer-track"><div id="timer-fill"></div></div>
    <div id="map-wrap">
      <div id="map-loading">Loading map…</div>
      <div id="quiz-carousel"></div>
      <div id="timeup-badge">⏱ Time's up!</div>
      <svg id="map-svg" viewBox="0 0 960 600">
        <defs>
          <radialGradient id="ocean-grad" cx="50%" cy="50%" r="75%">
            <stop offset="0%"   stop-color="#0d2048"/>
            <stop offset="100%" stop-color="#060e1f"/>
          </radialGradient>
          <radialGradient id="vig-grad" cx="50%" cy="50%" r="75%">
            <stop offset="44%"  stop-color="transparent"/>
            <stop offset="100%" stop-color="rgba(0,0,0,0.45)"/>
          </radialGradient>
        </defs>
        <rect width="960" height="600" fill="url(#ocean-grad)"/>
        <g id="map-group" opacity="0"></g>
        <rect width="960" height="600" fill="url(#vig-grad)" pointer-events="none"/>
      </svg>
    </div>
  </div>

  <div id="answer-section">
    <div id="question-label">Where is this national park?</div>
    <div id="question-text"></div>
    <div id="options-row">
      <button class="opt-btn" id="opt-0"></button>
      <button class="opt-btn" id="opt-1"></button>
      <button class="opt-btn" id="opt-2"></button>
    </div>
  </div>

  <div id="end-section">
    <div id="end-message"></div>
    <button id="retry-btn"></button>
    <button id="restart-btn">Play Again</button>
  </div>

</div>

<div id="glitter-layer"></div>

<script src="https://d3js.org/d3.v7.min.js"></script>
<script>
(async () => {
  const W = 960, H = 600;
  const REGIONS      = ${regionsJson};
  const PARKS_GEO    = ${geojsonEmbed};
  const BG_ISO       = new Set(${bgIsoJson});
  const FIT_COORDS   = ${fitCoordsJson};
  const CHALLENGE_ID = ${JSON.stringify(challengeId)};
  const SCORE_URL    = ${JSON.stringify(scoreUrl)};
  const correctSound = new Audio('correct.mp3');
  function playCorrectSound() {
    correctSound.currentTime = 0;
    correctSound.play().catch(() => {});
  }

  const NE_URL = 'https://d2ad6b4ur7yvpq.cloudfront.net/naturalearth-3.3.0/ne_50m_admin_0_countries.geojson';

  // ── State ─────────────────────────────────────────────────────────────────────
  let queue     = shuffle([...REGIONS]);
  let qIndex    = 0;
  let results   = {}; // regionKey -> true/false, latest known outcome
  let answered  = new Set();
  let phase     = 'loading';
  let options   = [];
  let neData    = null;
  let timerTimeoutId = null;
  const QUESTION_TIME_MS = 10000;
  let markerPos = {};
  let quizCarouselInterval = null;
  let zoomTimeoutId    = null;
  let carouselTimeoutId = null;
  // Timings mirror the YouTube video's pacing (gen-map-video.js):
  // T_ZOOM_START=1s, 4s zoom-in, 0.6s gap before the carousel crossfades in.
  const ZOOM_START_DELAY_MS   = 1000; // pause before the map zooms into the region
  const ZOOM_IN_DURATION_MS   = 4000; // matches the video's 4s zoom-in
  const ZOOM_OUT_DURATION_MS  = 2000; // matches the video's 2s zoom-out
  const CAROUSEL_IN_DELAY_MS  = 600;  // pause after the zoom lands before photos crossfade in
  const CAROUSEL_INTERVAL_MS  = 3500; // how long each photo is shown (Ken Burns pan duration)

  // Ken Burns variants — same 4 deterministic pan/zoom directions as the video.
  const KB = [
    { from: { scale: 1.05, x:  1.5, y:  0.5 }, to: { scale: 1.10, x: -1.5, y: -1.0 } },
    { from: { scale: 1.10, x: -1.5, y: -1.0 }, to: { scale: 1.05, x:  1.5, y:  0.5 } },
    { from: { scale: 1.05, x: -1.0, y:  1.5 }, to: { scale: 1.10, x:  1.0, y: -1.5 } },
    { from: { scale: 1.10, x:  1.0, y:  1.0 }, to: { scale: 1.05, x: -1.5, y: -0.5 } },
  ];
  function applyKenBurns(img, variant) {
    const kb = KB[variant % KB.length];
    img.style.transition = 'none';
    img.style.transform  = \`scale(\${kb.from.scale}) translate(\${kb.from.x}%, \${kb.from.y}%)\`;
    void img.offsetWidth; // force reflow so the reset above applies before animating
    img.style.transition = \`opacity 0.9s ease, transform \${CAROUSEL_INTERVAL_MS}ms linear\`;
    img.style.transform  = \`scale(\${kb.to.scale}) translate(\${kb.to.x}%, \${kb.to.y}%)\`;
  }

  // ── Utilities ─────────────────────────────────────────────────────────────────
  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  function $(id) { return document.getElementById(id); }
  function setText(id, val) { const el = $(id); if (el) el.textContent = val || ''; }
  function markerId(k) { return 'mk-' + k.replace(/[^a-zA-Z0-9_-]/g, '_'); }
  function getMarker(k) { return $(markerId(k)); }

  // ── D3 setup ──────────────────────────────────────────────────────────────────
  const FIT = { type: 'Feature', geometry: { type: 'MultiPoint', coordinates: FIT_COORDS }, properties: null };
  const projection = d3.geoMercator().fitExtent([[30, 20], [W - 30, H - 20]], FIT);
  const pathGen    = d3.geoPath().projection(projection);

  for (const f of PARKS_GEO.features) {
    const key = (f.id ?? f.properties?.regionKey ?? '').trim();
    const pt  = projection(f.geometry.coordinates);
    if (pt) markerPos[key] = { x: pt[0], y: pt[1] };
  }

  // ── Fetch NE background ───────────────────────────────────────────────────────
  neData = await fetch(NE_URL).then(r => r.json());
  const bgFeatures = neData.features.filter(f => {
    const iso = f.properties?.iso_a2_eh ?? f.properties?.iso_a2 ?? '';
    return BG_ISO.has(iso) && f.geometry;
  });

  // ── Render map ────────────────────────────────────────────────────────────────
  const g = d3.select('#map-group');
  g.append('path').datum(d3.geoGraticule()())
    .attr('fill','none').attr('stroke','#0e2650').attr('stroke-width',0.3)
    .attr('d', pathGen);
  for (const f of bgFeatures) {
    const d = pathGen(f);
    if (d) g.append('path').attr('d',d).attr('fill','#3a7a4a').attr('stroke','#2d6038').attr('stroke-width',0.3);
  }
  const MR = 8;
  for (const f of PARKS_GEO.features) {
    const key = (f.id ?? f.properties?.regionKey ?? '').trim();
    const pos = markerPos[key];
    if (!pos) continue;
    const { x: cx, y: cy } = pos;
    g.append('circle')
      .attr('id', markerId(key)).attr('class','park-marker')
      .attr('cx', cx).attr('cy', cy).attr('r', MR)
      .attr('fill','#c8d8b4').attr('stroke','#6b7c52').attr('stroke-width',1.2);
  }
  $('map-loading').style.display = 'none';
  d3.select('#map-group').transition().duration(700).attr('opacity',1);

  // ── Marker helpers ────────────────────────────────────────────────────────────
  function setMarkerColor(key, fill, stroke) {
    const el = getMarker(key);
    if (!el) return;
    el.setAttribute('fill', fill);
    el.setAttribute('stroke', stroke);
  }
  function hideAllMarkers() {
    document.querySelectorAll('.park-marker').forEach(el => { el.style.opacity = '0'; });
  }
  // Only the current question's location is ever shown on the map — no other
  // parks, answered or upcoming, so nothing but the current pin gives
  // anything away.
  function syncMarkers() {
    hideAllMarkers();
    const cur = queue[qIndex];
    if (!cur) return;
    const el = getMarker(cur.regionKey);
    if (!el) return;
    el.style.opacity = '1';
    el.setAttribute('fill', '#fbbf24');
    el.setAttribute('stroke', '#d97706');
  }

  // ── Zoom ──────────────────────────────────────────────────────────────────────
  function zoomToRegion(key) {
    const pos = markerPos[key];
    if (!pos) return;
    const scale = 5;
    const tx = W / 2 - pos.x * scale;
    const ty = H / 2 - pos.y * scale;
    const group = $('map-group');
    group.style.transitionDuration = (ZOOM_IN_DURATION_MS / 1000) + 's';
    group.style.transform = \`translate(\${tx}px,\${ty}px) scale(\${scale})\`;
    document.querySelectorAll('.park-marker').forEach(el => {
      if (el.id !== markerId(key)) el.style.opacity = '0';
    });
  }
  function resetZoom() {
    const group = $('map-group');
    group.style.transitionDuration = (ZOOM_OUT_DURATION_MS / 1000) + 's';
    group.style.transform = 'translate(0,0) scale(1)';
  }

  // ── Progress dots — rebuilt whenever the queue changes size (new round) ───────
  function renderProgressDots() {
    const row = $('progress-row');
    row.innerHTML = '';
    queue.forEach(() => {
      const d = document.createElement('div');
      d.className = 'pd';
      row.appendChild(d);
    });
  }
  function updateProgress() {
    document.querySelectorAll('#progress-row .pd').forEach((el, i) => {
      const r = queue[i];
      const status = r ? results[r.regionKey] : undefined;
      el.classList.toggle('done',   status === true);
      el.classList.toggle('wrong',  status === false);
      el.classList.toggle('active', i === qIndex && status === undefined);
    });
  }

  // ── Per-question countdown ──────────────────────────────────────────────────────
  function startTimer() {
    clearTimeout(timerTimeoutId);
    const fill = $('timer-fill');
    if (fill) {
      fill.classList.remove('running');
      fill.style.height = '100%';
      void fill.offsetHeight; // force reflow to restart the animation
      fill.style.animationDuration = QUESTION_TIME_MS + 'ms';
      fill.classList.add('running');
    }
    timerTimeoutId = setTimeout(handleQuestionTimeout, QUESTION_TIME_MS);
  }
  function pauseTimer() {
    clearTimeout(timerTimeoutId);
    const fill = $('timer-fill');
    if (fill) { fill.classList.remove('running'); fill.style.height = '100%'; }
  }
  function showTimeUpBadge() {
    const badge = $('timeup-badge');
    badge.classList.add('visible');
    setTimeout(() => badge.classList.remove('visible'), 1400);
  }

  function handleQuestionTimeout() {
    if (phase !== 'question') return;
    const region      = queue[qIndex];
    const correct     = region.labelEn;
    const correctIdx  = options.indexOf(correct);

    phase = 'revealed';
    pauseTimer();
    stopQuizCarousel();
    if (correctIdx >= 0) $('opt-' + correctIdx).className = 'opt-btn correct';
    ['opt-0','opt-1','opt-2'].forEach(id => { $(id).disabled = true; });
    setMarkerColor(region.regionKey, '#4ade80', '#15803d');
    showTimeUpBadge();

    results[region.regionKey] = false;
    updateProgress();

    setTimeout(() => {
      zoomToRegion(region.regionKey);
      setTimeout(() => handleNext(), 1000);
    }, 1000);
  }

  // ── Photo carousel — visual guessing clue, no name/text, runs while the
  //    timer is counting down (started alongside startTimer, stopped once the
  //    correct answer is given so the map's zoom-to-region reveal takes over) ──
  function startQuizCarousel(images) {
    stopQuizCarousel();
    const wrap = $('quiz-carousel');
    wrap.innerHTML = '';
    if (!images || images.length === 0) { wrap.style.opacity = '0'; return; }
    images.forEach((src, i) => {
      const img = document.createElement('img');
      img.src = src;
      img.alt = '';
      img.style.opacity = i === 0 ? '1' : '0';
      wrap.appendChild(img);
    });
    wrap.style.opacity = '1';
    const imgs = wrap.querySelectorAll('img');
    applyKenBurns(imgs[0], 0);
    if (images.length > 1) {
      let idx = 0;
      let variant = 1;
      quizCarouselInterval = setInterval(() => {
        imgs[idx].style.opacity = '0';
        idx = (idx + 1) % imgs.length;
        imgs[idx].style.opacity = '1';
        applyKenBurns(imgs[idx], variant++);
      }, CAROUSEL_INTERVAL_MS);
    }
  }
  function stopQuizCarousel() {
    clearTimeout(zoomTimeoutId);
    clearTimeout(carouselTimeoutId);
    clearInterval(quizCarouselInterval);
    quizCarouselInterval = null;
    const wrap = $('quiz-carousel');
    if (wrap) wrap.style.opacity = '0';
  }

  // Map zooms into the region first (like the video's zoomToRegion), then once
  // it lands, the photo carousel crossfades in over the zoomed map.
  function scheduleZoomAndCarousel(regionKey, images) {
    zoomTimeoutId = setTimeout(() => {
      zoomToRegion(regionKey);
      carouselTimeoutId = setTimeout(() => {
        startQuizCarousel(images);
        revealOptionsAndTimer();
      }, ZOOM_IN_DURATION_MS + CAROUSEL_IN_DELAY_MS);
    }, ZOOM_START_DELAY_MS);
  }

  // ── Options ───────────────────────────────────────────────────────────────────
  function generateOptions(region) {
    const correct = region.labelEn;
    const pool = shuffle(REGIONS.filter(r => r.regionKey !== region.regionKey)).map(r => r.labelEn);
    return shuffle([correct, pool[0] || 'Unknown', pool[1] || 'Unknown']);
  }

  // ── Start question ────────────────────────────────────────────────────────────
  function startQuestion(i) {
    qIndex  = i;
    const region = queue[i];
    options = generateOptions(region);
    setText('question-text', region.questionEn || '');

    // Options + countdown stay hidden/disabled until the zoom lands and the
    // carousel starts (revealOptionsAndTimer), matching the video's pacing.
    const optRow = $('options-row');
    optRow.style.opacity = '0';
    optRow.style.pointerEvents = 'none';
    $('timer-track').style.opacity = '0';
    ['opt-0','opt-1','opt-2'].forEach((id, j) => {
      const el = $(id);
      el.textContent = options[j];
      el.className   = 'opt-btn';
      el.disabled    = true;
    });

    $('answer-section').style.display = 'flex';
    $('end-section').style.display    = 'none';
    stopQuizCarousel();
    pauseTimer();
    resetZoom();
    syncMarkers();
    updateProgress();
    phase = 'question';
    scheduleZoomAndCarousel(region.regionKey, (region.infograph?.images || []).filter(Boolean));
  }

  // Fades in the options + countdown bar and enables answering — called the
  // moment the carousel starts (i.e. once the zoom-in effect has landed).
  function revealOptionsAndTimer() {
    const optRow = $('options-row');
    optRow.style.opacity = '1';
    optRow.style.pointerEvents = 'auto';
    ['opt-0','opt-1','opt-2'].forEach(id => { $(id).disabled = false; });
    $('timer-track').style.opacity = '1';
    startTimer();
  }

  // ── Answer handler ────────────────────────────────────────────────────────────
  function handleAnswer(label, btnIdx) {
    if (phase !== 'question') return;
    const region    = queue[qIndex];
    const correct   = region.labelEn;
    const isCorrect = label === correct;

    if (isCorrect) {
      $('opt-' + btnIdx).className = 'opt-btn correct';
    } else {
      const correctIdx = options.indexOf(correct);
      $('opt-' + btnIdx).className = 'opt-btn wrong';
      if (correctIdx >= 0) $('opt-' + correctIdx).className = 'opt-btn correct';
    }
    ['opt-0','opt-1','opt-2'].forEach(id => { $(id).disabled = true; });
    setMarkerColor(region.regionKey, '#4ade80', '#15803d');
    phase = 'revealed';
    pauseTimer();
    stopQuizCarousel();
    if (isCorrect) playCorrectSound();

    results[region.regionKey] = isCorrect;
    updateProgress();

    setTimeout(() => {
      zoomToRegion(region.regionKey);
      setTimeout(() => handleNext(), 1000);
    }, isCorrect ? 400 : 1000);
  }

  // ── Advance ───────────────────────────────────────────────────────────────────
  function handleNext() {
    resetZoom();
    answered.add(queue[qIndex].regionKey);
    const next = qIndex + 1;
    if (next >= queue.length) {
      finishRound();
    } else {
      startQuestion(next);
    }
  }

  // ── Round finished — celebrate only once every original region has been
  //    answered correctly (possibly after retries); otherwise offer a retry
  //    of just the ones still wrong ─────────────────────────────────────────────
  function finishRound() {
    phase = 'done';
    stopQuizCarousel();
    $('answer-section').style.display = 'none';
    $('end-section').style.display = 'flex';

    const correctCount = REGIONS.filter(r => results[r.regionKey] === true).length;
    const wrongRegions  = REGIONS.filter(r => results[r.regionKey] === false);
    const allCorrect    = wrongRegions.length === 0;

    const msg = $('end-message');
    const retryBtn = $('retry-btn');
    if (allCorrect) {
      msg.textContent = 'Perfect score!';
      msg.style.color = '#4ade80';
      retryBtn.style.display = 'none';
      fireGlitter();
      postScore(correctCount, REGIONS.length);
    } else {
      msg.textContent = correctCount + ' / ' + REGIONS.length + ' correct';
      msg.style.color = '#e2e8f0';
      retryBtn.textContent = 'Retry ' + wrongRegions.length + ' wrong answer' + (wrongRegions.length === 1 ? '' : 's');
      retryBtn.style.display = 'inline-block';
    }
  }

  // ── Retry just the regions still marked wrong ─────────────────────────────────
  function retry() {
    const wrongRegions = queue.filter(r => results[r.regionKey] !== true);
    queue = shuffle(wrongRegions.length > 0 ? wrongRegions : queue);
    queue.forEach(r => { delete results[r.regionKey]; answered.delete(r.regionKey); });
    qIndex = 0;
    resetZoom();
    hideAllMarkers();
    renderProgressDots();
    startQuestion(0);
  }

  function restart() {
    queue    = shuffle([...REGIONS]);
    qIndex   = 0;
    results  = {};
    answered = new Set();
    resetZoom();
    hideAllMarkers();
    renderProgressDots();
    startQuestion(0);
  }

  // ── Score ─────────────────────────────────────────────────────────────────────
  async function postScore(score, maxScore) {
    if (!SCORE_URL) return;
    try {
      await fetch(SCORE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challengeId: CHALLENGE_ID, score, maxScore }),
      });
    } catch { /* ignore */ }
  }

  // ── Glitter ───────────────────────────────────────────────────────────────────
  function fireGlitter() {
    const layer  = $('glitter-layer');
    const colors = ['#fbbf24','#4ade80','#f59e0b','#86efac','#fde68a','#a3e635','#34d399','#fcd34d'];
    layer.innerHTML = '';
    layer.style.display = 'block';
    for (let i = 0; i < 80; i++) {
      const p = document.createElement('div');
      p.className = 'glitter-p';
      const dx = (Math.random() - 0.5) * 260;
      const dy = -(80 + Math.random() * 180);
      Object.assign(p.style, {
        left:    (10 + Math.random() * 80) + '%',
        top:     (20 + Math.random() * 60) + '%',
        width:   (4 + Math.random() * 7) + 'px',
        height:  (4 + Math.random() * 7) + 'px',
        background: colors[Math.floor(Math.random() * colors.length)],
        borderRadius: ['50%','0%','2px'][Math.floor(Math.random() * 3)],
        '--delay': (Math.random() * 0.4) + 's',
        '--dur':   (0.9 + Math.random() * 0.8) + 's',
        '--dx':    dx + 'px',
        '--dy':    dy + 'px',
        '--rot':   (Math.random() * 720) + 'deg',
      });
      layer.appendChild(p);
    }
    setTimeout(() => { layer.style.display = 'none'; layer.innerHTML = ''; }, 2500);
  }

  // ── Wire events ───────────────────────────────────────────────────────────────
  ['opt-0','opt-1','opt-2'].forEach((id, i) => {
    $(id).addEventListener('click', () => handleAnswer(options[i], i));
  });
  $('retry-btn').addEventListener('click', retry);
  $('restart-btn').addEventListener('click', restart);

  // ── Boot ──────────────────────────────────────────────────────────────────────
  renderProgressDots();
  startQuestion(0);
})();
</script>
</body>
</html>`;

// ── Write ─────────────────────────────────────────────────────────────────────
fs.mkdirSync(path.dirname(outAbs), { recursive: true });
fs.writeFileSync(outAbs, html, 'utf-8');

// Bundle the correct-answer sound alongside the package so it stays self-contained
const soundSrc  = path.resolve('public/sounds/correct.mp3');
const soundDest = path.join(path.dirname(outAbs), 'correct.mp3');
if (fs.existsSync(soundSrc)) fs.copyFileSync(soundSrc, soundDest);

const sizeKb = Math.round(fs.statSync(outAbs).size / 1024);
console.log(`\nWritten: ${outputPath} (${sizeKb} KB)`);
console.log(`Regions: ${regions.length}`);
console.log(`\nUsage:`);
console.log(`  # Open directly in browser:`);
console.log(`  open ${outputPath}`);
console.log(`\n  # Embed in Next.js page:`);
console.log(`  <iframe src="/${outputPath.replace(/^public\//, '')}" className="w-full h-[680px] border-0 rounded-2xl" />`);
console.log(`\n  # Score posts to: ${scoreUrl || '(disabled)'}`);
