#!/usr/bin/env node
'use strict';
/**
 * concat-video-segments.js
 * Stitches the individually-rendered per-segment MP4s (from gen-map-video.js's
 * or gen-connections-video.js's segments/ output) into one final video, in
 * segment order (000-opening, 001-<park>, 002-<park>, ...).
 *
 * Each segment is rendered independently via:
 *   npx hyperframes render <dir>/segments/<segment> --fps=30
 * which drops an MP4 into renders/<segment-composition-id>_<timestamp>.mp4.
 * This script finds each segment's most recent render and concatenates them
 * with ffmpeg (stream copy — no re-encode, so it's fast and lossless).
 *
 * Usage:
 *   node scripts/concat-video-segments.js --dir=videos/map-challenge/south-america-parks
 *   node scripts/concat-video-segments.js --dir=videos/map-challenge/south-america-parks --output=renders/final.mp4
 *
 * Options:
 *   --dir      Base video directory (the one passed to gen-map-video.js / gen-connections-video.js --output) — required
 *   --output   Output MP4 path (default: renders/<dir-basename>_final_<timestamp>.mp4)
 *   --renders  Directory HyperFrames writes rendered MP4s to (default: renders)
 */

const fs   = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const args = {};
for (const arg of process.argv.slice(2)) {
  if (arg.startsWith('--')) {
    const eq = arg.indexOf('=');
    if (eq !== -1) args[arg.slice(2, eq)] = arg.slice(eq + 1);
    else            args[arg.slice(2)]    = true;
  }
}

if (!args.dir) {
  console.error('Usage: node scripts/concat-video-segments.js --dir=videos/map-challenge/<slug> [--output=path.mp4] [--renders=renders]');
  process.exit(1);
}

const baseDir      = path.resolve(args.dir);
const segmentsRoot = path.join(baseDir, 'segments');
const rendersDir   = path.resolve(args.renders || 'renders');

if (!fs.existsSync(segmentsRoot)) {
  console.error(`No segments/ directory found at ${segmentsRoot}`);
  console.error(`Generate segments first with gen-map-video.js / gen-connections-video.js --output=${args.dir}`);
  process.exit(1);
}

const segmentDirs = fs.readdirSync(segmentsRoot, { withFileTypes: true })
  .filter(e => e.isDirectory())
  .map(e => e.name)
  // The "web" variant (gen-map-video.js / gen-connections-video.js --variant=web)
  // writes "-question"/"-reveal" segments into this same shared segments/ dir —
  // those are web-UI-only clips, never part of the concatenated video, and must
  // not be double-counted alongside their "full"-variant sibling.
  .filter(name => !/-question$|-reveal$/.test(name))
  .sort(); // zero-padded numeric prefixes sort correctly as plain strings

if (segmentDirs.length === 0) {
  console.error(`No segment folders found in ${segmentsRoot}`);
  process.exit(1);
}

console.log(`Found ${segmentDirs.length} segment(s) in ${path.relative(process.cwd(), segmentsRoot)}:`);

/** Latest renders/<compositionId>_*.mp4 by mtime, or null if none exist. */
function latestRenderFor(compositionId) {
  let files;
  try {
    files = fs.readdirSync(rendersDir);
  } catch {
    return null;
  }
  const prefix = `${compositionId}_`;
  const matches = files
    .filter(f => f.startsWith(prefix) && f.endsWith('.mp4'))
    .map(f => {
      const full = path.join(rendersDir, f);
      return { full, mtime: fs.statSync(full).mtimeMs };
    })
    .sort((a, b) => b.mtime - a.mtime);
  return matches.length > 0 ? matches[0].full : null;
}

const resolved = segmentDirs.map(id => ({ id, render: latestRenderFor(id) }));
const missing  = resolved.filter(r => !r.render);

resolved.forEach(({ id, render }) => {
  console.log(`  ${render ? '✓' : '✗'} ${id}${render ? ` → ${path.basename(render)}` : ' — NOT RENDERED'}`);
});

if (missing.length > 0) {
  console.error(`\n${missing.length} segment(s) haven't been rendered yet. Render them first:`);
  missing.forEach(({ id }) => {
    console.error(`  npx hyperframes render ${path.relative(process.cwd(), path.join(segmentsRoot, id))} --fps=30`);
  });
  process.exit(1);
}

/** Does this file have an audio stream? (ffmpeg's concat demuxer silently
 *  drops ALL audio if the stream layout isn't identical across every input —
 *  e.g. a silent opening clip followed by clips that do have narration.) */
function hasAudioStream(file) {
  const out = execFileSync('ffprobe', [
    '-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=index', '-of', 'csv=p=0', file,
  ]).toString().trim();
  return out.length > 0;
}

/** Sample rate of a file's first audio stream, or null if it has none. */
function audioSampleRate(file) {
  const out = execFileSync('ffprobe', [
    '-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=sample_rate', '-of', 'csv=p=0', file,
  ]).toString().trim();
  return out ? Number(out) : null;
}

/** Patches a video-only file with a silent audio track (matching its video
 *  duration) so it has the same stream layout as clips that do have audio.
 *  The silent track must match the real narration tracks' sample rate —
 *  the concat demuxer stream-copies audio without resampling, so a mismatch
 *  (e.g. a 44.1kHz placeholder spliced before 48kHz narration) makes it
 *  mis-time every packet after the first segment, stretching/shifting all
 *  the audio that follows. */
function withSilentAudio(inputFile, tmpDir, sampleRate) {
  const outFile = path.join(tmpDir, `silent-${path.basename(inputFile)}`);
  execFileSync('ffmpeg', [
    '-y',
    '-i', inputFile,
    '-f', 'lavfi', '-i', `anullsrc=channel_layout=stereo:sample_rate=${sampleRate}`,
    '-c:v', 'copy', '-c:a', 'aac', '-shortest',
    '-map', '0:v:0', '-map', '1:a:0',
    outFile,
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  return outFile;
}

const audioFlags = resolved.map(({ render }) => hasAudioStream(render));
const anyAudio    = audioFlags.some(Boolean);
const allAudio    = audioFlags.every(Boolean);

// Match the real narration tracks' sample rate, not a hardcoded guess.
const realSampleRate = anyAudio
  ? audioSampleRate(resolved.find((_, i) => audioFlags[i]).render) || 48000
  : 48000;

const tmpDir = path.join(rendersDir, `.concat-tmp-${Date.now()}`);
if (anyAudio && !allAudio) {
  console.log(`\nNormalizing audio tracks (some segments are silent, e.g. the opening) before concatenating...`);
  fs.mkdirSync(tmpDir, { recursive: true });
}

const inputsForConcat = resolved.map(({ render }, i) => {
  if (anyAudio && !allAudio && !audioFlags[i]) {
    const patched = withSilentAudio(render, tmpDir, realSampleRate);
    console.log(`  + silent audio track added to ${path.basename(render)}`);
    return patched;
  }
  return render;
});

// ── Build ffmpeg concat list ───────────────────────────────────────────────────
const listPath = path.join(rendersDir, `.concat-list-${Date.now()}.txt`);
const listContent = inputsForConcat.map(f => `file '${f.replace(/'/g, "'\\''")}'`).join('\n');
fs.writeFileSync(listPath, listContent, 'utf-8');

const now = new Date();
const stamp = now.toISOString().slice(0, 19).replace('T', '_').replace(/:/g, '-');
const outputPath = args.output || path.join(rendersDir, `${path.basename(baseDir)}_final_${stamp}.mp4`);
fs.mkdirSync(path.dirname(path.resolve(outputPath)), { recursive: true });

console.log(`\nConcatenating ${resolved.length} clip(s) → ${outputPath}`);
try {
  execFileSync('ffmpeg', [
    '-y',
    '-f', 'concat',
    '-safe', '0',
    '-i', listPath,
    '-c', 'copy',
    path.resolve(outputPath),
  ], { stdio: 'inherit' });
} catch (err) {
  console.error('\nffmpeg concat failed — this usually means the segments have mismatched codec/resolution/fps.');
  console.error('If they were all rendered the same way (same --fps, same HyperFrames version) this should not happen.');
  fs.unlinkSync(listPath);
  if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
  process.exit(1);
}

fs.unlinkSync(listPath);
if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
console.log(`\nDone: ${outputPath}`);
