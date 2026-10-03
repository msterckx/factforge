'use strict';
/**
 * runpod-upscale.js
 * 4x AI image upscale (Real-ESRGAN) via a RunPod serverless endpoint.
 *
 * Flow: SigV4 PUT each source image to RunPod's S3-compatible bucket under
 * upscale/input/ → POST /run with the list of source keys (one job for
 * however many images are pending, like the TTS batch) → poll /status/:id
 * until COMPLETED → SigV4 GET each resulting PNG from upscale/output/<jobId>/.
 *
 * Required env (loaded from .env.local at the repo root):
 *   RUNPOD_API_KEY, RUNPOD_UPSCALE_ENDPOINT_ID,
 *   RUNPOD_S3_ENDPOINT, RUNPOD_S3_REGION, RUNPOD_S3_BUCKET,
 *   RUNPOD_S3_ACCESS_KEY_ID, RUNPOD_S3_SECRET_ACCESS_KEY
 */

const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');

const REQUIRED_ENV = [
  'RUNPOD_API_KEY', 'RUNPOD_UPSCALE_ENDPOINT_ID',
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
    throw new Error(`runpod-upscale: missing env var(s) in .env.local: ${missing.join(', ')}`);
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

  const statusUrl = `https://api.runpod.ai/v2/${endpointId}/status/${id}`;
  const pollMs     = 3000;
  const timeoutMs  = 10 * 60 * 1000; // batch upscales can take longer than a single TTS clip
  const startedAt  = Date.now();

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

// ── S3 (SigV4) helpers ───────────────────────────────────────────────────────
function sha256Hex(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}
function hmac(key, data) {
  return crypto.createHmac('sha256', key).update(data).digest();
}

function sigv4Authorize({ method, canonicalUri, payloadHash, region, host, accessKeyId, secretAccessKey }) {
  const amzDate   = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const dateStamp = amzDate.slice(0, 8);

  const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const signedHeaders    = 'host;x-amz-content-sha256;x-amz-date';
  const canonicalRequest = [method, canonicalUri, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');

  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, credentialScope, sha256Hex(canonicalRequest)].join('\n');

  const kDate    = hmac(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion  = hmac(kDate, region);
  const kService = hmac(kRegion, 's3');
  const kSigning = hmac(kService, 'aws4_request');
  const signature = hmac(kSigning, stringToSign).toString('hex');

  return {
    'x-amz-date': amzDate,
    'x-amz-content-sha256': payloadHash,
    Authorization:
      `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, ` +
      `SignedHeaders=${signedHeaders}, Signature=${signature}`,
  };
}

async function s3GetObject({ endpoint, bucket, region, accessKeyId, secretAccessKey, key }) {
  const url = new URL(endpoint);
  const host = url.host;
  const canonicalUri = `/${bucket}/${key}`.split('/').map(encodeURIComponent).join('/');
  const payloadHash = sha256Hex('');

  const headers = sigv4Authorize({ method: 'GET', canonicalUri, payloadHash, region, host, accessKeyId, secretAccessKey });
  const res = await fetch(`${url.protocol}//${host}${canonicalUri}`, { headers });
  if (!res.ok) throw new Error(`S3 download failed: ${res.status} ${await res.text()}`);
  return Buffer.from(await res.arrayBuffer());
}

async function s3PutObject({ endpoint, bucket, region, accessKeyId, secretAccessKey, key, body, contentType }) {
  const url = new URL(endpoint);
  const host = url.host;
  const canonicalUri = `/${bucket}/${key}`.split('/').map(encodeURIComponent).join('/');
  const payloadHash = sha256Hex(body);

  const headers = sigv4Authorize({ method: 'PUT', canonicalUri, payloadHash, region, host, accessKeyId, secretAccessKey });
  if (contentType) headers['content-type'] = contentType;

  const res = await fetch(`${url.protocol}//${host}${canonicalUri}`, { method: 'PUT', headers, body });
  if (!res.ok) throw new Error(`S3 upload failed (${key}): ${res.status} ${await res.text()}`);
}

// ── Public API ────────────────────────────────────────────────────────────────
/**
 * Upscale one or more source images in a single RunPod job.
 * @param {{ s3Key: string, localBuffer: Buffer, contentType: string, outPath: string }[]} items
 * @returns {Promise<{ source: string, output_key: string, width: number, height: number }[]>} results for items RunPod actually returned
 */
async function upscaleBatch(items) {
  if (items.length === 0) return [];

  const env = requireEnv();
  const s3Opts = {
    endpoint: env.RUNPOD_S3_ENDPOINT,
    bucket: env.RUNPOD_S3_BUCKET,
    region: env.RUNPOD_S3_REGION,
    accessKeyId: env.RUNPOD_S3_ACCESS_KEY_ID,
    secretAccessKey: env.RUNPOD_S3_SECRET_ACCESS_KEY,
  };

  for (const it of items) {
    await s3PutObject({ ...s3Opts, key: it.s3Key, body: it.localBuffer, contentType: it.contentType });
  }

  const output = await runpodSubmitAndWait({
    apiKey: env.RUNPOD_API_KEY,
    endpointId: env.RUNPOD_UPSCALE_ENDPOINT_ID,
    input: { sources: items.map(it => it.s3Key) },
  });

  const images = Array.isArray(output?.images) ? output.images : [];
  const byKey = new Map(images.map(img => [img.source, img]));

  const results = [];
  for (const it of items) {
    const img = byKey.get(it.s3Key);
    if (!img?.output_key) {
      console.warn(`  ✗ No upscaled output for "${it.s3Key}" (${JSON.stringify(output?.failed ?? [])})`);
      continue;
    }
    const buf = await s3GetObject({ ...s3Opts, key: img.output_key });
    fs.mkdirSync(path.dirname(it.outPath), { recursive: true });
    fs.writeFileSync(it.outPath, buf);
    console.log(`    → ${path.basename(it.outPath)} (${img.width}x${img.height})`);
    results.push({ source: it.s3Key, output_key: img.output_key, width: img.width, height: img.height });
  }
  return results;
}

module.exports = { upscaleBatch };
