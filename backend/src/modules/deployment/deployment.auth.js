'use strict';

/**
 * Deployment authentication boundary (LC-ARCH-002 §11: "Mutual authentication or equivalent
 * strong identity for Engineering Workspace and LS-100", "Role-based deployment permission
 * separate from ordinary operator control").
 *
 * This backend has NO authentication system at all today (confirmed: zero auth middleware exists
 * anywhere in the codebase). Rather than pretend to add real identity/authorization here, this
 * module is an honest, minimal boundary: a shared-secret bearer token gate, clearly labeled as
 * development-grade. It exists so the deployment endpoints are not silently wide open, and so a
 * real auth system has one obvious place to plug into later (replace `requireDeploymentAuth`'s
 * body; every route already calls it).
 *
 * "Do not expose an unauthenticated production deployment endpoint" is enforced by refusing to
 * start the endpoint at all when `LEGION_PROFILE=ls100-production` and no token is configured.
 */

const { HttpError } = require('../../lib/httpError');

let warnedOnce = false;

function requireDeploymentAuth(req, res, next) {
  const profile = process.env.LEGION_PROFILE || 'engineering';
  const token = process.env.LS100_DEPLOY_TOKEN;

  if (profile === 'ls100-production') {
    if (!token) {
      // Fail loud, every request — never silently allow unauthenticated production deployment.
      return next(new HttpError(501, 'Deployment authentication is not configured for this production LS-100 (LS100_DEPLOY_TOKEN unset). Refusing to accept deployment requests.'));
    }
    const header = req.get('authorization') || '';
    const presented = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!presented || presented !== token) {
      return next(new HttpError(401, 'Missing or invalid deployment credentials'));
    }
    return next();
  }

  // engineering / ls100-sim: allow a configured token to be enforced even in dev, but otherwise
  // permit the request through with a one-time loud warning — this is explicitly NOT production
  // auth, and every deployment audit entry still records the caller-supplied `actor`.
  if (token) {
    const header = req.get('authorization') || '';
    const presented = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!presented || presented !== token) return next(new HttpError(401, 'Missing or invalid deployment credentials'));
    return next();
  }
  if (!warnedOnce) {
    warnedOnce = true;
    // eslint-disable-next-line no-console
    console.warn(`[deployment.auth] LS100_DEPLOY_TOKEN is not set (profile=${profile}) — deployment endpoints are UNAUTHENTICATED. Development only; never run a production LS-100 this way.`);
  }
  return next();
}

module.exports = { requireDeploymentAuth };
