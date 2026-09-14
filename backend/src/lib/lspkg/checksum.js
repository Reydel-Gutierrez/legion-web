'use strict';

const crypto = require('crypto');

/**
 * Deterministically stringifies a JSON-compatible value: object keys are sorted recursively so
 * two logically-identical objects with keys inserted in a different order always serialize to the
 * same bytes. This is what makes checksums (and the whole package) stable across rebuilds.
 * @param {unknown} value
 * @returns {string}
 */
function canonicalStringify(value) {
  return JSON.stringify(sortKeysDeep(value));
}

function sortKeysDeep(value) {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value !== null && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value).sort()) out[key] = sortKeysDeep(value[key]);
    return out;
  }
  return value;
}

/** @param {Buffer|string} data */
function sha256Hex(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

module.exports = { canonicalStringify, sortKeysDeep, sha256Hex };
