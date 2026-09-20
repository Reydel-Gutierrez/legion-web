'use strict';

/**
 * Direct deploy (LC-ARCH-002 §4 "Direct deploy over LAN", Phase 4). Builds a package exactly the
 * way Export Site Package does, then transfers those same bytes over HTTP to a configured LS-100's
 * `/api/deployment/import` endpoint — the identical staging/validate/preview/backup/activate
 * pipeline as offline import (DEP-004: "must not become separate configuration formats"). This
 * module owns *transfer* only; it never touches the target's database directly.
 *
 * "For the current development environment, explicit LS-100 URL entry is acceptable" — there is
 * no discovery here by design.
 */

const { HttpError } = require('../../lib/httpError');
const { buildProjectPackage, getBuiltPackageBuffer } = require('../siteVersions/sitePackage.service');

/**
 * @param {string} siteId
 * @param {{ targetUrl: string, actor?: string, deployToken?: string, buildOptions?: object }} options
 */
async function deployDirect(siteId, options) {
  const targetUrl = String(options.targetUrl || '').trim().replace(/\/+$/, '');
  if (!targetUrl) throw new HttpError(400, 'targetUrl is required (e.g. http://ls100-sim.local:4100)');
  let parsedUrl;
  try {
    parsedUrl = new URL(targetUrl);
  } catch {
    throw new HttpError(400, `targetUrl is not a valid URL: ${targetUrl}`);
  }
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new HttpError(400, 'targetUrl must be http or https');
  }

  const { record } = await buildProjectPackage(siteId, options.buildOptions || {});
  const { buffer } = await getBuiltPackageBuffer(record.id);

  const token = options.deployToken || process.env.LS100_DEPLOY_TOKEN;
  const headers = { 'Content-Type': 'application/octet-stream' };
  if (token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(`${targetUrl}/api/deployment/import?source=DIRECT`, {
      method: 'POST',
      headers,
      body: buffer,
    });
  } catch (e) {
    throw new HttpError(502, `Could not reach LS-100 at ${targetUrl}: ${e.message}`);
  }

  const bodyText = await response.text();
  let bodyJson = null;
  try {
    bodyJson = JSON.parse(bodyText);
  } catch {
    // non-JSON error body from a proxy/unexpected endpoint; surfaced as-is below
  }

  if (!response.ok) {
    throw new HttpError(response.status, `LS-100 rejected the package: ${bodyJson?.error || bodyText || response.statusText}`);
  }

  return { transferred: true, targetUrl, packageRecord: record, remoteRecord: bodyJson };
}

module.exports = { deployDirect };
