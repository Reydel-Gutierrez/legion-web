-- Global Template Library (company-wide; site imports are independent copies in working version JSON)

CREATE TABLE "GlobalEquipmentTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "equipmentType" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "defaultGraphicName" TEXT,
    "pointsJson" JSONB NOT NULL DEFAULT '[]',
    "status" "EntityStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GlobalEquipmentTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GlobalGraphicTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "appliesToEquipmentType" TEXT NOT NULL,
    "globalEquipmentTemplateId" TEXT,
    "equipmentTemplateName" TEXT,
    "graphicEditorStateJson" JSONB,
    "boundPointCount" INTEGER NOT NULL DEFAULT 0,
    "status" "EntityStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GlobalGraphicTemplate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GlobalEquipmentTemplate_equipmentType_idx" ON "GlobalEquipmentTemplate"("equipmentType");
CREATE INDEX "GlobalEquipmentTemplate_status_idx" ON "GlobalEquipmentTemplate"("status");
CREATE INDEX "GlobalGraphicTemplate_appliesToEquipmentType_idx" ON "GlobalGraphicTemplate"("appliesToEquipmentType");
CREATE INDEX "GlobalGraphicTemplate_status_idx" ON "GlobalGraphicTemplate"("status");

ALTER TABLE "GlobalGraphicTemplate" ADD CONSTRAINT "GlobalGraphicTemplate_globalEquipmentTemplateId_fkey" FOREIGN KEY ("globalEquipmentTemplateId") REFERENCES "GlobalEquipmentTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
