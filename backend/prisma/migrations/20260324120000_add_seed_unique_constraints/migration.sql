-- Unique constraints for idempotent seed upserts (local dev stability)
CREATE UNIQUE INDEX "Building_siteId_name_key" ON "Building"("siteId", "name");

CREATE UNIQUE INDEX "Floor_buildingId_name_key" ON "Floor"("buildingId", "name");

CREATE UNIQUE INDEX "Equipment_siteId_code_key" ON "Equipment"("siteId", "code");

CREATE UNIQUE INDEX "Point_equipmentId_pointCode_key" ON "Point"("equipmentId", "pointCode");
