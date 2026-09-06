'use strict';

/**
 * Smoke test: verify BACnet HTTP routes respond (not 404).
 * Run with the API server already listening, or set SMOKE_BASE_URL (default http://localhost:4000).
 *
 * Usage: node scripts/smoke-bacnet-routes.js
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');

const BASE_URL = process.env.SMOKE_BASE_URL || 'http://localhost:4000';

const ROUTES = [
  { method: 'GET', path: '/api/runtime/bacnet/explorer/devices', body: null },
  { method: 'POST', path: '/api/runtime/bacnet/discover', body: { lowLimit: 1, highLimit: 1, timeoutMs: 1 } },
  { method: 'POST', path: '/api/runtime/bacnet/read-property', body: {} },
  { method: 'POST', path: '/api/runtime/bacnet/check-devices-health', body: { deviceIds: [] } },
];

function requestRoute({ method, path, body }) {
  const url = new URL(`${BASE_URL}${path}`);
  const payload = body != null ? JSON.stringify(body) : null;
  const transport = url.protocol === 'https:' ? https : http;

  return new Promise((resolve, reject) => {
    const req = transport.request(
      url,
      {
        method,
        headers:
          payload != null
            ? {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload),
              }
            : undefined,
      },
      (res) => {
        res.resume();
        resolve({ method, path, status: res.statusCode });
      }
    );

    req.on('error', reject);
    if (payload != null) req.write(payload);
    req.end();
  });
}

async function main() {
  for (const route of ROUTES) {
    const result = await requestRoute(route);
    if (result.status === 404) {
      throw new Error(`${result.method} ${result.path} returned 404`);
    }
    console.log(`[smoke] ${result.method} ${result.path} -> ${result.status}`);
  }
}

main().catch((err) => {
  console.error('[smoke] failed:', err?.message || err);
  process.exit(1);
});
