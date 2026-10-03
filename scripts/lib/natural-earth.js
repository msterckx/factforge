'use strict';
/**
 * natural-earth.js
 * Loads the Natural Earth countries background used behind the map quiz
 * videos, cached locally after the first download.
 *
 * IMPORTANT: HyperFrames compositions must not fetch anything over the
 * network at render time (non-deterministic — the render pipeline doesn't
 * reliably wait for it, so the map silently renders blank). This data must
 * be fetched here, at *generation* time, filtered down to just the features
 * a given continent preset needs, and baked directly into the composition
 * HTML as a plain JS constant.
 */

const fs   = require('fs');
const path = require('path');

const NE_URL     = 'https://d2ad6b4ur7yvpq.cloudfront.net/naturalearth-3.3.0/ne_50m_admin_0_countries.geojson';
const CACHE_PATH = path.join(__dirname, '.cache', 'ne_50m_admin_0_countries.geojson');

async function loadNaturalEarth() {
  if (fs.existsSync(CACHE_PATH)) {
    return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf-8'));
  }
  console.log('  Downloading Natural Earth background data (one-time, cached locally)...');
  const res = await fetch(NE_URL);
  if (!res.ok) throw new Error(`Failed to fetch Natural Earth data: ${res.status}`);
  const text = await res.text();
  fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
  fs.writeFileSync(CACHE_PATH, text, 'utf-8');
  return JSON.parse(text);
}

/** Same ISO-code filter previously done in the browser at render time. */
function filterByIso(geojson, isoList) {
  const isoSet = new Set(isoList);
  return geojson.features.filter(f => {
    const iso = f.properties?.iso_a2_eh ?? f.properties?.iso_a2 ?? '';
    return isoSet.has(iso) && f.geometry;
  });
}

module.exports = { loadNaturalEarth, filterByIso };
