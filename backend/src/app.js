const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { notFound } = require('./middleware/notFound');
const { errorHandler } = require('./middleware/errorHandler');
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

const app = express();

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

app.use(notFound);
app.use(errorHandler);

module.exports = app;
