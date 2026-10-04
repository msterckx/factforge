#!/usr/bin/env node
'use strict';
/**
 * gen-connections-video.js
 * Connections quiz video — the artwork image is unavoidably visible
 * throughout the question (that's the whole quiz); after the answer is
 * revealed, a full-screen carousel cycles through any additional photos of
 * the artwork (beyond the primary image_url), with a persistent answer panel
 * on the right — the connections_quiz counterpart to gen-map-video.js. An
 * item with no extra photos just holds on its single image, no carousel.
 *
 * Generates ONE independent HyperFrames composition per item (plus one for
 * the shared opening title card), so any one item's segment can be
 * regenerated/re-rendered without touching the others. Render each segment,
 * then use scripts/concat-video-segments.js to stitch the rendered clips
 * into the final video.
 *
 * Usage:
 *   node scripts/gen-connections-video.js \
 *     --db=gameoftrivia.db \
 *     --game=contemporary-art \
 *     [--images-dir=local-data/challenges/contemporary-art]
 *
 * Options:
 *   --variant     "full" (default) — the single continuous per-item
 *                 composition with the on-screen answer panel/countdown,
 *                 meant for the concatenated YouTube upload. "web" — two
 *                 lighter compositions per item instead of one ("-question"
 *                 and "-reveal"), with the answer panel/countdown omitted
 *                 entirely (a real web quiz UI supplies its own buttons and
 *                 decides when the reveal happens, instead of a scripted
 *                 countdown). Segment folder names differ between variants
 *                 ("NNN-slug" vs "NNN-slug-question"/"NNN-slug-reveal"), so
 *                 both can be written into the same --output without colliding.
 *   --output      Output base directory (default: videos/connections-challenge/<slug>)
 *   --title       Video title shown on opening card (default: game title)
 *   --tagline     Opening title-card subtitle (default: "Can you name the artist?")
 *   --tag         Small label above the name on the reveal caption (default: "Artwork")
 *   --fit         "cover" (default) crops images to fill the 16:9 frame;
 *                 "contain" shows the whole image, with the left/right (or
 *                 top/bottom) filled by a blurred, darkened copy of it.
 *   --motion      "normal" (default) or "subtle": how far the slow zoom/pan
 *                 goes. Subtle zooms 1.03× instead of up to 1.10×, so less of
 *                 each image is cropped away (web variant only).
 *   --image-focus Vertical crop anchor when an image is taller than 16:9, as a
 *                 percentage from the top: 0 keeps the top (portraits — heads stay
 *                 in frame), 50 = centred (default), 100 keeps the bottom.
 *   --folder-images  Take each item's images from its folder in the local image
 *                 mirror (local-data/web-images) instead of the DB lists:
 *                 <folder>/<folder>.webp is the question image and
 *                 <folder>/<folder>-1.webp, -2, … the reveal carousel (the
 *                 folder is the one holding the item's image_url). Items whose
 *                 folder doesn't follow this yet fall back to the DB images.
 *   --voice       Voice sample filename for RunPod TTS (default: celeste_48k_stereo.wav)
 *   --skip-audio  Skip audio generation (reuses existing WAV files if present)
 *   --audio-only  Only generate/refresh narration audio, then exit (no HTML output)
 *   --force-audio Regenerate audio via RunPod TTS even if a cached WAV already
 *                 exists for it (in this video's own audio/ dir, or in the
 *                 durable audio store) — costs a fresh synthesis.
 *   --refresh-audio  Re-sync this video's own audio/ cache from the durable
 *                 audio store even if a local WAV already exists — cheap (a
 *                 file copy, no synthesis), unlike --force-audio. Each
 *                 video's audio/ dir only ever fills in what's missing, so
 *                 after refreshing narration elsewhere (a different
 *                 --output, or --audio-only run against this same output
 *                 earlier), a regenerated segment can silently keep playing
 *                 a stale take unless you pass this.
 *   --images-dir  Local directory of upscaled images (layout: <item-id>/images/*.png,
 *                 written by upscale-images-runpod.js) — overrides the DB image_url.
 *   --only        Comma list of item ids (or numeric indices, or "opening")
 *                 to (re)write just those segments — everything else on disk
 *                 is left untouched. Omit to write every segment.
 *   --refresh-images  Overwrite images already copied/downloaded into a
 *                      segment's own images/ folder with the current source
 *                      (local-data/images-dir file, or a fresh download) —
 *                      images are otherwise copied once and never revisited,
 *                      so a regenerated segment can silently keep stale art
 *                      after local-data is re-upscaled or image_url changes.
 */

const fs   = require('fs');
const path = require('path');
const { generateAudioBatch } = require('./lib/runpod-tts');
const audioStore = require('./lib/audio-store');
const { getWavDurationSeconds } = require('./lib/wav-duration');
const { getVideoTheme, rgba } = require('./lib/video-themes');
const { readWebImage, folderImages } = require('./lib/web-image');

// ── CLI args ──────────────────────────────────────────────────────────────────
const args = {};
for (const arg of process.argv.slice(2)) {
  if (arg.startsWith('--')) {
    const eq = arg.indexOf('=');
    if (eq !== -1) args[arg.slice(2, eq)] = arg.slice(eq + 1);
    else            args[arg.slice(2)]    = true;
  }
}

if (!args.db || !args.game) {
  console.error([
    'Usage: node scripts/gen-connections-video.js --db=gameoftrivia.db --game=contemporary-art',
    '',
    'Other options: --output  --title  --voice=celeste_48k_stereo.wav  --skip-audio',
    '               --audio-only  --force-audio  --refresh-audio  --images-dir=path/to/upscaled-images  --only=id1,id2',
    '               --refresh-images',
  ].join('\n'));
  process.exit(1);
}

const ttsVoice     = args.voice || 'celeste_48k_stereo.wav';
const skipAudio    = !!args['skip-audio'];
const audioOnly    = !!args['audio-only'];
const forceAudio   = !!args['force-audio'];
const refreshAudio = !!args['refresh-audio'];
const onlyArg      = args.only != null ? String(args.only) : null;
const imagesDirArg = args['images-dir'] || null;
const refreshImages = !!args['refresh-images'];
const writeOpening = onlyArg === null || onlyArg.split(',').map(s => s.trim().toLowerCase()).includes('opening');
const variant = String(args.variant || 'full').toLowerCase();
if (!['full', 'web'].includes(variant)) {
  console.error(`--variant must be "full" or "web" (got "${variant}")`);
  process.exit(1);
}

// ── Load game + items from DB ──────────────────────────────────────────────────
const Database = require('better-sqlite3');
const db = new Database(path.resolve(args.db));
const gameSlug = args.game;

const game = db.prepare('SELECT * FROM challenge_games WHERE slug = ?').get(args.game);
if (!game) {
  console.error(`Game not found: "${args.game}"`);
  console.error('Available:', db.prepare("SELECT slug FROM challenge_games WHERE game_type = 'connections_quiz' OR (game_type = 'generic_quiz' AND media_type = 'carousel')").all().map(r => r.slug).join(', '));
  db.close(); process.exit(1);
}
const isCarouselMedia = game.game_type === 'connections_quiz' || (game.game_type === 'generic_quiz' && game.media_type === 'carousel');
if (!isCarouselMedia) {
  console.error(`"${args.game}" is a "${game.game_type}"${game.media_type ? ` (media_type=${game.media_type})` : ''} game, not "connections_quiz" or a carousel-media "generic_quiz".`);
  db.close(); process.exit(1);
}

let outputDir   = args.output   || `videos/connections-challenge/${game.slug}`;
let videoTitle  = args.title    || game.title_en;
let videoTagline = args.tagline || 'Can you name the artist?';
let videoTag     = args.tag     || 'Artwork';
// Vertical crop anchor for images that don't fit 16:9: 0 = keep the top
// (portraits: heads stay in frame), 50 = centred (default), 100 = keep the bottom.
// How images that aren't 16:9 fill the frame: "cover" crops to fill (default),
// "contain" shows the whole image over a blurred, darkened copy of itself.
const imageFit = args.fit === 'contain' ? 'contain' : 'cover';
// Ken Burns strength for the web clips. Every bit of zoom crops on top of the
// unavoidable aspect-ratio crop, so "subtle" keeps a gentle movement with far
// less zoom. Pans stay within the zoom's margin so no edge ever shows
// (pan% ≤ (scale-1)/2 at the lowest scale).
const motion = args.motion === 'subtle'
  ? { questionEnd: 1.03, leadEnd: 1.03, kbLow: 1.02, kbHigh: 1.05, pan: 0.8 }
  : { questionEnd: 1.08, leadEnd: 1.06, kbLow: 1.05, kbHigh: 1.10, pan: 1.5 };
const imageFocusArg = Number(args['image-focus'] ?? 50);
const imageFocus = Number.isFinite(imageFocusArg) ? Math.min(100, Math.max(0, imageFocusArg)) : 50;
const revealDelayBuffer = game.reveal_delay_buffer ?? 0.5;
const videoTheme = getVideoTheme(game.theme_key);

const rawItems = db.prepare('SELECT * FROM challenge_items WHERE game_id = ? ORDER BY position').all(game.id).map(it => {
  // infograph_data is either a bare JSON array of *additional* carousel images
  // (see ItemsManager.tsx), or — for items converted from matching/chronology —
  // the richer {born, died, ..., images[]} object. image_url is always primary.
  let extra = [];
  try {
    const parsed = JSON.parse(it.infograph_data || '[]');
    extra = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.images) ? parsed.images : [];
  } catch { /* no extra images */ }
  return {
    id:                 it.id,
    name:               it.name,
    imageUrls:          [it.image_url, ...extra].filter(Boolean),
    carouselUrls:       null, // set by --folder-images: reveal-only images
    match:              it.clue_en,
    questionText:       it.question_text_en,
    questionAudioUrlEn: it.question_audio_url_en,
    answerAudioUrlEn:   it.answer_audio_url_en,
  };
});

console.log(`DB mode: ${game.slug} (${game.title_en})`);

if (args['folder-images']) {
  for (const it of rawItems) {
    // The folder holding image_url, or else the one holding the carousel images
    // (e.g. a main image kept one level up, with <name>/<name>.webp alongside
    // the numbered ones).
    const candidates = [...new Set(it.imageUrls.map(u => folderImages(u)))];
    const f = candidates.find(c => !c.error) || candidates[0] || { error: 'no images' };
    if (f.error) {
      console.warn(`  ⚠ ${it.name}: ${f.error} — using DB images`);
      continue;
    }
    for (const w of f.warnings || []) console.warn(`  ⚠ ${it.name}: ${w}`);
    it.imageUrls = [f.question, ...f.carousel];
    it.carouselUrls = f.carousel;
    console.log(`  Folder images: ${it.name} — ${f.folder} (question + ${f.carousel.length} carousel)`);
  }
}

// ── Image helpers ─────────────────────────────────────────────────────────────
function resolveImageUrl(url) {
  if (!url) return url;
  const match = url.match(/#\/media\/[^:]+:(.+)$/);
  if (match) return `https://commons.wikimedia.org/wiki/Special:FilePath/${match[1]}`;
  return url;
}

/** Local upscaled images for an item, if --images-dir has any at <id>/images/*.png. */
function findLocalImages(itemId, srcDir, limit = 5) {
  if (!srcDir) return [];
  const dir = path.join(srcDir, String(itemId), 'images');
  try {
    return fs.readdirSync(dir)
      .filter(f => /\.(png|jpe?g|webp)$/i.test(f))
      .sort()
      .slice(0, limit)
      .map(f => path.join(dir, f));
  } catch { return []; }
}

/** Ensures this scene's own images/ folder has every photo for the item
 *  (primary + extras), downloading whatever isn't available locally — never
 *  referencing a remote URL directly, so every segment stays self-contained.
 *  Existing files are left untouched unless --refresh-images is passed, so a
 *  segment re-generated after local-data/images-dir gets newer upscales (or
 *  the DB's image_url changes) actually picks up the new bytes instead of
 *  silently keeping whatever was copied in the first time. */
async function ensureSceneImages(item, segDir) {
  const destDir = path.join(segDir, 'images');
  fs.mkdirSync(destDir, { recursive: true });

  const local = findLocalImages(item.id, imagesDirArg, 5);
  if (local.length > 0) {
    console.log(`  Images: ${item.name} — ${local.length} local upscaled file(s)`);
    return local.map(src => {
      const dest = path.join(destDir, path.basename(src));
      const fresh = !fs.existsSync(dest);
      if (fresh || refreshImages) fs.copyFileSync(src, dest);
      if (!fresh && refreshImages) console.log(`    ↻ refreshed ${path.basename(src)}`);
      return `images/${path.basename(src)}`;
    });
  }

  const out = [];
  for (let j = 0; j < item.imageUrls.length; j++) {
    const url = resolveImageUrl(item.imageUrls[j]);
    if (!url) continue;
    const ext = (/\.([a-z0-9]+)(?:\?.*)?$/i.exec(url) || [, 'jpg'])[1].toLowerCase();
    const destPath = path.join(destDir, `art-${j}.${ext}`);
    if (!fs.existsSync(destPath) || refreshImages) {
      const img = await readWebImage(url);
      if (!img.ok) {
        console.warn(`    ✗ Failed to load ${url}: ${img.error}`);
        continue;
      }
      console.log(`  Images: ${item.name} [${j + 1}/${item.imageUrls.length}] — ${img.source === 'local' ? 'local copy' : 'downloaded'}${refreshImages ? ' (refresh)' : ''}`);
      fs.writeFileSync(destPath, img.buffer);
    } else {
      console.log(`  Images: ${item.name} [${j + 1}/${item.imageUrls.length}] — already cached in segment`);
    }
    out.push(`images/${path.basename(destPath)}`);
  }
  if (out.length === 0) console.log(`  Images: ${item.name} — none`);
  return out;
}

// ── Audio helpers ─────────────────────────────────────────────────────────────
function questionNarrationText(scene) {
  return (scene.questionText || '').trim();
}
/** Narrates just the artist's name (the caption already shows name + artist
 *  on screen) — same convention as gen-map-video.js. */
function answerNarrationText(scene) {
  return (scene.match || '').trim();
}

function copyIntoSegment(outAbsDir, segDir, relPathFromOutAbs, destSubdir, destFilename) {
  if (!relPathFromOutAbs) return null;
  const src = path.join(outAbsDir, relPathFromOutAbs);
  if (!fs.existsSync(src)) return null;
  const destDir = path.join(segDir, destSubdir);
  fs.mkdirSync(destDir, { recursive: true });
  fs.copyFileSync(src, path.join(destDir, destFilename));
  return `${destSubdir}/${destFilename}`;
}

/** Short slug from an item's name, so segment folders read like
 *  "001-the-physical-impossibility" instead of an opaque DB id. */
function slugify(name, maxLen = 24) {
  const slug = String(name)
    .toLowerCase()
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug.slice(0, maxLen).replace(/-+$/g, '') || 'item';
}

function segmentDirName(scene) {
  return `${String(scene.originalIndex + 1).padStart(3, '0')}-${slugify(scene.name)}`;
}

// ── Main ──────────────────────────────────────────────────────────────────────
(async () => {

const outAbs       = path.resolve(outputDir);
const segmentsRoot = path.join(outAbs, 'segments');

const items = rawItems.filter(it => it.imageUrls.length > 0 && it.match);
if (items.length === 0) {
  console.error('No items with both an image and an answer/match matched.');
  db.close(); process.exit(1);
}

console.log(`Building carousel video segments for ${items.length} artworks:`);
items.forEach(it => console.log(`  • ${it.name} (${it.match}) — ${it.imageUrls.length} image(s)`));

function getWrongOptions(itemId, allItems, sceneIndex) {
  const others = allItems.filter(it => it.id !== itemId);
  const sorted = [...others].sort((a, b) => a.match.localeCompare(b.match));
  const a = sorted[sceneIndex % sorted.length];
  const b = sorted[(sceneIndex + Math.ceil(sorted.length / 2)) % sorted.length];
  const pair = a.id === b.id ? [a, sorted[(sceneIndex + 1) % sorted.length]] : [a, b];
  return pair.map(it => it.match);
}

let scenes = items.map((it, i) => {
  const wrong = getWrongOptions(it.id, items, i);
  const correctSlot = i % 3;
  const opts = [...wrong];
  opts.splice(correctSlot, 0, it.match);

  return {
    originalIndex: i,
    id:            it.id,
    name:          it.name,
    match:         it.match,
    options:       opts,
    correctIndex:  correctSlot,
    questionText:        it.questionText || '',
    questionAudioUrlEn:  it.questionAudioUrlEn || '',
    answerAudioUrlEn:    it.answerAudioUrlEn   || '',
  };
});

// ── --only filter ──────────────────────────────────────────────────────────
if (onlyArg !== null) {
  const requested = onlyArg.split(',').map(s => s.trim()).filter(s => s.toLowerCase() !== 'opening');
  if (requested.length > 0) {
    const indices = requested.map(s => {
      const n = parseInt(s, 10);
      if (isNaN(n)) return -1;
      const byId = scenes.findIndex(sc => sc.id === n);
      return byId !== -1 ? byId : n;
    }).filter(n => n >= 0 && n < scenes.length);
    if (indices.length === 0) {
      console.error(`--only: no scenes matched "${onlyArg}". Valid indices: 0–${scenes.length - 1}, or an item id.`);
      process.exit(1);
    }
    scenes = indices.map(n => scenes[n]);
    console.log(`Segment mode: (re)writing scene(s) ${indices.join(', ')} only`);
  } else {
    scenes = [];
    console.log(`Segment mode: (re)writing the opening segment only`);
  }
}

// ── Timing constants (seconds) ─────────────────────────────────────────────────
// Narration starts immediately at T_PANEL_IN; the panel/timer/reveal only
// appear once it (plus the game's reveal-delay buffer) has finished, so the
// whole "shifted" block after T_PANEL_IN moves later by `shift` for scenes
// with longer narration — the countdown window itself keeps its original
// fixed LENGTH (T_REVEAL - T_PANEL_IN), only WHEN it starts moves.
const OPENING           = 4;
const T_PANEL_IN         = 0.5;  // narration-q starts here (fixed)
const T_REVEAL           = 9.2;  // fixed length countdown window; actual reveal at T_REVEAL + shift
const IMG_DUR            = 3.0;  // seconds per additional carousel image after reveal
const POST_REVEAL_HOLD   = 2.0;  // hold after the carousel finishes, before cutting away
const SCENE_TAIL         = 1.5;  // buffer held at the very end of the segment

// ── Audio generation ───────────────────────────────────────────────────────────
const questionAudioPaths = new Map();
const answerAudioPaths   = new Map();
const audioDir = path.join(outAbs, 'audio');

console.log(`\nAudio dir: ${audioDir}`);
if (!skipAudio) {
  fs.mkdirSync(audioDir, { recursive: true });
  console.log('Generating audio (RunPod TTS):');

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
      const label = `Scene ${i + 1}/${scenes.length} (${scene.name}) ${clip.kind}`;
      const hadLocal = fs.existsSync(audioFile);
      if (!forceAudio && !refreshAudio && hadLocal) {
        console.log(`  ${label} — already exists`);
        clip.map.set(i, `audio/${clip.file}`);
        continue;
      }
      if (!forceAudio && audioStore.ensureLocalCopy(gameSlug, String(scene.id), clip.kind, audioFile, { overwrite: refreshAudio })) {
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
        const scene = scenes[c.sceneIdx];
        const url = audioStore.persistCanonical(gameSlug, String(scene.id), c.kind, c.audioFile);
        db.prepare(`UPDATE challenge_items SET ${c.dbColumn} = ? WHERE id = ?`).run(url, scene.id);
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
      if (fs.existsSync(audioFile) || (dbUrl && audioStore.ensureLocalCopy(gameSlug, String(scene.id), kind, audioFile))) {
        map.set(i, `audio/${file}`);
        found++;
      } else {
        console.log(`  ${file} — NOT FOUND (${scene.name})`);
        missing++;
      }
    }
  }
  console.log(`Audio: ${found} found, ${missing} missing (--skip-audio)`);
}

if (audioOnly) {
  console.log(`\nAudio-only mode: skipped HTML/video generation.`);
  db.close();
  return;
}

// ── Per-scene variable duration (based on measured narration length) ──────────
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
}

// ── Shared page shell (identical DOM/CSS for every segment) ───────────────────
function pageShell({ compositionId, totalDur, audioElements, innerScript }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${videoTitle}</title>
  ${videoTheme.googleFontHref ? `<link rel="stylesheet" href="${videoTheme.googleFontHref}">` : ''}
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      width: 1920px; height: 1080px;
      overflow: hidden;
      background: rgb(${videoTheme.panelBgRgb});
      font-family: Georgia, 'Times New Roman', serif;
    }

    #stage { width: 1920px; height: 1080px; position: relative; overflow: hidden; }

    /* ── Left-column carousel (right column reserved for the answer panel) ── */
    #carousel {
      position: absolute; top: 0; left: 0;
      width: 1340px; height: 1080px;
      z-index: 10;
      background: #0a131c;
      overflow: hidden;
    }
    .car-img {
      position: absolute; inset: 0;
      overflow: hidden;
      transform-origin: center center;
      will-change: transform;
    }
    .car-img > img { position: absolute; inset: 0; width: 100%; height: 100%; }
    .car-fg { object-fit: ${imageFit}; object-position: 50% ${imageFocus}%; }
    .car-bg {
      display: ${imageFit === 'contain' ? 'block' : 'none'};
      object-fit: cover;
      filter: blur(48px) brightness(0.45);
      transform: scale(1.15);
    }
    #car-label {
      position: absolute; bottom: 0; left: 0; right: 0;
      background: linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.78) 45%);
      padding: 100px 64px 56px;
      pointer-events: none;
      opacity: 0;
    }
    #car-tag {
      font-size: 12px; color: ${videoTheme.panelAccent};
      text-transform: uppercase; letter-spacing: 0.28em;
      font-family: sans-serif; margin-bottom: 10px;
    }
    #car-name {
      font-size: 44px; font-weight: normal;
      color: #fff; letter-spacing: 0.02em;
      text-shadow: 0 2px 24px rgba(0,0,0,0.8);
      line-height: 1.1; margin-bottom: 8px;
    }
    #car-artist {
      font-size: 22px; color: ${videoTheme.correct};
      font-family: sans-serif; letter-spacing: 0.06em;
    }

    /* ── Right-column answer panel (persistent for the whole question) ──── */
    #answer-panel {
      position: absolute;
      top: 0; right: 0;
      width: 580px; height: 1080px;
      background: rgba(${videoTheme.panelBgRgb}, 0.94);
      border-left: 1.5px solid ${rgba(videoTheme.panelAccent, 0.3)};
      z-index: 6;
      display: flex;
      flex-direction: column;
      justify-content: center;
      padding: 0 56px;
      pointer-events: none;
      opacity: 0;
    }
    #q-text {
      color: rgba(255,255,255,0.85);
      font-size: 24px;
      font-family: Georgia, serif;
      line-height: 1.4;
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
      border-radius: ${videoTheme.buttonRadius || '12px'};
      font-size: 25px;
      font-family: ${videoTheme.buttonFont || 'Georgia, serif'};
      color: rgba(255,255,255,0.85);
      background: rgba(255,255,255,0.06);
      border: 1.5px solid rgba(255,255,255,0.14);
      text-align: left;
      letter-spacing: 0.01em;
      line-height: 1.25;
      ${videoTheme.buttonTextTransform || ''}
    }
    .opt.correct {
      background: ${rgba(videoTheme.correct, 0.18)};
      border-color: ${videoTheme.correct};
      color: ${videoTheme.correct};
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

  <!-- Full-screen artwork carousel -->
  <div id="carousel">
    <div id="car-img-0" class="car-img"><img class="car-bg" src="" alt=""/><img class="car-fg" src="" alt=""/></div>
    <div id="car-img-1" class="car-img" style="opacity:0"><img class="car-bg" src="" alt=""/><img class="car-fg" src="" alt=""/></div>
    <div id="car-img-2" class="car-img" style="opacity:0"><img class="car-bg" src="" alt=""/><img class="car-fg" src="" alt=""/></div>
    <div id="car-img-3" class="car-img" style="opacity:0"><img class="car-bg" src="" alt=""/><img class="car-fg" src="" alt=""/></div>
    <div id="car-img-4" class="car-img" style="opacity:0"><img class="car-bg" src="" alt=""/><img class="car-fg" src="" alt=""/></div>
    <div id="car-label">
      <div id="car-tag">${videoTag}</div>
      <div id="car-name"></div>
      <div id="car-artist"></div>
    </div>
  </div>

  <!-- Title card -->
  <div id="title-card" style="opacity:0">
    <h1>${videoTitle}</h1>
    <p>${videoTagline}</p>
  </div>

  <!-- Answer panel (right column) — persistent for the whole question;
       the correct option highlights when the progress bar finishes depleting -->
  <div id="answer-panel">
    <div id="q-text"></div>
    <div id="progress-bar-track">
      <div id="progress-bar-fill"></div>
    </div>
    <div id="options-container">
      <div class="opt" id="opt-0"></div>
      <div class="opt" id="opt-1"></div>
      <div class="opt" id="opt-2"></div>
    </div>
  </div>

  <!-- Narration audio -->
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
  function setSlideSrc(slot, src) {
    slot.querySelectorAll('img').forEach(im => { im.src = src; });
  }

${innerScript}

  window.__timelines = window.__timelines || {};
  window.__timelines['${compositionId}'] = tl;
})();
</script>
</body>
</html>`;
}

// ── Opening segment (shared title card, no specific artwork) ───────────────────
function writeOpeningSegment() {
  const compositionId = `000-opening-${path.basename(outputDir)}`;
  const segDir = path.join(segmentsRoot, compositionId);
  const innerScript = `  tl.set('#carousel', { opacity: 0 });
  tl.to('#title-card', { opacity: 1, duration: 1.2, ease: 'power1.inOut' }, 0.6);
  tl.to('#title-card', { opacity: 0, duration: 0.8, ease: 'power1.in'    }, 3.2);`;

  const html = pageShell({ compositionId, totalDur: OPENING, audioElements: '', innerScript });
  fs.mkdirSync(segDir, { recursive: true });
  fs.writeFileSync(path.join(segDir, 'index.html'), html, 'utf-8');
  console.log(`  ✓ segments/${compositionId}/index.html (${OPENING}s)`);
}

// ── One scene's segment ─────────────────────────────────────────────────────
async function writeSceneSegment(scene, i) {
  const compositionId = segmentDirName(scene);
  const segDir = path.join(segmentsRoot, compositionId);
  fs.mkdirSync(segDir, { recursive: true });

  const shift = scene.waitDuration || 0;
  const qPath = questionAudioPaths.get(i);
  const aPath = answerAudioPaths.get(i);

  const qSegPath = copyIntoSegment(outAbs, segDir, qPath, 'audio', 'question.wav');
  const aSegPath = copyIntoSegment(outAbs, segDir, aPath, 'audio', 'answer.wav');
  const item = items.find(it => it.id === scene.id);
  const images = await ensureSceneImages(item, segDir);

  const revealAt = T_REVEAL + shift;

  const audioElements = [
    qSegPath ? `  <audio id="narration-q" data-start="${T_PANEL_IN.toFixed(2)}" data-duration="${Math.max(0.1, scene.narrationDuration - 0.05).toFixed(2)}" data-track-index="1" src="${qSegPath}"></audio>` : '',
    aSegPath ? `  <audio id="narration-a" data-start="${(revealAt + 0.1).toFixed(2)}" data-duration="${Math.max(0.1, scene.answerDuration - 0.05).toFixed(2)}" data-track-index="1" src="${aSegPath}"></audio>` : '',
  ].filter(Boolean).join('\n');

  const imgCount = Math.min(images.length, 5);
  const carStart = revealAt + 0.2;
  const carDur   = imgCount > 1 ? (imgCount - 1) * IMG_DUR : 0;
  const carEnd   = carStart + carDur;
  const exitAt   = carEnd + POST_REVEAL_HOLD;
  const sceneDuration = Number((exitAt + SCENE_TAIL).toFixed(2));
  scene.sceneDuration = sceneDuration;

  const sceneJson = JSON.stringify({ ...scene, images }); // images are already segment-relative

  const innerScript = `  const scene = ${sceneJson};
  const shift    = scene.waitDuration || 0;
  const T_PI     = ${T_PANEL_IN};
  const T_RV     = ${T_REVEAL};
  const carStart = ${carStart.toFixed(3)};
  const carDur   = ${carDur.toFixed(3)};
  const imgCount = ${imgCount};
  const imgInterval = imgCount > 1 ? carDur / (imgCount - 1) : carDur;
  const qDur = T_RV - T_PI;

  // ─ Setup ──────────────────────────────────────────────────────────────────
  ['opt-0','opt-1','opt-2'].forEach((id, j) => {
    const el = document.getElementById(id);
    if (el) { el.textContent = scene.options[j] || ''; el.className = 'opt'; }
  });
  for (let j = 0; j < 5; j++) {
    const img = document.getElementById('car-img-' + j);
    if (!img) continue;
    setSlideSrc(img, scene.images[j] || '');
    gsap.set(img, { opacity: j === 0 ? 1 : 0 });
  }
  setText('q-text', scene.questionText || 'Who created this artwork?');

  // ─ Continuous Ken Burns pan on the primary image, visible from frame 0 ───
  if (scene.images[0]) {
    tl.fromTo('#car-img-0', { scale: 1 }, { scale: 1.08, duration: scene.sceneDuration, ease: 'none' }, 0);
  }

  // ─ Answer panel fades in — waits for narration to finish (+ buffer) ──────
  tl.to('#answer-panel', { opacity: 1, duration: 0.7, ease: 'power1.inOut', overwrite: 'auto' }, T_PI + shift);

  // ─ Progress bar: green → amber → red depletion, ends exactly at reveal ───
  tl.set('#progress-bar-fill', { width: '100%', backgroundColor: '#4ade80', opacity: 1 }, T_PI + shift);
  tl.to('#progress-bar-fill', { width: '0%', duration: qDur, ease: 'none', overwrite: 'auto' }, T_PI + shift);
  tl.to('#progress-bar-fill', { backgroundColor: '#fbbf24', duration: qDur * 0.7, ease: 'none', overwrite: 'auto' }, T_PI + shift);
  tl.to('#progress-bar-fill', { backgroundColor: '#ef4444', duration: qDur * 0.3, ease: 'none', overwrite: 'auto' }, T_PI + shift + qDur * 0.7);

  // ─ Reveal: correct answer highlights, caption appears ────────────────────
  tl.call(() => {
    const el = document.getElementById('opt-' + scene.correctIndex);
    if (el) el.className = 'opt correct';
    setText('car-name', scene.name);
    setText('car-artist', scene.match);
  }, [], T_RV + shift);
  tl.to('#progress-bar-fill', { opacity: 0, duration: 0.4, ease: 'power1.in', overwrite: 'auto' }, T_RV + shift);
  tl.to('#car-label', { opacity: 1, duration: 0.5, ease: 'power1.inOut', overwrite: 'auto' }, T_RV + shift);

  // ─ Post-reveal carousel: crossfade through any additional images ─────────
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

  // ─ Out ────────────────────────────────────────────────────────────────────
  tl.to('#answer-panel', { opacity: 0, duration: 0.6, ease: 'power1.in', overwrite: 'auto' }, ${exitAt.toFixed(2)});
  tl.to('#car-label',    { opacity: 0, duration: 0.6, ease: 'power1.in', overwrite: 'auto' }, ${exitAt.toFixed(2)});`;

  const html = pageShell({ compositionId, totalDur: sceneDuration, audioElements, innerScript });
  fs.writeFileSync(path.join(segDir, 'index.html'), html, 'utf-8');
  console.log(`  ✓ segments/${compositionId}/index.html (${sceneDuration}s, narration ${scene.narrationDuration}s, ${imgCount} image(s))`);
}

// ── WEB VARIANT ──────────────────────────────────────────────────────────────
// Two lighter compositions per item instead of one continuous timeline — no
// answer panel, no countdown. A real web quiz UI already owns real buttons
// and decides *when* the reveal happens (on click, at an unpredictable time),
// which a single baked timeline with a fixed reveal instant can't represent.
// Splitting into "question" (ends on its own natural last frame — the web
// page just pauses there, however long the visitor takes to answer) and
// "reveal" (re-zeroed at the old reveal instant, played from t=0 on click)
// means every hand-off is a fresh file start — always a keyframe, no need to
// force one at an arbitrary mid-file seek target.
function webPageShell({ compositionId, totalDur, audioElements, innerScript, showLabel }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${videoTitle}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 1920px; height: 1080px; overflow: hidden; background: #0a131c; }
    #stage { width: 1920px; height: 1080px; position: relative; overflow: hidden; }
    #carousel { position: absolute; inset: 0; background: #0a131c; overflow: hidden; }
    .car-img {
      position: absolute; inset: 0;
      overflow: hidden;
      transform-origin: center center;
      will-change: transform;
    }
    .car-img > img { position: absolute; inset: 0; width: 100%; height: 100%; }
    .car-fg { object-fit: ${imageFit}; object-position: 50% ${imageFocus}%; }
    .car-bg {
      display: ${imageFit === 'contain' ? 'block' : 'none'};
      object-fit: cover;
      filter: blur(48px) brightness(0.45);
      transform: scale(1.15);
    }
    #car-label {
      position: absolute; bottom: 0; left: 0; right: 0;
      background: linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.78) 45%);
      padding: 100px 64px 56px;
      opacity: 0;
    }
    #car-tag { font-size: 12px; color: ${videoTheme.panelAccent}; text-transform: uppercase; letter-spacing: 0.28em; font-family: sans-serif; margin-bottom: 10px; }
    #car-name { font-size: 44px; font-weight: normal; color: #fff; letter-spacing: 0.02em; text-shadow: 0 2px 24px rgba(0,0,0,0.8); line-height: 1.1; margin-bottom: 8px; font-family: Georgia, serif; }
    #car-artist { font-size: 22px; color: ${videoTheme.correct}; font-family: sans-serif; letter-spacing: 0.06em; }
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
    <div id="car-img-0" class="car-img"><img class="car-bg" src="" alt=""/><img class="car-fg" src="" alt=""/></div>
    <div id="car-img-1" class="car-img" style="opacity:0"><img class="car-bg" src="" alt=""/><img class="car-fg" src="" alt=""/></div>
    <div id="car-img-2" class="car-img" style="opacity:0"><img class="car-bg" src="" alt=""/><img class="car-fg" src="" alt=""/></div>
    <div id="car-img-3" class="car-img" style="opacity:0"><img class="car-bg" src="" alt=""/><img class="car-fg" src="" alt=""/></div>
    <div id="car-img-4" class="car-img" style="opacity:0"><img class="car-bg" src="" alt=""/><img class="car-fg" src="" alt=""/></div>
    ${showLabel ? `<div id="car-label">
      <div id="car-tag">${videoTag}</div>
      <div id="car-name"></div>
      <div id="car-artist"></div>
    </div>` : ''}
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
  function setSlideSrc(slot, src) {
    slot.querySelectorAll('img').forEach(im => { im.src = src; });
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

  const item = items.find(it => it.id === scene.id);
  // "question" only ever shows the primary image, so only fetch that one —
  // the full carousel set belongs to the "reveal" clip.
  const primaryOnlyItem = { ...item, imageUrls: item.imageUrls.slice(0, 1) };
  const imagesQ = await ensureSceneImages(primaryOnlyItem, qDir);
  // Reveal carousel: with --folder-images only the numbered images (the
  // question image already had its moment); otherwise the DB list as before.
  const revealItem = item.carouselUrls && item.carouselUrls.length > 0
    ? { ...item, imageUrls: item.carouselUrls }
    : item;
  const imagesR = await ensureSceneImages(revealItem, rDir);

  // ── "question" clip: narration + Ken Burns hold, no countdown/panel ──────
  const HOLD_TAIL = 1.0; // small settle after narration ends before the clip ends
  const qDuration = Number((T_PANEL_IN + scene.narrationDuration + HOLD_TAIL).toFixed(2));

  const qAudioElements = qSegPath
    ? `  <audio id="narration-q" data-start="${T_PANEL_IN.toFixed(2)}" data-duration="${Math.max(0.1, scene.narrationDuration - 0.05).toFixed(2)}" data-track-index="1" src="${qSegPath}"></audio>`
    : '';

  const qInnerScript = `  const scene = ${JSON.stringify({ ...scene, images: imagesQ })};
  for (let j = 0; j < 5; j++) {
    const img = document.getElementById('car-img-' + j);
    if (!img) continue;
    setSlideSrc(img, j === 0 ? (scene.images[0] || '') : '');
    gsap.set(img, { opacity: j === 0 ? 1 : 0 });
  }
  if (scene.images[0]) {
    tl.fromTo('#car-img-0', { scale: 1 }, { scale: ${motion.questionEnd}, duration: ${qDuration}, ease: 'none' }, 0);
  }`;

  const qHtml = webPageShell({ compositionId: qId, totalDur: qDuration, audioElements: qAudioElements, innerScript: qInnerScript, showLabel: false });
  fs.writeFileSync(path.join(qDir, 'index.html'), qHtml, 'utf-8');
  console.log(`  ✓ segments/${qId}/index.html (${qDuration}s, narration ${scene.narrationDuration}s)`);

  // ── "reveal" clip: re-zeroed at the old reveal instant ───────────────────
  const imgCount = Math.min(imagesR.length, 5);
  const carStart = 0.2;
  const carDur   = imgCount > 1 ? (imgCount - 1) * IMG_DUR : 0;
  // A DB-list reveal opens on the question image the viewer just saw, so it
  // moves on at once. A --folder-images reveal opens on a fresh carousel image,
  // which gets its own full slot (and Ken Burns) before the first switch.
  const leadHold = revealItem !== item ? IMG_DUR : 0;
  const carEnd   = carStart + leadHold + carDur;
  const exitAt   = carEnd + POST_REVEAL_HOLD;
  const rDuration = Number((exitAt + SCENE_TAIL).toFixed(2));

  const rAudioElements = aSegPath
    ? `  <audio id="narration-a" data-start="0.10" data-duration="${Math.max(0.1, scene.answerDuration - 0.05).toFixed(2)}" data-track-index="1" src="${aSegPath}"></audio>`
    : '';

  const rInnerScript = `  const scene = ${JSON.stringify({ ...scene, images: imagesR })};
  const carStart = ${carStart.toFixed(3)};
  const carDur   = ${carDur.toFixed(3)};
  const leadHold = ${leadHold.toFixed(3)};
  const imgCount = ${imgCount};
  const imgInterval = imgCount > 1 ? carDur / (imgCount - 1) : carDur;

  for (let j = 0; j < 5; j++) {
    const img = document.getElementById('car-img-' + j);
    if (!img) continue;
    setSlideSrc(img, scene.images[j] || '');
    gsap.set(img, { opacity: j === 0 ? 1 : 0 });
  }
  if (scene.images[0]) {
    if (leadHold > 0) {
      tl.fromTo('#car-img-0', { scale: 1.0 }, { scale: ${motion.leadEnd}, duration: imgCount > 1 ? carStart + leadHold + 0.9 : ${rDuration}, ease: 'none' }, 0);
    } else {
      tl.fromTo('#car-img-0', { scale: ${motion.questionEnd} }, { scale: ${motion.questionEnd}, duration: ${rDuration}, ease: 'none' }, 0);
    }
  }

  tl.call(() => { setText('car-name', scene.name); setText('car-artist', scene.match); }, [], 0);
  tl.to('#car-label', { opacity: 1, duration: 0.5, ease: 'power1.inOut', overwrite: 'auto' }, 0);

  const lo = ${motion.kbLow}, hi = ${motion.kbHigh}, p = ${motion.pan}, k = p / 1.5;
  const KB = [
    { from: { scale: lo, xPercent:  p,     yPercent:  0.5 * k }, to: { scale: hi, xPercent: -p,     yPercent: -1.0 * k } },
    { from: { scale: hi, xPercent: -p,     yPercent: -1.0 * k }, to: { scale: lo, xPercent:  p,     yPercent:  0.5 * k } },
    { from: { scale: lo, xPercent: -1.0 * k, yPercent:  p     }, to: { scale: hi, xPercent:  1.0 * k, yPercent: -p     } },
  ];
  for (let j = 1; j < imgCount; j++) {
    const switchAt = carStart + leadHold + (j - 1) * imgInterval;
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

  const rHtml = webPageShell({ compositionId: rId, totalDur: rDuration, audioElements: rAudioElements, innerScript: rInnerScript, showLabel: true });
  fs.writeFileSync(path.join(rDir, 'index.html'), rHtml, 'utf-8');
  console.log(`  ✓ segments/${rId}/index.html (${rDuration}s, ${imgCount} image(s))`);
}

// ── Write segments ─────────────────────────────────────────────────────────
console.log(`\nWriting segments to ${outputDir}/segments/ (variant: ${variant})`);
if (variant === 'web') {
  for (let i = 0; i < scenes.length; i++) await writeSceneSegmentsWeb(scenes[i], i);
} else {
  if (writeOpening) writeOpeningSegment();
  for (let i = 0; i < scenes.length; i++) await writeSceneSegment(scenes[i], i);
}

console.log(`\nDone: ${scenes.length} scene segment(s)${variant === 'full' && writeOpening ? ' + opening' : ''} written.`);
console.log(`\nNext steps:`);
console.log(`  npx hyperframes browser ensure`);
console.log(`  npx hyperframes preview ${outputDir}/segments/<segment-dir>      # preview one segment`);
console.log(`  npx hyperframes render ${outputDir}/segments/<segment-dir> --fps=30   # render one segment`);
console.log(`  node scripts/concat-video-segments.js --dir=${outputDir}             # stitch all rendered segments into the final video`);

db.close();

})().catch(err => {
  console.error('\nError:', err.message);
  db.close();
  process.exit(1);
});
