-- Remove stray "Sunset Strip Plaza" rows with no buildings (duplicate empty projects).
-- Seeded Sunset Strip Plaza with North/South structure is kept.

UPDATE "Site" SET "activeReleaseVersionId" = NULL
WHERE "id" IN (
  SELECT s."id" FROM "Site" s
  WHERE s."name" = 'Sunset Strip Plaza'
  AND NOT EXISTS (SELECT 1 FROM "Building" b WHERE b."siteId" = s."id")
);

DELETE FROM "Site" s
WHERE s."name" = 'Sunset Strip Plaza'
AND NOT EXISTS (SELECT 1 FROM "Building" b WHERE b."siteId" = s."id");
