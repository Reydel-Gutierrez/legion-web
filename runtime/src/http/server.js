'use strict';

/**
 * Legion Runtime's internal HTTP API. Plain `node:http` — no framework dependency needed for this
 * small, purely internal surface (loopback by default; see `../config/env.js`). Legion Server is
 * the only intended caller; browsers must never hit this directly (Server proxies/translates).
 */

const http = require('http');
const { URL } = require('url');
const runtimeCore = require('../core/runtimeCore');
const { RUNTIME_INTERNAL_TOKEN } = require('../config/env');

function sendJson(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) });
  res.end(data);
}

function readJsonBody(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) req.destroy();
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (_) {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
}

/** Matches "/runtime/controllers/:code/online" style patterns against a real pathname. */
function matchRoute(pattern, pathname) {
  const patternParts = pattern.split('/').filter(Boolean);
  const pathParts = pathname.split('/').filter(Boolean);
  if (patternParts.length !== pathParts.length) return null;
  const params = {};
  for (let i = 0; i < patternParts.length; i += 1) {
    const p = patternParts[i];
    if (p.startsWith(':')) {
      params[p.slice(1)] = decodeURIComponent(pathParts[i]);
    } else if (p !== pathParts[i]) {
      return null;
    }
  }
  return params;
}

const routes = [
  { method: 'GET', pattern: '/live', handler: async () => ({ status: 200, body: { ok: true } }) },
  {
    method: 'GET',
    pattern: '/ready',
    handler: async () => {
      const status = await runtimeCore.getStatus();
      const ready = status.initialized && status.dbReachable;
      return { status: ready ? 200 : 503, body: { ok: ready, ...status } };
    },
  },
  {
    method: 'GET',
    pattern: '/health',
    handler: async () => ({ status: 200, body: await runtimeCore.getStatus() }),
  },
  {
    method: 'GET',
    pattern: '/runtime/status',
    handler: async () => ({ status: 200, body: await runtimeCore.getStatus() }),
  },
  {
    method: 'POST',
    pattern: '/runtime/reload',
    handler: async () => ({ status: 200, body: await runtimeCore.reload() }),
  },
  {
    method: 'GET',
    pattern: '/runtime/controllers',
    handler: async () => ({ status: 200, body: runtimeCore.listControllers() }),
  },
  {
    method: 'GET',
    pattern: '/runtime/controllers/:code',
    handler: async ({ params }) => {
      const row = runtimeCore.getController(params.code);
      return row ? { status: 200, body: row } : { status: 404, body: { error: 'Controller not found' } };
    },
  },
  {
    method: 'GET',
    pattern: '/runtime/controllers/:code/field-points',
    handler: async ({ params }) => {
      const list = await runtimeCore.listFieldPointsForController(params.code);
      return list === null
        ? { status: 404, body: { error: 'Controller not found' } }
        : { status: 200, body: { points: list } };
    },
  },
  {
    method: 'POST',
    pattern: '/runtime/controllers/:code/online',
    handler: async ({ params }) => {
      const row = runtimeCore.setOnline(params.code, true);
      return row ? { status: 200, body: row } : { status: 404, body: { error: 'Controller not found' } };
    },
  },
  {
    method: 'POST',
    pattern: '/runtime/controllers/:code/offline',
    handler: async ({ params }) => {
      const row = runtimeCore.setOnline(params.code, false);
      return row ? { status: 200, body: row } : { status: 404, body: { error: 'Controller not found' } };
    },
  },
  {
    method: 'POST',
    pattern: '/runtime/controllers/:code/start',
    handler: async ({ params }) => {
      const row = runtimeCore.setSimEnabled(params.code, true);
      return row ? { status: 200, body: row } : { status: 404, body: { error: 'Controller not found' } };
    },
  },
  {
    method: 'POST',
    pattern: '/runtime/controllers/:code/stop',
    handler: async ({ params }) => {
      const row = runtimeCore.setSimEnabled(params.code, false);
      return row ? { status: 200, body: row } : { status: 404, body: { error: 'Controller not found' } };
    },
  },
  {
    method: 'POST',
    pattern: '/runtime/controllers/:code/poll-now',
    handler: async ({ params }) => {
      const row = await runtimeCore.pollNow(params.code);
      return row ? { status: 200, body: row } : { status: 404, body: { error: 'Controller not found' } };
    },
  },
  {
    // The only path a write reaches a real device through: Server -> here -> BacnetDriver -> device.
    method: 'POST',
    pattern: '/runtime/controllers/:code/write',
    handler: async ({ params, body }) => {
      const result = await runtimeCore.writePoint(params.code, body?.fieldPointKey, body?.value, { priority: body?.priority });
      return { status: result.status, body: result.ok ? result.result : { error: result.error } };
    },
  },
  {
    method: 'GET',
    pattern: '/runtime/discovery-devices',
    handler: async ({ query }) => ({
      status: 200,
      body: { devices: await runtimeCore.listDiscoveryDevices(query.get('siteId') || undefined) },
    }),
  },
];

function createServer() {
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://internal');
      const pathname = url.pathname;

      // /live and /ready are always open (no token) so an orchestrator/monitor never needs a secret
      // just to check the process is alive.
      const isPublicProbe = pathname === '/live' || pathname === '/ready';
      if (!isPublicProbe && RUNTIME_INTERNAL_TOKEN) {
        const provided = req.headers['x-runtime-token'];
        if (provided !== RUNTIME_INTERNAL_TOKEN) {
          sendJson(res, 401, { error: 'Unauthorized' });
          return;
        }
      }

      for (const route of routes) {
        if (route.method !== req.method) continue;
        const params = matchRoute(route.pattern, pathname);
        if (!params) continue;
        const body = req.method === 'POST' ? await readJsonBody(req) : undefined;
        const result = await route.handler({ params, query: url.searchParams, body });
        sendJson(res, result.status, result.body);
        return;
      }

      sendJson(res, 404, { error: 'Not found' });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[runtime] request handler error:', e?.message || e);
      sendJson(res, 500, { error: 'Internal runtime error' });
    }
  });
}

module.exports = { createServer };
