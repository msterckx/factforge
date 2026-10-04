'use strict';
/**
 * web-image.js
 * Fetches an image referenced from the DB, preferring the local mirror of the
 * production image store (local-data/web-images, a 1:1 copy of the server's
 * WEB_DIR) over a network download.
 *
 * DB image references come in three shapes:
 *   /api/images/<path>                                  site-relative (local mirror only)
 *   https://www.gameoftrivia.com/api/images/<path>      production URL
 *   https://anything-else/...                           external (always downloaded)
 *
 * Both /api/images forms resolve to local-data/web-images/<path> when that
 * file exists, so images removed from the server keep working for renders.
 */

const fs   = require('fs');
const path = require('path');

const WEB_IMAGES_DIR = path.resolve(__dirname, '..', '..', 'local-data', 'web-images');
const PROD_ORIGIN    = 'https://www.gameoftrivia.com';

/** The /api/images/<path> part of a reference, decoded — or null if it isn't one. */
function apiImagePath(ref) {
  let pathname = ref;
  if (/^https?:\/\//i.test(ref)) {
    try { pathname = new URL(ref).pathname; } catch { return null; }
    if (!/(^|\.)gameoftrivia\.com$/i.test(new URL(ref).hostname)) return null;
  }
  const m = /^\/api\/images\/(.+)$/.exec(pathname.split('?')[0]);
  if (!m) return null;
  try { return decodeURIComponent(m[1]); } catch { return m[1]; }
}

/** Absolute path of the local mirror copy, if the reference has one on disk. */
function localWebImagePath(ref) {
  const rel = apiImagePath(ref);
  if (!rel) return null;
  const abs = path.resolve(WEB_IMAGES_DIR, rel);
  if (!abs.startsWith(WEB_IMAGES_DIR + path.sep)) return null;
  return fs.existsSync(abs) ? abs : null;
}

/**
 * Returns { ok: true, buffer, source } or { ok: false, error }.
 * Local mirror first; otherwise downloads (site-relative refs fall back to
 * the production origin).
 */
async function readWebImage(ref) {
  const local = localWebImagePath(ref);
  if (local) return { ok: true, buffer: fs.readFileSync(local), source: 'local' };

  const url = ref.startsWith('/') ? PROD_ORIGIN + ref : ref;
  const res = await fetch(url);
  if (!res.ok) return { ok: false, error: `${res.status} (${url})` };
  return { ok: true, buffer: Buffer.from(await res.arrayBuffer()), source: 'download' };
}

/**
 * Folder convention for video images: an item's images live in one folder of
 * the local mirror, named after the folder —
 *   <folder>/<folder>.webp       question image (un-numbered)
 *   <folder>/<folder>-<n>.webp   reveal carousel, in numeric order
 * `ref` is any DB reference to a file inside that folder (typically the item's
 * image_url). Returns { question, carousel, folder } as /api/images/... paths,
 * or { error } when the folder or its question image is missing.
 */
function folderImages(ref) {
  const rel = apiImagePath(ref);
  if (!rel) return { error: `not an /api/images reference: ${ref}` };
  let folderRel = path.posix.dirname(rel);
  let dir = path.resolve(WEB_IMAGES_DIR, folderRel);
  if (!fs.existsSync(dir)) {
    // A folder renamed between "_" and "-" (cloud_gate → cloud-gate) still counts.
    const parent = path.posix.dirname(folderRel);
    const want = path.posix.basename(folderRel).toLowerCase().replace(/_/g, '-');
    const parentDir = path.resolve(WEB_IMAGES_DIR, parent);
    const alt = fs.existsSync(parentDir)
      ? fs.readdirSync(parentDir).find(d => d.toLowerCase().replace(/_/g, '-') === want && fs.statSync(path.join(parentDir, d)).isDirectory())
      : undefined;
    if (alt) { folderRel = `${parent}/${alt}`; dir = path.resolve(WEB_IMAGES_DIR, folderRel); }
  }
  const base = path.posix.basename(folderRel);
  if (!dir.startsWith(WEB_IMAGES_DIR + path.sep) || !fs.existsSync(dir)) {
    return { error: `folder not in local mirror: ${folderRel}` };
  }
  // "-" and "_" count as the same (cloud-gate.webp in cloud_gate/ still
  // matches), so a mix of both in one folder doesn't break the convention.
  const norm = name => name.toLowerCase().replace(/_/g, '-');
  const stemOf = f => f.replace(/\.(webp|jpe?g|png)$/i, '');
  const isImage = f => /\.(webp|jpe?g|png)$/i.test(f);
  const nBase = norm(base);
  const files = fs.readdirSync(dir).filter(isImage);
  const question = files.find(f => norm(stemOf(f)) === nBase);
  const numberedRe = new RegExp(`^${nBase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-(\\d+)$`);
  const numberedAll = files
    .map(f => ({ f, m: numberedRe.exec(norm(stemOf(f))) }))
    .filter(x => x.m)
    .sort((a, b) => Number(a.m[1]) - Number(b.m[1]) || a.f.localeCompare(b.f));
  const numbered = numberedAll.map(x => x.f);
  const counts = {};
  for (const x of numberedAll) counts[x.m[1]] = (counts[x.m[1]] || 0) + 1;
  const warnings = Object.entries(counts).filter(([, c]) => c > 1)
    .map(([n]) => `two files numbered ${n} in ${folderRel}: ${numberedAll.filter(x => x.m[1] === n).map(x => x.f).join(', ')}`);
  if (!question) return { error: `no ${base}.webp question image in ${folderRel}`, folder: folderRel };
  const toRef = f => `/api/images/${folderRel}/${f}`;
  return { question: toRef(question), carousel: numbered.map(toRef), folder: folderRel, warnings };
}

module.exports = { WEB_IMAGES_DIR, apiImagePath, localWebImagePath, readWebImage, folderImages };
