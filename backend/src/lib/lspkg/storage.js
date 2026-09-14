'use strict';

/**
 * Staged/imported `.lspkg` bytes live on disk, not in the database — Postgres is a poor fit for
 * storing potentially-large binary blobs, and this keeps `DeploymentPackageRecord` a lightweight,
 * queryable metadata row (see backend/prisma/schema.prisma). Filenames are always the package
 * record's own generated UUID, never a caller-supplied name, so this module never has to sanitize
 * a hostile path.
 */

const fs = require('fs');
const path = require('path');

function stagingDir() {
  const dir = process.env.LSPKG_STAGING_DIR || path.join(__dirname, '..', '..', '..', '.lspkg-staging');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** @param {string} packageRecordId @param {Buffer} buffer @returns {string} absolute file path */
function writeStagedPackage(packageRecordId, buffer) {
  const filePath = path.join(stagingDir(), `${packageRecordId}.lspkg`);
  fs.writeFileSync(filePath, buffer);
  return filePath;
}

/** @param {string} filePath @returns {Buffer} */
function readStagedPackage(filePath) {
  return fs.readFileSync(filePath);
}

function deleteStagedPackage(filePath) {
  try {
    fs.unlinkSync(filePath);
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
}

module.exports = { stagingDir, writeStagedPackage, readStagedPackage, deleteStagedPackage };
