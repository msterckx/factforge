#!/usr/bin/env node
'use strict';
/**
 * build-intros.js
 * Builds one "Game of Trivia" intro per quiz category from the template in
 * video-assets/intro/game-of-trivia-intro (which says just "QUIZ"), replacing
 * that line with e.g. "HISTORY QUIZ". Each variant gets its own composition id,
 * game-of-trivia-intro-<category>, which concat-video-segments.js picks by the
 * game's category.
 *
 * Usage:
 *   node scripts/build-intros.js                 # write the variants
 *   node scripts/build-intros.js --render        # write and render them all
 *   node scripts/build-intros.js --render --only=history,science
 *
 * Variants are written to videos/intros/<composition-id>/ (generated output,
 * not tracked); renders land in renders/ like every other segment.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const Database = require('better-sqlite3');

const args = {};
for (const a of process.argv.slice(2)) {
  const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
  if (m) args[m[1]] = m[2] ?? true;
}

const ROOT = path.resolve(__dirname, '..');
const TEMPLATE = path.join(ROOT, 'video-assets', 'intro', 'game-of-trivia-intro', 'index.html');
const OUT_ROOT = path.join(ROOT, 'videos', 'intros');
const BASE_ID = 'game-of-trivia-intro';

/** "Art & Architecture" → "ART & ARCHITECTURE QUIZ"; "Movies and TV" → "MOVIES & TV QUIZ". */
function quizLine(name) {
  return `${name.replace(/\band\b/gi, '&').toUpperCase()} QUIZ`;
}

function introIdFor(category) {
  return `${BASE_ID}-${category}`;
}

function buildVariants() {
  const db = new Database(path.join(ROOT, 'gameoftrivia.db'), { readonly: true });
  const cats = db.prepare('SELECT slug, name FROM categories ORDER BY slug').all();
  db.close();
  // Games may use a category without a categories row (e.g. "other")
  const variants = cats.map(c => ({ category: c.slug, line: quizLine(c.name) }));
  variants.push({ category: 'other', line: 'QUIZ' });

  const template = fs.readFileSync(TEMPLATE, 'utf-8');
  if (!template.includes(`>QUIZ<`) || !template.includes(`'${BASE_ID}'`)) {
    throw new Error('Template no longer has the QUIZ label / composition id this script replaces');
  }
  return variants.map(v => {
    const id = introIdFor(v.category);
    const html = template
      .replaceAll(`"${BASE_ID}"`, `"${id}"`)
      .replaceAll(`'${BASE_ID}'`, `'${id}'`)
      .replace('>QUIZ<', `>${v.line.replace(/&/g, '&amp;')}<`);
    const dir = path.join(OUT_ROOT, id);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), html, 'utf-8');
    return { ...v, id, dir };
  });
}

if (require.main === module) {
  const only = typeof args.only === 'string' ? new Set(args.only.split(',').map(s => s.trim())) : null;
  const variants = buildVariants().filter(v => !only || only.has(v.category));
  for (const v of variants) {
    console.log(`  ✓ ${path.relative(ROOT, v.dir)}  "${v.line}"`);
    if (args.render) {
      execFileSync('npx', ['hyperframes', 'render', v.dir, '--fps=30'], { cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'] });
      console.log(`    rendered`);
    }
  }
  if (!args.render) console.log('\nRender with: node scripts/build-intros.js --render');
}

module.exports = { introIdFor };
