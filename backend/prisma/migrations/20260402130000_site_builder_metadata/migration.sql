-- Site Builder / engineering metadata persisted on relational rows

ALTER TABLE "Site" ADD COLUMN "timezone" TEXT,
ADD COLUMN "siteType" TEXT,
ADD COLUMN "description" TEXT,
ADD COLUMN "displayLabel" TEXT,
ADD COLUMN "engineeringNotes" TEXT,
ADD COLUMN "icon" TEXT;

ALTER TABLE "Building" ADD COLUMN "buildingType" TEXT,
ADD COLUMN "buildingCode" TEXT,
ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Floor" ADD COLUMN "floorType" TEXT,
ADD COLUMN "occupancyType" TEXT,
ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;
