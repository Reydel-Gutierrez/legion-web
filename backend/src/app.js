const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { notFound } = require('./middleware/notFound');
const { errorHandler } = require('./middleware/errorHandler');
const { asyncHandler } = require('./middleware/asyncHandler');
const { JSON_BODY_LIMIT } = require('./config/env.ts');

const siteRoutes = require('./modules/sites/site.routes');
const floorRoutes = require('./modules/floors/floor.routes');
const buildingRoutes = require('./modules/buildings/building.routes');
const equipmentFloorRoutes = require('./modules/equipment/equipment.floor.routes');
const pointEquipmentRoutes = require('./modules/points/point.equipment.routes');
const equipmentPatchRoutes = require('./modules/equipment/equipment.routes');
const pointRoutes = require('./modules/points/point.routes');
const userRoutes = require('./modules/users/user.routes');
const globalTemplateLibraryRoutes = require('./modules/globalTemplateLibrary/globalTemplateLibrary.routes');
const geocodeRoutes = require('./modules/geocode/geocode.routes');
const runtimeRoutes = require('./modules/runtime/runtime.routes');
const equipmentControllersRoutes = require('./modules/equipmentControllers/equipmentControllers.routes');
const pointMappingsRoutes = require('./modules/pointMappings/pointMappings.routes');
const operatorDefinitionsRoutes = require('./modules/operatorDefinitions/operatorDefinitions.routes');
const deploymentRoutes = require('./modules/deployment/deployment.routes');
const prisma = require('./lib/prisma');
const { getRuntimeHealth } = require('./modules/runtime/runtime.service.ts');

const app = express();

console.log("NODE_ENV:", process.env.NODE_ENV);

app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json({ limit: JSON_BODY_LIMIT }));

/** LIVE: this process is running. Never depends on the database or Runtime. */
app.get('/live', (req, res) => {
  res.json({ ok: true });
});

/** READY: this process can perform its role (serve API requests backed by the database). */
app.get('/ready', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, dbReachable: true });
  } catch (e) {
    res.status(503).json({ ok: false, dbReachable: false, error: e?.message || String(e) });
  }
});

/**
 * HEALTH: detailed dependency status. Runtime unreachable is reported here, never thrown — the API
 * itself stays healthy/available even when the separate Runtime process is down (LC-ARCH-004).
 */
app.get('/health', async (req, res) => {
  let dbReachable = true;
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (_) {
    dbReachable = false;
  }
  const runtime = await getRuntimeHealth();
  res.json({
    ok: true,
    dbReachable,
    runtime: {
      reachable: runtime.reachable,
      status: runtime.reachable ? runtime.status : null,
      detail: runtime.reachable ? runtime.body : null,
    },
  });
});

app.use('/api/geocode', geocodeRoutes);

app.use('/api/sites', siteRoutes);
app.use('/api/buildings', floorRoutes);
app.use('/api/buildings', buildingRoutes);
app.use('/api/floors', equipmentFloorRoutes);
app.use('/api/equipment', pointEquipmentRoutes);
app.use('/api/equipment', equipmentPatchRoutes);
app.use('/api/points', pointRoutes);
app.use('/api/users', userRoutes);
app.use('/api/global-template-library', globalTemplateLibraryRoutes);
/** Live SIM / discovery: never allow caches or ETag revalidation — 304 responses have no JSON body and break SPA clients. */
app.use('/api/runtime', (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  next();
});
app.use('/api/runtime', runtimeRoutes);
app.use('/api/equipment-controllers', equipmentControllersRoutes);
app.use('/api/point-mappings', pointMappingsRoutes);
app.use('/api/operator', operatorDefinitionsRoutes);
app.use('/api/deployment', deploymentRoutes);

if (process.env.NODE_ENV === 'development') {
  const { syncSimCatalogBindingsForEquipmentId } = require('./lib/simCatalogBindingSync');
  app.get(
    '/api/dev/sim-catalog-sync/:equipmentId',
    asyncHandler(async (req, res) => {
      const summary = await syncSimCatalogBindingsForEquipmentId(req.params.equipmentId);
      res.json(summary);
    })
  );
}

app.use(notFound);
app.use(errorHandler);

module.exports = app;
