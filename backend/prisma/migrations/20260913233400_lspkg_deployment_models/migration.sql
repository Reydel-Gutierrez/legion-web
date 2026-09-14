-- CreateEnum
CREATE TYPE "LsCommissionState" AS ENUM ('UNCOMMISSIONED', 'STAGED', 'VALIDATED', 'ACTIVATING', 'ACTIVE', 'FAILED', 'ROLLBACK');

-- CreateEnum
CREATE TYPE "DeploymentPackageStatus" AS ENUM ('STAGED', 'VALIDATED', 'ACTIVATING', 'ACTIVE', 'FAILED', 'SUPERSEDED', 'DISCARDED');

-- CreateEnum
CREATE TYPE "DeploymentSource" AS ENUM ('DIRECT', 'OFFLINE_IMPORT');

-- CreateEnum
CREATE TYPE "DeploymentAuditResult" AS ENUM ('SUCCESS', 'FAILURE');

-- CreateEnum
CREATE TYPE "ControllerAppDeployStatus" AS ENUM ('PENDING', 'TRANSFERRED', 'VERIFIED', 'FAILED', 'NOT_APPLICABLE');

-- CreateTable
CREATE TABLE "LsCommissioning" (
    "id" TEXT NOT NULL DEFAULT 'ls100',
    "state" "LsCommissionState" NOT NULL DEFAULT 'UNCOMMISSIONED',
    "activeSiteId" TEXT,
    "activePackageRecordId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LsCommissioning_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeploymentPackageRecord" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "siteName" TEXT NOT NULL,
    "packageVersion" TEXT NOT NULL,
    "schemaVersion" INTEGER NOT NULL,
    "status" "DeploymentPackageStatus" NOT NULL DEFAULT 'STAGED',
    "source" "DeploymentSource" NOT NULL,
    "filePath" TEXT NOT NULL,
    "checksumSha256" TEXT NOT NULL,
    "manifestJson" JSONB NOT NULL,
    "changePreviewJson" JSONB,
    "validationErrorsJson" JSONB,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validatedAt" TIMESTAMP(3),
    "activatedAt" TIMESTAMP(3),
    "supersededAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "createdSiteVersionId" TEXT,

    CONSTRAINT "DeploymentPackageRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeploymentBackupRecord" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "packageRecordId" TEXT,
    "reason" TEXT NOT NULL,
    "snapshotJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeploymentBackupRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeploymentAuditEntry" (
    "id" TEXT NOT NULL,
    "siteId" TEXT,
    "packageRecordId" TEXT,
    "action" TEXT NOT NULL,
    "result" "DeploymentAuditResult" NOT NULL,
    "actor" TEXT,
    "detailsJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeploymentAuditEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ControllerApplicationDeployment" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "equipmentId" TEXT,
    "controllerCode" TEXT NOT NULL,
    "applicationRef" TEXT,
    "applicationVersion" TEXT,
    "status" "ControllerAppDeployStatus" NOT NULL DEFAULT 'NOT_APPLICABLE',
    "packageRecordId" TEXT,
    "notes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ControllerApplicationDeployment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DeploymentPackageRecord_siteId_idx" ON "DeploymentPackageRecord"("siteId");

-- CreateIndex
CREATE INDEX "DeploymentPackageRecord_status_idx" ON "DeploymentPackageRecord"("status");

-- CreateIndex
CREATE INDEX "DeploymentBackupRecord_siteId_idx" ON "DeploymentBackupRecord"("siteId");

-- CreateIndex
CREATE INDEX "DeploymentAuditEntry_siteId_idx" ON "DeploymentAuditEntry"("siteId");

-- CreateIndex
CREATE INDEX "DeploymentAuditEntry_packageRecordId_idx" ON "DeploymentAuditEntry"("packageRecordId");

-- CreateIndex
CREATE INDEX "ControllerApplicationDeployment_siteId_idx" ON "ControllerApplicationDeployment"("siteId");

-- CreateIndex
CREATE UNIQUE INDEX "ControllerApplicationDeployment_siteId_controllerCode_key" ON "ControllerApplicationDeployment"("siteId", "controllerCode");

-- AddForeignKey
ALTER TABLE "DeploymentBackupRecord" ADD CONSTRAINT "DeploymentBackupRecord_packageRecordId_fkey" FOREIGN KEY ("packageRecordId") REFERENCES "DeploymentPackageRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeploymentAuditEntry" ADD CONSTRAINT "DeploymentAuditEntry_packageRecordId_fkey" FOREIGN KEY ("packageRecordId") REFERENCES "DeploymentPackageRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;
