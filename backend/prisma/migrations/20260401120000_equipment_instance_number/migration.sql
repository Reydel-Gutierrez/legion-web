-- AlterTable
ALTER TABLE "Equipment" ADD COLUMN "instanceNumber" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Equipment_siteId_instanceNumber_key" ON "Equipment"("siteId", "instanceNumber");
