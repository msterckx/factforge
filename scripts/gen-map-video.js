#!/usr/bin/env node
'use strict';
/**
 * gen-map-video.js
 * Map quiz video — after the answer is shown, the map cuts away to a
 * full-screen image slideshow of the location (a park with only one photo
 * just holds on it, no slideshow).
 *
 * Generates ONE independent HyperFrames composition per park (plus one for
 * the shared opening title card), instead of a single merged timeline — so
 * any one park's segment can be regenerated/re-rendered without touching the
 * others. Render each segment, then use scripts/concat-video-segments.js to
 * stitch the rendered clips into the final video.
 *
 * DB mode (recommended — reads directly from SQLite, no export step):
 *   node scripts/gen-map-video.js \
 *     --db=restore/remote_db/gameoftrivia.db \
 *     --game=south-america-parks \
 *     [--images-dir=path/to/images]
 *
 * JSON mode (legacy — requires prior DB export):
 *   node scripts/gen-map-video.js \
 *     --regions=map-regions-27.json \
 *     --geojson=public/maps/south_america_parks_20260504.geojson \
 *     --output=videos/map-challenge/sa-parks \
 *     --title="South American National Parks" \
 *     --bg=south_america
 *
 * Shared options:
 *   --output      Output base directory (DB mode default: videos/map-challenge/<slug>)
 *   --title       Video title (DB mode default: game title)
 *   --tagline     Opening title-card subtitle (default: "Can you name these parks?")
 *   --bg          Continent preset: south_america | africa | north_america (DB mode: auto-detected)
 *   --voice       Voice sample filename for RunPod TTS (default: celeste_48k_stereo.wav)
 *   --skip-audio  Skip TTS generation (reuses existing WAV files if present)
 *   --audio-only  Only generate/refresh narration audio, then exit (no HTML output)
 *   --force-audio Regenerate audio via RunPod TTS even if a cached WAV already
 *                 exists for it (in this video's own audio/ dir, or in the
 *                 durable audio store) — costs a fresh synthesis. Use with
 *                 --only to refresh one scene's clips.
 *   --refresh-audio  Re-sync this video's own audio/ cache from the durable
 *                 audio store even if a local WAV already exists — cheap (a
 *                 file copy, no synthesis), unlike --force-audio. Each
 *                 video's audio/ dir only ever fills in what's missing, so
 *                 after refreshing narration elsewhere (a different
 *                 --output, or --audio-only run against this same output
 *                 earlier), a regenerated segment can silently keep playing
 *                 a stale take unless you pass this.
 *   --images-dir  Local directory of hi-res images (overrides DB image URLs)
 *   --only        Comma list of region_key values (or numeric indices, or
 *                 "opening") to (re)write just those segments — everything
 *                 else on disk is left untouched. Omit to write every segment.
 *   --variant     "full" (default) — the single continuous per-park
 *                 composition with the on-screen answer panel/countdown,
 *                 meant for the concatenated YouTube upload. "web" — two
 *                 lighter compositions per park instead of one ("-question"
 *                 and "-reveal"), with the answer panel/countdown omitted
 *                 entirely (a real web quiz UI supplies its own buttons and
 *                 decides when the reveal happens, instead of a scripted
 *                 countdown) — mirrors gen-connections-video.js's web variant.
 *                 The "question" clip shows the map zooming into the
 *                 highlighted region with narration, pausing on its last
 *                 frame; the "reveal" clip is the full-screen photo carousel
 *                 + name/country caption, re-zeroed to t=0. Segment folder
 *                 names differ between variants ("NNN-key" vs
 *                 "NNN-key-question"/"NNN-key-reveal"), so both can be
 *                 written into the same --output without colliding.
 */

const fs   = require('fs');
const path = require('path');
const { generateAudioBatch } = require('./lib/runpod-tts');
const { readWebImage } = require('./lib/web-image');
const audioStore = require('./lib/audio-store');
const { getWavDurationSeconds } = require('./lib/wav-duration');
const { loadNaturalEarth, filterByIso } = require('./lib/natural-earth');

// ── CLI args ──────────────────────────────────────────────────────────────────
const args = {};
for (const arg of process.argv.slice(2)) {
  if (arg.startsWith('--')) {
    const eq = arg.indexOf('=');
    if (eq !== -1) args[arg.slice(2, eq)] = arg.slice(eq + 1);
    else            args[arg.slice(2)]    = true;
  }
}

const ttsVoice    = args.voice   || 'celeste_48k_stereo.wav';
const skipAudio   = !!args['skip-audio'];
const audioOnly   = !!args['audio-only'];
const forceAudio  = !!args['force-audio'];
const refreshAudio = !!args['refresh-audio'];
const onlyArg     = args.only != null ? String(args.only) : null; // e.g. "0", "Manu_National_Park", "opening"
const imagesDirArg = args['images-dir'] || null; // local dir of hi-res images
const writeOpening = onlyArg === null || onlyArg.split(',').map(s => s.trim().toLowerCase()).includes('opening');
const variant = String(args.variant || 'full').toLowerCase();
if (!['full', 'web'].includes(variant)) {
  console.error(`--variant must be "full" or "web" (got "${variant}")`);
  process.exit(1);
}

function inferBg(mapSvg = '') {
  if (mapSvg.includes('africa'))        return 'africa';
  if (mapSvg.includes('north_america')) return 'north_america';
  if (mapSvg.includes('europe'))        return 'europe';
  if (mapSvg.includes('pacific'))       return 'pacific';
  return 'south_america';
}

// Mutable — DB mode derives these from the game record
let outputDir   = args.output   || 'videos/map-video';
let videoTitle  = args.title    || 'National Parks Quiz';
let videoTagline = args.tagline || 'Can you name these parks?';
let bgPreset    = args.bg       || 'south_america';
let rawRegions  = null;
let rawGeojson  = null;
let db          = null; // kept open (read-write) so generated audio URLs can be written back
let gameSlug    = null;
let revealDelayBuffer = 0.5; // seconds after narration ends before options/countdown appear (game-configurable)

if (args.db && args.game) {
  const Database = require('better-sqlite3');
  db = new Database(path.resolve(args.db));
  gameSlug = args.game;

  const game = db.prepare('SELECT * FROM challenge_games WHERE slug = ?').get(args.game);
  if (!game) {
    console.error(`Game not found: "${args.game}"`);
    console.error('Available:', db.prepare("SELECT slug FROM challenge_games WHERE game_type IN ('map','map_quiz')").all().map(r => r.slug).join(', '));
    db.close(); process.exit(1);
  }

  if (!args.output) outputDir  = `videos/map-challenge/${game.slug}`;
  if (!args.title)  videoTitle = game.title_en;
  if (!args.bg)     bgPreset   = inferBg(game.map_svg || '');
  revealDelayBuffer = game.reveal_delay_buffer ?? 0.5;

  rawRegions = db.prepare(
    'SELECT * FROM map_regions WHERE game_id = ? ORDER BY id'
  ).all(game.id).map(r => ({
    id:            r.id,
    enabled:       r.enabled === 1,
    regionKey:     r.region_key,
    labelEn:       r.label_en,
    labelNl:       r.label_nl,
    questionTextEn: r.question_text_en,
    questionAudioUrlEn: r.question_audio_url_en,
    answerAudioUrlEn:   r.answer_audio_url_en,
    infographData: r.infograph_data,
  }));

  const geoLocalPath = path.resolve('public' + game.map_svg);
  if (!fs.existsSync(geoLocalPath)) {
    console.error(`GeoJSON not found: ${geoLocalPath}`);
    db.close(); process.exit(1);
  }
  rawGeojson = JSON.parse(fs.readFileSync(geoLocalPath, 'utf-8'));

  console.log(`DB mode: ${game.slug} (${game.title_en})`);
  console.log(`GeoJSON: ${geoLocalPath}`);

} else if (args.regions && args.geojson) {
  rawRegions = JSON.parse(fs.readFileSync(path.resolve(args.regions), 'utf-8'));
  rawGeojson = JSON.parse(fs.readFileSync(path.resolve(args.geojson), 'utf-8'));

} else {
  console.error([
    'DB mode:   node scripts/gen-map-video.js --db=restore/remote_db/gameoftrivia.db --game=south-america-parks',
    'JSON mode: node scripts/gen-map-video.js --regions=regions.json --geojson=public/maps/parks.geojson --output=videos/map-challenge/sa-parks --title=... --bg=...',
    '',
    'Other options: --voice=celeste_48k_stereo.wav  --skip-audio  --force-audio  --refresh-audio',
    '               --images-dir=path/to/hires-images  --only=key1,key2',
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

  // Resolve a subdirectory named regionKey (case-insensitive), shared by layouts 2 & 3
  function resolveRegionSubDir() {
    let subDir = path.join(srcDir, regionKey);
    if (fs.existsSync(subDir)) return subDir;
    try {
      const entries = fs.readdirSync(srcDir, { withFileTypes: true });
      const found = entries.find(e => e.isDirectory() && e.name.toLowerCase() === regionKey.toLowerCase());
      if (found) return path.join(srcDir, found.name);
    } catch { /* ignore */ }
    return subDir; // may not exist — the readdirSync below will just fail
  }

  // Layout 2: <srcDir>/<regionKey>/*.img
  if (matched.length === 0) {
    const subDir = resolveRegionSubDir();
    try {
      matched = fs.readdirSync(subDir)
        .filter(f => IMG_RE.test(f))
        .sort()
        .slice(0, 5)
        .map(f => ({ src: path.join(subDir, f), dest: `${regionKey}_${f}` }));
    } catch { /* subDir doesn't exist */ }
  }

  // Layout 3: <srcDir>/<regionKey>/images/*.img (mirrors the audio-store's per-region typed subfolders)
  if (matched.length === 0) {
    const imagesSubDir = path.join(resolveRegionSubDir(), 'images');
    try {
      matched = fs.readdirSync(imagesSubDir)
        .filter(f => IMG_RE.test(f))
        .sort()
        .slice(0, 5)
        .map(f => ({ src: path.join(imagesSubDir, f), dest: `${regionKey}_${f}` }));
    } catch { /* imagesSubDir doesn't exist */ }
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
/** Question narration script — admin-authored question text only (no infoText fallback). */
function questionNarrationText(scene) {
  return (scene.questionText || '').trim();
}

/** Answer narration script — just the correct location's name. */
function answerNarrationText(scene) {
  return (scene.label || '').trim();
}

/**
 * Copies a file (already-generated audio, referenced relative to outAbs) into
 * a segment's own subfolder, so the segment never needs "../../" traversal to
 * reach shared assets — HyperFrames' asset resolution rejects that outside
 * the render step. Returns the path relative to the segment's index.html, or
 * null if the source doesn't exist.
 */
function copyIntoSegment(outAbsDir, segDir, relPathFromOutAbs, destSubdir, destFilename) {
  if (!relPathFromOutAbs) return null;
  const src = path.join(outAbsDir, relPathFromOutAbs);
  if (!fs.existsSync(src)) return null;
  const destDir = path.join(segDir, destSubdir);
  fs.mkdirSync(destDir, { recursive: true });
  fs.copyFileSync(src, path.join(destDir, destFilename));
  return `${destSubdir}/${destFilename}`;
}

function segmentDirName(scene) {
  return `${String(scene.originalIndex + 1).padStart(3, '0')}-${scene.regionKey}`;
}

// ── Main ──────────────────────────────────────────────────────────────────────
(async () => {

const outAbs         = path.resolve(outputDir);
const segmentsRoot   = path.join(outAbs, 'segments');

// ── Load data ─────────────────────────────────────────────────────────────────
const allRegions = rawRegions;
const geojson    = rawGeojson;

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

console.log(`Building carousel video segments for ${regions.length} parks:`);
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
    originalIndex: i, // stable segment numbering even after --only filtering
    dbId:         r.id, // map_regions.id, for writing generated audio URLs back
    regionKey:    r.regionKey,
    label:        r.labelEn,
    options:      opts,
    correctIndex: correctSlot,
    questionText: r.questionTextEn || '',
    questionAudioUrlEn: r.questionAudioUrlEn || '',
    answerAudioUrlEn:   r.answerAudioUrlEn   || '',
    country:      ig?.country   || '',
    typeLabel:    ig?.typeLabel || 'National Park',
    area:         fields.area        || ig?.area        || '',
    established:  fields.established || ig?.established || '',
    images: (() => {
      // Copied straight into this scene's own segment folder (not a shared
      // top-level dir) so every segment stays fully self-contained — no
      // "../../" path traversal, which HyperFrames' asset resolution rejects.
      const segImagesDir = path.join(segmentsRoot, `${String(i + 1).padStart(3, '0')}-${r.regionKey}`, 'images');
      const local  = imagesDirArg ? findLocalImages(r.regionKey, imagesDirArg, segImagesDir) : [];
      const dbImgs = (ig?.images || []).filter(Boolean).slice(0, 5);
      logImageSource(r.labelEn, local.length, dbImgs.length);
      return local.length > 0 ? local : dbImgs;
    })(),
    lon,
    lat,
  };
});

const allScenes = scenes; // unfiltered, for --only lookups by index/key

// ── --only filter (limits which segments get (re)written) ────────────────────
if (onlyArg !== null) {
  const requested = onlyArg.split(',').map(s => s.trim()).filter(s => s.toLowerCase() !== 'opening');
  if (requested.length > 0) {
    const indices = requested.map(s => {
      const n = parseInt(s, 10);
      return isNaN(n) ? scenes.findIndex(sc => sc.regionKey === s) : n;
    }).filter(n => n >= 0 && n < scenes.length);
    if (indices.length === 0) {
      console.error(`--only: no scenes matched "${onlyArg}". Valid indices: 0–${scenes.length - 1}`);
      process.exit(1);
    }
    scenes = indices.map(n => scenes[n]);
    console.log(`Segment mode: (re)writing scene(s) ${indices.join(', ')} only`);
  } else {
    scenes = []; // --only=opening alone: just the opening segment
    console.log(`Segment mode: (re)writing the opening segment only`);
  }
}

// ── Background presets ────────────────────────────────────────────────────────
const BG_ISO = {
  south_america: ['BR','AR','CL','CO','VE','PE','BO','PY','UY','EC','GY','SR','FK','PA','CR','GF','BQ','CW','AW','TT','SX','BB','LC','VC','GD'],
  africa:        ['ZA','NA','BW','ZW','ZM','TZ','KE','UG','RW','BI','CD','AO','MZ','MG','MW','SO','ET','ER','DJ','SD','SS','CF','CG','GA','CM','NG','GH','CI','SN','GN','SL','LR','TG','BJ','NE','ML','BF','MR','GM','GW','TD','LY','DZ','MA','TN','EG','MU'],
  north_america: ['US','CA','MX','GT','BZ','HN','SV','NI','CR','PA','CU','HT','DO','JM','GL'],
  // Matches MapMedia.tsx's own europe BG_ISO set, so the pre-baked video
  // background and the live interactive map show the same countries.
  europe:        ['PT','ES','FR','GB','IE','IS','NO','SE','FI','DK','DE','NL','BE','LU','CH','AT','IT','PL','CZ','SK','HU','SI','HR','BA','RS','ME','MK','AL','GR','BG','RO','MD','UA','BY','LT','LV','EE'],
  // Straddles the antimeridian (Midway ~177°W to Hiroshima ~132°E) — see ROTATE below.
  // Matches MapMedia.tsx's own pacific BG_ISO set.
  pacific:       ['US','JP','PH','SB','PG','FM','MH','PW','KI','TW','KR','KP','CN','RU','AU','NZ','VU','ID','MY','TL'],
};
const FIT_COORDS = {
  south_america: [[-84, 14], [-34, -57], [-84, -57], [-34, 14]],
  africa:        [[-20, 38], [52, -35],  [-20, -35], [52, 38]],
  north_america: [[-170, 84], [-50, 5],  [-170, 5],  [-50, 84]],
  europe:        [[-12, 71], [32, 34],   [-12, 34],  [32, 71]],
  // Corners given in plain (unrotated) lon/lat — ROTATE below recenters the sphere on
  // the date line before fitExtent runs, so these still "just work" despite spanning it.
  pacific:       [[112, 42], [-140, -18], [112, -18], [-140, 42]],
};
// A plain (unrotated) Mercator fitExtent takes the raw min/max longitude of the data as
// the bounding box — fine for every other preset, but Pacific-Theater points straddle
// ±180° (Midway ~-177°, Hiroshima ~132°), so the naive bbox would span almost the whole
// globe the "long way" through the Atlantic instead of the actual ~100°-wide slice of
// ocean. Rotating the reference meridian to the date line (180°) recenters the sphere
// there first, so the same data fits a normal, non-wrapping bbox instead — the standard
// trick for Pacific-centered maps. Every projection() call downstream (fitExtent, path
// generation, marker placement) sees the rotation automatically once set.
const ROTATE = {
  pacific: [180, 0],
};

const fitCoords = JSON.stringify(FIT_COORDS[bgPreset] || FIT_COORDS.south_america);
const rotateJson = JSON.stringify(ROTATE[bgPreset] || [0, 0]);

// Fetched + filtered ONCE here at generation time and baked into every
// segment as a plain constant — compositions must not fetch anything over
// the network at render time (see scripts/lib/natural-earth.js).
const neGeojson  = await loadNaturalEarth();
const bgFeatures = filterByIso(neGeojson, BG_ISO[bgPreset] || BG_ISO.south_america);
const bgFeaturesJson = JSON.stringify(bgFeatures);

// ── Timing constants ──────────────────────────────────────────────────────────
// Layout: left column shows the map/carousel, right column is a persistent
// answer panel. The question narration plays as the map zooms in; the correct
// answer highlights the moment the panel's progress bar finishes depleting.
const OPENING         = 4;
const T_PANEL_IN      = 0.3;   // answer panel + options fade in
const T_ZOOM_START    = 1.0;   // map zoom begins; narration audio starts here too
const T_ZOOM_LAND     = 5.0;   // zoom animation complete (4 s duration)
const T_CAROUSEL_IN   = 5.6;   // carousel crossfades over zoomed map (left column only)
const T_REVEAL        = 9.0;   // progress bar finishes depleting → correct answer highlights
const POST_REVEAL_HOLD = 2.0;  // seconds to keep the reveal on screen before cutting away
// Carousel/zoom/panel all cut away together, timed off the reveal itself (which
// already shifts later with narration length) rather than a fixed absolute time —
// so the carousel finishes exactly POST_REVEAL_HOLD after the answer is given,
// regardless of how long the narration was.
const T_CAROUSEL_OUT  = T_REVEAL + POST_REVEAL_HOLD;
const T_ZOOM_OUT      = T_CAROUSEL_OUT;
const T_PANEL_OUT     = T_CAROUSEL_OUT;
const SCENE_TAIL      = 3.5;   // zoom-out anim + marker reset, held at the end of the segment

// ── Audio generation ──────────────────────────────────────────────────────────
// Two clips per scene: the question (narrated while the map zooms in) and the
// answer (narrated once the progress bar ends and the correct option highlights).
const questionAudioPaths = new Map();
const answerAudioPaths   = new Map();
const audioDir           = path.join(outAbs, 'audio');

console.log(`\nAudio dir: ${audioDir}`);
if (!skipAudio) {
  fs.mkdirSync(audioDir, { recursive: true });
  console.log('Generating audio (RunPod TTS):');

  // Collect every clip that actually needs generating across ALL scenes first,
  // then submit them as a single RunPod job — one queue wait for the whole batch
  // instead of one per scene. Names must be unique across the whole batch.
  const pending = [];
  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    const idx   = scene.originalIndex;

    const clips = [
      { kind: 'question', name: `scene-${idx}-question`, sceneIdx: i, map: questionAudioPaths, text: questionNarrationText(scene), file: `scene-${idx}-q.wav`, dbUrl: scene.questionAudioUrlEn, dbColumn: 'question_audio_url_en' },
      { kind: 'answer',   name: `scene-${idx}-answer`,   sceneIdx: i, map: answerAudioPaths,   text: answerNarrationText(scene),   file: `scene-${idx}-a.wav`, dbUrl: scene.answerAudioUrlEn,   dbColumn: 'answer_audio_url_en' },
    ];

    for (const clip of clips) {
      const audioFile = path.join(audioDir, clip.file);
      const label = `Scene ${i + 1}/${scenes.length} (${scene.label}) ${clip.kind}`;
      const hadLocal = fs.existsSync(audioFile);
      if (!forceAudio && !refreshAudio && hadLocal) {
        console.log(`  ${label} — already exists`);
        clip.map.set(i, `audio/${clip.file}`);
        continue;
      }
      if (!forceAudio && gameSlug && clip.dbUrl && audioStore.ensureLocalCopy(gameSlug, scene.regionKey, clip.kind, audioFile, { overwrite: refreshAudio })) {
        console.log(`  ${label} — ${hadLocal ? '↻ refreshed from' : 'reused from'} audio store`);
        clip.map.set(i, `audio/${clip.file}`);
        continue;
      }
      if (!clip.text) {
        console.log(`  ${label} — no text, skipping`);
        continue;
      }
      console.log(`  ${label}: "${clip.text.slice(0, 80)}${clip.text.length > 80 ? '…' : ''}"`);
      pending.push({ ...clip, audioFile });
    }
  }

  if (pending.length > 0) {
    console.log(`\nSubmitting ${pending.length} clip(s) as a single RunPod job...`);
    try {
      await generateAudioBatch(
        pending.map(c => ({ name: c.name, text: c.text, outPath: c.audioFile })),
        { sample: ttsVoice },
      );
      for (const c of pending) {
        c.map.set(c.sceneIdx, `audio/${path.basename(c.audioFile)}`);
        if (db && gameSlug) {
          const scene = scenes[c.sceneIdx];
          const url = audioStore.persistCanonical(gameSlug, scene.regionKey, c.kind, c.audioFile);
          db.prepare(`UPDATE map_regions SET ${c.dbColumn} = ? WHERE id = ?`).run(url, scene.dbId);
        }
      }
    } catch (err) {
      console.warn(`  ✗ Failed: ${err.message}`);
    }
  }
} else {
  let found = 0, missing = 0;
  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    const idx   = scene.originalIndex;
    const kinds = [
      [questionAudioPaths, 'question', `scene-${idx}-q.wav`, scene.questionAudioUrlEn],
      [answerAudioPaths,   'answer',   `scene-${idx}-a.wav`, scene.answerAudioUrlEn],
    ];
    for (const [map, kind, file, dbUrl] of kinds) {
      const audioFile = path.join(audioDir, file);
      if (fs.existsSync(audioFile) || (gameSlug && dbUrl && audioStore.ensureLocalCopy(gameSlug, scene.regionKey, kind, audioFile))) {
        map.set(i, `audio/${file}`);
        found++;
      } else {
        console.log(`  ${file} — NOT FOUND (${scene.label})`);
        missing++;
      }
    }
  }
  console.log(`Audio: ${found} found, ${missing} missing (--skip-audio)`);
}

if (audioOnly) {
  console.log(`\nAudio-only mode: skipped HTML/video generation.`);
  if (db) db.close();
  return;
}

// ── Per-scene variable duration (based on measured narration length) ──────────
// The countdown/options window keeps its original fixed LENGTH (T_REVEAL -
// T_PANEL_IN); only WHEN it starts moves — after narration finishes plus the
// game's configurable reveal-delay buffer. Everything after that point (reveal,
// carousel-out, zoom-out, panel-out) shifts later by the same amount, for that
// scene only. The zoom-in/carousel-in animations (T_ZOOM_LAND/T_CAROUSEL_IN)
// intentionally keep their original fixed timing (known simplification).
for (let i = 0; i < scenes.length; i++) {
  const scene = scenes[i];
  const qPath = questionAudioPaths.get(i);
  const aPath = answerAudioPaths.get(i);
  const narrationDuration = qPath ? getWavDurationSeconds(path.join(outAbs, qPath)) : 0;
  const answerDuration    = aPath ? getWavDurationSeconds(path.join(outAbs, aPath)) : 0;
  const waitDuration = narrationDuration > 0 ? narrationDuration + revealDelayBuffer : 0;
  scene.narrationDuration = Number(narrationDuration.toFixed(2));
  scene.answerDuration    = Number(answerDuration.toFixed(2));
  scene.waitDuration      = Number(waitDuration.toFixed(2));
  scene.optionsInTime     = Number((T_ZOOM_START + waitDuration).toFixed(2));
  scene.exitAt            = Number((T_CAROUSEL_OUT + waitDuration).toFixed(2)); // carousel/zoom/panel-out — POST_REVEAL_HOLD after the (shifted) reveal
  scene.sceneDuration     = Number((scene.exitAt + SCENE_TAIL).toFixed(2));
}

// ── Shared page shell (identical DOM/CSS for every segment) ───────────────────
function pageShell({ compositionId, totalDur, audioElements, innerScript }) {
  return `<!DOCTYPE html>
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

    /* ── Left-column carousel (right column is reserved for the answer panel) ── */
    #carousel {
      position: absolute; top: 0; left: 0;
      width: 1340px; height: 1080px;
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
      padding: 100px 64px 56px;
      pointer-events: none;
    }
    #car-type {
      font-size: 12px; color: #a7c957;
      text-transform: uppercase; letter-spacing: 0.28em;
      font-family: sans-serif; margin-bottom: 10px;
    }
    #car-name {
      font-size: 46px; font-weight: normal;
      color: #fff; letter-spacing: 0.03em;
      text-shadow: 0 2px 24px rgba(0,0,0,0.8);
      line-height: 1.1; margin-bottom: 8px;
    }
    #car-country {
      font-size: 17px; color: rgba(255,255,255,0.62);
      font-family: sans-serif; letter-spacing: 0.14em;
    }

    /* ── Right-column answer panel (persistent for the whole question) ──── */
    #answer-panel {
      position: absolute;
      top: 0; right: 0;
      width: 580px; height: 1080px;
      background: rgba(15, 30, 43, 0.94);
      border-left: 1.5px solid rgba(167, 201, 87, 0.3);
      z-index: 6;
      display: flex;
      flex-direction: column;
      justify-content: center;
      padding: 0 56px;
      pointer-events: none;
    }
    #q-text {
      color: rgba(255,255,255,0.6);
      font-size: 19px;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      font-family: sans-serif;
      margin-bottom: 24px;
    }
    #progress-bar-track {
      width: 100%; height: 8px;
      border-radius: 4px;
      background: rgba(255,255,255,0.08);
      overflow: hidden;
      margin-bottom: 36px;
    }
    #progress-bar-fill {
      width: 100%; height: 100%;
      background: #4ade80;
      opacity: 0;
    }
    #options-container { display: flex; flex-direction: column; gap: 18px; }
    .opt {
      padding: 22px 26px;
      border-radius: 12px;
      font-size: 25px;
      font-family: Georgia, serif;
      color: rgba(255,255,255,0.85);
      background: rgba(255,255,255,0.06);
      border: 1.5px solid rgba(255,255,255,0.14);
      text-align: left;
      letter-spacing: 0.01em;
      line-height: 1.25;
    }
    .opt.correct {
      background: rgba(74, 222, 128, 0.18);
      border-color: #4ade80;
      color: #4ade80;
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

  </style>
</head>
<body>
<div id="stage"
     data-composition-id="${compositionId}"
     data-start="0"
     data-duration="${totalDur}"
     data-width="1920"
     data-height="1080">

  <!-- Map (zooms into location before carousel fades in) -->
  <svg id="map-svg" width="1920" height="1080" viewBox="0 0 1920 1080"
       class="clip" data-start="0" data-duration="${totalDur}" data-track-index="0">
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
    <div id="car-label" style="opacity:0">
      <div id="car-type"></div>
      <div id="car-name"></div>
      <div id="car-country"></div>
    </div>
  </div>

  <!-- Title card -->
  <div id="title-card" style="opacity:0">
    <h1>${videoTitle}</h1>
    <p>${videoTagline}</p>
  </div>

  <!-- Answer panel (right column) — persistent for the whole question;
       the correct option highlights when the progress bar finishes depleting -->
  <div id="answer-panel" style="opacity:0">
    <div id="q-text">Where is this national park?</div>
    <div id="progress-bar-track">
      <div id="progress-bar-fill"></div>
    </div>
    <div id="options-container">
      <div class="opt" id="opt-0"></div>
      <div class="opt" id="opt-1"></div>
      <div class="opt" id="opt-2"></div>
    </div>
  </div>

  <!-- Narration audio: starts as the map zooms in -->
${audioElements}

</div>

<script src="https://d3js.org/d3.v7.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>

<script>
(() => {
  const W = 1920, H = 1080;
  const PARKS_GEO = ${JSON.stringify(geojson)};
  const MARKER_R = 12; // marker radius, same as web app

  const FIT = {
    type: 'Feature',
    geometry: { type: 'MultiPoint', coordinates: ${fitCoords} },
    properties: null,
  };
  const projection = d3.geoMercator().rotate(${rotateJson}).fitExtent([[80, 40], [1340, H - 40]], FIT);
  const pathGen    = d3.geoPath().projection(projection);

  const markerPos = {};
  for (const f of PARKS_GEO.features) {
    const key = (f.id ?? f.properties?.regionKey ?? '').trim();
    const pt  = projection(f.geometry.coordinates);
    if (pt) markerPos[key] = { x: pt[0], y: pt[1] };
  }

  // Background land — baked in at generation time (see scripts/lib/natural-earth.js);
  // compositions must not fetch anything over the network at render time.
  const bgFeatures = ${bgFeaturesJson};

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
    g.append('circle')
      .attr('id', 'mk-' + key.replace(/[^a-zA-Z0-9_-]/g, '_'))
      .attr('class', 'park-marker')
      .attr('cx', cx).attr('cy', cy).attr('r', MARKER_R)
      .attr('fill', '#c8d8b4').attr('stroke', '#6b7c52').attr('stroke-width', 1.5);
  }

  function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val || '';
  }
  function markerId(key) { return 'mk-' + key.replace(/[^a-zA-Z0-9_-]/g, '_'); }
  function getMarker(key) { return document.getElementById(markerId(key)); }
  // Only the segment's own park is ever shown on the map — every other
  // marker stays hidden throughout, including zoom.
  function hideAllMarkers() {
    document.querySelectorAll('.park-marker').forEach(el => { el.style.opacity = '0'; });
  }
  hideAllMarkers();

  // viewBox zoom helper (seek-safe, no transform matrix state)
  const ZOOM = 10, ZW = W / 10, ZH = H / 10;
  function viewBoxZoomed(key) {
    const pos = markerPos[key];
    if (!pos) return '0 0 1920 1080';
    const zX = Math.max(0, Math.min(W - ZW, pos.x - ZW / 2));
    const zY = Math.max(0, Math.min(H - ZH, pos.y - ZH / 2));
    return \`\${zX} \${zY} \${ZW} \${ZH}\`;
  }

  const tl = gsap.timeline({ paused: true });

${innerScript}

  window.__timelines = window.__timelines || {};
  window.__timelines['${compositionId}'] = tl;
})();
</script>
</body>
</html>`;
}

// ── Opening segment (shared title card, no specific park) ─────────────────────
function writeOpeningSegment() {
  // Namespaced by output dir (not just "000-opening") — renders/ is shared
  // across every map-challenge video project, and concat-video-segments.js
  // picks the *most recent* renders/<compositionId>_*.mp4 match. A bare
  // "000-opening" id would silently reuse another project's stale opening
  // render if this project's own opening segment isn't re-rendered.
  const compositionId = `000-opening-${path.basename(outputDir)}`;
  const segDir = path.join(segmentsRoot, compositionId);
  const innerScript = `  tl.to('#map-group',  { opacity: 1, duration: 1.5, ease: 'power1.inOut' }, 0);
  tl.to('#title-card', { opacity: 1, duration: 1.2, ease: 'power1.inOut' }, 0.6);
  tl.to('#title-card', { opacity: 0, duration: 0.8, ease: 'power1.in'    }, 3.2);`;

  const html = pageShell({ compositionId, totalDur: OPENING, audioElements: '', innerScript });
  fs.mkdirSync(segDir, { recursive: true });
  fs.writeFileSync(path.join(segDir, 'index.html'), html, 'utf-8');
  console.log(`  ✓ segments/${compositionId}/index.html (${OPENING}s)`);
}

// ── One scene's segment ─────────────────────────────────────────────────────
function writeSceneSegment(scene, i) {
  const compositionId = segmentDirName(scene);
  const segDir = path.join(segmentsRoot, compositionId);
  fs.mkdirSync(segDir, { recursive: true });

  const shift = scene.waitDuration || 0;
  const vbKey = scene.regionKey;
  const qPath = questionAudioPaths.get(i);
  const aPath = answerAudioPaths.get(i);

  // Copy this scene's own audio straight into its segment folder — no
  // "../../" traversal, so the segment stays fully self-contained.
  const qSegPath = copyIntoSegment(outAbs, segDir, qPath, 'audio', 'question.wav');
  const aSegPath = copyIntoSegment(outAbs, segDir, aPath, 'audio', 'answer.wav');

  const audioElements = [
    qSegPath ? `  <audio id="narration-q" data-start="${T_ZOOM_START.toFixed(2)}" data-duration="${Math.max(0.1, scene.narrationDuration - 0.05).toFixed(2)}" data-track-index="1" src="${qSegPath}"></audio>` : '',
    aSegPath ? `  <audio id="narration-a" data-start="${(T_REVEAL + shift + 0.1).toFixed(2)}" data-duration="${Math.max(0.1, scene.answerDuration - 0.05).toFixed(2)}" data-track-index="1" src="${aSegPath}"></audio>` : '',
  ].filter(Boolean).join('\n');

  const sceneJson = JSON.stringify(scene); // scene.images are already segment-relative (copied at build time)

  const carDur = (T_CAROUSEL_OUT + shift) - T_CAROUSEL_IN;
  const imgCount = Math.min(scene.images.length, 5);

  const innerScript = `  const scene = ${sceneJson};
  const shift  = scene.waitDuration || 0;
  const vb     = viewBoxZoomed(${JSON.stringify(vbKey)});
  const T_PI   = ${T_PANEL_IN};
  const T_ZS   = ${T_ZOOM_START};
  const T_ZL   = ${T_ZOOM_LAND};
  const T_CI   = ${T_CAROUSEL_IN};
  const T_RV   = ${T_REVEAL};
  const T_CO   = ${T_CAROUSEL_OUT};
  const T_ZO   = ${T_ZOOM_OUT};
  const T_PO   = ${T_PANEL_OUT};
  const carDur = ${carDur.toFixed(3)};
  const imgCount = ${imgCount};
  const imgInterval = imgCount > 1 ? carDur / imgCount : carDur;

  // ─ Setup — static for this segment's whole duration, so it just runs once
  //   immediately rather than as a tl.call() at position 0 (a one-shot
  //   callback sitting exactly at time zero isn't guaranteed to fire on a
  //   direct seek from a freshly-created timeline; continuous tweens at 0
  //   render fine, but discrete calls need the play head to cross them) ────
  // The map's fade-in only happens once, in the separate opening segment —
  // each park is its own standalone composition, so show it immediately.
  gsap.set('#map-group', { opacity: 1 });
  ['opt-0','opt-1','opt-2'].forEach((id, j) => {
    const el = document.getElementById(id);
    if (el) { el.textContent = scene.options[j] || ''; el.className = 'opt'; }
  });
  for (let j = 0; j < 5; j++) {
    const img = document.getElementById('car-img-' + j);
    if (!img) continue;
    img.src = scene.images[j] || '';
    gsap.set(img, { opacity: j === 0 ? 1 : 0 });
  }
  const activeMk = getMarker(scene.regionKey);
  if (activeMk) { activeMk.style.opacity = '1'; activeMk.setAttribute('fill', '#fbbf24'); activeMk.setAttribute('stroke', '#d97706'); }

  // ─ Answer panel fades in — waits for narration to finish (+ buffer) ──────
  tl.to('#answer-panel', { opacity: 1, duration: 0.7, ease: 'power1.inOut', overwrite: 'auto' }, T_PI + shift);

  // ─ Progress bar: green → amber → red depletion, ends exactly at reveal ───
  const qDur = T_RV - T_PI;
  tl.set('#progress-bar-fill', { width: '100%', backgroundColor: '#4ade80', opacity: 1 }, T_PI + shift);
  tl.to('#progress-bar-fill', { width: '0%', duration: qDur, ease: 'none', overwrite: 'auto' }, T_PI + shift);
  tl.to('#progress-bar-fill', { backgroundColor: '#fbbf24', duration: qDur * 0.7, ease: 'none', overwrite: 'auto' }, T_PI + shift);
  tl.to('#progress-bar-fill', { backgroundColor: '#ef4444', duration: qDur * 0.3, ease: 'none', overwrite: 'auto' }, T_PI + shift + qDur * 0.7);

  // ─ Map zoom in (viewBox shrink, seek-safe) — narration plays through this ─
  tl.to('#map-svg', { attr: { viewBox: vb }, duration: 4, ease: 'power2.inOut' }, T_ZS);
  tl.call(() => {
    document.querySelectorAll('.park-marker').forEach(el => {
      if (el.id !== markerId(scene.regionKey)) el.style.opacity = '0';
    });
    const pos = markerPos[scene.regionKey];
    ['pulse-c','active-dot'].forEach(id => {
      const el = document.getElementById(id);
      if (el && pos) { el.setAttribute('cx', pos.x); el.setAttribute('cy', pos.y); }
    });
  }, [], T_ZS);
  // Pulse fires as zoom lands
  tl.to('#active-dot', { opacity: 1, duration: 0.3, ease: 'power2.out', overwrite: 'auto' }, T_ZL + 0.2);
  tl.set('#pulse-c', { attr: { r: 0.8 }, opacity: 0 }, T_ZL + 0.3);
  tl.to('#pulse-grp', { opacity: 1, duration: 0.05 }, T_ZL + 0.3);
  tl.to('#pulse-c', { attr: { r: 5 }, opacity: 0, duration: 1.5, ease: 'power1.out' }, T_ZL + 0.4);

  // ─ Carousel crossfades over the zoomed map (left column only) ────────────
  tl.to('#carousel', { opacity: 1, duration: 0.9, ease: 'power1.inOut', overwrite: 'auto' }, T_CI);

  // ─ Image crossfades + Ken Burns (seek-safe: all on main timeline) ──────────
  const KB = [
    { from: { scale: 1.05, xPercent:  1.5, yPercent:  0.5 }, to: { scale: 1.10, xPercent: -1.5, yPercent: -1.0 } },
    { from: { scale: 1.10, xPercent: -1.5, yPercent: -1.0 }, to: { scale: 1.05, xPercent:  1.5, yPercent:  0.5 } },
    { from: { scale: 1.05, xPercent: -1.0, yPercent:  1.5 }, to: { scale: 1.10, xPercent:  1.0, yPercent: -1.5 } },
    { from: { scale: 1.10, xPercent:  1.0, yPercent:  1.0 }, to: { scale: 1.05, xPercent: -1.5, yPercent: -0.5 } },
  ];
  for (let j = 0; j < imgCount; j++) {
    const switchAt  = T_CI + j * imgInterval;
    const switchEnd = j === imgCount - 1 ? T_CO + shift : T_CI + (j + 1) * imgInterval;
    const kbDur     = switchEnd - switchAt;
    const kb        = KB[j % KB.length];

    if (j > 0) {
      tl.to('#car-img-' + (j - 1), { opacity: 0, duration: 0.9, ease: 'power1.inOut', overwrite: 'auto' }, switchAt);
      tl.to('#car-img-' + j,       { opacity: 1, duration: 0.9, ease: 'power1.inOut', overwrite: 'auto' }, switchAt);
    }
    if (scene.images[j]) {
      tl.fromTo('#car-img-' + j,
        { scale: kb.from.scale, xPercent: kb.from.xPercent, yPercent: kb.from.yPercent },
        { scale: kb.to.scale,   xPercent: kb.to.xPercent,   yPercent: kb.to.yPercent,
          duration: kbDur, ease: 'none', overwrite: 'auto' },
        switchAt
      );
    }
  }

  // ─ Reveal: correct answer highlights the instant the progress bar ends ───
  tl.call(() => {
    const el = document.getElementById('opt-' + scene.correctIndex);
    if (el) el.className = 'opt correct';
    const mk = getMarker(scene.regionKey);
    if (mk) { mk.setAttribute('fill', '#4ade80'); mk.setAttribute('stroke', '#15803d'); }
    // Caption (park name) is only set/shown once the answer is revealed —
    // showing it on the carousel any earlier would give the answer away.
    setText('car-type',    scene.typeLabel || 'National Park');
    setText('car-name',    scene.label);
    setText('car-country', scene.country);
  }, [], T_RV + shift);
  tl.to('#progress-bar-fill', { opacity: 0, duration: 0.4, ease: 'power1.in', overwrite: 'auto' }, T_RV + shift);
  tl.to('#car-label', { opacity: 1, duration: 0.5, ease: 'power1.inOut', overwrite: 'auto' }, T_RV + shift);

  // ─ Carousel + panel out, map zooms back simultaneously ────────────────────
  tl.to('#carousel',     { opacity: 0, duration: 0.9, ease: 'power1.in', overwrite: 'auto' }, T_CO + shift);
  tl.to('#answer-panel', { opacity: 0, duration: 0.6, ease: 'power1.in', overwrite: 'auto' }, T_PO + shift);
  tl.to('#active-dot', { opacity: 0, duration: 0.2, overwrite: 'auto' }, T_CO + shift);
  tl.set('#pulse-c',   { attr: { r: 0.8 } }, T_CO + shift + 0.1);
  tl.to('#map-svg', { attr: { viewBox: '0 0 1920 1080' }, duration: 2, ease: 'power2.inOut' }, T_ZO + shift);
  for (let j = 0; j < 5; j++) {
    tl.set('#car-img-' + j, { opacity: j === 0 ? 1 : 0, scale: 1, xPercent: 0, yPercent: 0 }, T_ZO + shift + 2.1);
  }
  tl.set('#car-label', { opacity: 0 }, T_ZO + shift + 2.1);
  tl.call(hideAllMarkers, [], T_ZO + shift + 2.1);`;

  const html = pageShell({ compositionId, totalDur: scene.sceneDuration, audioElements, innerScript });
  fs.writeFileSync(path.join(segDir, 'index.html'), html, 'utf-8');
  console.log(`  ✓ segments/${compositionId}/index.html (${scene.sceneDuration}s, narration ${scene.narrationDuration}s)`);
}

// ── WEB VARIANT ──────────────────────────────────────────────────────────────
// Two lighter compositions per park instead of one continuous timeline — no
// answer panel, no countdown, no baked options (mirrors gen-connections-video.js's
// web variant). "question": the map zooms into the highlighted region as
// narration plays, then just holds there — the web page pauses on that last
// frame however long the visitor takes to answer, instead of a scripted
// countdown. "reveal": the full-screen photo carousel + name/country caption,
// re-zeroed to t=0, played from t=0 once a real answer comes in.
const IMG_DUR_WEB          = 3.0;  // seconds per carousel image in the reveal clip
const POST_REVEAL_HOLD_WEB = 2.0;  // hold after the carousel finishes, before the clip ends
const SCENE_TAIL_WEB       = 1.5;  // buffer held at the very end of the reveal clip
const ZOOM_HOLD_TAIL       = 1.0;  // settle after the zoom (or narration, whichever is longer) before the question clip ends

/** Downloads/copies this scene's reveal images into its own segment folder —
 *  scene.images may be local-relative (already copied under the "full" variant's
 *  segment dir, when --images-dir matched) or raw remote DB URLs; either way the
 *  web reveal segment needs its own self-contained copies (no cross-segment
 *  relative paths, no render-time network fetch). */
async function ensureWebRevealImages(scene, segDir) {
  const destDir = path.join(segDir, 'images');
  fs.mkdirSync(destDir, { recursive: true });
  const out = [];
  for (let j = 0; j < scene.images.length; j++) {
    const src = scene.images[j];
    if (!src) continue;
    if (src.startsWith('images/')) {
      const fullSegDir = path.join(segmentsRoot, segmentDirName(scene));
      const abs = path.join(fullSegDir, src);
      if (!fs.existsSync(abs)) continue;
      const destPath = path.join(destDir, path.basename(abs));
      if (!fs.existsSync(destPath)) fs.copyFileSync(abs, destPath);
      out.push(`images/${path.basename(destPath)}`);
      continue;
    }
    const ext = (/\.([a-z0-9]+)(?:\?.*)?$/i.exec(src) || [, 'jpg'])[1].toLowerCase();
    const destPath = path.join(destDir, `img-${j}.${ext}`);
    if (!fs.existsSync(destPath)) {
      const img = await readWebImage(src);
      if (!img.ok) { console.warn(`    ✗ Failed to load ${src}: ${img.error}`); continue; }
      fs.writeFileSync(destPath, img.buffer);
    }
    out.push(`images/${path.basename(destPath)}`);
  }
  return out;
}

// Map + D3 shell, stripped of the answer panel/countdown/carousel/title-card —
// used only by the "question" web clip (map zoom, nothing else).
function webMapPageShell({ compositionId, totalDur, audioElements, innerScript }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${videoTitle}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 1920px; height: 1080px; overflow: hidden; background: #060e1f; }
    #stage { width: 1920px; height: 1080px; position: relative; overflow: hidden; }
    #map-svg { position: absolute; top: 0; left: 0; }
  </style>
</head>
<body>
<div id="stage"
     data-composition-id="${compositionId}"
     data-start="0"
     data-duration="${totalDur}"
     data-width="1920"
     data-height="1080">

  <svg id="map-svg" width="1920" height="1080" viewBox="0 0 1920 1080"
       class="clip" data-start="0" data-duration="${totalDur}" data-track-index="0">
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
    <g id="map-group"></g>
    <g id="pulse-grp" opacity="0">
      <circle id="pulse-c" cx="960" cy="540" r="0.8"
              fill="none" stroke="#ff6b35" stroke-width="0.3"/>
    </g>
    <circle id="active-dot" cx="960" cy="540" r="0.6" fill="#ff6b35" opacity="0"/>
    <rect width="1920" height="1080" fill="url(#vigGrad)" pointer-events="none"/>
  </svg>

  <!-- Narration audio -->
${audioElements}

</div>

<script src="https://d3js.org/d3.v7.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>

<script>
(() => {
  const W = 1920, H = 1080;
  const PARKS_GEO = ${JSON.stringify(geojson)};
  const MARKER_R = 12;

  const FIT = {
    type: 'Feature',
    geometry: { type: 'MultiPoint', coordinates: ${fitCoords} },
    properties: null,
  };
  const projection = d3.geoMercator().rotate(${rotateJson}).fitExtent([[80, 40], [1340, H - 40]], FIT);
  const pathGen    = d3.geoPath().projection(projection);

  const markerPos = {};
  for (const f of PARKS_GEO.features) {
    const key = (f.id ?? f.properties?.regionKey ?? '').trim();
    const pt  = projection(f.geometry.coordinates);
    if (pt) markerPos[key] = { x: pt[0], y: pt[1] };
  }

  // Background land — baked in at generation time; compositions must not
  // fetch anything over the network at render time.
  const bgFeatures = ${bgFeaturesJson};

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
    g.append('circle')
      .attr('id', 'mk-' + key.replace(/[^a-zA-Z0-9_-]/g, '_'))
      .attr('class', 'park-marker')
      .attr('cx', cx).attr('cy', cy).attr('r', MARKER_R)
      .attr('fill', '#c8d8b4').attr('stroke', '#6b7c52').attr('stroke-width', 1.5);
  }

  function markerId(key) { return 'mk-' + key.replace(/[^a-zA-Z0-9_-]/g, '_'); }
  function getMarker(key) { return document.getElementById(markerId(key)); }
  document.querySelectorAll('.park-marker').forEach(el => { el.style.opacity = '0'; });

  const ZOOM = 10, ZW = W / 10, ZH = H / 10;
  function viewBoxZoomed(key) {
    const pos = markerPos[key];
    if (!pos) return '0 0 1920 1080';
    const zX = Math.max(0, Math.min(W - ZW, pos.x - ZW / 2));
    const zY = Math.max(0, Math.min(H - ZH, pos.y - ZH / 2));
    return \`\${zX} \${zY} \${ZW} \${ZH}\`;
  }

  const tl = gsap.timeline({ paused: true });

${innerScript}

  window.__timelines = window.__timelines || {};
  window.__timelines['${compositionId}'] = tl;
})();
</script>
</body>
</html>`;
}

// Carousel-only shell (no map/D3 at all) — used only by the "reveal" web clip.
function webCarouselPageShell({ compositionId, totalDur, audioElements, innerScript }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${videoTitle}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 1920px; height: 1080px; overflow: hidden; background: #000; }
    #stage { width: 1920px; height: 1080px; position: relative; overflow: hidden; }
    #carousel { position: absolute; inset: 0; background: #000; overflow: hidden; }
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
      padding: 100px 64px 56px;
      opacity: 0;
    }
    #car-type { font-size: 12px; color: #a7c957; text-transform: uppercase; letter-spacing: 0.28em; font-family: sans-serif; margin-bottom: 10px; }
    #car-name { font-size: 44px; font-weight: normal; color: #fff; letter-spacing: 0.02em; text-shadow: 0 2px 24px rgba(0,0,0,0.8); line-height: 1.1; margin-bottom: 8px; font-family: Georgia, serif; }
    #car-country { font-size: 18px; color: rgba(255,255,255,0.62); font-family: sans-serif; letter-spacing: 0.14em; }
  </style>
</head>
<body>
<div id="stage"
     data-composition-id="${compositionId}"
     data-start="0"
     data-duration="${totalDur}"
     data-width="1920"
     data-height="1080">

  <div id="carousel">
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

${audioElements}

</div>

<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>

<script>
(() => {
  const tl = gsap.timeline({ paused: true });
  function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val || '';
  }

${innerScript}

  window.__timelines = window.__timelines || {};
  window.__timelines['${compositionId}'] = tl;
})();
</script>
</body>
</html>`;
}

async function writeSceneSegmentsWeb(scene, i) {
  const baseId = segmentDirName(scene);
  const qId = `${baseId}-question`;
  const rId = `${baseId}-reveal`;
  const qDir = path.join(segmentsRoot, qId);
  const rDir = path.join(segmentsRoot, rId);
  fs.mkdirSync(qDir, { recursive: true });
  fs.mkdirSync(rDir, { recursive: true });

  const qPath = questionAudioPaths.get(i);
  const aPath = answerAudioPaths.get(i);
  const qSegPath = copyIntoSegment(outAbs, qDir, qPath, 'audio', 'question.wav');
  const aSegPath = copyIntoSegment(outAbs, rDir, aPath, 'audio', 'answer.wav');

  // ── "question" clip: map zooms into the highlighted region, no panel/carousel ──
  const zoomLandAt = T_ZOOM_START + 4; // 4s zoom duration, same as the full variant
  const qDuration = Number((Math.max(zoomLandAt + 0.5, T_ZOOM_START + scene.narrationDuration) + ZOOM_HOLD_TAIL).toFixed(2));
  const regionKeyJson = JSON.stringify(scene.regionKey);

  const qAudioElements = qSegPath
    ? `  <audio id="narration-q" data-start="${T_ZOOM_START.toFixed(2)}" data-duration="${Math.max(0.1, scene.narrationDuration - 0.05).toFixed(2)}" data-track-index="1" src="${qSegPath}"></audio>`
    : '';

  const qInnerScript = `  const vb = viewBoxZoomed(${regionKeyJson});

  tl.to('#map-svg', { attr: { viewBox: vb }, duration: 4, ease: 'power2.inOut' }, ${T_ZOOM_START});
  tl.call(() => {
    document.querySelectorAll('.park-marker').forEach(el => {
      el.style.opacity = el.id === markerId(${regionKeyJson}) ? '1' : '0';
    });
    const activeMk = getMarker(${regionKeyJson});
    if (activeMk) { activeMk.setAttribute('fill', '#fbbf24'); activeMk.setAttribute('stroke', '#d97706'); }
    const pos = markerPos[${regionKeyJson}];
    ['pulse-c','active-dot'].forEach(id => {
      const el = document.getElementById(id);
      if (el && pos) { el.setAttribute('cx', pos.x); el.setAttribute('cy', pos.y); }
    });
  }, [], ${T_ZOOM_START});
  tl.to('#active-dot', { opacity: 1, duration: 0.3, ease: 'power2.out', overwrite: 'auto' }, ${(zoomLandAt + 0.2).toFixed(2)});
  tl.set('#pulse-c', { attr: { r: 0.8 }, opacity: 0 }, ${(zoomLandAt + 0.3).toFixed(2)});
  tl.to('#pulse-grp', { opacity: 1, duration: 0.05 }, ${(zoomLandAt + 0.3).toFixed(2)});
  tl.to('#pulse-c', { attr: { r: 5 }, opacity: 0, duration: 1.5, ease: 'power1.out' }, ${(zoomLandAt + 0.4).toFixed(2)});`;

  const qHtml = webMapPageShell({ compositionId: qId, totalDur: qDuration, audioElements: qAudioElements, innerScript: qInnerScript });
  fs.writeFileSync(path.join(qDir, 'index.html'), qHtml, 'utf-8');
  console.log(`  ✓ segments/${qId}/index.html (${qDuration}s, narration ${scene.narrationDuration}s)`);

  // ── "reveal" clip: full-screen carousel + caption, re-zeroed at t=0 ──────
  const imagesR = await ensureWebRevealImages(scene, rDir);
  const imgCount = Math.min(imagesR.length, 5);
  const carStart = 0.2;
  const carDur   = imgCount > 1 ? (imgCount - 1) * IMG_DUR_WEB : 0;
  const carEnd   = carStart + carDur;
  const exitAt   = carEnd + POST_REVEAL_HOLD_WEB;
  const rDuration = Number((exitAt + SCENE_TAIL_WEB).toFixed(2));

  const rAudioElements = aSegPath
    ? `  <audio id="narration-a" data-start="0.10" data-duration="${Math.max(0.1, scene.answerDuration - 0.05).toFixed(2)}" data-track-index="1" src="${aSegPath}"></audio>`
    : '';

  const rInnerScript = `  const scene = ${JSON.stringify({ ...scene, images: imagesR })};
  const carStart = ${carStart.toFixed(3)};
  const carDur   = ${carDur.toFixed(3)};
  const imgCount = ${imgCount};
  const imgInterval = imgCount > 1 ? carDur / (imgCount - 1) : carDur;

  for (let j = 0; j < 5; j++) {
    const img = document.getElementById('car-img-' + j);
    if (!img) continue;
    img.src = scene.images[j] || '';
    gsap.set(img, { opacity: j === 0 ? 1 : 0 });
  }
  if (scene.images[0]) {
    tl.fromTo('#car-img-0', { scale: 1.08 }, { scale: 1.08, duration: ${rDuration}, ease: 'none' }, 0);
  }

  tl.call(() => {
    setText('car-type', scene.typeLabel || 'National Park');
    setText('car-name', scene.label);
    setText('car-country', scene.country);
  }, [], 0);
  tl.to('#car-label', { opacity: 1, duration: 0.5, ease: 'power1.inOut', overwrite: 'auto' }, 0);

  const KB = [
    { from: { scale: 1.05, xPercent:  1.5, yPercent:  0.5 }, to: { scale: 1.10, xPercent: -1.5, yPercent: -1.0 } },
    { from: { scale: 1.10, xPercent: -1.5, yPercent: -1.0 }, to: { scale: 1.05, xPercent:  1.5, yPercent:  0.5 } },
    { from: { scale: 1.05, xPercent: -1.0, yPercent:  1.5 }, to: { scale: 1.10, xPercent:  1.0, yPercent: -1.5 } },
  ];
  for (let j = 1; j < imgCount; j++) {
    const switchAt = carStart + (j - 1) * imgInterval;
    tl.to('#car-img-' + (j - 1), { opacity: 0, duration: 0.9, ease: 'power1.inOut', overwrite: 'auto' }, switchAt);
    tl.to('#car-img-' + j,       { opacity: 1, duration: 0.9, ease: 'power1.inOut', overwrite: 'auto' }, switchAt);
    if (scene.images[j]) {
      const kb = KB[(j - 1) % KB.length];
      tl.fromTo('#car-img-' + j,
        { scale: kb.from.scale, xPercent: kb.from.xPercent, yPercent: kb.from.yPercent },
        { scale: kb.to.scale,   xPercent: kb.to.xPercent,   yPercent: kb.to.yPercent,
          duration: imgInterval, ease: 'none', overwrite: 'auto' },
        switchAt
      );
    }
  }

  tl.to('#car-label', { opacity: 0, duration: 0.6, ease: 'power1.in', overwrite: 'auto' }, ${exitAt.toFixed(2)});`;

  const rHtml = webCarouselPageShell({ compositionId: rId, totalDur: rDuration, audioElements: rAudioElements, innerScript: rInnerScript });
  fs.writeFileSync(path.join(rDir, 'index.html'), rHtml, 'utf-8');
  console.log(`  ✓ segments/${rId}/index.html (${rDuration}s, ${imgCount} image(s))`);
}

// ── Write segments ─────────────────────────────────────────────────────────
console.log(`\nWriting segments to ${outputDir}/segments/ (variant: ${variant})`);
if (variant === 'web') {
  for (let i = 0; i < scenes.length; i++) await writeSceneSegmentsWeb(scenes[i], i);
} else {
  if (writeOpening) writeOpeningSegment();
  scenes.forEach((scene, i) => writeSceneSegment(scene, i));
}

console.log(`\nDone: ${scenes.length} scene segment(s)${variant === 'full' && writeOpening ? ' + opening' : ''} written.`);
console.log(`\nNext steps:`);
console.log(`  npx hyperframes browser ensure`);
console.log(`  npx hyperframes preview ${outputDir}/segments/<segment-dir>      # preview one segment`);
console.log(`  npx hyperframes render ${outputDir}/segments/<segment-dir> --fps=30   # render one segment`);
console.log(`  node scripts/concat-video-segments.js --dir=${outputDir}             # stitch all rendered segments into the final video`);

if (db) db.close();

})().catch(err => {
  console.error('\nError:', err.message);
  if (db) db.close();
  process.exit(1);
});
