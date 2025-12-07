-- =====================================================================
-- BUILDSTATE FM - PROPERTY WORKFLOW DATABASE PATCH (PostgreSQL)
-- =====================================================================
-- SIMPLIFIED VERSION - No conditional logic, just direct ALTER statements
-- Run this on your production PostgreSQL database
-- =====================================================================
-- 
-- IMPORTANT: Backup your database before running this script!
-- =====================================================================

-- =====================================================================
-- FIX 1: Property.totalArea - Convert to INTEGER (if not already)
-- =====================================================================
-- This fixes floating point precision issues
-- Safe to run even if already INTEGER (will be no-op)
ALTER TABLE "Property" 
  ALTER COLUMN "totalArea" TYPE INTEGER USING CASE 
    WHEN "totalArea" IS NULL THEN NULL 
    ELSE ROUND("totalArea")::INTEGER 
  END;

ALTER TABLE "Property" 
  ALTER COLUMN "totalArea" DROP NOT NULL;

COMMENT ON COLUMN "Property"."totalArea" IS 'Total area in square meters (integer only)';

-- =====================================================================
-- FIX 2: Unit.area - Convert to INTEGER (if not already)
-- =====================================================================
-- This ensures unit areas are stored as integers to avoid precision issues
-- Safe to run even if already INTEGER (will be no-op)
ALTER TABLE "Unit" 
  ALTER COLUMN "area" TYPE INTEGER USING CASE 
    WHEN "area" IS NULL THEN NULL 
    ELSE ROUND("area")::INTEGER 
  END;

ALTER TABLE "Unit" 
  ALTER COLUMN "area" DROP NOT NULL;

COMMENT ON COLUMN "Unit"."area" IS 'Area in square meters (integer only)';

-- =====================================================================
-- FIX 3: UnitImage.updatedAt - Add @updatedAt behavior
-- =====================================================================
-- First, ensure the column allows NULL temporarily
ALTER TABLE "UnitImage" 
  ALTER COLUMN "updatedAt" DROP NOT NULL;

-- Set default value
ALTER TABLE "UnitImage" 
  ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- Make it NOT NULL again
ALTER TABLE "UnitImage" 
  ALTER COLUMN "updatedAt" SET NOT NULL;

-- Create or replace function to update updatedAt
CREATE OR REPLACE FUNCTION update_unit_image_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop trigger if exists, then create it
DROP TRIGGER IF EXISTS update_unit_image_updated_at_trigger ON "UnitImage";
CREATE TRIGGER update_unit_image_updated_at_trigger
    BEFORE UPDATE ON "UnitImage"
    FOR EACH ROW
    EXECUTE FUNCTION update_unit_image_updated_at();

COMMENT ON COLUMN "UnitImage"."updatedAt" IS 'Automatically updated timestamp';

-- =====================================================================
-- FIX 4: UnitOwner.updatedAt - Add @updatedAt behavior
-- =====================================================================
-- First, ensure the column allows NULL temporarily
ALTER TABLE "UnitOwner" 
  ALTER COLUMN "updatedAt" DROP NOT NULL;

-- Set default value
ALTER TABLE "UnitOwner" 
  ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- Make it NOT NULL again
ALTER TABLE "UnitOwner" 
  ALTER COLUMN "updatedAt" SET NOT NULL;

-- Create or replace function to update updatedAt
CREATE OR REPLACE FUNCTION update_unit_owner_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop trigger if exists, then create it
DROP TRIGGER IF EXISTS update_unit_owner_updated_at_trigger ON "UnitOwner";
CREATE TRIGGER update_unit_owner_updated_at_trigger
    BEFORE UPDATE ON "UnitOwner"
    FOR EACH ROW
    EXECUTE FUNCTION update_unit_owner_updated_at();

COMMENT ON COLUMN "UnitOwner"."updatedAt" IS 'Automatically updated timestamp';

-- =====================================================================
-- FIX 5: Add indexes for performance (if missing)
-- =====================================================================
CREATE INDEX IF NOT EXISTS "idx_property_total_area" ON "Property"("totalArea");
CREATE INDEX IF NOT EXISTS "idx_unit_area" ON "Unit"("area");

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

-- 3. Verify UnitImage.updatedAt has default and trigger
SELECT column_name, column_default 
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'UnitImage' AND column_name = 'updatedAt';

SELECT trigger_name, event_manipulation, event_object_table
FROM information_schema.triggers 
WHERE trigger_name = 'update_unit_image_updated_at_trigger';

-- 4. Verify UnitOwner.updatedAt has default and trigger
SELECT column_name, column_default 
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'UnitOwner' AND column_name = 'updatedAt';

SELECT trigger_name, event_manipulation, event_object_table
FROM information_schema.triggers 
WHERE trigger_name = 'update_unit_owner_updated_at_trigger';

-- =====================================================================
-- NOTES
-- =====================================================================
-- 1. The area fields now store values in square meters as integers
-- 2. Frontend converts between sq ft and sq m for display, but stores as integer sqm
-- 3. UnitImage.updatedAt now automatically updates on record changes via trigger
-- 4. UnitOwner.updatedAt now automatically updates on record changes via trigger
-- 5. All changes are backward compatible (NULL values remain NULL)
-- 6. Existing float values are automatically rounded to integers during type conversion
-- 7. This script is for PostgreSQL (not MySQL)
-- 8. Safe to run multiple times (idempotent)
-- =====================================================================

