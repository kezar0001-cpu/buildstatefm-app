-- ============================================
-- Migration: Add propertyId to Recommendation table
-- ============================================
-- This SQL script adds a required propertyId field to the Recommendation table
-- to allow recommendations to be linked directly to properties without requiring an inspection report
--
-- Run this script on your database, or use: psql $DATABASE_URL -f add_property_id_to_recommendations_standalone.sql
-- ============================================

BEGIN;

-- Step 1: Add propertyId as nullable initially (we'll make it required after populating)
ALTER TABLE "Recommendation" ADD COLUMN IF NOT EXISTS "propertyId" TEXT;

-- Step 2: Populate propertyId from existing report->inspection->property relationships
-- This updates recommendations that have a report linked to an inspection
UPDATE "Recommendation" r
SET "propertyId" = (
    SELECT i."propertyId"
    FROM "Report" rep
    INNER JOIN "Inspection" i ON rep."inspectionId" = i."id"
    WHERE rep."id" = r."reportId"
)
WHERE r."reportId" IS NOT NULL
  AND r."propertyId" IS NULL;

-- Step 3: Handle recommendations without reports
-- For recommendations that don't have a report, we'll use the first property managed by the user who created the recommendation
UPDATE "Recommendation" r
SET "propertyId" = (
    SELECT p."id"
    FROM "Property" p
    WHERE p."managerId" = r."createdById"
    ORDER BY p."createdAt" ASC
    LIMIT 1
)
WHERE r."propertyId" IS NULL
  AND r."reportId" IS NULL;

-- Step 4: Delete any remaining orphaned recommendations that can't be linked to a property
-- These are recommendations that have no report and the creator doesn't manage any properties
-- WARNING: This will permanently delete recommendations that can't be linked to a property
-- Comment out this line if you want to review these recommendations manually first
DELETE FROM "Recommendation" WHERE "propertyId" IS NULL;

-- Step 5: Make propertyId required (non-nullable)
-- This will fail if there are still NULL values, so make sure Step 4 completed successfully
ALTER TABLE "Recommendation" ALTER COLUMN "propertyId" SET NOT NULL;

-- Step 6: Add foreign key constraint
ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_propertyId_fkey" 
    FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 7: Create index for better query performance
CREATE INDEX IF NOT EXISTS "Recommendation_propertyId_idx" ON "Recommendation"("propertyId");

-- Step 8: Make reportId nullable (since we made it optional in the schema)
-- Check if reportId currently has a NOT NULL constraint before altering
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'Recommendation' 
        AND column_name = 'reportId' 
        AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE "Recommendation" ALTER COLUMN "reportId" DROP NOT NULL;
    END IF;
END $$;

COMMIT;

-- ============================================
-- Verification queries (run these after migration to verify):
-- ============================================
-- Check for any recommendations without propertyId (should return 0 rows):
-- SELECT COUNT(*) FROM "Recommendation" WHERE "propertyId" IS NULL;
--
-- Check recommendations count by property:
-- SELECT p."name", COUNT(r."id") as recommendation_count
-- FROM "Property" p
-- LEFT JOIN "Recommendation" r ON r."propertyId" = p."id"
-- GROUP BY p."id", p."name"
-- ORDER BY recommendation_count DESC;
-- ============================================

