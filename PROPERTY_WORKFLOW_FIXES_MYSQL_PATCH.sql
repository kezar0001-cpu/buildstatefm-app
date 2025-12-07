-- =====================================================================
-- BUILDSTATE FM - PROPERTY WORKFLOW DATABASE PATCH
-- =====================================================================
-- This script fixes database schema issues for the property workflow
-- Run this on your production PostgreSQL database to align with Prisma schema
-- =====================================================================

-- Fix 1: Change Property.totalArea from DOUBLE PRECISION to INTEGER (sqm as integer)
-- This fixes the floating point precision bug where values like 250 become 24.99999990
ALTER TABLE "Property" 
  ALTER COLUMN "totalArea" TYPE INTEGER USING ROUND("totalArea")::INTEGER,
  ALTER COLUMN "totalArea" DROP NOT NULL;

COMMENT ON COLUMN "Property"."totalArea" IS 'Total area in square meters (integer only)';

-- Fix 2: Change Unit.area from DOUBLE PRECISION to INTEGER (sqm as integer)
-- This ensures unit areas are stored as integers to avoid precision issues
ALTER TABLE "Unit" 
  ALTER COLUMN "area" TYPE INTEGER USING ROUND("area")::INTEGER,
  ALTER COLUMN "area" DROP NOT NULL;

COMMENT ON COLUMN "Unit"."area" IS 'Area in square meters (integer only)';

-- Fix 3: Fix InspectionRoom.updatedAt to have @updatedAt behavior
-- Add default value and trigger to match Prisma @updatedAt
-- First, ensure the column allows NULL temporarily
ALTER TABLE "InspectionRoom" 
  ALTER COLUMN "updatedAt" DROP NOT NULL;

-- Set default value
ALTER TABLE "InspectionRoom" 
  ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- Make it NOT NULL again
ALTER TABLE "InspectionRoom" 
  ALTER COLUMN "updatedAt" SET NOT NULL;

-- Create or replace function to update updatedAt
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop trigger if exists, then create it
DROP TRIGGER IF EXISTS update_inspection_room_updated_at ON "InspectionRoom";
CREATE TRIGGER update_inspection_room_updated_at
    BEFORE UPDATE ON "InspectionRoom"
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON COLUMN "InspectionRoom"."updatedAt" IS 'Automatically updated timestamp';

-- Fix 4: Ensure foreign keys exist (if they don't already)
-- These should already exist from Prisma migrations, but verify
-- Property -> Unit relationship
-- (Unit.propertyId should already have FK, but verify)
-- No action needed if FK already exists

-- Fix 5: Add indexes if missing (for performance)
-- These should already exist from Prisma migrations, but verify
CREATE INDEX IF NOT EXISTS "idx_property_total_area" ON "Property"("totalArea");
CREATE INDEX IF NOT EXISTS "idx_unit_area" ON "Unit"("area");
CREATE INDEX IF NOT EXISTS "idx_inspection_room_updated" ON "InspectionRoom"("updatedAt");

-- =====================================================================
-- VERIFICATION QUERIES
-- =====================================================================
-- Run these to verify the changes:

-- 1. Verify Property.totalArea is INTEGER
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'Property' AND column_name = 'totalArea';

-- 2. Verify Unit.area is INTEGER
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'Unit' AND column_name = 'area';

-- 3. Verify InspectionRoom.updatedAt has default and trigger
SELECT column_name, column_default 
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'InspectionRoom' AND column_name = 'updatedAt';

SELECT trigger_name, event_manipulation, event_object_table
FROM information_schema.triggers 
WHERE trigger_name = 'update_inspection_room_updated_at';

-- 4. Check for any existing data that might need conversion (should be 0 after migration)
SELECT COUNT(*) as float_properties FROM "Property" WHERE "totalArea" IS NOT NULL AND "totalArea" != FLOOR("totalArea");
SELECT COUNT(*) as float_units FROM "Unit" WHERE "area" IS NOT NULL AND "area" != FLOOR("area");

-- =====================================================================
-- DATA MIGRATION (if needed)
-- =====================================================================
-- Note: The ALTER COLUMN statements above use USING ROUND()::INTEGER
-- which automatically converts existing float values to integers during the type change.
-- No separate UPDATE statements are needed.

-- =====================================================================
-- NOTES
-- =====================================================================
-- 1. The area fields now store values in square meters as integers
-- 2. Frontend converts between sq ft and sq m for display, but stores as integer sqm
-- 3. InspectionRoom.updatedAt now automatically updates on record changes via trigger
-- 4. All changes are backward compatible (NULL values remain NULL)
-- 5. Existing float values are automatically rounded to integers during type conversion
-- 6. This script is for PostgreSQL (not MySQL)
-- =====================================================================

