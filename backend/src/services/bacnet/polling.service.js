'use strict';

const { randomUUID } = require('crypto');
const { HttpError } = require('../../lib/httpError');
const { readPresentValue } = require('./readProperty.service');

/** @type {Map<string, { id: string, intervalMs: number, timer: NodeJS.Timeout, targets: object[], lastResults: object[], startedAt: string, lastPollAt: string|null, lastError: string|null, pollCount: number }>} */
const sessions = new Map();

function normalizePollingTarget(raw, index) {
  if (!raw || typeof raw !== 'object') {
    throw new HttpError(400, `targets[${index}] must be an object`);
  }

  return {
    key: raw.key ? String(raw.key) : `target-${index + 1}`,
    address: raw.address,
    deviceInstance: raw.deviceInstance,
    objectType: raw.objectType,
    objectInstance: raw.objectInstance,
    pointsMappedId: raw.pointsMappedId,
  };
}

async function pollSession(session) {
  const results = [];

  for (const target of session.targets) {
    try {
      const result = await readPresentValue(target);
      results.push({ key: target.key, ok: true, result });
    } catch (err) {
      results.push({
        key: target.key,
        ok: false,
        error: err.message || String(err),
      });
    }
  }

  session.lastResults = results;
  session.lastPollAt = new Date().toISOString();
  session.pollCount += 1;
  session.lastError = results.some((r) => !r.ok)
    ? results.filter((r) => !r.ok).map((r) => `${r.key}: ${r.error}`).join('; ')
    : null;
}

function toSessionDto(session) {
  return {
    pollingId: session.id,
    intervalMs: session.intervalMs,
    targets: session.targets,
    startedAt: session.startedAt,
    lastPollAt: session.lastPollAt,
    pollCount: session.pollCount,
    lastError: session.lastError,
    lastResults: session.lastResults,
  };
}

/**
 * Start in-process polling for one or more BACnet targets.
 * Designed to be lifted into a dedicated worker later.
 */
async function startPolling(params = {}) {
  const intervalMs = Number(params.intervalMs) || 5000;
  if (!Number.isInteger(intervalMs) || intervalMs < 500) {
    throw new HttpError(400, 'intervalMs must be an integer >= 500');
  }

  const rawTargets = params.targets;
  if (!Array.isArray(rawTargets) || rawTargets.length === 0) {
    throw new HttpError(400, 'targets must be a non-empty array');
  }

  const targets = rawTargets.map(normalizePollingTarget);
  const pollingId = params.pollingId ? String(params.pollingId) : randomUUID();

  if (sessions.has(pollingId)) {
    throw new HttpError(409, `Polling session "${pollingId}" is already running`);
  }

  const session = {
    id: pollingId,
    intervalMs,
    timer: null,
    targets,
    lastResults: [],
    startedAt: new Date().toISOString(),
    lastPollAt: null,
    lastError: null,
    pollCount: 0,
  };

  await pollSession(session);

  session.timer = setInterval(() => {
    pollSession(session).catch((err) => {
      session.lastError = err.message || String(err);
      // eslint-disable-next-line no-console
      console.error('[bacnet] polling tick failed:', session.lastError);
    });
  }, intervalMs);

  if (typeof session.timer.unref === 'function') {
    session.timer.unref();
  }

  sessions.set(pollingId, session);

  return toSessionDto(session);
}

function stopPolling(params = {}) {
  const pollingId = params.pollingId ? String(params.pollingId) : null;

  if (pollingId) {
    const session = sessions.get(pollingId);
    if (!session) {
      throw new HttpError(404, `Polling session "${pollingId}" not found`);
    }
    clearInterval(session.timer);
    sessions.delete(pollingId);
    return { stopped: [toSessionDto({ ...session, timer: null })] };
  }

  const stopped = [];
  for (const session of sessions.values()) {
    clearInterval(session.timer);
    stopped.push(toSessionDto({ ...session, timer: null }));
  }
  sessions.clear();

  return { stopped };
}

function listPollingSessions() {
  return Array.from(sessions.values()).map(toSessionDto);
}

function stopAllPolling() {
  stopPolling({});
}

module.exports = {
  startPolling,
  stopPolling,
  listPollingSessions,
  stopAllPolling,
};
