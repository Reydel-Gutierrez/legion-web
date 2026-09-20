-- DropForeignKey
ALTER TABLE "ControllersMapped" DROP CONSTRAINT "ControllersMapped_siteId_fkey";

-- RenameForeignKey
ALTER TABLE "ControllersMapped" RENAME CONSTRAINT "EquipmentController_siteId_fkey" TO "ControllersMapped_siteId_fkey";

-- RenameIndex
ALTER INDEX "BacnetDiscoveredObject_bacnetDeviceId_objectTypeId_objectInstan" RENAME TO "BacnetDiscoveredObject_bacnetDeviceId_objectTypeId_objectIn_key";
