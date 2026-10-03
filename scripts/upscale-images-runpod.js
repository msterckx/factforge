#!/usr/bin/env node
'use strict';
/**
 * upscale-images-runpod.js
 * 4x AI upscale of source photos via the RunPod serverless upscale endpoint
 * instead of the local GPU script (upscale-images.py).
 *
 * Supports two game types:
 *   - map / map_quiz:       downloads each region's source image(s) from the
 *                            DB's infograph_data.images URLs (may be several
 *                            per region — used by gen-map-video.js).
 *   - connections_quiz:     downloads each item's single image_url.
 * Either way, low-res originals are cached under <key>/images_lowres/, every
 * pending image across the game is upscaled in a single RunPod job, and the
 * 4x PNGs are written to <key>/images/ — the exact layout the matching video
 * generator's findLocalImages()/image-resolution logic looks for via
 * --images-dir. <key> is the region_key for map games, or the item id for
 * connections_quiz (items have no stable slug like regionKey).
 *
 * Usage:
 *   node scripts/upscale-images-runpod.js \
 *     --db=restore/remote_db/gameoftrivia.db \
 *     --game=south-america-parks \
 *     [--only=Manu_National_Park,Tayrona_National_Natural_Park] \
 *     [--images-dir=local-data/challenges/south-america-parks] \
 *     [--force] [--upscale-only]
 *
 *   node scripts/upscale-images-runpod.js --db=gameoftrivia.db --game=contemporary-art
 *
 * Options:
 *   --db            SQLite DB path (required)
 *   --game          challenge_games.slug (required)
 *   --only          Comma list of region_key values (map games) or item ids
 *                    (connections_quiz) to limit to (default: all enabled)
 *   --images-dir    Local images root (default: local-data/challenges/<game>)
 *   --force         Re-upscale even if the destination PNG already exists
 *   --upscale-only  Skip re-downloading sources — only use what's already cached
 *                   in <key>/images_lowres/ (fails a source instead of
 *                   fetching it). Use to retry just the upload/RunPod/download
 *                   step after a prior run already cached the sources.
 */

const fs   = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { upscaleBatch } = require('./lib/runpod-upscale');
const { readWebImage } = require('./lib/web-image');

const args = {};
for (const arg of process.argv.slice(2)) {
  if (arg.startsWith('--')) {
    const eq = arg.indexOf('=');
    if (eq !== -1) args[arg.slice(2, eq)] = arg.slice(eq + 1);
    else            args[arg.slice(2)]    = true;
  }
}

if (!args.db || !args.game) {
  console.error('Usage: node scripts/upscale-images-runpod.js --db=<path> --game=<slug> [--only=key1,key2] [--images-dir=path] [--force] [--upscale-only]');
  process.exit(1);
}

const onlyKeys    = args.only ? new Set(String(args.only).split(',').map(s => s.trim())) : null;
const force       = !!args.force;
const upscaleOnly = !!args['upscale-only'];
const imagesDir   = args['images-dir'] || `local-data/challenges/${args.game}`;

function extOf(url) {
  const m = /\.([a-z0-9]+)(?:\?.*)?$/i.exec(url);
  return m ? m[1].toLowerCase() : 'webp';
}
function contentTypeFor(ext) {
  return { webp: 'image/webp', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png' }[ext] || 'application/octet-stream';
}

(async () => {
  const db = new Database(path.resolve(args.db));
  const game = db.prepare('SELECT * FROM challenge_games WHERE slug = ?').get(args.game);
  if (!game) {
    console.error(`Game not found: "${args.game}"`);
    db.close(); process.exit(1);
  }

  const isConnectionsQuiz = game.game_type === 'connections_quiz' || (game.game_type === 'generic_quiz' && game.media_type === 'carousel');

  const units = isConnectionsQuiz
    ? db.prepare('SELECT * FROM challenge_items WHERE game_id = ? ORDER BY position').all(game.id)
        .filter(it => !onlyKeys || onlyKeys.has(String(it.id)))
        .map(it => {
          // infograph_data is either a bare JSON array of *additional* carousel
          // images (see ItemsManager.tsx), or — for items converted from
          // matching/chronology — the richer {born, died, ..., images[]}
          // object. image_url is always the primary either way.
          let extra = [];
          try {
            const parsed = JSON.parse(it.infograph_data || '[]');
            extra = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.images) ? parsed.images : [];
          } catch { /* no extra images */ }
          const images = [it.image_url, ...extra].filter(Boolean);
          return { key: String(it.id), label: it.name, images };
        })
        .filter(it => it.images.length > 0)
    : db.prepare('SELECT * FROM map_regions WHERE game_id = ? AND enabled = 1 ORDER BY id').all(game.id)
        .filter(r => !onlyKeys || onlyKeys.has(r.region_key.trim()))
        .map(r => {
          let images = [];
          try { images = JSON.parse(r.infograph_data || '{}').images || []; } catch { /* no infograph data */ }
          return { key: r.region_key.trim(), label: r.label_en, images };
        })
        .filter(r => r.images.length > 0);

  if (units.length === 0) {
    console.error(isConnectionsQuiz ? 'No items with an image_url matched.' : 'No enabled regions with infograph images matched.');
    db.close(); process.exit(1);
  }

  console.log(`Upscaling images for ${units.length} ${isConnectionsQuiz ? 'item(s)' : 'region(s)'} in "${game.slug}" (--images-dir=${imagesDir}):`);

  const pending = [];
  for (const unit of units) {
    const unitDir    = path.join(imagesDir, unit.key);
    const lowResDir  = path.join(unitDir, 'images_lowres');
    const outDir     = path.join(unitDir, 'images');

    for (const url of unit.images) {
      const ext      = extOf(url);
      const basename = path.basename(new URL(url).pathname);
      const stem     = basename.replace(/\.[a-z0-9]+$/i, '');
      const destPath = path.join(outDir, `${stem}.png`);

      if (fs.existsSync(destPath) && !force) {
        console.log(`  ${unit.label} / ${basename} — already upscaled, skipping`);
        continue;
      }

      const lowResPath = path.join(lowResDir, basename);
      let buf;
      if (fs.existsSync(lowResPath)) {
        console.log(`  ${unit.label} / ${basename} — using cached source`);
        buf = fs.readFileSync(lowResPath);
      } else if (upscaleOnly) {
        console.warn(`  ✗ ${unit.label} / ${basename} — no cached source in ${lowResDir} (--upscale-only), skipping`);
        continue;
      } else {
        const img = await readWebImage(url);
        if (!img.ok) {
          console.warn(`    ✗ Failed to load ${url}: ${img.error}`);
          continue;
        }
        console.log(`  ${unit.label} / ${basename} — ${img.source === 'local' ? 'local copy' : 'downloaded source'}`);
        buf = img.buffer;
        fs.mkdirSync(lowResDir, { recursive: true });
        fs.writeFileSync(lowResPath, buf);
      }

      pending.push({
        s3Key: `upscale/input/${unit.key}/${basename}`,
        localBuffer: buf,
        contentType: contentTypeFor(ext),
        outPath: destPath,
      });
    }
  }

  db.close();

  if (pending.length === 0) {
    console.log('\nNothing to upscale.');
    return;
  }

  console.log(`\nSubmitting ${pending.length} image(s) as a single RunPod upscale job...`);
  const results = await upscaleBatch(pending);
  console.log(`\nDone: ${results.length}/${pending.length} upscaled successfully.`);
})().catch(err => {
  console.error('\nError:', err.message);
  process.exit(1);
});
