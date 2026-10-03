'use strict';
/**
 * audio-store.js
 * Durable, DB-referenced storage for narration audio — the audio equivalent of
 * how map-region images are stored under WEB_DIR and served via /api/images.
 *
 * Physical files live under AUDIO_DIR/challenges/<gameSlug>/<regionKey>/audio/<kind>.wav
 * and are served publicly at /api/audio/challenges/<gameSlug>/<regionKey>/audio/<kind>.wav.
 *
 * Required env (loaded from .env.local at the repo root): AUDIO_DIR
 */

const fs   = require('fs');
const path = require('path');

let envLoaded = false;
function loadProjectEnv() {
  if (envLoaded) return;
  envLoaded = true;
  let dir = __dirname;
  for (let i = 0; i < 5; i++) {
    const envPath = path.join(dir, '.env.local');
    if (fs.existsSync(envPath)) {
      try { process.loadEnvFile(envPath); } catch { /* already loaded / unsupported */ }
      return;
    }
    dir = path.dirname(dir);
  }
}

function audioDir() {
  loadProjectEnv();
  const dir = process.env.AUDIO_DIR;
  if (!dir) throw new Error('audio-store: missing AUDIO_DIR in .env.local');
  return dir;
}

/** Public URL for a stored clip, as saved into map_regions.*_audio_url_en. */
function publicUrlFor(gameSlug, regionKey, kind) {
  return `/api/audio/challenges/${gameSlug}/${regionKey}/audio/${kind}.wav`;
}

/** Canonical on-disk location for a stored clip. */
function physicalPathFor(gameSlug, regionKey, kind) {
  return path.join(audioDir(), 'challenges', gameSlug, regionKey, 'audio', `${kind}.wav`);
}

/**
 * If the canonical copy exists and localPath doesn't yet, copy it down.
 * Pass overwrite:true to re-copy even when localPath already exists — e.g.
 * a video's own per-scene audio/ cache never revisits a file once written,
 * so a scene regenerated after the canonical copy changes (narration text
 * edited, --force-audio'd elsewhere) would otherwise silently keep playing
 * the old take. Returns true if a usable file now exists at localPath.
 */
function ensureLocalCopy(gameSlug, regionKey, kind, localPath, { overwrite = false } = {}) {
  const src = physicalPathFor(gameSlug, regionKey, kind);
  if (!fs.existsSync(src)) return false;
  if (overwrite || !fs.existsSync(localPath)) {
    fs.mkdirSync(path.dirname(localPath), { recursive: true });
    fs.copyFileSync(src, localPath);
  }
  return true;
}

/**
 * Push a freshly-generated local file up into the canonical store.
 * Returns the public URL to save into the DB.
 */
function persistCanonical(gameSlug, regionKey, kind, localPath) {
  const dest = physicalPathFor(gameSlug, regionKey, kind);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(localPath, dest);
  return publicUrlFor(gameSlug, regionKey, kind);
}

module.exports = { publicUrlFor, physicalPathFor, ensureLocalCopy, persistCanonical };
