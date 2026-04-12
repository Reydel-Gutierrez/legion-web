-- Remove seeded Demo Campus and any "Sunset Strip Plaza" site with zero buildings (empty duplicate).
-- Other sites (e.g. your real projects, or Sunset with buildings) are left as-is.
-- Default Demo Campus id matches backend/prisma/seed.js DEMO_CAMPUS_SITE_ID.

UPDATE "Site" SET "activeReleaseVersionId" = NULL WHERE "id" = 'cafe0000-0000-4000-8000-00000000babe';

UPDATE "Site" SET "activeReleaseVersionId" = NULL
WHERE "id" IN (
  SELECT s."id" FROM "Site" s
  WHERE s."name" = 'Sunset Strip Plaza'
  AND NOT EXISTS (SELECT 1 FROM "Building" b WHERE b."siteId" = s."id")
);

DELETE FROM "Site" WHERE "id" = 'cafe0000-0000-4000-8000-00000000babe';

DELETE FROM "Site" s
WHERE s."name" = 'Sunset Strip Plaza'
AND NOT EXISTS (SELECT 1 FROM "Building" b WHERE b."siteId" = s."id");
