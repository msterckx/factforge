#!/usr/bin/env node
'use strict';
/**
 * gen-all-challenges.js
 * Generates static packages for all map/map_quiz games in the DB.
 *
 * Usage:
 *   node scripts/gen-all-challenges.js \
 *     --db=restore/remote_db/gameoftrivia.db \
 *     [--images-dir=path/to/images] \
 *     [--score-url=/api/challenges/score] \
 *     [--game=south-america-parks]   ← single game (preview/rebuild one)
 */

const { execSync } = require('child_process');
const path         = require('path');
const fs           = require('fs');
const Database     = require('better-sqlite3');

// ── CLI args ──────────────────────────────────────────────────────────────────
const args = {};
for (const arg of process.argv.slice(2)) {
  if (arg.startsWith('--')) {
    const eq = arg.indexOf('=');
    if (eq !== -1) args[arg.slice(2, eq)] = arg.slice(eq + 1);
    else            args[arg.slice(2)]    = true;
  }
}

const dbPath      = args.db || 'gameoftrivia.db';
// Explicit --images-dir applies the same path to every game (override).
// Otherwise each game defaults to its own local-data/challenges/<slug>/ dir.
const imagesDirOverride = args['images-dir'] || null;
const scoreUrlArg  = args['score-url']  !== undefined ? `--score-url=${args['score-url']}` : '--score-url=';
const onlyGame     = args.game || null;

if (!fs.existsSync(path.resolve(dbPath))) {
  console.error(`DB not found: ${dbPath}`);
  process.exit(1);
}

// ── Load games ────────────────────────────────────────────────────────────────
const db = new Database(path.resolve(dbPath), { readonly: true });
let games = db.prepare(
  "SELECT slug, title_en, category FROM challenge_games WHERE game_type IN ('map','map_quiz') AND available = 1 ORDER BY id"
).all();
db.close();

if (onlyGame) {
  games = games.filter(g => g.slug === onlyGame);
  if (games.length === 0) {
    console.error(`Game not found: "${onlyGame}"`);
    process.exit(1);
  }
}

console.log(`Generating ${games.length} challenge package(s) from ${dbPath}\n`);

// ── Generate each ─────────────────────────────────────────────────────────────
const results = [];
for (const game of games) {
  console.log(`${'─'.repeat(60)}`);
  console.log(`▶ ${game.slug}`);
  const imagesDir = imagesDirOverride || `local-data/challenges/${game.slug}`;
  const cmd = [
    'node scripts/gen-map-challenge.js',
    `--db=${dbPath}`,
    `--game=${game.slug}`,
    `--topic=${game.category || 'other'}`,
    scoreUrlArg,
    `--images-dir=${imagesDir}`,
  ].filter(Boolean).join(' ');

  try {
    execSync(cmd, { stdio: 'inherit', cwd: process.cwd() });
    results.push({ slug: game.slug, topic: game.category || 'other', ok: true });
  } catch (err) {
    console.error(`  ✗ Failed: ${err.message}`);
    results.push({ slug: game.slug, topic: game.category || 'other', ok: false });
  }
}

// ── Write manifest ────────────────────────────────────────────────────────────
const manifestPath = path.resolve('public/challenges/manifest.json');
const existing     = fs.existsSync(manifestPath)
  ? JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
  : [];

const topicBySlug = Object.fromEntries(results.map(r => [r.slug, r.topic]));

for (const { slug, ok } of results) {
  if (!ok) continue;
  const topic = topicBySlug[slug] || 'other';
  const idx = existing.findIndex(e => e.slug === slug);
  const entry = {
    slug,
    topic,
    path:      `/challenges/${topic}/${slug}/index.html`,
    builtAt:   new Date().toISOString(),
  };
  if (idx >= 0) existing[idx] = { ...existing[idx], ...entry };
  else          existing.push(entry);
}
fs.writeFileSync(manifestPath, JSON.stringify(existing, null, 2));

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${'═'.repeat(60)}`);
const ok  = results.filter(r =>  r.ok);
const bad = results.filter(r => !r.ok);
console.log(`Done: ${ok.length} built, ${bad.length} failed`);
ok.forEach(r  => console.log(`  ✓  public/challenges/${r.topic}/${r.slug}/index.html`));
bad.forEach(r => console.log(`  ✗  ${r.slug}`));
console.log(`\nManifest: ${manifestPath}`);
console.log(`\nEmbed example:`);
const ex = ok[0];
console.log(`  <iframe src="/challenges/${ex ? `${ex.topic}/${ex.slug}` : '<topic>/<slug>'}/index.html" className="w-full h-[680px] border-0 rounded-2xl" />`);
