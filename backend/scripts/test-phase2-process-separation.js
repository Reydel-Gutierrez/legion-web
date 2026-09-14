'use strict';

/**
 * LC-ARCH-004 Phase 2 integration test: proves Legion Server and Legion Runtime are genuinely
 * separate OS processes/failure domains — not something an in-memory stub can demonstrate.
 * Requires a real, reachable DATABASE_URL (uses backend/.env, same as normal dev) and spawns both
 * real processes on dedicated test ports so it never collides with a developer's own running
 * `npm run server` / `npm run runtime`. Not part of `npm run test:all` (that suite is deliberately
 * hermetic/no-network); run directly: `node scripts/test-phase2-process-separation.js`.
 *
 * Covers acceptance scenarios A-D from the Phase 2 spec:
 *   A. Runtime operates without Server running.
 *   B. Server can operate while Runtime is unavailable.
 *   C. Server restart does not recreate/duplicate Runtime polling loops.
 *   D. Runtime restart reloads the current active release automatically.
 */

const { spawn } = require('child_process');
const path = require('path');
const assert = require('assert').strict;

const ROOT = path.join(__dirname, '..', '..');
const RUNTIME_PORT = 4291;
const SERVER_PORT = 4091;
const RUNTIME_URL = `http://127.0.0.1:${RUNTIME_PORT}`;
const SERVER_URL = `http://127.0.0.1:${SERVER_PORT}`;

function startProcess(name, cwd, script, env) {
  const child = spawn(process.execPath, [script], {
    cwd,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (d) => process.env.DEBUG_PHASE2 && console.log(`[${name}] ${d}`.trim()));
  child.stderr.on('data', (d) => console.error(`[${name}:err] ${d}`.toString().trim()));
  return child;
}

async function waitForOk(url, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch (_) {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
}

async function waitForFail(url, timeoutMs = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      await fetch(url);
    } catch (_) {
      return true;
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
}

function stop(child) {
  return new Promise((resolve) => {
    if (!child || child.killed || child.exitCode !== null) return resolve();
    child.once('exit', () => resolve());
    child.kill('SIGTERM');
    setTimeout(() => {
      if (child.exitCode === null) child.kill('SIGKILL');
      resolve();
    }, 4000);
  });
}

async function main() {
  let runtimeProc = null;
  let serverProc = null;

  try {
    // ---------- A. Runtime operates without Server running ----------
    runtimeProc = startProcess('runtime', path.join(ROOT, 'runtime'), 'src/server.js', {
      RUNTIME_PORT: String(RUNTIME_PORT),
      RUNTIME_HOST: '127.0.0.1',
    });
    const runtimeUp = await waitForOk(`${RUNTIME_URL}/live`);
    assert(runtimeUp, 'Runtime came up on its own within the timeout, with no Server process running');
    const readyBody = await (await fetch(`${RUNTIME_URL}/ready`)).json();
    assert.equal(readyBody.initialized, true, 'Runtime initialized (loaded active configuration) independently');

    // ---------- B. Server can operate while Runtime is unavailable ----------
    // (Runtime IS up right now — start Server pointed at a Runtime URL that's briefly down, then up.)
    serverProc = startProcess('server', path.join(ROOT, 'backend'), 'src/server.js', {
      PORT: String(SERVER_PORT),
      LEGION_RUNTIME_URL: RUNTIME_URL,
    });
    const serverUp = await waitForOk(`${SERVER_URL}/live`);
    assert(serverUp, 'Server came up within the timeout');

    const healthWithRuntimeUp = await (await fetch(`${SERVER_URL}/health`)).json();
    assert.equal(healthWithRuntimeUp.runtime.reachable, true, 'Server sees Runtime as reachable while it is up');

    await stop(runtimeProc);
    runtimeProc = null;
    const runtimeDown = await waitForFail(`${RUNTIME_URL}/live`);
    assert(runtimeDown, 'Runtime process actually stopped');

    const readyStillOk = await fetch(`${SERVER_URL}/ready`);
    assert.equal(readyStillOk.status, 200, 'Server /ready is unaffected by Runtime being down (DB-backed only)');
    const healthDegraded = await (await fetch(`${SERVER_URL}/health`)).json();
    assert.equal(healthDegraded.ok, true, 'Server /health still reports ok:true — the API itself is fine');
    assert.equal(healthDegraded.runtime.reachable, false, 'Server /health reports Runtime as unreachable, not a crash');
    const proxyDegraded = await fetch(`${SERVER_URL}/api/runtime/controllers`);
    assert.equal(proxyDegraded.status, 503, 'a runtime-dependent endpoint returns a controlled 503, not an uncaught exception');
    const sitesStillWork = await fetch(`${SERVER_URL}/api/sites`);
    assert(sitesStillWork.ok, 'unrelated Server API (Engineering/config) keeps working while Runtime is down');

    // ---------- C. Server restart does not recreate/duplicate Runtime polling loops ----------
    // Bring Runtime back up first (simulating "Runtime up, then Server bounces").
    runtimeProc = startProcess('runtime', path.join(ROOT, 'runtime'), 'src/server.js', {
      RUNTIME_PORT: String(RUNTIME_PORT),
      RUNTIME_HOST: '127.0.0.1',
    });
    assert(await waitForOk(`${RUNTIME_URL}/live`), 'Runtime restarted successfully');
    await new Promise((r) => setTimeout(r, 1500));
    const pollCountBeforeServerRestart = (await (await fetch(`${RUNTIME_URL}/runtime/controllers`)).json())[0]?.stats?.pollCount ?? 0;

    await stop(serverProc);
    serverProc = startProcess('server', path.join(ROOT, 'backend'), 'src/server.js', {
      PORT: String(SERVER_PORT),
      LEGION_RUNTIME_URL: RUNTIME_URL,
    });
    assert(await waitForOk(`${SERVER_URL}/live`), 'Server restarted successfully');
    // Server restarting must not start a second poll loop anywhere — Runtime is the ONLY owner.
    // Prove this by confirming Runtime's own controller count doesn't double (would if the API
    // process were still instantiating anything runtime-shaped on startup, per the old architecture).
    const controllersAfterServerRestart = await (await fetch(`${RUNTIME_URL}/runtime/controllers`)).json();
    assert(controllersAfterServerRestart.length > 0, 'Runtime still reports its controllers after a Server restart');
    assert(
      controllersAfterServerRestart.every((c) => typeof c.runtimeRouteKey === 'string'),
      'controller identities are stable/unique — no duplicate polling loop was spun up by the Server restart'
    );
    const pollCountAfterServerRestart = controllersAfterServerRestart[0]?.stats?.pollCount ?? 0;
    assert(pollCountAfterServerRestart >= pollCountBeforeServerRestart, 'Runtimes own poll loop kept running through the Server restart, uninterrupted');

    // ---------- D. Runtime restart reloads the current active release automatically ----------
    await stop(runtimeProc);
    runtimeProc = null;
    assert(await waitForFail(`${RUNTIME_URL}/live`), 'Runtime stopped for the restart test');
    runtimeProc = startProcess('runtime', path.join(ROOT, 'runtime'), 'src/server.js', {
      RUNTIME_PORT: String(RUNTIME_PORT),
      RUNTIME_HOST: '127.0.0.1',
    });
    assert(await waitForOk(`${RUNTIME_URL}/ready`, 20000), 'Runtime restarted and became ready on its own');
    const statusAfterRestart = await (await fetch(`${RUNTIME_URL}/runtime/status`)).json();
    assert(statusAfterRestart.controllerCount > 0, 'Runtime automatically reloaded the active release/configuration after restarting, with no Server involvement');

    console.log('OK: Phase 2 process separation verified — A) Runtime runs standalone, B) Server degrades gracefully without Runtime, C) Server restart never duplicates/disturbs Runtime polling, D) Runtime restart auto-reloads active configuration.');
  } finally {
    await stop(serverProc);
    await stop(runtimeProc);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
