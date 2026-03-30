-- If migration 20260328180000_global_template_library failed after creating tables:
--   npx prisma migrate resolve --rolled-back 20260328180000_global_template_library
--   npx prisma db execute --file scripts/repair-global-template-library-tables.sql
--   npx prisma migrate deploy
DROP TABLE IF EXISTS "GlobalGraphicTemplate" CASCADE;
DROP TABLE IF EXISTS "GlobalEquipmentTemplate" CASCADE;
