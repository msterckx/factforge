#!/usr/bin/env node
'use strict';
/**
 * clean-images-cache.js
 * upscale-images-runpod.js never deletes — only adds/overwrites (see its
 * header) — so if an item's/region's image_url(s) change in the DB, the
 * previously cached file(s) are left behind under
 * local-data/challenges/<game>/<key>/{images,images_lowres}/, and
 * findLocalImage()/findLocalImages() in the video generators pick whichever
 * file sorts first alphabetically, which may now be the stale one. This
 * removes that leftover cache.
 *
 * Two things count as "old":
 *   1. Stale files inside a still-valid unit's folder — cached files that no
 *      longer correspond to any of that item's/region's *current*
 *      image_url(s) in the DB.
 *   2. Orphaned unit folders — a <key>/ directory on disk for an item/region
 *      id that no longer exists in the DB at all.
 *
 * Usage:
 *   node scripts/clean-images-cache.js --db=gameoftrivia.db --game=contemporary-art
 *   node scripts/clean-images-cache.js --db=gameoftrivia.db --game=contemporary-art --only=193
 *   node scripts/clean-images-cache.js --db=gameoftrivia.db --game=contemporary-art --dry-run
 *
 * Options:
 *   --db          SQLite DB path (required)
 *   --game        challenge_games.slug (required)
 *   --only        Comma list of item ids (connections_quiz) or region_key
 *                 values (map games) to limit cleanup to (default: all keys
 *                 found on disk under --images-dir)
 *   --images-dir  Local images root (default: local-data/challenges/<game>)
 *   --all         Wipe each targeted unit's images/ and images_lowres/
 *                 folders entirely, instead of only removing files that no
 *                 longer match the current DB image_url(s) — use to force a
 *                 full from-scratch re-upscale for that unit.
 *   --dry-run     List what would be removed without deleting anything
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const args = {};
for (const arg of process.argv.slice(2)) {
  if (arg.startsWith('--')) {
    const eq = arg.indexOf('=');
    if (eq !== -1) args[arg.slice(2, eq)] = arg.slice(eq + 1);
    else            args[arg.slice(2)]    = true;
  }
}

if (!args.db || !args.game) {
  console.error('Usage: node scripts/clean-images-cache.js --db=<path> --game=<slug> [--only=id1,id2] [--images-dir=path] [--all] [--dry-run]');
  process.exit(1);
}

const onlyKeys  = args.only ? new Set(String(args.only).split(',').map(s => s.trim())) : null;
const wipeAll   = !!args.all;
const dryRun    = !!args['dry-run'];
const imagesDir = path.resolve(args['images-dir'] || `local-data/challenges/${args.game}`);
const tag       = dryRun ? '[dry-run] ' : '';

const db = new Database(path.resolve(args.db));
const game = db.prepare('SELECT * FROM challenge_games WHERE slug = ?').get(args.game);
if (!game) {
  console.error(`Game not found: "${args.game}"`);
  db.close(); process.exit(1);
}

const isConnectionsQuiz = game.game_type === 'connections_quiz' || (game.game_type === 'generic_quiz' && game.media_type === 'carousel');

// Every unit currently in the DB for this game — deliberately unfiltered by
// enabled/image presence, so a disabled region or a temporarily image-less
// item is still recognized as "known" and its cache isn't treated as orphaned.
const dbUnits = isConnectionsQuiz
  ? db.prepare('SELECT * FROM challenge_items WHERE game_id = ? ORDER BY position').all(game.id).map(it => {
      let extra = [];
      try {
        const parsed = JSON.parse(it.infograph_data || '[]');
        extra = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.images) ? parsed.images : [];
      } catch { /* no extra images */ }
      return { key: String(it.id), label: it.name, images: [it.image_url, ...extra].filter(Boolean) };
    })
  : db.prepare('SELECT * FROM map_regions WHERE game_id = ? ORDER BY id').all(game.id).map(r => {
      let images = [];
      try { images = JSON.parse(r.infograph_data || '{}').images || []; } catch { /* no infograph data */ }
      return { key: r.region_key.trim(), label: r.label_en, images };
    });
db.close();

const dbByKey = new Map(dbUnits.map(u => [u.key, u]));

if (!fs.existsSync(imagesDir)) {
  console.log(`No images dir at ${imagesDir} — nothing to clean.`);
  process.exit(0);
}

const diskKeys = fs.readdirSync(imagesDir, { withFileTypes: true })
  .filter(e => e.isDirectory())
  .map(e => e.name);

const targets = onlyKeys ? diskKeys.filter(k => onlyKeys.has(k)) : diskKeys;
if (onlyKeys) {
  for (const k of onlyKeys) {
    if (!diskKeys.includes(k)) console.log(`  (--only) no folder on disk for "${k}", skipping`);
  }
}

let removedFiles = 0, removedDirs = 0;

for (const key of targets) {
  const unitDir = path.join(imagesDir, key);
  const unit = dbByKey.get(key);

  if (!unit) {
    console.log(`${tag}Removing orphaned folder: ${key}/ (no matching item/region in DB)`);
    if (!dryRun) fs.rmSync(unitDir, { recursive: true, force: true });
    removedDirs++;
    continue;
  }

  if (wipeAll) {
    console.log(`${tag}Wiping ${key}/images and ${key}/images_lowres (${unit.label})`);
    if (!dryRun) {
      fs.rmSync(path.join(unitDir, 'images'), { recursive: true, force: true });
      fs.rmSync(path.join(unitDir, 'images_lowres'), { recursive: true, force: true });
    }
    removedDirs++;
    continue;
  }

  // Basenames still valid for this unit, given its *current* DB image_url(s) —
  // mirrors the naming upscale-images-runpod.js itself uses.
  const expectedLowres   = new Set();
  const expectedUpscaled = new Set();
  for (const url of unit.images) {
    let basename;
    try { basename = path.basename(new URL(url).pathname); } catch { continue; }
    expectedLowres.add(basename);
    expectedUpscaled.add(`${basename.replace(/\.[a-z0-9]+$/i, '')}.png`);
  }

  for (const [sub, expected] of [['images_lowres', expectedLowres], ['images', expectedUpscaled]]) {
    const dir = path.join(unitDir, sub);
    if (!fs.existsSync(dir)) continue;
    for (const file of fs.readdirSync(dir)) {
      if (expected.has(file)) continue;
      console.log(`${tag}Removing stale: ${key}/${sub}/${file}  (${unit.label})`);
      if (!dryRun) fs.rmSync(path.join(dir, file), { force: true });
      removedFiles++;
    }
  }
}

console.log(`\n${tag}Done: ${removedFiles} stale file(s), ${removedDirs} orphaned/wiped folder(s).`);
