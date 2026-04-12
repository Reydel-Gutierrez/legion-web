-- CreateTable
CREATE TABLE "EquipmentController" (
    "id" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "controllerCode" TEXT NOT NULL,
    "displayName" TEXT,
    "protocol" TEXT NOT NULL,
    "deviceInstance" TEXT,
    "ipAddress" TEXT,
    "networkAddress" TEXT,
    "siteId" TEXT,
    "buildingId" TEXT,
    "floorId" TEXT,
    "pollRateMs" INTEGER DEFAULT 5000,
    "isSimulated" BOOLEAN NOT NULL DEFAULT false,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT,
    "lastSeenAt" TIMESTAMP(3),
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EquipmentController_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PointMapping" (
    "id" TEXT NOT NULL,
    "equipmentControllerId" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "pointId" TEXT NOT NULL,
    "legionPointCode" TEXT,
    "fieldPointKey" TEXT NOT NULL,
    "fieldPointName" TEXT,
    "fieldObjectType" TEXT,
    "fieldObjectInstance" TEXT,
    "fieldDataType" TEXT,
    "readEnabled" BOOLEAN NOT NULL DEFAULT true,
    "writeEnabled" BOOLEAN NOT NULL DEFAULT false,
    "isBound" BOOLEAN NOT NULL DEFAULT true,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PointMapping_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EquipmentController_equipmentId_key" ON "EquipmentController"("equipmentId");

-- CreateIndex
CREATE UNIQUE INDEX "EquipmentController_controllerCode_key" ON "EquipmentController"("controllerCode");

-- CreateIndex
CREATE INDEX "EquipmentController_controllerCode_idx" ON "EquipmentController"("controllerCode");

-- CreateIndex
CREATE INDEX "EquipmentController_siteId_idx" ON "EquipmentController"("siteId");

-- CreateIndex
CREATE INDEX "PointMapping_equipmentId_idx" ON "PointMapping"("equipmentId");

-- CreateIndex
CREATE INDEX "PointMapping_pointId_idx" ON "PointMapping"("pointId");

-- CreateIndex
CREATE UNIQUE INDEX "PointMapping_equipmentControllerId_fieldPointKey_key" ON "PointMapping"("equipmentControllerId", "fieldPointKey");

-- CreateIndex
CREATE UNIQUE INDEX "PointMapping_equipmentControllerId_pointId_key" ON "PointMapping"("equipmentControllerId", "pointId");

-- AddForeignKey
ALTER TABLE "EquipmentController" ADD CONSTRAINT "EquipmentController_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentController" ADD CONSTRAINT "EquipmentController_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentController" ADD CONSTRAINT "EquipmentController_floorId_fkey" FOREIGN KEY ("floorId") REFERENCES "Floor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentController" ADD CONSTRAINT "EquipmentController_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointMapping" ADD CONSTRAINT "PointMapping_equipmentControllerId_fkey" FOREIGN KEY ("equipmentControllerId") REFERENCES "EquipmentController"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointMapping" ADD CONSTRAINT "PointMapping_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointMapping" ADD CONSTRAINT "PointMapping_pointId_fkey" FOREIGN KEY ("pointId") REFERENCES "Point"("id") ON DELETE CASCADE ON UPDATE CASCADE;
