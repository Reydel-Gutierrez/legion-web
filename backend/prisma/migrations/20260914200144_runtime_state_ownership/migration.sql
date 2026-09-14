-- CreateEnum
CREATE TYPE "PointQuality" AS ENUM ('GOOD', 'STALE', 'COMM_FAILURE', 'OUT_OF_SERVICE', 'OVERRIDDEN', 'UNRELIABLE', 'UNKNOWN');

-- CreateTable
CREATE TABLE "ControllerRuntimeState" (
    "id" TEXT NOT NULL,
    "liveControllerBindingId" TEXT NOT NULL,
    "status" TEXT,
    "quality" "PointQuality" NOT NULL DEFAULT 'UNKNOWN',
    "lastSeenAt" TIMESTAMP(3),
    "lastPollAt" TIMESTAMP(3),
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ControllerRuntimeState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PointRuntimeState" (
    "id" TEXT NOT NULL,
    "pointId" TEXT NOT NULL,
    "presentValue" TEXT,
    "quality" "PointQuality" NOT NULL DEFAULT 'UNKNOWN',
    "source" TEXT,
    "lastSeenAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PointRuntimeState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ControllerRuntimeState_liveControllerBindingId_key" ON "ControllerRuntimeState"("liveControllerBindingId");

-- CreateIndex
CREATE UNIQUE INDEX "PointRuntimeState_pointId_key" ON "PointRuntimeState"("pointId");

-- CreateIndex
CREATE INDEX "PointRuntimeState_pointId_idx" ON "PointRuntimeState"("pointId");

-- AddForeignKey
ALTER TABLE "ControllerRuntimeState" ADD CONSTRAINT "ControllerRuntimeState_liveControllerBindingId_fkey" FOREIGN KEY ("liveControllerBindingId") REFERENCES "LiveControllerBinding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointRuntimeState" ADD CONSTRAINT "PointRuntimeState_pointId_fkey" FOREIGN KEY ("pointId") REFERENCES "Point"("id") ON DELETE CASCADE ON UPDATE CASCADE;
