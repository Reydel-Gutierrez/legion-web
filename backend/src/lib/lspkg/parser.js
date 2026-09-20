'use strict';

/**
 * Parses and validates a `.lspkg` buffer (LC-ARCH-002 §3, §11). Shared by both deployment entry
 * points — direct LAN transfer and offline import — so they can never diverge into competing
 * formats (DEP-004). Returns a structured result rather than throwing on recoverable validation
 * problems, so callers (the staging endpoint) can persist a FAILED record with a reason instead of
 * a bare 500.
 */

const { readZip, ZipError } = require('./zip');
const { canonicalStringify, sha256Hex } = require('./checksum');
const { validateManifest, assertNoForbiddenKeys, SUPPORTED_SCHEMA_VERSIONS } = require('./manifest');

const DEFAULT_LIMITS = {
  maxFiles: 64,
  maxTotalBytes: 100 * 1024 * 1024,
  maxEntryBytes: 32 * 1024 * 1024,
};

/**
 * @param {Buffer} buffer
 * @param {{ maxFiles?: number, maxTotalBytes?: number, maxEntryBytes?: number }} [limits]
 * @returns {{ ok: boolean, errors: string[], warnings: string[], manifest: object|null, files: Record<string, object>|null }}
 */
function parseSitePackage(buffer, limits = {}) {
  const merged = { ...DEFAULT_LIMITS, ...limits };
  const errors = [];
  const warnings = [];

  let entries;
  try {
    entries = readZip(buffer, merged);
  } catch (e) {
    if (e instanceof ZipError) return { ok: false, errors: [e.message], warnings, manifest: null, files: null };
    throw e;
  }

  const byName = new Map(entries.map((e) => [e.name, e.data]));
  if (!byName.has('manifest.json')) {
    return { ok: false, errors: ['Package is missing manifest.json'], warnings, manifest: null, files: null };
  }

  let manifest;
  try {
    manifest = JSON.parse(byName.get('manifest.json').toString('utf8'));
  } catch (e) {
    return { ok: false, errors: [`manifest.json is not valid JSON: ${e.message}`], warnings, manifest: null, files: null };
  }

  const manifestCheck = validateManifest(manifest);
  if (!manifestCheck.ok) {
    return { ok: false, errors: manifestCheck.errors, warnings, manifest, files: null };
  }

  if (!SUPPORTED_SCHEMA_VERSIONS.includes(manifest.packageSchemaVersion)) {
    errors.push(`Unsupported package schema version ${manifest.packageSchemaVersion}`);
    return { ok: false, errors, warnings, manifest, files: null };
  }

  const files = {};
  for (const fileName of manifest.files || []) {
    if (!byName.has(fileName)) {
      errors.push(`manifest declares file "${fileName}" but it is missing from the archive`);
      continue;
    }
    let parsed;
    try {
      parsed = JSON.parse(byName.get(fileName).toString('utf8'));
    } catch (e) {
      errors.push(`"${fileName}" is not valid JSON: ${e.message}`);
      continue;
    }
    const expectedChecksum = manifest.checksums?.[fileName];
    const actualChecksum = sha256Hex(canonicalStringify(parsed));
    if (!expectedChecksum) {
      errors.push(`manifest.checksums is missing an entry for "${fileName}"`);
    } else if (expectedChecksum !== actualChecksum) {
      errors.push(`Checksum mismatch for "${fileName}" — package is corrupt or tampered`);
    }
    files[fileName] = parsed;
  }

  // Any archive entry not declared in the manifest is unexpected content — reject rather than
  // silently ignore it (a tampered or malformed package must not pass validation quietly).
  for (const name of byName.keys()) {
    if (name !== 'manifest.json' && !(manifest.files || []).includes(name)) {
      errors.push(`Archive contains undeclared file "${name}"`);
    }
  }

  if (errors.length) return { ok: false, errors, warnings, manifest, files };

  try {
    assertNoForbiddenKeys(manifest);
    assertNoForbiddenKeys(files);
  } catch (e) {
    return { ok: false, errors: [e.message], warnings, manifest, files: null };
  }

  if (manifest.signature && manifest.signature.signed === false) {
    warnings.push('Package is unsigned (development build) — integrity was checked via checksum only, not a cryptographic signature.');
  }

  return { ok: true, errors: [], warnings, manifest, files };
}

module.exports = { parseSitePackage, DEFAULT_LIMITS };
