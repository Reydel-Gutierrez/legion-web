-- CreateEnum
CREATE TYPE "SiteDeploymentAction" AS ENUM ('DEPLOY', 'ROLLBACK');

-- AlterTable
ALTER TABLE "SiteVersion" ADD COLUMN     "sourceWorkingVersionId" TEXT;

-- CreateTable
CREATE TABLE "SiteDeploymentEvent" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "releaseVersionId" TEXT NOT NULL,
    "previousReleaseVersionId" TEXT,
    "action" "SiteDeploymentAction" NOT NULL,
    "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activatedBy" TEXT,

    CONSTRAINT "SiteDeploymentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveControllerBinding" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "controllerCode" TEXT NOT NULL,
    "displayName" TEXT,
    "protocol" TEXT NOT NULL,
    "deviceInstance" TEXT,
    "ipAddress" TEXT,
    "networkAddress" TEXT,
    "buildingId" TEXT,
    "floorId" TEXT,
    "pollRateMs" INTEGER DEFAULT 5000,
    "isSimulated" BOOLEAN NOT NULL DEFAULT false,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT,
    "lastSeenAt" TIMESTAMP(3),
    "releaseVersionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LiveControllerBinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LivePointBinding" (
    "id" TEXT NOT NULL,
    "liveControllerBindingId" TEXT NOT NULL,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LivePointBinding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SiteDeploymentEvent_siteId_activatedAt_idx" ON "SiteDeploymentEvent"("siteId", "activatedAt");

-- CreateIndex
CREATE INDEX "SiteDeploymentEvent_releaseVersionId_idx" ON "SiteDeploymentEvent"("releaseVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "LiveControllerBinding_equipmentId_key" ON "LiveControllerBinding"("equipmentId");

-- CreateIndex
CREATE INDEX "LiveControllerBinding_siteId_idx" ON "LiveControllerBinding"("siteId");

-- CreateIndex
CREATE INDEX "LiveControllerBinding_controllerCode_idx" ON "LiveControllerBinding"("controllerCode");

-- CreateIndex
CREATE INDEX "LivePointBinding_equipmentId_idx" ON "LivePointBinding"("equipmentId");

-- CreateIndex
CREATE INDEX "LivePointBinding_pointId_idx" ON "LivePointBinding"("pointId");

-- CreateIndex
CREATE UNIQUE INDEX "LivePointBinding_liveControllerBindingId_fieldPointKey_key" ON "LivePointBinding"("liveControllerBindingId", "fieldPointKey");

-- CreateIndex
CREATE UNIQUE INDEX "LivePointBinding_liveControllerBindingId_pointId_key" ON "LivePointBinding"("liveControllerBindingId", "pointId");

-- AddForeignKey
ALTER TABLE "SiteVersion" ADD CONSTRAINT "SiteVersion_sourceWorkingVersionId_fkey" FOREIGN KEY ("sourceWorkingVersionId") REFERENCES "SiteVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteDeploymentEvent" ADD CONSTRAINT "SiteDeploymentEvent_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteDeploymentEvent" ADD CONSTRAINT "SiteDeploymentEvent_releaseVersionId_fkey" FOREIGN KEY ("releaseVersionId") REFERENCES "SiteVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveControllerBinding" ADD CONSTRAINT "LiveControllerBinding_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveControllerBinding" ADD CONSTRAINT "LiveControllerBinding_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LivePointBinding" ADD CONSTRAINT "LivePointBinding_liveControllerBindingId_fkey" FOREIGN KEY ("liveControllerBindingId") REFERENCES "LiveControllerBinding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LivePointBinding" ADD CONSTRAINT "LivePointBinding_pointId_fkey" FOREIGN KEY ("pointId") REFERENCES "Point"("id") ON DELETE CASCADE ON UPDATE CASCADE;
