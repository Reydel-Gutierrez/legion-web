-- BACnet discovery staging cache (BacnetDevice + BacnetDiscoveredObject).

CREATE TABLE "BacnetDevice" (
    "id" TEXT NOT NULL,
    "deviceInstance" INTEGER NOT NULL,
    "address" TEXT NOT NULL,
    "vendorId" INTEGER,
    "maxApdu" INTEGER,
    "segmentation" INTEGER,
    "protocol" TEXT,
    "objectName" TEXT,
    "modelName" TEXT,
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BacnetDevice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BacnetDiscoveredObject" (
    "id" TEXT NOT NULL,
    "bacnetDeviceId" TEXT NOT NULL,
    "objectType" TEXT NOT NULL,
    "objectTypeId" INTEGER NOT NULL,
    "objectInstance" INTEGER NOT NULL,
    "objectName" TEXT,
    "description" TEXT,
    "presentValue" JSONB,
    "units" TEXT,
    "outOfService" BOOLEAN,
    "reliability" TEXT,
    "lastReadAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BacnetDiscoveredObject_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BacnetDevice_deviceInstance_address_key" ON "BacnetDevice"("deviceInstance", "address");

CREATE INDEX "BacnetDevice_address_idx" ON "BacnetDevice"("address");

CREATE UNIQUE INDEX "BacnetDiscoveredObject_bacnetDeviceId_objectTypeId_objectInstance_key" ON "BacnetDiscoveredObject"("bacnetDeviceId", "objectTypeId", "objectInstance");

CREATE INDEX "BacnetDiscoveredObject_bacnetDeviceId_idx" ON "BacnetDiscoveredObject"("bacnetDeviceId");

ALTER TABLE "BacnetDiscoveredObject" ADD CONSTRAINT "BacnetDiscoveredObject_bacnetDeviceId_fkey" FOREIGN KEY ("bacnetDeviceId") REFERENCES "BacnetDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
