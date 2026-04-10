-- Logical point keys on alarm definitions (template/engineering before DB bind)

ALTER TABLE "AlarmDefinition" ADD COLUMN IF NOT EXISTS "pointKey" TEXT;
ALTER TABLE "AlarmDefinition" ADD COLUMN IF NOT EXISTS "targetPointKey" TEXT;

UPDATE "AlarmDefinition" d
SET "pointKey" = p."pointCode"
FROM "Point" p
WHERE d."pointId" = p.id AND (d."pointKey" IS NULL OR d."pointKey" = '');

UPDATE "AlarmDefinition" SET "pointKey" = 'unknown' WHERE "pointKey" IS NULL OR "pointKey" = '';

ALTER TABLE "AlarmDefinition" ALTER COLUMN "pointKey" SET NOT NULL;

ALTER TABLE "AlarmDefinition" DROP CONSTRAINT IF EXISTS "AlarmDefinition_pointId_fkey";

ALTER TABLE "AlarmDefinition" ALTER COLUMN "pointId" DROP NOT NULL;

ALTER TABLE "AlarmDefinition" ADD CONSTRAINT "AlarmDefinition_pointId_fkey"
  FOREIGN KEY ("pointId") REFERENCES "Point"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "AlarmDefinition_siteId_equipmentId_pointKey_idx"
  ON "AlarmDefinition"("siteId", "equipmentId", "pointKey");
