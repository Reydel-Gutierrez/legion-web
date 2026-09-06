'use strict';

const BACNET_ROUTE_CHECKS = [
  { method: 'get', path: '/explorer/devices' },
  { method: 'post', path: '/discover' },
  { method: 'post', path: '/read-property' },
  { method: 'post', path: '/check-devices-health' },
];

function listRouteHandlers(router) {
  return (router.stack || [])
    .filter((layer) => layer.route)
    .map((layer) => {
      const methods = Object.keys(layer.route.methods)
        .filter((method) => layer.route.methods[method])
        .map((method) => method.toUpperCase());
      return { methods, path: layer.route.path };
    });
}

function verifyNodeBacnet() {
  // eslint-disable-next-line global-require
  require('node-bacnet');
  return 'node-bacnet loaded';
}

function verifyPrisma() {
  // eslint-disable-next-line global-require
  const prisma = require('./prisma');
  if (!prisma || typeof prisma.$connect !== 'function') {
    throw new Error('Prisma client is not initialized');
  }
  return 'Prisma client loaded';
}

function verifyBacnetRoutes() {
  // eslint-disable-next-line global-require
  const bacnetRoutes = require('../modules/bacnet/bacnet.routes');
  const handlers = listRouteHandlers(bacnetRoutes);

  for (const expected of BACNET_ROUTE_CHECKS) {
    const match = handlers.find(
      (handler) =>
        handler.path === expected.path && handler.methods.includes(expected.method.toUpperCase())
    );
    if (!match) {
      throw new Error(`Missing BACnet route: ${expected.method.toUpperCase()} ${expected.path}`);
    }
  }

  return `BACnet routes ready (${handlers.length} handlers)`;
}

function verifyRuntimeBacnetMount() {
  // eslint-disable-next-line global-require
  const runtimeRoutes = require('../modules/runtime/runtime.routes');
  const mounted = (runtimeRoutes.stack || []).some((layer) => {
    if (!layer.regexp) return false;
    const pattern = layer.regexp.toString();
    return pattern.includes('bacnet') || pattern.includes('\\/bacnet');
  });

  if (!mounted) {
    throw new Error('runtime.routes.js does not mount /bacnet');
  }

  return 'BACnet mounted at /api/runtime/bacnet';
}

function runStartupChecks() {
  const checks = [
    verifyNodeBacnet,
    verifyPrisma,
    verifyBacnetRoutes,
    verifyRuntimeBacnetMount,
  ];

  const results = checks.map((check) => check());
  return results;
}

module.exports = {
  runStartupChecks,
  listRouteHandlers,
};
