#!/usr/bin/env node
'use strict';
/**
 * encode-web-videos.js
 * Re-encodes the full-quality challenge videos in public/videos/<game>/*.mp4
 * into lighter web versions in local-data/web-videos/<game>/*.mp4 — 720p H.264
 * with faststart, about a tenth of the size. The web player shows them at
 * most ~768px wide, so 1080p only costs bandwidth.
 *
 * local-data/web-videos is what the site serves locally (VIDEO_DIR default)
 * and what upload-web-videos.sh copies to the server, so local dev plays
 * exactly what production will.
 *
 * Usage:
 *   node scripts/encode-web-videos.js                 # all games, changed files only
 *   node scripts/encode-web-videos.js --game=quantum-scientists
 *   node scripts/encode-web-videos.js --force         # re-encode everything
 *
 * Files are skipped when the web version is newer than its source. Each output
 * is checked to keep the source duration (quiz hold times are based on it).
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const args = {};
for (const a of process.argv.slice(2)) {
  const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
  if (m) args[m[1]] = m[2] ?? true;
}

const ROOT = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT, 'public', 'videos');
const OUT_DIR = path.join(ROOT, 'local-data', 'web-videos');
const CRF = String(args.crf || 23);

function duration(file) {
  const out = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]);
  return Number(String(out).trim());
}

if (!fs.existsSync(SRC_DIR)) {
  console.error(`No source videos in ${SRC_DIR}`);
  process.exit(1);
}

const games = fs.readdirSync(SRC_DIR, { withFileTypes: true })
  .filter(d => d.isDirectory() && (!args.game || d.name === args.game))
  .map(d => d.name);
if (args.game && games.length === 0) {
  console.error(`Game folder not found: public/videos/${args.game}`);
  process.exit(1);
}

let encoded = 0, skipped = 0, failed = 0, srcBytes = 0, outBytes = 0;
for (const game of games) {
  const files = fs.readdirSync(path.join(SRC_DIR, game)).filter(f => f.toLowerCase().endsWith('.mp4')).sort();
  fs.mkdirSync(path.join(OUT_DIR, game), { recursive: true });
  for (const f of files) {
    const src = path.join(SRC_DIR, game, f);
    const out = path.join(OUT_DIR, game, f);
    const srcStat = fs.statSync(src);
    if (!args.force && fs.existsSync(out) && fs.statSync(out).mtimeMs >= srcStat.mtimeMs) {
      skipped++;
      continue;
    }
    const tmp = out + '.tmp.mp4';
    try {
      execFileSync('ffmpeg', [
        '-v', 'error', '-y', '-i', src,
        '-vf', 'scale=-2:720:flags=lanczos',
        '-c:v', 'libx264', '-preset', 'slow', '-crf', CRF, '-profile:v', 'high', '-pix_fmt', 'yuv420p',
        '-c:a', 'aac', '-b:a', '128k',
        '-movflags', '+faststart',
        tmp,
      ], { stdio: ['ignore', 'ignore', 'inherit'] });
      const dSrc = duration(src), dOut = duration(tmp);
      if (Math.abs(dSrc - dOut) > 0.1) throw new Error(`duration changed ${dSrc.toFixed(2)}s → ${dOut.toFixed(2)}s`);
      fs.renameSync(tmp, out);
      const oSize = fs.statSync(out).size;
      srcBytes += srcStat.size; outBytes += oSize;
      encoded++;
      console.log(`  ✓ ${game}/${f}  ${(srcStat.size / 1e6).toFixed(1)} MB → ${(oSize / 1e6).toFixed(1)} MB`);
    } catch (err) {
      failed++;
      if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
      console.error(`  ✗ ${game}/${f}: ${err.message}`);
    }
  }
}

console.log(`\nEncoded ${encoded}, skipped ${skipped} (up to date), failed ${failed}.`);
if (encoded > 0) console.log(`Size: ${(srcBytes / 1e6).toFixed(0)} MB → ${(outBytes / 1e6).toFixed(0)} MB`);
process.exit(failed > 0 ? 1 : 0);
