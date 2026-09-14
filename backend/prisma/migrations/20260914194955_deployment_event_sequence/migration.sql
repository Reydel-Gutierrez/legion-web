-- DropIndex
DROP INDEX "SiteDeploymentEvent_siteId_activatedAt_idx";

-- AlterTable
ALTER TABLE "SiteDeploymentEvent" ADD COLUMN     "sequence" SERIAL NOT NULL;

-- CreateIndex
CREATE INDEX "SiteDeploymentEvent_siteId_sequence_idx" ON "SiteDeploymentEvent"("siteId", "sequence");
