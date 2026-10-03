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
  const folderRel = path.posix.dirname(rel);
  const base = path.posix.basename(folderRel);
  const dir = path.resolve(WEB_IMAGES_DIR, folderRel);
  if (!dir.startsWith(WEB_IMAGES_DIR + path.sep) || !fs.existsSync(dir)) {
    return { error: `folder not in local mirror: ${folderRel}` };
  }
  const esc = base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const files = fs.readdirSync(dir);
  const question = files.find(f => new RegExp(`^${esc}\\.(webp|jpe?g|png)$`, 'i').test(f));
  const numbered = files
    .map(f => ({ f, m: new RegExp(`^${esc}-(\\d+)\\.(webp|jpe?g|png)$`, 'i').exec(f) }))
    .filter(x => x.m)
    .sort((a, b) => Number(a.m[1]) - Number(b.m[1]))
    .map(x => x.f);
  if (!question) return { error: `no ${base}.webp question image in ${folderRel}`, folder: folderRel };
  const toRef = f => `/api/images/${folderRel}/${f}`;
  return { question: toRef(question), carousel: numbered.map(toRef), folder: folderRel };
}

module.exports = { WEB_IMAGES_DIR, apiImagePath, localWebImagePath, readWebImage, folderImages };
