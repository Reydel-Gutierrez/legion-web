'use strict';

// Explicit local SIM-only check. Stops the selected simulator briefly and restores it.
// Usage: node scripts/smoke-sim-runtime.js http://localhost:4001 <equipment-id>
const assert = require('assert').strict;
const http = require('http');
const base = new URL(process.argv[2] || 'http://localhost:4001');
const equipmentId = process.argv[3];
assert(['localhost', '127.0.0.1', '[::1]'].includes(base.hostname), 'Use a local API only');
assert(equipmentId, 'Pass the equipment ID to test');

function request(route, method = 'GET') {
  return new Promise((resolve, reject) => {
    const req = http.request(new URL(route, base), { method }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 400) return reject(new Error(`HTTP ${res.statusCode}: ${route}`));
        try { resolve(JSON.parse(body)); } catch (err) { reject(err); }
      });
    });
    req.setTimeout(10000, () => req.destroy(new Error('API timeout')));
    req.on('error', reject);
    req.end();
  });
}
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function main() {
  const controllers = await request('/api/runtime/controllers');
  const sim = controllers.find((c) => c.equipmentId === equipmentId);
  assert(sim && sim.protocol === 'SIM' && sim.simEnabled && sim.online, 'Selected equipment must have a running SIM');
  const route = `/api/runtime/controllers/${encodeURIComponent(sim.runtimeRouteKey)}`;
  const pointsRoute = `/api/equipment/${encodeURIComponent(equipmentId)}/points`;
  const before = await request(pointsRoute);
  await wait(Math.max(22000, Number(sim.pollRateMs) + 2000));
  const after = await request(pointsRoute);
  assert(after.some((p) => before.some((b) => b.id === p.id && b.presentValue !== p.presentValue)), 'Automatic poll must change values');
  const fresh = await request(route);
  assert(new Date(fresh.lastSeenAt) > new Date(sim.lastSeenAt), 'Automatic poll must advance Last Seen');
  console.log('PASS: automatic SIM polling changes persisted values and Last Seen through HTTP');

  try {
    await request(`${route}/stop`, 'POST');
    const stopped = await request(route);
    const stoppedPoints = await request(pointsRoute);
    const offlineMs = Math.max(90000, Number(sim.pollRateMs) * 4);
    // Include a full reconciliation tick after the normal offline threshold.
    await wait(offlineMs + 22000);
    const aged = await request(route);
    const agedPoints = await request(pointsRoute);
    assert.equal(aged.online, false);
    assert.equal(aged.lastSeenAt, stopped.lastSeenAt);
    for (const p of agedPoints.filter((p) => p.lastSeenAt)) {
      const original = stoppedPoints.find((s) => s.id === p.id);
      assert.equal(p.lastSeenAt, original.lastSeenAt);
      assert.equal(p.presentValue, original.presentValue);
      assert.equal(p.commState, 'OFFLINE');
    }
    console.log('PASS: stopped SIM produces no values/heartbeat; mapped points become OFFLINE after normal timeout');
  } finally {
    await request(`${route}/start`, 'POST');
    await request(`${route}/poll-now`, 'POST');
    assert.equal((await request(route)).online, true);
    console.log('PASS: simulator restored and fresh after successful poll');
  }
}
main().catch((err) => { console.error(err); process.exitCode = 1; });
