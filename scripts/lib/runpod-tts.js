'use strict';
/**
 * runpod-tts.js
 * Voice-clone narration via a RunPod serverless endpoint.
 *
 * Flow: POST /run (one or more { text, output_name } generations) → poll
 * /status/:id until COMPLETED → SigV4-sign a GET per generation against
 * RunPod's S3-compatible bucket to fetch each resulting WAV.
 *
 * Required env (loaded from .env.local at the repo root):
 *   RUNPOD_API_KEY, RUNPOD_ENDPOINT_ID,
 *   RUNPOD_S3_ENDPOINT, RUNPOD_S3_REGION, RUNPOD_S3_BUCKET,
 *   RUNPOD_S3_ACCESS_KEY_ID, RUNPOD_S3_SECRET_ACCESS_KEY
 */

const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const REFERENCE_SAMPLE = 'celeste_48k_stereo.wav';
const REFERENCE_SAMPLE_TEXT =
  'At the edge of the northern forest, morning light drifts across ancient trees, ' +
  'revealing a quiet world shaped by time, memory, and the delicate balance between nature and change.';

const REQUIRED_ENV = [
  'RUNPOD_API_KEY', 'RUNPOD_ENDPOINT_ID',
  'RUNPOD_S3_ENDPOINT', 'RUNPOD_S3_REGION', 'RUNPOD_S3_BUCKET',
  'RUNPOD_S3_ACCESS_KEY_ID', 'RUNPOD_S3_SECRET_ACCESS_KEY',
];

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

function requireEnv() {
  loadProjectEnv();
  const missing = REQUIRED_ENV.filter(k => !process.env[k]);
  if (missing.length) {
    throw new Error(`runpod-tts: missing env var(s) in .env.local: ${missing.join(', ')}`);
  }
  return Object.fromEntries(REQUIRED_ENV.map(k => [k, process.env[k]]));
}

// ── RunPod job submission ────────────────────────────────────────────────────
async function runpodSubmitAndWait({ apiKey, endpointId, input }) {
  const authHeader = { Authorization: `Bearer ${apiKey}` };

  const runRes = await fetch(`https://api.runpod.ai/v2/${endpointId}/run`, {
    method: 'POST',
    headers: { ...authHeader, 'Content-Type': 'application/json' },
    body: JSON.stringify({ input }),
  });
  if (!runRes.ok) throw new Error(`RunPod submit failed: ${runRes.status} ${await runRes.text()}`);
  const { id, status: initialStatus } = await runRes.json();
  if (initialStatus === 'FAILED') throw new Error(`RunPod job ${id} failed immediately`);

  const statusUrl   = `https://api.runpod.ai/v2/${endpointId}/status/${id}`;
  const pollMs       = 3000;
  const timeoutMs     = 5 * 60 * 1000;
  const startedAt    = Date.now();

  for (;;) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error(`RunPod job ${id} timed out after ${timeoutMs / 1000}s`);
    }
    const statusRes = await fetch(statusUrl, { headers: authHeader });
    if (!statusRes.ok) throw new Error(`RunPod status check failed: ${statusRes.status} ${await statusRes.text()}`);
    const job = await statusRes.json();
    if (job.status === 'COMPLETED') return job.output;
    if (job.status === 'FAILED' || job.status === 'CANCELLED') {
      throw new Error(`RunPod job ${id} ${job.status.toLowerCase()}: ${JSON.stringify(job.error ?? job.output ?? '')}`);
    }
    await new Promise(r => setTimeout(r, pollMs));
  }
}

// ── S3 (SigV4) download ──────────────────────────────────────────────────────
function sha256Hex(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}
function hmac(key, data) {
  return crypto.createHmac('sha256', key).update(data).digest();
}

async function s3GetObject({ endpoint, bucket, region, accessKeyId, secretAccessKey, key }) {
  const url = new URL(endpoint);
  const host = url.host;
  const canonicalUri = `/${bucket}/${key}`.split('/').map(encodeURIComponent).join('/');

  const amzDate   = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256Hex(''); // empty GET body

  const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const signedHeaders    = 'host;x-amz-content-sha256;x-amz-date';
  const canonicalRequest = ['GET', canonicalUri, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');

  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256', amzDate, credentialScope, sha256Hex(canonicalRequest),
  ].join('\n');

  const kDate    = hmac(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion  = hmac(kDate, region);
  const kService = hmac(kRegion, 's3');
  const kSigning = hmac(kService, 'aws4_request');
  const signature = hmac(kSigning, stringToSign).toString('hex');

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const res = await fetch(`${url.protocol}//${host}${canonicalUri}`, {
    headers: {
      'x-amz-date': amzDate,
      'x-amz-content-sha256': payloadHash,
      Authorization: authorization,
    },
  });
  if (!res.ok) throw new Error(`S3 download failed: ${res.status} ${await res.text()}`);
  return Buffer.from(await res.arrayBuffer());
}

// ── Post-processing ──────────────────────────────────────────────────────────
const LEAD_IN_SECONDS = 0.5;
const PRE_ROLL_SECONDS = 0.06; // original quiet kept before the first sound

/**
 * RunPod's voice-clone output has an inconsistent amount of dead air (roughly
 * 0.2-0.6s, varies clip to clip) before the speech actually starts. Left in,
 * it makes narration audibly lag any visual cue timed to when the clip
 * starts (e.g. the answer reveal). Stripping it to zero fixes that but
 * over-trims right up against (or into) the actual onset of speech, making
 * it sound chopped off — so this strips whatever's there, then adds back a
 * fixed, clean lead-in, giving every clip the same small buffer regardless
 * of how much dead air the model originally produced. Leaves the file
 * untouched if ffmpeg isn't available or the pass fails for any reason.
 */
function normalizeLeadIn(filePath) {
  const tmpPath = `${filePath}.norm.wav`;
  try {
    execFileSync('ffmpeg', [
      '-nostdin', '-y', '-i', filePath,
      // Trim the dead air but keep PRE_ROLL of the original quiet lead-up in
      // front of the first sound (start_silence), and fade in over that
      // pre-roll only. Fading over the onset itself swallowed short initial
      // consonants — "Can you…" came out as "…an you". The added delay is
      // shortened by the same pre-roll, so speech still starts at exactly
      // LEAD_IN_SECONDS in every clip.
      '-af', `silenceremove=start_periods=1:start_duration=0:start_threshold=-50dB:start_silence=${PRE_ROLL_SECONDS},afade=t=in:st=0:d=${PRE_ROLL_SECONDS / 2},adelay=${Math.round((LEAD_IN_SECONDS - PRE_ROLL_SECONDS) * 1000)}:all=1`,
      tmpPath,
    ], { stdio: ['ignore', 'ignore', 'pipe'] });
    fs.renameSync(tmpPath, filePath);
  } catch {
    if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
  }
}

// ── Public API ────────────────────────────────────────────────────────────────
/**
 * Generate one or more narration clips in a single RunPod job and save each to
 * its outPath. One job, one queue wait, regardless of item count.
 * @param {{ name: string, text: string, outPath: string }[]} items
 * @param {{ sample?: string, sampleText?: string }} [opts]
 */
async function generateAudioBatch(items, opts = {}) {
  if (items.length === 0) return;

  const env = requireEnv();
  const sample     = opts.sample     || REFERENCE_SAMPLE;
  const sampleText = opts.sampleText || REFERENCE_SAMPLE_TEXT;

  const output = await runpodSubmitAndWait({
    apiKey: env.RUNPOD_API_KEY,
    endpointId: env.RUNPOD_ENDPOINT_ID,
    input: {
      sample,
      sample_text: sampleText,
      generations: items.map(it => ({ text: it.text, output_name: it.name })),
    },
  });

  const results = Array.isArray(output?.generations) ? output.generations : [];
  // RunPod appends ".wav" to whatever output_name we sent.
  const byName = new Map(results.map(r => [String(r.output_name || '').replace(/\.wav$/i, ''), r]));

  for (const it of items) {
    const result = byName.get(it.name);
    if (!result?.output_key) {
      throw new Error(`RunPod batch job completed but returned no output for "${it.name}": ${JSON.stringify(output)}`);
    }

    const buf = await s3GetObject({
      endpoint: env.RUNPOD_S3_ENDPOINT,
      bucket: env.RUNPOD_S3_BUCKET,
      region: env.RUNPOD_S3_REGION,
      accessKeyId: env.RUNPOD_S3_ACCESS_KEY_ID,
      secretAccessKey: env.RUNPOD_S3_SECRET_ACCESS_KEY,
      key: result.output_key,
    });

    fs.mkdirSync(path.dirname(it.outPath), { recursive: true });
    fs.writeFileSync(it.outPath, buf);
    normalizeLeadIn(it.outPath);
    const sizeKb = Math.round(fs.statSync(it.outPath).size / 1024);
    console.log(`    → ${path.basename(it.outPath)} (${sizeKb} KB)`);
  }
}

/**
 * Generate a single narration clip via the RunPod voice-clone endpoint and save it to outPath.
 * @param {string} text
 * @param {string} outPath
 * @param {{ sample?: string, sampleText?: string }} [opts]
 */
async function generateAudio(text, outPath, opts = {}) {
  await generateAudioBatch([{ name: 'audio', text, outPath }], opts);
}

module.exports = { generateAudio, generateAudioBatch, REFERENCE_SAMPLE, REFERENCE_SAMPLE_TEXT };
