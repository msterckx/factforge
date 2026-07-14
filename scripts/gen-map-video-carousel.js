#!/usr/bin/env node
'use strict';
/**
 * gen-map-video-carousel.js
 * Map quiz video — carousel variant.
 * Same question/answer reveal as gen-map-video.js, but after the answer is
 * shown the map cuts away to a full-screen image slideshow of the location.
 *
 * Usage:
 *   node scripts/gen-map-video-carousel.js \
 *     --regions=map-regions-27.json \
 *     --geojson=public/maps/south_america_parks_20260504.geojson \
 *     --output=videos/map-challenge/sa-parks-carousel/index.html \
 *     --title="South American National Parks" \
 *     --bg=south_america
 *
 * Options:
 *   --regions     Path to exported regions JSON (required)
 *   --geojson     Path to parks GeoJSON with Point features (required)
 *   --output      Output HTML path (default: videos/map-video-carousel/index.html)
 *   --title       Video title (default: "National Parks Quiz")
 *   --bg          Continent preset: south_america | africa | north_america (default: south_america)
 *   --tts-url     Gradio TTS API base URL (default: http://127.0.0.1:7860)
 *   --voice       Voice sample filename (default: celeste_48k_stereo.wav)
 *   --skip-audio  Skip TTS generation (reuses existing WAV files if present)
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

const regionsPath = args.regions || args.r;
const geojsonPath = args.geojson || args.g;
const outputPath  = args.output  || args.o || 'videos/map-video-carousel/index.html';
const videoTitle  = args.title   || 'National Parks Quiz';
const bgPreset    = args.bg      || 'south_america';
const ttsUrl      = (args['tts-url'] || 'http://127.0.0.1:7860').replace(/\/$/, '');
const ttsVoice    = args.voice   || 'celeste_48k_stereo.wav';
const skipAudio   = !!args['skip-audio'];
const onlyArg     = args.only != null ? String(args.only) : null; // e.g. "0" or "0,2"
const imagesDirArg = args['images-dir'] || null; // local dir of hi-res images

if (!regionsPath || !geojsonPath) {
  console.error([
    'Usage: node scripts/gen-map-video-carousel.js \\',
    '  --regions=regions.json \\',
    '  --geojson=public/maps/south_america_parks_20260504.geojson \\',
    '  --output=videos/map-challenge/sa-parks-carousel/index.html \\',
    '  --title="South American National Parks" \\',
    '  --bg=south_america \\',
    '  [--tts-url=http://127.0.0.1:7860] \\',
    '  [--voice=celeste_48k_stereo.wav] \\',
    '  [--skip-audio] \\',
    '  [--images-dir=path/to/hires-images]',
  ].join('\n'));
  process.exit(1);
}

// ── Image helpers ─────────────────────────────────────────────────────────────
function findLocalImages(regionKey, srcDir, destDir) {
  if (!srcDir) return [];

  const IMG_RE = /\.(jpe?g|png|webp)$/i;

  // Layout 1: flat — files starting with regionKey in srcDir
  let matched = [];
  try {
    matched = fs.readdirSync(srcDir)
      .filter(f => f.toLowerCase().startsWith(regionKey.toLowerCase()) && IMG_RE.test(f))
      .sort()
      .slice(0, 5)
      .map(f => ({ src: path.join(srcDir, f), dest: f }));
  } catch { /* srcDir unreadable */ }

  // Layout 2: subdirectory named regionKey (or case-insensitive match)
  if (matched.length === 0) {
    let subDir = path.join(srcDir, regionKey);
    if (!fs.existsSync(subDir)) {
      try {
        const entries = fs.readdirSync(srcDir, { withFileTypes: true });
        const found = entries.find(e => e.isDirectory() && e.name.toLowerCase() === regionKey.toLowerCase());
        if (found) subDir = path.join(srcDir, found.name);
      } catch { /* ignore */ }
    }
    try {
      matched = fs.readdirSync(subDir)
        .filter(f => IMG_RE.test(f))
        .sort()
        .slice(0, 5)
        .map(f => ({ src: path.join(subDir, f), dest: `${regionKey}_${f}` }));
    } catch { /* subDir doesn't exist */ }
  }

  if (matched.length === 0) return [];

  fs.mkdirSync(destDir, { recursive: true });
  return matched.map(({ src, dest }) => {
    const outPath = path.join(destDir, dest);
    if (!fs.existsSync(outPath)) fs.copyFileSync(src, outPath);
    return `images/${dest}`;
  });
}

function logImageSource(label, localCount, dbCount) {
  if (localCount > 0) {
    console.log(`  Images: ${label} — ${localCount} local file(s)`);
  } else if (dbCount > 0) {
    console.log(`  Images: ${label} — ${dbCount} database URL(s) (no local match)`);
  } else {
    console.log(`  Images: ${label} — none`);
  }
}

// ── Audio helpers ─────────────────────────────────────────────────────────────
function narrationText(infoText) {
  if (!infoText) return '';
  const m = infoText.match(/^([^.!?]+[.!?]+)(\s+[^.!?]+[.!?]+)?/);
  if (m) return (m[1] + (m[2] || '')).trim();
  return infoText.slice(0, 150);
}

async function generateAudio(text, outPath, baseUrl) {
  const initRes = await fetch(`${baseUrl}/gradio_api/call/generate_or_split`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      data: [
        false,
        { files: [{ name: ttsVoice, date: '' }], selected: [ttsVoice] },
        text, 'English', -1, 'Qwen3 - Large',
        true, 0.9, 50, 1.0, 1.05, 2048,
        false, 1.0, 50, 1.0, 1.0, 1.3, 10, false, 4, 0.5, 1.0, false, 0.01, 30,
        3.0, 0.5, 0.5, 0.8, 1.2, 1.0, 'English', 0.9, 0.9, 30, 1.1, 0, 300,
      ],
    }),
  });
  if (!initRes.ok) throw new Error(`TTS POST failed: ${initRes.status} ${await initRes.text()}`);
  const { event_id } = await initRes.json();

  const sseRes = await fetch(`${baseUrl}/gradio_api/call/generate_or_split/${event_id}`);
  if (!sseRes.ok) throw new Error(`TTS SSE failed: ${sseRes.status}`);

  let audioUrl = null;
  const decoder = new TextDecoder();
  let buffer = '';
  let currentEvent = '';
  const receivedLines = [];

  for await (const chunk of sseRes.body) {
    buffer += decoder.decode(chunk, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();
    for (const line of lines) {
      const trimmed = line.trimEnd();
      if (trimmed) receivedLines.push(trimmed);
      if (trimmed.startsWith('event:')) {
        currentEvent = trimmed.slice(6).trim();
      } else if (trimmed.startsWith('data:') && currentEvent === 'error') {
        throw new Error(`TTS error: ${trimmed.slice(5).trim()}`);
      } else if (trimmed.startsWith('data:') && currentEvent === 'complete') {
        try {
          const data = JSON.parse(trimmed.slice(5).trim());
          const first = Array.isArray(data[0]) ? data[0][0] : data[0];
          audioUrl = first?.url || null;
          if (!audioUrl) {
            const m = JSON.stringify(data).match(/"url"\s*:\s*"([^"]+)"/);
            if (m) audioUrl = m[1];
          }
        } catch { /* keep scanning */ }
      }
    }
    if (audioUrl) break;
  }

  if (!audioUrl) {
    const preview = receivedLines.slice(0, 20).join('\n');
    throw new Error(`TTS: no audio URL found.\nSSE lines received:\n${preview}`);
  }

  const wavRes = await fetch(audioUrl);
  if (!wavRes.ok) throw new Error(`TTS WAV download failed: ${wavRes.status}`);
  const buf = Buffer.from(await wavRes.arrayBuffer());
  fs.writeFileSync(outPath, buf);
  console.log(`    → ${path.basename(outPath)} (${Math.round(buf.length / 1024)} KB)`);
}

// ── Main ──────────────────────────────────────────────────────────────────────
(async () => {

const outAbs        = path.resolve(outputPath);
const imagesCopyDir = imagesDirArg ? path.join(path.dirname(outAbs), 'images') : null;

// ── Load data ─────────────────────────────────────────────────────────────────
const allRegions = JSON.parse(fs.readFileSync(path.resolve(regionsPath), 'utf-8'));
const geojson    = JSON.parse(fs.readFileSync(path.resolve(geojsonPath), 'utf-8'));

const geoMap = new Map(
  geojson.features.map(f => [(f.id ?? f.properties?.regionKey ?? '').trim(), f])
);

const regions = allRegions
  .filter(r => r.enabled)
  .map(r => ({ ...r, regionKey: r.regionKey.trim() }))
  .filter(r => geoMap.has(r.regionKey));

if (regions.length === 0) {
  console.error('No enabled regions matched GeoJSON features.');
  console.error('GeoJSON keys:', [...geoMap.keys()].join(', '));
  process.exit(1);
}

console.log(`Building carousel video for ${regions.length} parks:`);
regions.forEach(r => console.log(`  • ${r.labelEn} (${r.regionKey})`));

// ── Build scenes ──────────────────────────────────────────────────────────────
function parseInfograph(str) {
  if (!str) return null;
  try { return JSON.parse(str); } catch { return null; }
}

function extractInfographFields(ig) {
  if (!ig) return {};
  if (Array.isArray(ig.fields)) {
    const m = {};
    for (const f of ig.fields) m[f.label.toLowerCase()] = f.value;
    return m;
  }
  return { area: ig.area, established: ig.established };
}

function getWrongOptions(regionKey, allEnabled, sceneIndex) {
  const others = allEnabled.filter(r => r.regionKey !== regionKey);
  const sorted = [...others].sort((a, b) => a.labelEn.localeCompare(b.labelEn));
  const a = sorted[sceneIndex % sorted.length];
  const b = sorted[(sceneIndex + Math.ceil(sorted.length / 2)) % sorted.length];
  const pair = a.regionKey === b.regionKey ? [a, sorted[(sceneIndex + 1) % sorted.length]] : [a, b];
  return pair.map(r => r.labelEn);
}

let scenes = regions.map((r, i) => {
  const geoFeature = geoMap.get(r.regionKey);
  const [lon, lat] = geoFeature.geometry.coordinates;
  const wrong = getWrongOptions(r.regionKey, regions, i);
  const correctSlot = i % 3;
  const opts = [...wrong];
  opts.splice(correctSlot, 0, r.labelEn);

  const ig = parseInfograph(r.infographData);
  const fields = extractInfographFields(ig);

  return {
    originalIndex: i, // stable file name even after --only filtering
    regionKey:    r.regionKey,
    label:        r.labelEn,
    options:      opts,
    correctIndex: correctSlot,
    infoText:     (r.infoTextEn || '').slice(0, 220),
    country:      ig?.country   || '',
    typeLabel:    ig?.typeLabel || 'National Park',
    area:         fields.area        || ig?.area        || '',
    established:  fields.established || ig?.established || '',
    images: (() => {
      const local  = findLocalImages(r.regionKey, imagesDirArg, imagesCopyDir);
      const dbImgs = (ig?.images || []).filter(Boolean).slice(0, 5);
      logImageSource(r.labelEn, local.length, dbImgs.length);
      return local.length > 0 ? local : dbImgs;
    })(),
    lon,
    lat,
  };
});

// ── --only filter (preview a subset of scenes) ────────────────────────────────
if (onlyArg !== null) {
  const indices = onlyArg.split(',').map(s => {
    const n = parseInt(s.trim(), 10);
    return isNaN(n) ? scenes.findIndex(sc => sc.regionKey === s.trim()) : n;
  }).filter(n => n >= 0 && n < scenes.length);
  if (indices.length === 0) {
    console.error(`--only: no scenes matched "${onlyArg}". Valid indices: 0–${scenes.length - 1}`);
    process.exit(1);
  }
  scenes = indices.map(n => scenes[n]);
  console.log(`Preview mode: showing scene(s) ${indices.join(', ')} only`);
}

// ── Background presets ────────────────────────────────────────────────────────
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

const bgIsoSet  = (BG_ISO[bgPreset] || BG_ISO.south_america).join("','");
const fitCoords = JSON.stringify(FIT_COORDS[bgPreset] || FIT_COORDS.south_america);

// ── Timing constants ──────────────────────────────────────────────────────────
const SCENE_DUR       = 30;    // extended to fit zoom + carousel
const OPENING         = 4;
const T_QUESTION_IN   = 0.5;
const T_QUESTION_OUT  = 5.5;
const T_REVEAL_IN     = 6.2;
const T_REVEAL_OUT    = 9.8;
const T_ZOOM_START    = 10.5;  // map zoom begins
const T_ZOOM_LAND     = 14.5;  // zoom animation complete (4 s duration)
const T_CAROUSEL_IN   = 15.5;  // carousel crossfades over zoomed map
const T_CAROUSEL_OUT  = 27.5;  // carousel fades out
const T_ZOOM_OUT      = 27.5;  // map begins zooming back out simultaneously
const CAR_DUR         = T_CAROUSEL_OUT - T_CAROUSEL_IN; // 12 s for images
const TOTAL_DUR       = OPENING + scenes.length * SCENE_DUR + 2;

// ── Audio generation ──────────────────────────────────────────────────────────
const audioPaths = new Map();
const audioDir   = path.join(path.dirname(outAbs), 'audio');

console.log(`\nAudio dir: ${audioDir}`);
if (!skipAudio) {
  fs.mkdirSync(audioDir, { recursive: true });
  console.log(`Generating audio (TTS: ${ttsUrl}):`);
  for (let i = 0; i < scenes.length; i++) {
    const idx       = scenes[i].originalIndex;
    const audioFile = path.join(audioDir, `scene-${idx}.wav`);
    if (fs.existsSync(audioFile)) {
      console.log(`  Scene ${i + 1}/${scenes.length}: ${scenes[i].label} — already exists`);
      audioPaths.set(i, `audio/scene-${idx}.wav`);
      continue;
    }
    const text = narrationText(scenes[i].infoText);
    if (!text) { console.log(`  Scene ${i + 1}/${scenes.length}: no infoText, skipping`); continue; }
    console.log(`  Scene ${i + 1}/${scenes.length}: ${scenes[i].label}`);
    console.log(`    "${text.slice(0, 80)}${text.length > 80 ? '…' : ''}"`);
    try {
      await generateAudio(text, audioFile, ttsUrl);
      audioPaths.set(i, `audio/scene-${idx}.wav`);
    } catch (err) {
      console.warn(`    ✗ Failed: ${err.message}`);
    }
  }
} else {
  let found = 0, missing = 0;
  for (let i = 0; i < scenes.length; i++) {
    const idx       = scenes[i].originalIndex;
    const audioFile = path.join(audioDir, `scene-${idx}.wav`);
    if (fs.existsSync(audioFile)) {
      audioPaths.set(i, `audio/scene-${idx}.wav`);
      found++;
    } else {
      console.log(`  scene-${idx}.wav — NOT FOUND (${scenes[i].label})`);
      missing++;
    }
  }
  console.log(`Audio: ${found} found, ${missing} missing (--skip-audio)`);
}

// ── Generate HTML ─────────────────────────────────────────────────────────────
const compositionId = path.basename(path.dirname(outAbs));
const scenesJson    = JSON.stringify(scenes);
const geojsonEmbed  = JSON.stringify(geojson);
const progressDots  = scenes.map((_, i) => `<div class="pd" id="pd-${i}"></div>`).join('\n    ');

const audioElements = [...audioPaths.entries()]
  .map(([i, relPath]) => {
    const audioStart = (OPENING + i * SCENE_DUR + T_CAROUSEL_IN).toFixed(2);
    const audioDur   = (CAR_DUR - 0.5).toFixed(2);
    return `  <audio id="narration-${i}" data-start="${audioStart}" data-duration="${audioDur}" data-track-index="1" src="${relPath}"></audio>`;
  })
  .join('\n');

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${videoTitle}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      width: 1920px; height: 1080px;
      overflow: hidden;
      background: #060e1f;
      font-family: Georgia, 'Times New Roman', serif;
    }

    #stage { width: 1920px; height: 1080px; position: relative; overflow: hidden; }

    #map-svg { position: absolute; top: 0; left: 0; }

    /* ── Full-screen carousel ────────────────────────────────────────── */
    #carousel {
      position: absolute; inset: 0;
      z-index: 10;
      background: #000;
      overflow: hidden; /* clips Ken Burns scale overflow */
    }
    .car-img {
      position: absolute; inset: 0;
      width: 100%; height: 100%;
      object-fit: cover; object-position: center;
      transform-origin: center center;
      will-change: transform;
    }
    #car-label {
      position: absolute; bottom: 0; left: 0; right: 0;
      background: linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.78) 45%);
      padding: 120px 96px 72px;
      pointer-events: none;
    }
    #car-type {
      font-size: 13px; color: #a7c957;
      text-transform: uppercase; letter-spacing: 0.28em;
      font-family: sans-serif; margin-bottom: 12px;
    }
    #car-name {
      font-size: 58px; font-weight: normal;
      color: #fff; letter-spacing: 0.04em;
      text-shadow: 0 2px 24px rgba(0,0,0,0.8);
      line-height: 1.1; margin-bottom: 10px;
    }
    #car-country {
      font-size: 20px; color: rgba(255,255,255,0.62);
      font-family: sans-serif; letter-spacing: 0.14em;
    }

    /* ── Question card ───────────────────────────────────────────────── */
    #question-card {
      position: absolute;
      bottom: 72px; left: 50%; transform: translateX(-50%);
      background: rgba(15, 30, 43, 0.92);
      border: 1.5px solid rgba(167, 201, 87, 0.3);
      border-radius: 20px;
      padding: 32px 52px 36px;
      text-align: center;
      min-width: 680px;
      z-index: 5;
      pointer-events: none;
    }
    #q-text {
      color: rgba(255,255,255,0.6);
      font-size: 20px;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      font-family: sans-serif;
      margin-bottom: 26px;
    }
    #options-container { display: flex; gap: 14px; justify-content: center; }
    .opt {
      padding: 13px 28px;
      border-radius: 10px;
      font-size: 19px;
      font-family: Georgia, serif;
      color: rgba(255,255,255,0.85);
      background: rgba(255,255,255,0.06);
      border: 1.5px solid rgba(255,255,255,0.14);
      min-width: 170px;
      text-align: center;
      letter-spacing: 0.01em;
      white-space: nowrap;
    }
    .opt.correct {
      background: rgba(74, 222, 128, 0.18);
      border-color: #4ade80;
      color: #4ade80;
    }

    /* ── Answer reveal ───────────────────────────────────────────────── */
    #answer-reveal {
      position: absolute;
      bottom: 72px; left: 50%; transform: translateX(-50%);
      z-index: 5;
      pointer-events: none;
    }
    #answer-badge {
      background: rgba(74, 222, 128, 0.12);
      border: 2px solid #4ade80;
      border-radius: 14px;
      padding: 20px 60px;
    }
    #answer-name {
      font-size: 38px;
      color: #4ade80;
      letter-spacing: 0.04em;
      white-space: nowrap;
    }

    /* ── Title card ──────────────────────────────────────────────────── */
    #title-card {
      position: absolute; bottom: 90px; left: 90px;
      color: white; z-index: 5; pointer-events: none;
    }
    #title-card h1 {
      font-size: 56px; font-weight: normal;
      letter-spacing: 0.06em;
      text-shadow: 0 2px 30px rgba(0,0,0,0.9);
    }
    #title-card p {
      font-size: 18px; opacity: 0.6;
      margin-top: 10px; letter-spacing: 0.22em;
      text-transform: uppercase; font-family: sans-serif;
    }

    /* ── Progress dots — above carousel ─────────────────────────────── */
    #progress {
      position: absolute; top: 36px; left: 50%; transform: translateX(-50%);
      display: flex; gap: 10px; z-index: 20; pointer-events: none;
    }
    .pd {
      width: 9px; height: 9px; border-radius: 50%;
      background: rgba(255,255,255,0.22);
    }
  </style>
</head>
<body>
<div id="stage"
     data-composition-id="${compositionId}"
     data-start="0"
     data-duration="${TOTAL_DUR}"
     data-width="1920"
     data-height="1080">

  <!-- Map (zooms into location before carousel fades in) -->
  <svg id="map-svg" width="1920" height="1080" viewBox="0 0 1920 1080"
       class="clip" data-start="0" data-duration="${TOTAL_DUR}" data-track-index="0">
    <defs>
      <radialGradient id="oceanGrad" cx="50%" cy="50%" r="75%">
        <stop offset="0%"   stop-color="#0d2048"/>
        <stop offset="100%" stop-color="#060e1f"/>
      </radialGradient>
      <radialGradient id="vigGrad" cx="50%" cy="50%" r="75%">
        <stop offset="44%"  stop-color="transparent"/>
        <stop offset="100%" stop-color="rgba(0,0,0,0.52)"/>
      </radialGradient>
    </defs>
    <rect width="1920" height="1080" fill="url(#oceanGrad)"/>
    <g id="map-group" style="opacity:0"></g>
    <!-- Pulse ring — fires as zoom lands on the location -->
    <g id="pulse-grp" opacity="0">
      <circle id="pulse-c" cx="960" cy="540" r="0.8"
              fill="none" stroke="#ff6b35" stroke-width="0.3"/>
    </g>
    <!-- Active dot -->
    <circle id="active-dot" cx="960" cy="540" r="0.6" fill="#ff6b35" opacity="0"/>
    <rect width="1920" height="1080" fill="url(#vigGrad)" pointer-events="none"/>
  </svg>

  <!-- Full-screen image carousel (covers map during location reveal) -->
  <div id="carousel" style="opacity:0">
    <img id="car-img-0" class="car-img" src="" alt=""/>
    <img id="car-img-1" class="car-img" src="" alt="" style="opacity:0"/>
    <img id="car-img-2" class="car-img" src="" alt="" style="opacity:0"/>
    <img id="car-img-3" class="car-img" src="" alt="" style="opacity:0"/>
    <img id="car-img-4" class="car-img" src="" alt="" style="opacity:0"/>
    <div id="car-label">
      <div id="car-type"></div>
      <div id="car-name"></div>
      <div id="car-country"></div>
    </div>
  </div>

  <!-- Title card -->
  <div id="title-card" style="opacity:0">
    <h1>${videoTitle}</h1>
    <p>Can you name these parks?</p>
  </div>

  <!-- Progress dots (always above carousel) -->
  <div id="progress">
    ${progressDots}
  </div>

  <!-- Question card -->
  <div id="question-card" style="opacity:0">
    <div id="q-text">Where is this national park?</div>
    <div id="options-container">
      <div class="opt" id="opt-0"></div>
      <div class="opt" id="opt-1"></div>
      <div class="opt" id="opt-2"></div>
    </div>
  </div>

  <!-- Answer reveal -->
  <div id="answer-reveal" style="opacity:0">
    <div id="answer-badge">
      <div id="answer-name"></div>
    </div>
  </div>

  <!-- Narration audio: starts as carousel fades in -->
${audioElements}

</div>

<script src="https://d3js.org/d3.v7.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>

<script>
(async () => {
  const W = 1920, H = 1080;
  const SCENES    = ${scenesJson};
  const PARKS_GEO = ${geojsonEmbed};
  const SCENE_DUR = ${SCENE_DUR};
  const OPENING   = ${OPENING};
  const TW = 14, TH = 20;

  const BG_ISO = new Set(['${bgIsoSet}']);
  const FIT = {
    type: 'Feature',
    geometry: { type: 'MultiPoint', coordinates: ${fitCoords} },
    properties: null,
  };
  const projection = d3.geoMercator().fitExtent([[80, 40], [1340, H - 40]], FIT);
  const pathGen    = d3.geoPath().projection(projection);

  const markerPos = {};
  for (const f of PARKS_GEO.features) {
    const key = (f.id ?? f.properties?.regionKey ?? '').trim();
    const pt  = projection(f.geometry.coordinates);
    if (pt) markerPos[key] = { x: pt[0], y: pt[1] };
  }

  // Fetch Natural Earth background
  const NE_URL = 'https://d2ad6b4ur7yvpq.cloudfront.net/naturalearth-3.3.0/ne_50m_admin_0_countries.geojson';
  const neData = await fetch(NE_URL).then(r => r.json());
  const bgFeatures = neData.features.filter(f => {
    const iso = f.properties?.iso_a2_eh ?? f.properties?.iso_a2 ?? '';
    return BG_ISO.has(iso) && f.geometry;
  });

  const g = d3.select('#map-group');
  g.append('path')
    .datum(d3.geoGraticule()())
    .attr('fill', 'none').attr('stroke', '#0e2650').attr('stroke-width', 0.4)
    .attr('d', pathGen);
  for (const f of bgFeatures) {
    const d = pathGen(f);
    if (d) g.append('path').attr('d', d)
      .attr('fill', '#3a7a4a').attr('stroke', '#2d6038').attr('stroke-width', 0.4);
  }
  for (const f of PARKS_GEO.features) {
    const key = (f.id ?? f.properties?.regionKey ?? '').trim();
    const pos = markerPos[key];
    if (!pos) continue;
    const { x: cx, y: cy } = pos;
    const d = \`M\${cx},\${cy + TH*0.45} L\${cx-TW},\${cy-TH*0.55} L\${cx+TW},\${cy-TH*0.55} Z\`;
    g.append('path')
      .attr('id', 'mk-' + key.replace(/[^a-zA-Z0-9_-]/g, '_'))
      .attr('class', 'park-marker')
      .attr('d', d)
      .attr('fill', '#c8d8b4').attr('stroke', '#6b7c52').attr('stroke-width', 1.5);
  }

  function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val || '';
  }
  function markerId(key) { return 'mk-' + key.replace(/[^a-zA-Z0-9_-]/g, '_'); }
  function getMarker(key) { return document.getElementById(markerId(key)); }
  function setAllMarkersDefault() {
    document.querySelectorAll('.park-marker').forEach(el => {
      el.setAttribute('fill', '#c8d8b4');
      el.setAttribute('stroke', '#6b7c52');
      el.style.opacity = '1';
    });
  }

  // ── Ken Burns variants (deterministic, 4 directions) ──────────────────────
  // Scale stays ≥1.05 so image edges never show through carousel bounds.
  const KB = [
    { from: { scale: 1.05, xPercent:  1.5, yPercent:  0.5 }, to: { scale: 1.10, xPercent: -1.5, yPercent: -1.0 } },
    { from: { scale: 1.10, xPercent: -1.5, yPercent: -1.0 }, to: { scale: 1.05, xPercent:  1.5, yPercent:  0.5 } },
    { from: { scale: 1.05, xPercent: -1.0, yPercent:  1.5 }, to: { scale: 1.10, xPercent:  1.0, yPercent: -1.5 } },
    { from: { scale: 1.10, xPercent:  1.0, yPercent:  1.0 }, to: { scale: 1.05, xPercent: -1.5, yPercent: -0.5 } },
  ];

  // ── GSAP Timeline ──────────────────────────────────────────────────────────
  const tl = gsap.timeline({ paused: true });

  // Opening
  tl.to('#map-group',  { opacity: 1, duration: 1.5, ease: 'power1.inOut' }, 0);
  tl.to('#title-card', { opacity: 1, duration: 1.2, ease: 'power1.inOut' }, 0.6);
  tl.to('#title-card', { opacity: 0, duration: 0.8, ease: 'power1.in'    }, 3.2);

  // viewBox zoom helpers (same seek-safe approach as gen-map-video.js)
  const ZOOM = 10, ZW = W / 10, ZH = H / 10;
  function viewBoxZoomed(key) {
    const pos = markerPos[key];
    if (!pos) return '0 0 1920 1080';
    const zX = Math.max(0, Math.min(W - ZW, pos.x - ZW / 2));
    const zY = Math.max(0, Math.min(H - ZH, pos.y - ZH / 2));
    return \`\${zX} \${zY} \${ZW} \${ZH}\`;
  }

  SCENES.forEach((scene, i) => {
    const t      = OPENING + i * SCENE_DUR;
    const vb     = viewBoxZoomed(scene.regionKey);
    const T_QI   = ${T_QUESTION_IN};
    const T_QO   = ${T_QUESTION_OUT};
    const T_RI   = ${T_REVEAL_IN};
    const T_RO   = ${T_REVEAL_OUT};
    const T_ZS   = ${T_ZOOM_START};
    const T_ZL   = ${T_ZOOM_LAND};
    const T_CI   = ${T_CAROUSEL_IN};
    const T_CO   = ${T_CAROUSEL_OUT};
    const T_ZO   = ${T_ZOOM_OUT};
    const carDur = T_CO - T_CI;

    const imgCount    = Math.min(scene.images.length, 5);
    const imgInterval = imgCount > 1 ? carDur / imgCount : carDur;

    // ─ Setup ─────────────────────────────────────────────────────────────────
    tl.call(() => {
      ['opt-0','opt-1','opt-2'].forEach((id, j) => {
        const el = document.getElementById(id);
        if (el) { el.textContent = scene.options[j] || ''; el.className = 'opt'; }
      });
      setText('answer-name', scene.label);
      setText('car-type',    scene.typeLabel || 'National Park');
      setText('car-name',    scene.label);
      setText('car-country', scene.country);
      for (let j = 0; j < 5; j++) {
        const img = document.getElementById('car-img-' + j);
        if (!img) continue;
        img.src = scene.images[j] || '';
        gsap.set(img, { opacity: j === 0 ? 1 : 0 });
      }
      document.querySelectorAll('.pd').forEach((d, j) => {
        d.style.background = j < i ? '#4ade80' : j === i ? '#fbbf24' : 'rgba(255,255,255,0.22)';
      });
      setAllMarkersDefault();
      const mk = getMarker(scene.regionKey);
      if (mk) { mk.setAttribute('fill', '#fbbf24'); mk.setAttribute('stroke', '#d97706'); }
    }, [], t);

    // ─ Question card in/out ───────────────────────────────────────────────────
    tl.to('#question-card', { opacity: 1, duration: 0.7, ease: 'power1.inOut', overwrite: 'auto' }, t + T_QI);
    tl.to('#question-card', { opacity: 0, duration: 0.5, ease: 'power1.in',    overwrite: 'auto' }, t + T_QO);

    // ─ Answer reveal ─────────────────────────────────────────────────────────
    tl.call(() => {
      const el = document.getElementById('opt-' + scene.correctIndex);
      if (el) el.className = 'opt correct';
    }, [], t + T_RI - 0.05);
    tl.to('#answer-reveal', { opacity: 1, duration: 0.6, ease: 'power1.inOut', overwrite: 'auto' }, t + T_RI);
    tl.call(() => {
      const mk = getMarker(scene.regionKey);
      if (mk) { mk.setAttribute('fill', '#4ade80'); mk.setAttribute('stroke', '#15803d'); }
    }, [], t + T_RI);
    tl.to('#answer-reveal', { opacity: 0, duration: 0.5, ease: 'power1.in', overwrite: 'auto' }, t + T_RO);

    // ─ Map zoom in (viewBox shrink, seek-safe) ────────────────────────────────
    tl.to('#map-svg', { attr: { viewBox: vb }, duration: 4, ease: 'power2.inOut' }, t + T_ZS);
    tl.call(() => {
      document.querySelectorAll('.park-marker').forEach(el => {
        if (el.id !== markerId(scene.regionKey)) el.style.opacity = '0';
      });
      const pos = markerPos[scene.regionKey];
      ['pulse-c','active-dot'].forEach(id => {
        const el = document.getElementById(id);
        if (el && pos) { el.setAttribute('cx', pos.x); el.setAttribute('cy', pos.y); }
      });
    }, [], t + T_ZS);
    // Pulse fires as zoom lands
    tl.to('#active-dot', { opacity: 1, duration: 0.3, ease: 'power2.out', overwrite: 'auto' }, t + T_ZL + 0.2);
    tl.set('#pulse-c', { attr: { r: 0.8 }, opacity: 0 }, t + T_ZL + 0.3);
    tl.to('#pulse-grp', { opacity: 1, duration: 0.05 }, t + T_ZL + 0.3);
    tl.to('#pulse-c', { attr: { r: 5 }, opacity: 0, duration: 1.5, ease: 'power1.out' }, t + T_ZL + 0.4);

    // ─ Carousel crossfades over the zoomed map ────────────────────────────────
    tl.to('#carousel', { opacity: 1, duration: 0.9, ease: 'power1.inOut', overwrite: 'auto' }, t + T_CI);

    // ─ Image crossfades + Ken Burns (seek-safe: all on main timeline) ──────────
    for (let j = 0; j < imgCount; j++) {
      const switchAt  = t + T_CI + j * imgInterval;
      const switchEnd = j === imgCount - 1 ? t + T_CO : t + T_CI + (j + 1) * imgInterval;
      const kbDur     = switchEnd - switchAt;
      const kb        = KB[(i * 5 + j) % KB.length];

      // Opacity crossfade (skip for image 0 — already set up in setup call)
      if (j > 0) {
        tl.to('#car-img-' + (j - 1), { opacity: 0, duration: 0.9, ease: 'power1.inOut', overwrite: 'auto' }, switchAt);
        tl.to('#car-img-' + j,       { opacity: 1, duration: 0.9, ease: 'power1.inOut', overwrite: 'auto' }, switchAt);
      }

      // Ken Burns: slow zoom + drift for the duration this image is on screen
      if (scene.images[j]) {
        tl.fromTo('#car-img-' + j,
          { scale: kb.from.scale, xPercent: kb.from.xPercent, yPercent: kb.from.yPercent },
          { scale: kb.to.scale,   xPercent: kb.to.xPercent,   yPercent: kb.to.yPercent,
            duration: kbDur, ease: 'none', overwrite: 'auto' },
          switchAt
        );
      }
    }

    // ─ Carousel out + map zooms back simultaneously ───────────────────────────
    tl.to('#carousel',   { opacity: 0, duration: 0.9, ease: 'power1.in', overwrite: 'auto' }, t + T_CO);
    tl.to('#active-dot', { opacity: 0, duration: 0.2, overwrite: 'auto' }, t + T_CO);
    tl.set('#pulse-c',   { attr: { r: 0.8 } }, t + T_CO + 0.1);
    tl.to('#map-svg', { attr: { viewBox: '0 0 1920 1080' }, duration: 2, ease: 'power2.inOut' }, t + T_ZO);
    // Reset image transforms and opacity for next scene
    for (let j = 0; j < 5; j++) {
      tl.set('#car-img-' + j, { opacity: j === 0 ? 1 : 0, scale: 1, xPercent: 0, yPercent: 0 }, t + T_ZO + 2.1);
    }
    tl.call(setAllMarkersDefault, [], t + T_ZO + 2.1);
  });

  // Final: all progress dots green
  tl.call(() => {
    document.querySelectorAll('.pd').forEach(d => { d.style.background = '#4ade80'; });
  }, [], OPENING + SCENES.length * SCENE_DUR);

  tl.to({}, { duration: 2 }, OPENING + SCENES.length * SCENE_DUR);

  window.__timelines = window.__timelines || {};
  window.__timelines['${compositionId}'] = tl;
})();
</script>
</body>
</html>`;

// ── Write output ──────────────────────────────────────────────────────────────
fs.mkdirSync(path.dirname(outAbs), { recursive: true });
fs.writeFileSync(outAbs, html, 'utf-8');

const mins = Math.floor(TOTAL_DUR / 60);
const secs = Math.round(TOTAL_DUR % 60);
console.log(`\nWritten: ${outputPath}`);
console.log(`Scenes:  ${scenes.length} × ${SCENE_DUR}s = ${scenes.length * SCENE_DUR}s + ${OPENING}s opening`);
console.log(`Total:   ~${TOTAL_DUR}s (${mins}m ${secs}s)`);
console.log(`Images:  up to 5 per scene, ${(CAR_DUR / 1).toFixed(1)}s carousel window`);
if (audioPaths.size > 0) console.log(`Audio:   ${audioPaths.size}/${scenes.length} scenes`);
console.log(`\nNext steps:`);
console.log(`  npx hyperframes browser ensure`);
console.log(`  npx hyperframes preview ${path.dirname(outputPath)}`);
console.log(`  npx hyperframes render ${path.dirname(outputPath)} --fps=30`);

})().catch(err => {
  console.error('\nError:', err.message);
  process.exit(1);
});
