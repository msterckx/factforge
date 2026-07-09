#!/usr/bin/env node
'use strict';
/**
 * gen-map-video.js
 * Generates a HyperFrames HTML composition for a map quiz YouTube video.
 *
 * Usage:
 *   node scripts/gen-map-video.js \
 *     --regions=path/to/regions.json \
 *     --geojson=public/maps/south_america_parks_20260504.geojson \
 *     --output=videos/map-challenge/sa-parks/index.html \
 *     --title="South American National Parks" \
 *     --bg=south_america
 *
 * Options:
 *   --regions   Path to exported regions JSON (required)
 *   --geojson   Path to parks GeoJSON with Point features (required)
 *   --output    Output HTML path (default: videos/map-video/index.html)
 *   --title     Video title shown on opening card (default: "National Parks Quiz")
 *   --bg        Background continent preset: south_america | africa | north_america (default: south_america)
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
const outputPath  = args.output  || args.o || 'videos/map-video/index.html';
const videoTitle  = args.title   || 'National Parks Quiz';
const bgPreset    = args.bg      || 'south_america';

if (!regionsPath || !geojsonPath) {
  console.error([
    'Usage: node scripts/gen-map-video.js \\',
    '  --regions=regions.json \\',
    '  --geojson=public/maps/south_america_parks_20260504.geojson \\',
    '  --output=videos/map-challenge/sa-parks/index.html \\',
    '  --title="South American National Parks" \\',
    '  --bg=south_america',
  ].join('\n'));
  process.exit(1);
}

// ── Load data ──────────────────────────────────────────────────────────────────
const allRegions = JSON.parse(fs.readFileSync(path.resolve(regionsPath), 'utf-8'));
const geojson    = JSON.parse(fs.readFileSync(path.resolve(geojsonPath), 'utf-8'));

// Match enabled regions → GeoJSON features (trim stray whitespace from keys)
const geoMap = new Map(
  geojson.features.map(f => [
    (f.id ?? f.properties?.regionKey ?? '').trim(),
    f,
  ])
);

const regions = allRegions
  .filter(r => r.enabled)
  .map(r => ({ ...r, regionKey: r.regionKey.trim() }))
  .filter(r => geoMap.has(r.regionKey));

if (regions.length === 0) {
  console.error('No enabled regions matched GeoJSON features. Check --regions and --geojson paths.');
  console.error('GeoJSON keys:', [...geoMap.keys()].join(', '));
  process.exit(1);
}

console.log(`Building video for ${regions.length} parks:`);
regions.forEach(r => console.log(`  • ${r.labelEn} (${r.regionKey})`));

// ── Build scene data ───────────────────────────────────────────────────────────
function parseInfograph(str) {
  if (!str) return null;
  try { return JSON.parse(str); } catch { return null; }
}

function extractInfographFields(ig) {
  if (!ig) return {};
  // New flexible format: ig.fields[] array
  if (Array.isArray(ig.fields)) {
    const m = {};
    for (const f of ig.fields) m[f.label.toLowerCase()] = f.value;
    return m;
  }
  // Legacy format: direct properties
  return {
    area:        ig.area,
    established: ig.established,
    landscape:   ig.landscape,
    wildlife:    ig.wildlife,
  };
}

// Generate wrong answer options: pick 2 others from the enabled pool,
// varied by position so each scene gets a different pair.
function getWrongOptions(regionKey, allEnabled, sceneIndex) {
  const others = allEnabled.filter(r => r.regionKey !== regionKey);
  // Sort deterministically then offset by scene index
  const sorted = [...others].sort((a, b) => a.labelEn.localeCompare(b.labelEn));
  const a = sorted[sceneIndex % sorted.length];
  const b = sorted[(sceneIndex + Math.ceil(sorted.length / 2)) % sorted.length];
  // If a===b (only 1 or 2 regions), fall back
  const pair = a.regionKey === b.regionKey ? [a, sorted[(sceneIndex + 1) % sorted.length]] : [a, b];
  return pair.map(r => r.labelEn);
}

const scenes = regions.map((r, i) => {
  const geoFeature = geoMap.get(r.regionKey);
  const [lon, lat] = geoFeature.geometry.coordinates;
  const wrong = getWrongOptions(r.regionKey, regions, i);
  // Rotate the correct answer to different option slots for visual variety
  const correctSlot = i % 3;
  const opts = [...wrong];
  opts.splice(correctSlot, 0, r.labelEn);

  const ig = parseInfograph(r.infographData);
  const fields = extractInfographFields(ig);

  return {
    regionKey:   r.regionKey,
    label:       r.labelEn,
    options:     opts,
    correctIndex: correctSlot,
    infoText:    (r.infoTextEn || '').slice(0, 220),
    country:     ig?.country    || '',
    typeLabel:   ig?.typeLabel  || 'National Park',
    area:        fields.area        || ig?.area        || '',
    established: fields.established || ig?.established || '',
    landscape:   fields.landscape   || ig?.landscape   || '',
    wildlife:    fields.wildlife    || ig?.wildlife     || '',
    images:      (ig?.images || []).filter(Boolean).slice(0, 3),
    lon,
    lat,
  };
});

// ── Background ISO sets ────────────────────────────────────────────────────────
const BG_ISO = {
  south_america: ['BR','AR','CL','CO','VE','PE','BO','PY','UY','EC','GY','SR','FK','PA','CR','GF','BQ','CW','AW','TT','SX','BB','LC','VC','GD'],
  africa:        ['ZA','NA','BW','ZW','ZM','TZ','KE','UG','RW','BI','CD','AO','MZ','MG','MW','SO','ET','ER','DJ','SD','SS','CF','CG','GA','CM','NG','GH','CI','SN','GN','SL','LR','TG','BJ','NE','ML','BF','MR','GM','GW','TD','LY','DZ','MA','TN','EG','MU'],
  north_america: ['US','CA','MX','GT','BZ','HN','SV','NI','CR','PA','CU','HT','DO','JM','GL'],
};

// Bounding boxes [minLon, minLat, maxLon, maxLat] for each continent
const BG_BOUNDS = {
  south_america: [[-84, -56], [1380, 1040]], // SVG fitExtent: [topLeft, bottomRight] padding
  africa:        [[-20, -35], [52,  38]],
  north_america: [[-170, 5], [-50, 84]],
};

// fitExtent SVG coordinates (with padding) — we'll use these as MultiPoint corners
const FIT_COORDS = {
  south_america: [[-84, 14], [-34, -57], [-84, -57], [-34, 14]],
  africa:        [[-20, 38], [52, -35],  [-20, -35], [52, 38]],
  north_america: [[-170, 84], [-50, 5],  [-170, 5],  [-50, 84]],
};

const bgIsoSet = (BG_ISO[bgPreset] || BG_ISO.south_america).join("','");
const fitCoords = JSON.stringify(FIT_COORDS[bgPreset] || FIT_COORDS.south_america);

// ── Timing constants (seconds) ─────────────────────────────────────────────────
const SCENE_DUR      = 26;   // total per scene
const OPENING        = 4;    // duration of opening title before first scene
const T_QUESTION_IN  = 0.5;
const T_QUESTION_OUT = 5.5;
const T_REVEAL_IN    = 6.2;
const T_REVEAL_OUT   = 9.8;
const T_ZOOM_START   = 10.5;
const T_INFOGRAPH_IN = 14.5;
const IMG_DUR        = 2.5;  // seconds per image in slideshow
const T_INFOGRAPH_OUT= 22.0;
const T_ZOOM_OUT     = 22.5;
const TOTAL_DUR      = OPENING + scenes.length * SCENE_DUR + 2;

const compositionId  = path.basename(path.dirname(path.resolve(outputPath)));
const scenesJson     = JSON.stringify(scenes);
const geojsonEmbed   = JSON.stringify(geojson);

// ── Generate HTML ──────────────────────────────────────────────────────────────
const progressDots = scenes.map((_, i) => `<div class="pd" id="pd-${i}"></div>`).join('\n    ');

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

    /* ── Infograph panel ─────────────────────────────────────────────── */
    #infograph-panel {
      position: absolute;
      top: 72px; right: 80px;
      width: 540px;
      border-radius: 20px;
      overflow: hidden;
      background: #0f1e2b;
      border: 1px solid rgba(167, 201, 87, 0.2);
      box-shadow: 0 20px 60px rgba(0,0,0,0.75);
      display: flex;
      flex-direction: column;
      pointer-events: none;
    }
    #infograph-image-wrap {
      width: 100%; height: 330px; flex-shrink: 0;
      overflow: hidden; background: #0a131c;
    }
    #infograph-img {
      width: 100%; height: 100%;
      object-fit: cover; object-position: center;
      transition: opacity 0.5s;
    }
    #infograph-data { padding: 26px 30px 28px; color: white; }
    .ig-tag {
      font-size: 11px; color: #a7c957;
      text-transform: uppercase; letter-spacing: 0.25em;
      font-family: sans-serif; margin-bottom: 6px;
    }
    #ig-name {
      font-size: 22px; font-weight: bold;
      color: white; line-height: 1.2; margin-bottom: 16px;
    }
    .ig-field { margin-bottom: 10px; }
    .ig-label {
      font-size: 10px; color: rgba(255,255,255,0.4);
      text-transform: uppercase; letter-spacing: 0.2em;
      font-family: sans-serif; margin-bottom: 3px;
    }
    .ig-value {
      font-size: 13px; color: rgba(255,255,255,0.82);
      font-family: sans-serif; line-height: 1.4;
    }
    #ig-description {
      margin-top: 14px; padding-top: 14px;
      border-top: 1px solid rgba(255,255,255,0.08);
      font-size: 11.5px; color: rgba(255,255,255,0.48);
      font-family: sans-serif; line-height: 1.65;
    }

    /* ── Title card ──────────────────────────────────────────────────── */
    #title-card {
      position: absolute; bottom: 90px; left: 90px;
      color: white; pointer-events: none;
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

    /* ── Progress dots ───────────────────────────────────────────────── */
    #progress {
      position: absolute; top: 36px; left: 50%; transform: translateX(-50%);
      display: flex; gap: 10px; pointer-events: none;
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
     data-width="1920"
     data-height="1080">

  <!-- Map SVG -->
  <svg id="map-svg" width="1920" height="1080"
       data-start="0" data-duration="${TOTAL_DUR}" data-track-index="0">
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
    <!-- D3 renders continent land + park triangles into map-group -->
    <g id="map-group" style="opacity:0"></g>
    <!-- Pulse ring (screen-space, always at screen center 960,540) -->
    <g id="pulse-grp" opacity="0">
      <circle id="pulse-c" cx="960" cy="540" r="8"
              fill="none" stroke="#ff6b35" stroke-width="3"/>
    </g>
    <!-- Active dot (screen-space, screen centre) -->
    <circle id="active-dot" cx="960" cy="540" r="6" fill="#ff6b35" opacity="0"/>
    <!-- Edge vignette -->
    <rect width="1920" height="1080" fill="url(#vigGrad)" pointer-events="none"/>
  </svg>

  <!-- Title card -->
  <div id="title-card" style="opacity:0">
    <h1>${videoTitle}</h1>
    <p>Can you name these parks?</p>
  </div>

  <!-- Progress dots -->
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

  <!-- Infograph panel -->
  <div id="infograph-panel" style="opacity:0">
    <div id="infograph-image-wrap">
      <img id="infograph-img" src="" alt=""/>
    </div>
    <div id="infograph-data">
      <div class="ig-tag" id="ig-type-label"></div>
      <h2 id="ig-name"></h2>
      <div class="ig-field">
        <div class="ig-label">Country</div>
        <div class="ig-value" id="ig-country"></div>
      </div>
      <div class="ig-field">
        <div class="ig-label">Area</div>
        <div class="ig-value" id="ig-area"></div>
      </div>
      <div class="ig-field">
        <div class="ig-label">Established</div>
        <div class="ig-value" id="ig-established"></div>
      </div>
      <div class="ig-field">
        <div class="ig-label">Landscape</div>
        <div class="ig-value" id="ig-landscape"></div>
      </div>
      <div class="ig-field">
        <div class="ig-label">Wildlife</div>
        <div class="ig-value" id="ig-wildlife"></div>
      </div>
      <p id="ig-description"></p>
    </div>
  </div>

</div>

<!-- CDN dependencies -->
<script src="https://d3js.org/d3.v7.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>

<script>
(async () => {
  const W = 1920, H = 1080;
  const SCENES      = ${scenesJson};
  const PARKS_GEO   = ${geojsonEmbed};
  const SCENE_DUR   = ${SCENE_DUR};
  const OPENING     = ${OPENING};
  const TW = 14, TH = 20; // triangle marker half-width, height

  // ── Background ISO set ────────────────────────────────────────────────────
  const BG_ISO = new Set(['${bgIsoSet}']);

  // ── Projection: fit continent into left ~70% of frame ────────────────────
  const FIT = {
    type: 'Feature',
    geometry: { type: 'MultiPoint', coordinates: ${fitCoords} },
    properties: null,
  };
  const projection = d3.geoMercator().fitExtent([[80, 40], [1340, H - 40]], FIT);
  const pathGen    = d3.geoPath().projection(projection);

  // Projected screen positions for each park marker
  const markerPos = {};
  for (const f of PARKS_GEO.features) {
    const key = (f.id ?? f.properties?.regionKey ?? '').trim();
    const pt  = projection(f.geometry.coordinates);
    if (pt) markerPos[key] = { x: pt[0], y: pt[1] };
  }

  // ── Fetch Natural Earth background ────────────────────────────────────────
  const NE_URL = 'https://d2ad6b4ur7yvpq.cloudfront.net/naturalearth-3.3.0/ne_50m_admin_0_countries.geojson';
  const neData = await fetch(NE_URL).then(r => r.json());
  const bgFeatures = neData.features.filter(f => {
    const iso = f.properties?.iso_a2_eh ?? f.properties?.iso_a2 ?? '';
    return BG_ISO.has(iso) && f.geometry;
  });

  // ── Render background + markers into map-group ────────────────────────────
  const g = d3.select('#map-group');

  // Graticule
  g.append('path')
    .datum(d3.geoGraticule()())
    .attr('fill', 'none').attr('stroke', '#0e2650').attr('stroke-width', 0.4)
    .attr('d', pathGen);

  // Continent land
  for (const f of bgFeatures) {
    const d = pathGen(f);
    if (d) g.append('path').attr('d', d)
      .attr('fill', '#3a7a4a').attr('stroke', '#2d6038').attr('stroke-width', 0.4);
  }

  // Park triangle markers (downward-pointing, same shape as web app)
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

  // ── DOM helpers ────────────────────────────────────────────────────────────
  function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val || '';
  }
  function markerId(key) {
    return 'mk-' + key.replace(/[^a-zA-Z0-9_-]/g, '_');
  }
  function getMarker(key) {
    return document.getElementById(markerId(key));
  }
  function setAllMarkersDefault() {
    document.querySelectorAll('.park-marker').forEach(el => {
      el.setAttribute('fill', '#c8d8b4');
      el.setAttribute('stroke', '#6b7c52');
      el.style.opacity = '1';
    });
  }

  // ── Zoom maths ─────────────────────────────────────────────────────────────
  // With svgOrigin "0 0": scale(Z) maps (px,py) → (px*Z, py*Z).
  // Adding translate(TX,TY) centres it on screen.
  const ZOOM = 10;
  function zoomParams(key) {
    const pos = markerPos[key];
    if (!pos) return { x: 0, y: 0, scale: 1 };
    return { x: W/2 - pos.x * ZOOM, y: H/2 - pos.y * ZOOM, scale: ZOOM };
  }

  // ── GSAP Timeline ──────────────────────────────────────────────────────────
  const tl = gsap.timeline({ paused: true });

  // Opening: map fades in, title appears then leaves
  tl.to('#map-group',  { opacity: 1, duration: 1.5, ease: 'power1.inOut' }, 0);
  tl.to('#title-card', { opacity: 1, duration: 1.2, ease: 'power1.inOut' }, 0.6);
  tl.to('#title-card', { opacity: 0, duration: 0.8, ease: 'power1.in'    }, 3.2);

  // ── Per-scene tweens ────────────────────────────────────────────────────────
  SCENES.forEach((scene, i) => {
    const t  = OPENING + i * SCENE_DUR;
    const z  = zoomParams(scene.regionKey);
    const T_QI  = ${T_QUESTION_IN};
    const T_QO  = ${T_QUESTION_OUT};
    const T_RI  = ${T_REVEAL_IN};
    const T_RO  = ${T_REVEAL_OUT};
    const T_ZS  = ${T_ZOOM_START};
    const T_IGI = ${T_INFOGRAPH_IN};
    const T_IGO = ${T_INFOGRAPH_OUT};
    const T_ZO  = ${T_ZOOM_OUT};
    const IDUR  = ${IMG_DUR};

    // ─ Setup: populate DOM, reset markers, highlight active ─────────────────
    tl.call(() => {
      // Options
      ['opt-0','opt-1','opt-2'].forEach((id, j) => {
        const el = document.getElementById(id);
        if (el) { el.textContent = scene.options[j] || ''; el.className = 'opt'; }
      });
      // Answer badge
      setText('answer-name', scene.label);
      // Infograph
      setText('ig-type-label', scene.typeLabel || 'National Park');
      setText('ig-name',        scene.label);
      setText('ig-country',     scene.country);
      setText('ig-area',        scene.area);
      setText('ig-established', scene.established);
      setText('ig-landscape',   scene.landscape);
      setText('ig-wildlife',    scene.wildlife);
      setText('ig-description', scene.infoText);
      // First image
      const imgEl = document.getElementById('infograph-img');
      if (imgEl && scene.images.length > 0) imgEl.src = scene.images[0];
      // Progress dots
      document.querySelectorAll('.pd').forEach((d, j) => {
        d.style.background = j < i ? '#4ade80' : j === i ? '#fbbf24' : 'rgba(255,255,255,0.22)';
      });
      // Markers: all default, active = amber
      setAllMarkersDefault();
      const mk = getMarker(scene.regionKey);
      if (mk) { mk.setAttribute('fill', '#fbbf24'); mk.setAttribute('stroke', '#d97706'); }
    }, [], t);

    // ─ Question card in ──────────────────────────────────────────────────────
    tl.to('#question-card', { opacity: 1, duration: 0.7, ease: 'power1.inOut' }, t + T_QI);

    // ─ Question card out ─────────────────────────────────────────────────────
    tl.to('#question-card', { opacity: 0, duration: 0.5, ease: 'power1.in' }, t + T_QO);

    // ─ Mark correct option, reveal answer ───────────────────────────────────
    tl.call(() => {
      const el = document.getElementById('opt-' + scene.correctIndex);
      if (el) el.className = 'opt correct';
    }, [], t + T_RI - 0.05);
    tl.to('#answer-reveal', { opacity: 1, duration: 0.6, ease: 'power1.inOut' }, t + T_RI);
    tl.call(() => {
      const mk = getMarker(scene.regionKey);
      if (mk) { mk.setAttribute('fill', '#4ade80'); mk.setAttribute('stroke', '#15803d'); }
    }, [], t + T_RI);

    // ─ Answer reveal out ─────────────────────────────────────────────────────
    tl.to('#answer-reveal', { opacity: 0, duration: 0.5, ease: 'power1.in' }, t + T_RO);

    // ─ Zoom in ───────────────────────────────────────────────────────────────
    tl.to('#map-group', {
      svgOrigin: '0 0', x: z.x, y: z.y, scale: z.scale,
      duration: 4, ease: 'power2.inOut',
    }, t + T_ZS);
    // Hide non-active markers so they don't clutter the zoomed view
    tl.call(() => {
      document.querySelectorAll('.park-marker').forEach(el => {
        if (el.id !== markerId(scene.regionKey)) el.style.opacity = '0';
      });
    }, [], t + T_ZS);
    // Active dot at screen centre appears as zoom lands
    tl.to('#active-dot', { opacity: 1, duration: 0.3, ease: 'power2.out' }, t + T_ZS + 4.2);
    // Pulse ring
    tl.set('#pulse-c', { attr: { r: 8 }, opacity: 0 }, t + T_ZS + 4.3);
    tl.to('#pulse-grp', { opacity: 1, duration: 0.05 }, t + T_ZS + 4.3);
    tl.to('#pulse-c', { attr: { r: 44 }, opacity: 0, duration: 1.5, ease: 'power1.out' }, t + T_ZS + 4.4);

    // ─ Infograph panel in ────────────────────────────────────────────────────
    tl.to('#infograph-panel', { opacity: 1, duration: 0.7, ease: 'power2.out' }, t + T_IGI);

    // Image slideshow (up to 3 images)
    for (let j = 0; j < Math.min(scene.images.length, 3); j++) {
      const src = scene.images[j];
      if (j === 0) continue; // already set in setup call
      tl.call(((s) => () => {
        const el = document.getElementById('infograph-img');
        if (el) el.src = s;
      })(src), [], t + T_IGI + j * IDUR);
    }

    // ─ Infograph out ─────────────────────────────────────────────────────────
    tl.to('#infograph-panel', { opacity: 0, duration: 0.6, ease: 'power1.in' }, t + T_IGO);
    tl.to('#active-dot', { opacity: 0, duration: 0.2 }, t + T_IGO);
    tl.set('#pulse-c', { attr: { r: 8 } }, t + T_IGO + 0.1);

    // ─ Zoom out ──────────────────────────────────────────────────────────────
    tl.to('#map-group', {
      svgOrigin: '0 0', x: 0, y: 0, scale: 1,
      duration: 2, ease: 'power2.inOut',
    }, t + T_ZO);
    // Restore all markers after zoom-out completes
    tl.call(setAllMarkersDefault, [], t + T_ZO + 2);
  });

  // Final: all progress dots green
  tl.call(() => {
    document.querySelectorAll('.pd').forEach(d => { d.style.background = '#4ade80'; });
  }, [], OPENING + SCENES.length * SCENE_DUR);

  // Hold 2s at end
  tl.to({}, { duration: 2 }, OPENING + SCENES.length * SCENE_DUR);

  // ── Register with HyperFrames runtime ─────────────────────────────────────
  window.__timelines = window.__timelines || {};
  window.__timelines['${compositionId}'] = tl;
})();
</script>
</body>
</html>`;

// ── Write output ──────────────────────────────────────────────────────────────
const outAbs = path.resolve(outputPath);
fs.mkdirSync(path.dirname(outAbs), { recursive: true });
fs.writeFileSync(outAbs, html, 'utf-8');

const mins  = Math.floor(TOTAL_DUR / 60);
const secs  = Math.round(TOTAL_DUR % 60);
console.log(`\nWritten: ${outputPath}`);
console.log(`Scenes:  ${scenes.length} × ${SCENE_DUR}s = ${scenes.length * SCENE_DUR}s + ${OPENING}s opening`);
console.log(`Total:   ~${TOTAL_DUR}s (${mins}m ${secs}s)`);
console.log(`\nNext steps:`);
console.log(`  npx hyperframes browser ensure`);
console.log(`  npx hyperframes render ${outputPath} --fps=30`);
