-- CreateTable
CREATE TABLE "PointHistorySample" (
    "id" TEXT NOT NULL,
    "pointId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "value" TEXT,
    "quality" TEXT NOT NULL DEFAULT 'ONLINE',

    CONSTRAINT "PointHistorySample_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PointHistorySample_pointId_timestamp_idx" ON "PointHistorySample"("pointId", "timestamp");

-- CreateIndex
CREATE INDEX "PointHistorySample_timestamp_idx" ON "PointHistorySample"("timestamp");

-- AddForeignKey
ALTER TABLE "PointHistorySample" ADD CONSTRAINT "PointHistorySample_pointId_fkey" FOREIGN KEY ("pointId") REFERENCES "Point"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "TrendDefinition" ADD COLUMN     "retentionDays" INTEGER DEFAULT 30;
