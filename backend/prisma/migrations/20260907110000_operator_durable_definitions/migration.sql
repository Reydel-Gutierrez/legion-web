CREATE TABLE "TrendDefinition" (
  "id" TEXT NOT NULL,
  "siteId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "isTemplate" BOOLEAN NOT NULL DEFAULT false,
  "equipmentType" TEXT,
  "sampleInterval" INTEGER,
  "pointRequirements" JSONB NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TrendDefinition_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "TrendAssignment" (
  "id" TEXT NOT NULL,
  "definitionId" TEXT NOT NULL,
  "siteId" TEXT NOT NULL,
  "equipmentId" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "resolvedMappings" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TrendAssignment_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ScheduleDefinition" (
  "id" TEXT NOT NULL,
  "siteId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "isTemplate" BOOLEAN NOT NULL DEFAULT false,
  "weeklyWindows" JSONB NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ScheduleDefinition_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ScheduleAssignment" (
  "id" TEXT NOT NULL,
  "definitionId" TEXT NOT NULL,
  "siteId" TEXT NOT NULL,
  "equipmentId" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ScheduleAssignment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TrendAssignment_definitionId_equipmentId_key" ON "TrendAssignment"("definitionId", "equipmentId");
CREATE UNIQUE INDEX "ScheduleAssignment_definitionId_equipmentId_key" ON "ScheduleAssignment"("definitionId", "equipmentId");
CREATE INDEX "TrendDefinition_siteId_isTemplate_idx" ON "TrendDefinition"("siteId", "isTemplate");
CREATE INDEX "TrendAssignment_siteId_equipmentId_idx" ON "TrendAssignment"("siteId", "equipmentId");
CREATE INDEX "ScheduleDefinition_siteId_isTemplate_idx" ON "ScheduleDefinition"("siteId", "isTemplate");
CREATE INDEX "ScheduleAssignment_siteId_equipmentId_idx" ON "ScheduleAssignment"("siteId", "equipmentId");
ALTER TABLE "TrendDefinition" ADD CONSTRAINT "TrendDefinition_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrendAssignment" ADD CONSTRAINT "TrendAssignment_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "TrendDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrendAssignment" ADD CONSTRAINT "TrendAssignment_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrendAssignment" ADD CONSTRAINT "TrendAssignment_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScheduleDefinition" ADD CONSTRAINT "ScheduleDefinition_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScheduleAssignment" ADD CONSTRAINT "ScheduleAssignment_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "ScheduleDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScheduleAssignment" ADD CONSTRAINT "ScheduleAssignment_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScheduleAssignment" ADD CONSTRAINT "ScheduleAssignment_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
