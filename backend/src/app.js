const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { notFound } = require('./middleware/notFound');
const { errorHandler } = require('./middleware/errorHandler');
const { asyncHandler } = require('./middleware/asyncHandler');
const { JSON_BODY_LIMIT } = require('./config/env');

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

const app = express();

console.log("NODE_ENV:", process.env.NODE_ENV);

app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json({ limit: JSON_BODY_LIMIT }));

app.get('/health', (req, res) => {
  res.json({ ok: true });
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
