'use strict';
/**
 * wav-duration.js
 * Tiny RIFF/WAVE header parser — returns a WAV file's duration in seconds by
 * reading its `fmt ` and `data` subchunks. No external dependency.
 */

const fs = require('fs');

/**
 * @param {string} filePath
 * @returns {number} duration in seconds, or 0 if the file can't be parsed as WAV
 */
function getWavDurationSeconds(filePath) {
  let buf;
  try {
    buf = fs.readFileSync(filePath);
  } catch {
    return 0;
  }

  if (buf.length < 12 || buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') {
    return 0;
  }

  let offset = 12;
  let sampleRate = 0, numChannels = 0, bitsPerSample = 0, dataSize = 0;

  while (offset + 8 <= buf.length) {
    const chunkId   = buf.toString('ascii', offset, offset + 4);
    const chunkSize = buf.readUInt32LE(offset + 4);
    const bodyStart = offset + 8;

    if (chunkId === 'fmt ') {
      numChannels   = buf.readUInt16LE(bodyStart + 2);
      sampleRate    = buf.readUInt32LE(bodyStart + 4);
      bitsPerSample = buf.readUInt16LE(bodyStart + 14);
    } else if (chunkId === 'data') {
      dataSize = chunkSize;
    }

    // Subchunks are padded to even byte boundaries.
    offset = bodyStart + chunkSize + (chunkSize % 2);
  }

  if (!sampleRate || !numChannels || !bitsPerSample || !dataSize) return 0;
  return dataSize / (sampleRate * numChannels * (bitsPerSample / 8));
}

module.exports = { getWavDurationSeconds };
