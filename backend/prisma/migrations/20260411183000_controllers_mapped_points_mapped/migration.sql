-- Per-site controller codes + clearer table names (ControllersMapped, PointsMapped).

UPDATE "EquipmentController" AS ec
SET "siteId" = e."siteId"
FROM "Equipment" AS e
WHERE ec."equipmentId" = e."id"
  AND (ec."siteId" IS NULL OR ec."siteId" IS DISTINCT FROM e."siteId");

ALTER TABLE "EquipmentController" ALTER COLUMN "siteId" SET NOT NULL;

DROP INDEX IF EXISTS "EquipmentController_controllerCode_key";

CREATE UNIQUE INDEX "ControllersMapped_siteId_controllerCode_key" ON "EquipmentController" ("siteId", "controllerCode");

ALTER TABLE "EquipmentController" DROP CONSTRAINT IF EXISTS "EquipmentController_siteId_fkey";

ALTER TABLE "EquipmentController" ADD CONSTRAINT "EquipmentController_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EquipmentController" RENAME TO "ControllersMapped";

ALTER TABLE "PointMapping" RENAME TO "PointsMapped";
