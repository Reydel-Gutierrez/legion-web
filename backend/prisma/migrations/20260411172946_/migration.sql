-- AlterTable
ALTER TABLE "ControllersMapped" RENAME CONSTRAINT "EquipmentController_pkey" TO "ControllersMapped_pkey";

-- AlterTable
ALTER TABLE "PointsMapped" RENAME CONSTRAINT "PointMapping_pkey" TO "PointsMapped_pkey";

-- RenameForeignKey
ALTER TABLE "ControllersMapped" RENAME CONSTRAINT "EquipmentController_buildingId_fkey" TO "ControllersMapped_buildingId_fkey";

-- RenameForeignKey
ALTER TABLE "ControllersMapped" RENAME CONSTRAINT "EquipmentController_equipmentId_fkey" TO "ControllersMapped_equipmentId_fkey";

-- RenameForeignKey
ALTER TABLE "ControllersMapped" RENAME CONSTRAINT "EquipmentController_floorId_fkey" TO "ControllersMapped_floorId_fkey";

-- RenameForeignKey
ALTER TABLE "ControllersMapped" RENAME CONSTRAINT "EquipmentController_siteId_fkey" TO "ControllersMapped_siteId_fkey";

-- RenameForeignKey
ALTER TABLE "PointsMapped" RENAME CONSTRAINT "PointMapping_equipmentControllerId_fkey" TO "PointsMapped_equipmentControllerId_fkey";

-- RenameForeignKey
ALTER TABLE "PointsMapped" RENAME CONSTRAINT "PointMapping_equipmentId_fkey" TO "PointsMapped_equipmentId_fkey";

-- RenameForeignKey
ALTER TABLE "PointsMapped" RENAME CONSTRAINT "PointMapping_pointId_fkey" TO "PointsMapped_pointId_fkey";

-- RenameIndex
ALTER INDEX "EquipmentController_controllerCode_idx" RENAME TO "ControllersMapped_controllerCode_idx";

-- RenameIndex
ALTER INDEX "EquipmentController_equipmentId_key" RENAME TO "ControllersMapped_equipmentId_key";

-- RenameIndex
ALTER INDEX "EquipmentController_siteId_idx" RENAME TO "ControllersMapped_siteId_idx";

-- RenameIndex
ALTER INDEX "PointMapping_equipmentControllerId_fieldPointKey_key" RENAME TO "PointsMapped_equipmentControllerId_fieldPointKey_key";

-- RenameIndex
ALTER INDEX "PointMapping_equipmentControllerId_pointId_key" RENAME TO "PointsMapped_equipmentControllerId_pointId_key";

-- RenameIndex
ALTER INDEX "PointMapping_equipmentId_idx" RENAME TO "PointsMapped_equipmentId_idx";

-- RenameIndex
ALTER INDEX "PointMapping_pointId_idx" RENAME TO "PointsMapped_pointId_idx";
