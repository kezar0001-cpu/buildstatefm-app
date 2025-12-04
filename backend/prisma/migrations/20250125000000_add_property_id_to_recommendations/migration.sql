-- AlterTable: Add propertyId column to Recommendation table
-- This migration adds a required propertyId field to link recommendations directly to properties

-- Step 1: Add propertyId as nullable initially (we'll make it required after populating)
ALTER TABLE "Recommendation" ADD COLUMN "propertyId" TEXT;

-- Step 2: Populate propertyId from existing report->inspection->property relationships
-- This updates recommendations that have a report linked to an inspection
UPDATE "Recommendation" r
SET "propertyId" = (
    SELECT i."propertyId"
    FROM "Report" rep
    INNER JOIN "Inspection" i ON rep."inspectionId" = i."id"
    WHERE rep."id" = r."reportId"
)
WHERE r."reportId" IS NOT NULL;

-- Step 3: Handle recommendations without reports
-- For recommendations that don't have a report, we need to get propertyId from the createdBy user's properties
-- We'll use the first property managed by the user who created the recommendation
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
DELETE FROM "Recommendation" WHERE "propertyId" IS NULL;

-- Step 5: Make propertyId required (non-nullable)
ALTER TABLE "Recommendation" ALTER COLUMN "propertyId" SET NOT NULL;

-- Step 6: Add foreign key constraint
ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 7: Create index for better query performance
CREATE INDEX "Recommendation_propertyId_idx" ON "Recommendation"("propertyId");

-- Step 8: Also update reportId to be nullable (since we made it optional in the schema)
ALTER TABLE "Recommendation" ALTER COLUMN "reportId" DROP NOT NULL;

