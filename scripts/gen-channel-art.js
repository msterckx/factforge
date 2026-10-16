#!/usr/bin/env node
'use strict';
/**
 * gen-channel-art.js
 * Builds the YouTube channel branding in the same style as the videos:
 *   local-data/youtube/channel/profile.png   800x800  (shown as a circle)
 *   local-data/youtube/channel/banner.jpg    2560x1440 (text kept inside the
 *                                            1546x423 area every device shows)
 *
 * Usage:
 *   node scripts/gen-channel-art.js
 *   node scripts/gen-channel-art.js --tagline="Quiz videos · History · Art · Science · Nature"
 *
 * The banner's photo band uses the images listed in BANNER_IMAGES (paths
 * under local-data/web-images/challenges/).
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
const IMAGES = path.join(ROOT, 'local-data', 'web-images', 'challenges');
const OUT = path.join(ROOT, 'local-data', 'youtube', 'channel');
const TAGLINE = args.tagline || 'Quiz videos · History · Art · Science · Nature';
const SITE = 'gameoftrivia.com';

const BANNER_IMAGES = [
  'history/ww2_pacific/pearl-harbor/pearl-harbor-4.webp',
  'art/renaissance/the-ambassadors/the-ambassadors-1.webp',
  'nature/south_america_parcs/torres-del-paine/torres-del-paine-1.webp',
  'art/worldfairs/atomium/atomium.webp',
  'science/quantum/einstein/einstein.webp',
  'art/contemporary/balloon_dog/balloon_dog.webp',
  'nature/africa_parcs/serengeti/serengeti-1.webp',
  'art/worldfairs/eiffel-tower/eiffel-tower.webp',
];

const FONT = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;700&display=block">';
const BASE_CSS = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  #stage { position: relative; overflow: hidden; font-family: 'Oswald', sans-serif; color: #fff;
    background:
      radial-gradient(circle at 2px 2px, rgba(255,255,255,0.07) 1.3px, transparent 1.8px) 0 0 / 24px 24px,
      radial-gradient(ellipse 80% 70% at 50% 45%, #16263a 0%, #0a131c 70%); }
  .mark { position: relative; background: #000; display: flex; align-items: center; justify-content: center; flex: none; }
  .mark::after { content: ''; position: absolute; border: solid #fff; }
  .mark span { font-weight: 700; line-height: 1; letter-spacing: 2px; }`;
const TIMELINE = id => `<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>
<script>(() => { const tl = gsap.timeline({ paused: true }); tl.to({}, { duration: 1 });
  window.__timelines = window.__timelines || {}; window.__timelines['${id}'] = tl; })();</script>`;

function render(dir, out, w, h, fmt) {
  const log = String(execFileSync('npx', ['hyperframes', 'render', dir, '--fps=30'], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] }));
  const mp4 = (log.match(/\/[^\s"']+\.mp4/g) || []).pop();
  if (!mp4 || !fs.existsSync(mp4)) throw new Error(`render produced no MP4 for ${dir}`);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', '0.5', '-i', mp4, '-frames:v', '1',
    '-vf', `scale=${w}:${h}:flags=lanczos`, ...(fmt === 'jpg' ? ['-q:v', '2'] : []), out]);
  fs.unlinkSync(mp4);
}

fs.mkdirSync(OUT, { recursive: true });

// ── Profile picture: the GOT mark, sized to sit well inside the circle crop ──
const profileDir = path.join(OUT, 'src-profile');
fs.mkdirSync(profileDir, { recursive: true });
fs.writeFileSync(path.join(profileDir, 'index.html'), `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>profile</title>${FONT}
<style>${BASE_CSS}
  html, body { width: 800px; height: 800px; overflow: hidden; background: #0a131c; }
  #stage { width: 800px; height: 800px; display: flex; align-items: center; justify-content: center; }
  /* 520px square: its 735px diagonal still fits inside the 800px circle crop,
     while staying readable at the 48px sizes YouTube uses in lists. */
  .mark { width: 520px; height: 520px; }
  .mark::after { inset: 30px; border-width: 19px; }
  .mark span { font-size: 232px; }
</style></head><body>
<div id="stage" data-composition-id="channel-profile" data-start="0" data-duration="1" data-width="800" data-height="800">
  <div class="mark"><span>GOT</span></div>
</div>${TIMELINE('channel-profile')}</body></html>`);
render(profileDir, path.join(OUT, 'profile.png'), 800, 800, 'png');

// ── Banner: photo band at the sides, brand lockup in the safe centre ─────────
const bannerDir = path.join(OUT, 'src-banner');
fs.rmSync(path.join(bannerDir, 'images'), { recursive: true, force: true });
fs.mkdirSync(path.join(bannerDir, 'images'), { recursive: true });
const tiles = BANNER_IMAGES.map((rel, i) => {
  const src = path.join(IMAGES, rel);
  if (!fs.existsSync(src)) throw new Error(`Banner image missing: ${rel}`);
  const name = `img-${i}${path.extname(rel)}`;
  fs.copyFileSync(src, path.join(bannerDir, 'images', name));
  return `<div style="background-image:url('images/${name}')"></div>`;
});
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
fs.writeFileSync(path.join(bannerDir, 'index.html'), `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>banner</title>${FONT}
<style>${BASE_CSS}
  html, body { width: 2560px; height: 1440px; overflow: hidden; background: #0a131c; }
  #stage { width: 2560px; height: 1440px; }
  /* 4x2 mosaic of quiz photos behind everything, in grayscale so the mix of
     sources reads as one set; darkened most where the text sits. */
  #mosaic { position: absolute; inset: 0; display: grid; grid-template-columns: repeat(4, 1fr); grid-template-rows: 1fr 1fr; gap: 6px; background: #0a131c; }
  #mosaic div { background-size: cover; background-position: center; filter: grayscale(1) contrast(1.05); }
  #shade { position: absolute; inset: 0;
    background:
      radial-gradient(ellipse 34% 30% at 50% 50%, rgba(10,19,28,0.97) 0%, rgba(10,19,28,0.93) 60%, rgba(10,19,28,0.55) 100%),
      linear-gradient(90deg, rgba(10,19,28,0.55), rgba(10,19,28,0.35) 25%, rgba(10,19,28,0.35) 75%, rgba(10,19,28,0.55)); }
  #dots { position: absolute; inset: 0; background: radial-gradient(circle at 2px 2px, rgba(255,255,255,0.07) 1.3px, transparent 1.8px) 0 0 / 24px 24px; }
  /* Everything readable stays inside the 1546x423 centre all devices show */
  #lockup { position: absolute; left: 507px; top: 509px; width: 1546px; height: 423px;
    display: flex; align-items: center; justify-content: center; gap: 64px; }
  .mark { width: 240px; height: 240px; }
  .mark::after { inset: 14px; border-width: 9px; }
  .mark span { font-size: 106px; }
  #name { font-weight: 700; font-size: 150px; line-height: 0.95; letter-spacing: 8px; text-transform: uppercase; white-space: nowrap; }
  #tag { font-weight: 500; font-size: 50px; letter-spacing: 2px; color: rgba(255,255,255,0.9); margin-top: 18px; white-space: nowrap; }
  #site { font-weight: 400; font-size: 40px; letter-spacing: 3px; color: rgba(255,255,255,0.65); margin-top: 12px; }
</style></head><body>
<div id="stage" data-composition-id="channel-banner" data-start="0" data-duration="1" data-width="2560" data-height="1440">
  <div id="mosaic">${tiles.join('')}</div>
  <div id="shade"></div><div id="dots"></div>
  <div id="lockup">
    <div class="mark"><span>GOT</span></div>
    <div><div id="name">Game of Trivia</div><div id="tag">${esc(TAGLINE)}</div><div id="site">${SITE}</div></div>
  </div>
</div>${TIMELINE('channel-banner')}</body></html>`);
render(bannerDir, path.join(OUT, 'banner.jpg'), 2560, 1440, 'jpg');

for (const f of ['profile.png', 'banner.jpg']) {
  console.log(`  ${f.padEnd(12)} ${(fs.statSync(path.join(OUT, f)).size / 1024).toFixed(0)} KB`);
}
console.log(`→ ${path.relative(ROOT, OUT)}/`);
