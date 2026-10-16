#!/usr/bin/env node
'use strict';
/**
 * gen-youtube-package.js
 * Builds the YouTube upload material for a game's final video:
 *   local-data/youtube/<slug>/thumbnail.jpg    1280x720, < 2 MB
 *   local-data/youtube/<slug>/description.txt  title, description, chapters, link, hashtags
 *
 * Chapters are timed from the same renders concat-video-segments.js stitches
 * (category intro + title card + one segment per question + outro), so build
 * the final video first. Chapter names never reveal answers ("Question 3").
 *
 * Usage:
 *   node scripts/gen-youtube-package.js --game=contemporary-art
 *   node scripts/gen-youtube-package.js --game=contemporary-art --images=193,194,195
 *
 * Options:
 *   --images   Item ids (or map region keys) whose question images make the
 *              thumbnail collage (default: the first three)
 *   --title    Quiz title on the thumbnail and in the YouTube title
 *              (default: the game's title)
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const Database = require('better-sqlite3');
const { readWebImage, folderImages } = require('./lib/web-image');
const { introIdFor } = require('./build-intros');

const args = {};
for (const a of process.argv.slice(2)) {
  const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
  if (m) args[m[1]] = m[2] ?? true;
}
if (!args.game) {
  console.error('Usage: node scripts/gen-youtube-package.js --game=<slug> [--images=id1,id2,id3] [--title="…"]');
  process.exit(1);
}

const ROOT = path.resolve(__dirname, '..');
const RENDERS = path.join(ROOT, 'renders');
const OUT = path.join(ROOT, 'local-data', 'youtube', args.game);
const SITE = 'www.gameoftrivia.com'; // descriptions use https:// so YouTube makes it a link

const db = new Database(path.join(ROOT, 'gameoftrivia.db'), { readonly: true });
const game = db.prepare('SELECT * FROM challenge_games WHERE slug = ?').get(args.game);
if (!game) { console.error(`Game not found: ${args.game}`); process.exit(1); }
const categoryName = db.prepare('SELECT name FROM categories WHERE slug = ?').get(game.category)?.name || '';
const isMap = game.media_type === 'map';

// ── Question items and their question images ─────────────────────────────────
function imagesOf(data) {
  try { const p = JSON.parse(data || '[]'); return Array.isArray(p) ? p : (p?.images || []); } catch { return []; }
}
const items = isMap
  ? db.prepare("SELECT region_key AS key, info_image_en AS image_url, infograph_data FROM map_regions WHERE game_id = ? AND enabled = 1 AND coalesce(question_text_en,'') <> '' ORDER BY id").all(game.id)
  : db.prepare('SELECT CAST(id AS TEXT) AS key, image_url, infograph_data FROM challenge_items WHERE game_id = ? ORDER BY position').all(game.id);
db.close();

function questionImage(it) {
  const refs = [it.image_url, ...imagesOf(it.infograph_data)].filter(Boolean);
  const f = refs.map(folderImages).find(x => !x.error);
  return f ? f.question : refs[0];
}

// ── Final-video layout, from the renders concat stitches ─────────────────────
const segRoot = path.join(ROOT, 'videos', isMap ? 'map-challenge' : 'connections-challenge', args.game, 'segments');
function latestRender(id) {
  const files = fs.readdirSync(RENDERS).filter(f => f.startsWith(`${id}_`) && f.endsWith('.mp4'));
  if (!files.length) return null;
  return files.map(f => path.join(RENDERS, f)).sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];
}
const duration = f => Number(String(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f])).trim());
const segIds = fs.readdirSync(segRoot).filter(n => !/-question$|-reveal$/.test(n) && fs.statSync(path.join(segRoot, n)).isDirectory()).sort();
const parts = [introIdFor(game.category), ...segIds, 'game-of-trivia-outro'].map(id => {
  const r = latestRender(id);
  if (!r) { console.error(`Not rendered yet: ${id} — build the final video first`); process.exit(1); }
  return { id, seconds: duration(r) };
});

// Chapters: Question N starts with its segment; Question 1 starts at 0:00 so it
// absorbs the intro + title card, and the short outro joins the last question
// (YouTube needs chapters ≥ 10 s and a first chapter at 0:00).
const stamp = s => { s = Math.floor(s); const m = Math.floor(s / 60); return `${m}:${String(s % 60).padStart(2, '0')}`; };
let t = 0; const chapters = [];
parts.forEach((p, i) => {
  if (/^\d{3}-/.test(p.id) && !p.id.startsWith('000-')) chapters.push({ at: chapters.length ? t : 0, label: `Question ${chapters.length + 1}` });
  t += p.seconds;
});
const totalSeconds = t;

// ── Texts ────────────────────────────────────────────────────────────────────
const openingHtml = fs.readFileSync(path.join(segRoot, segIds.find(id => id.startsWith('000-')), 'index.html'), 'utf-8');
const tagline = (/<p>([^<]+)<\/p>/.exec(openingHtml) || [, 'Can you get them all right?'])[1].trim();
const quizTitle = args.title || game.title_en;
const n = chapters.length;
const ytTitle = `${quizTitle} Quiz: ${tagline.replace(/\?$/, '')}? | Game of Trivia`.slice(0, 100);

const description = `${ytTitle}

${tagline} Test yourself with ${n} questions in this ${categoryName ? categoryName.toLowerCase() + ' ' : ''}quiz from Game of Trivia. For each one you get three options and a countdown — pause the video if you need more time, then see the answer revealed.

▶ Play this quiz and many more on https://${SITE}

Chapters
${chapters.map(c => `${stamp(c.at)} ${c.label}`).join('\n')}

#trivia #quiz #${(categoryName || 'general').toLowerCase().replace(/[^a-z]+/g, '')} #gameoftrivia
`;

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'description.txt'), description, 'utf-8');

// ── Thumbnail (HyperFrames composition, one frame) ───────────────────────────
(async () => {
  const pick = typeof args.images === 'string' ? args.images.split(',').map(s => s.trim()) : items.slice(0, 3).map(i => i.key);
  const chosen = pick.map(k => items.find(i => i.key === k)).filter(Boolean).slice(0, 3);
  if (chosen.length < 3) { console.error(`Need three items for the collage (got ${chosen.length})`); process.exit(1); }

  const src = path.join(OUT, 'thumbnail-src');
  fs.rmSync(src, { recursive: true, force: true });
  fs.mkdirSync(path.join(src, 'images'), { recursive: true });
  const imgs = [];
  for (const [i, it] of chosen.entries()) {
    const ref = questionImage(it);
    const img = await readWebImage(ref);
    if (!img.ok) { console.error(`Image failed: ${ref} (${img.error})`); process.exit(1); }
    const name = `img-${i}${path.extname(ref.split('?')[0]) || '.jpg'}`;
    fs.writeFileSync(path.join(src, 'images', name), img.buffer);
    imgs.push(`images/${name}`);
  }

  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  // Title size from its longest word, so it always fits the 670px text column
  // (Oswald Bold capitals average ~0.6em wide). Computed here, not in the page,
  // so it doesn't depend on when the web font finishes loading.
  const longestWord = Math.max(...quizTitle.toUpperCase().split(/\s+/).map(w => w.length));
  const titleSize = Math.max(56, Math.min(112, Math.floor(670 / (longestWord * 0.6))));
  fs.writeFileSync(path.join(src, 'index.html'), `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><title>thumbnail</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Oswald:wght@500;700&display=block">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 1920px; height: 1080px; overflow: hidden; background: #0a131c; }
  #stage { width: 1920px; height: 1080px; position: relative; overflow: hidden; font-family: 'Oswald', sans-serif; color: #fff;
    background:
      radial-gradient(circle at 2px 2px, rgba(255,255,255,0.07) 1.3px, transparent 1.8px) 0 0 / 24px 24px,
      radial-gradient(ellipse 70% 60% at 100% 0%, rgba(120,150,180,0.22), transparent 72%),
      linear-gradient(180deg, #16202b 0%, #0a131c 100%); }
  /* One wide image on top, two below — close to the images' own 16:9 shape */
  #collage { position: absolute; left: 0; top: 0; width: 1110px; height: 1080px; display: grid;
    grid-template-columns: 1fr 1fr; grid-template-rows: 620px 1fr; gap: 10px; background: #0a131c; }
  #collage div { background-size: cover; background-position: center; }
  #collage .big { grid-column: 1 / 3; }
  #panel { position: absolute; left: 1110px; top: 0; right: 0; bottom: 0; padding: 0 70px;
    display: flex; flex-direction: column; justify-content: center; gap: 34px; border-left: 4px solid rgba(255,255,255,0.12); }
  #mark { width: 116px; height: 116px; background: #000; position: relative; display: flex; align-items: center; justify-content: center; }
  #mark::after { content: ''; position: absolute; inset: 8px; border: 5px solid #fff; }
  #mark span { font-weight: 700; font-size: 50px; letter-spacing: 1px; }
  #title { font-weight: 700; font-size: ${titleSize}px; line-height: 0.98; text-transform: uppercase; letter-spacing: 1px; overflow-wrap: normal; }
  #title em { font-style: normal; display: inline-block; margin-top: 14px; padding: 4px 22px 8px; background: #fff; color: #0a131c; font-size: 92px; }
  #tagline { font-weight: 500; font-size: 52px; line-height: 1.15; color: rgba(255,255,255,0.9); }
  #count { font-weight: 500; font-size: 34px; letter-spacing: 8px; color: rgba(255,255,255,0.7); }
</style></head>
<body><div id="stage" data-composition-id="youtube-thumbnail" data-start="0" data-duration="1" data-width="1920" data-height="1080">
  <div id="collage">
    <div class="big" style="background-image:url('${imgs[0]}')"></div>
    <div style="background-image:url('${imgs[1]}')"></div>
    <div style="background-image:url('${imgs[2]}')"></div>
  </div>
  <div id="panel">
    <div id="mark"><span>GOT</span></div>
    <div id="title">${esc(quizTitle)}<br><em>Quiz</em></div>
    <div id="tagline">${esc(tagline)}</div>
    <div id="count">${n} QUESTIONS</div>
  </div>
</div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>
<script>(() => {
  const tl = gsap.timeline({ paused: true }); tl.to({}, { duration: 1 });
  window.__timelines = window.__timelines || {}; window.__timelines['youtube-thumbnail'] = tl; })();</script>
</body></html>
`, 'utf-8');

  // The render prints where it wrote the MP4; take the path from its output.
  const log = String(execFileSync('npx', ['hyperframes', 'render', src, '--fps=30'], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] }));
  const rendered = (log.match(/\/[^\s"']+\.mp4/g) || []).pop();
  if (!rendered || !fs.existsSync(rendered)) { console.error('Thumbnail render produced no MP4'); process.exit(1); }
  const thumb = path.join(OUT, 'thumbnail.jpg');
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', '0.5', '-i', rendered, '-frames:v', '1', '-vf', 'scale=1280:720:flags=lanczos', '-q:v', '2', thumb]);
  fs.unlinkSync(rendered);
  const kb = Math.round(fs.statSync(thumb).size / 1024);

  console.log(`YouTube package for ${args.game} → ${path.relative(ROOT, OUT)}/`);
  console.log(`  thumbnail.jpg    1280x720, ${kb} KB${kb > 2000 ? '  ⚠ over YouTube’s 2 MB limit' : ''}`);
  console.log(`  description.txt  "${ytTitle}" (${ytTitle.length} chars), ${n} chapters, video ${stamp(totalSeconds)}`);
})();
