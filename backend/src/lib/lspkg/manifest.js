'use strict';

/**
 * `.lspkg` manifest schema (LC-ARCH-002 §3). Bumping this requires a decision on backward/forward
 * compatibility (LC-ARCH-002 §11) — an LS-100 that does not recognize a package's schemaVersion
 * must refuse to stage it (DEP-003/DEP-005) rather than guess at its structure.
 */
const PACKAGE_SCHEMA_VERSION = 1;

/** Schema versions this build of the parser/activator understands. */
const SUPPORTED_SCHEMA_VERSIONS = [1];

const REQUIRED_MANIFEST_FIELDS = [
  'packageSchemaVersion',
  'packageId',
  'siteId',
  'siteName',
  'projectVersion',
  'createdAt',
  'minLs100Version',
  'deploymentScope',
  'files',
  'checksums',
  'signature',
];

/** Field names that must never appear anywhere in a built package (defense in depth on top of the
 * builder only ever selecting known-safe columns — see builder.js `assertNoForbiddenKeys`). */
const FORBIDDEN_KEY_PATTERN = /password|passwd|secret|token|apikey|api_key|privatekey|private_key|credential/i;

/**
 * @param {unknown} manifest
 * @returns {{ ok: boolean, errors: string[] }}
 */
function validateManifest(manifest) {
  const errors = [];
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    return { ok: false, errors: ['manifest must be a JSON object'] };
  }
  for (const field of REQUIRED_MANIFEST_FIELDS) {
    if (manifest[field] === undefined || manifest[field] === null) errors.push(`manifest.${field} is required`);
  }
  if (typeof manifest.packageSchemaVersion === 'number' && !SUPPORTED_SCHEMA_VERSIONS.includes(manifest.packageSchemaVersion)) {
    errors.push(`Unsupported package schema version ${manifest.packageSchemaVersion}; this LS-100 supports [${SUPPORTED_SCHEMA_VERSIONS.join(', ')}]`);
  }
  if (typeof manifest.siteId !== 'string' || !manifest.siteId.trim()) errors.push('manifest.siteId must be a non-empty string');
  if (typeof manifest.packageId !== 'string' || !manifest.packageId.trim()) errors.push('manifest.packageId must be a non-empty string');
  if (!Array.isArray(manifest.files)) errors.push('manifest.files must be an array');
  if (!manifest.checksums || typeof manifest.checksums !== 'object') errors.push('manifest.checksums must be an object');
  if (manifest.simulationPackage !== undefined && typeof manifest.simulationPackage !== 'boolean') {
    errors.push('manifest.simulationPackage must be a boolean when present');
  }
  return { ok: errors.length === 0, errors };
}

/**
 * Recursively scans a plain-JSON value for keys that must never be present in a deployable
 * package (passwords, tokens, private keys, machine secrets). Throws rather than silently
 * stripping, so a leak is a loud build failure, not a quiet omission.
 * @param {unknown} value
 * @param {string} [path]
 */
function assertNoForbiddenKeys(value, path = '$') {
  if (Array.isArray(value)) {
    value.forEach((item, i) => assertNoForbiddenKeys(item, `${path}[${i}]`));
    return;
  }
  if (value !== null && typeof value === 'object') {
    for (const key of Object.keys(value)) {
      if (FORBIDDEN_KEY_PATTERN.test(key)) {
        throw new Error(`Refusing to build package: forbidden key "${key}" found at ${path}.${key}`);
      }
      assertNoForbiddenKeys(value[key], `${path}.${key}`);
    }
  }
}

module.exports = {
  PACKAGE_SCHEMA_VERSION,
  SUPPORTED_SCHEMA_VERSIONS,
  REQUIRED_MANIFEST_FIELDS,
  validateManifest,
  assertNoForbiddenKeys,
};
