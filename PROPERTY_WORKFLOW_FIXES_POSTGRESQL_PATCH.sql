-- =====================================================================
-- BUILDSTATE FM - PROPERTY WORKFLOW DATABASE PATCH (PostgreSQL)
-- =====================================================================
-- This script fixes ALL database schema issues for the property workflow
-- Run this on your production PostgreSQL database to align with Prisma schema
-- =====================================================================
-- 
-- IMPORTANT: Backup your database before running this script!
-- =====================================================================

-- =====================================================================
-- FIX 1: Property.totalArea - Ensure INTEGER type (if not already)
-- =====================================================================
-- This fixes floating point precision issues
-- Only run if column is not already INTEGER
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'Property' 
        AND column_name = 'totalArea'
        AND data_type != 'integer'
    ) THEN
        EXECUTE 'ALTER TABLE "Property" ALTER COLUMN "totalArea" TYPE INTEGER USING ROUND("totalArea")::INTEGER';
        EXECUTE 'ALTER TABLE "Property" ALTER COLUMN "totalArea" DROP NOT NULL';
        EXECUTE 'COMMENT ON COLUMN "Property"."totalArea" IS ''Total area in square meters (integer only)''';
    END IF;
END $$;

-- =====================================================================
-- FIX 2: Unit.area - Ensure INTEGER type (if not already)
-- =====================================================================
-- This ensures unit areas are stored as integers to avoid precision issues
-- Only run if column is not already INTEGER
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'Unit' 
        AND column_name = 'area'
        AND data_type != 'integer'
    ) THEN
        EXECUTE 'ALTER TABLE "Unit" ALTER COLUMN "area" TYPE INTEGER USING ROUND("area")::INTEGER';
        EXECUTE 'ALTER TABLE "Unit" ALTER COLUMN "area" DROP NOT NULL';
        EXECUTE 'COMMENT ON COLUMN "Unit"."area" IS ''Area in square meters (integer only)''';
    END IF;
END $$;

-- =====================================================================
-- FIX 3: UnitImage.updatedAt - Add @updatedAt behavior
-- =====================================================================
-- Add default value and trigger to match Prisma @updatedAt
DO $$
BEGIN
    -- Check if column exists and is NOT NULL
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'UnitImage' 
        AND column_name = 'updatedAt'
        AND is_nullable = 'NO'
    ) THEN
        EXECUTE 'ALTER TABLE "UnitImage" ALTER COLUMN "updatedAt" DROP NOT NULL';
    END IF;
END $$;

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
-- Add default value and trigger to match Prisma @updatedAt
DO $$
BEGIN
    -- Check if column exists and is NOT NULL
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'UnitOwner' 
        AND column_name = 'updatedAt'
        AND is_nullable = 'NO'
    ) THEN
        EXECUTE 'ALTER TABLE "UnitOwner" ALTER COLUMN "updatedAt" DROP NOT NULL';
    END IF;
END $$;

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
-- FIX 5: InspectionRoom.updatedAt - Add @updatedAt behavior (if needed)
-- =====================================================================
-- This was in the original patch, keeping it for completeness
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'InspectionRoom' 
        AND column_name = 'updatedAt'
        AND is_nullable = 'NO'
    ) THEN
        EXECUTE 'ALTER TABLE "InspectionRoom" ALTER COLUMN "updatedAt" DROP NOT NULL';
    END IF;
END $$;

-- Set default value (only if column exists)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'InspectionRoom' 
        AND column_name = 'updatedAt'
    ) THEN
        EXECUTE 'ALTER TABLE "InspectionRoom" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP';
        EXECUTE 'ALTER TABLE "InspectionRoom" ALTER COLUMN "updatedAt" SET NOT NULL';
    END IF;
END $$;

-- Create or replace function to update updatedAt (if InspectionRoom exists)
CREATE OR REPLACE FUNCTION update_inspection_room_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop trigger if exists, then create it (only if table exists)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'InspectionRoom'
    ) THEN
        EXECUTE 'DROP TRIGGER IF EXISTS update_inspection_room_updated_at ON "InspectionRoom"';
        EXECUTE 'CREATE TRIGGER update_inspection_room_updated_at
            BEFORE UPDATE ON "InspectionRoom"
            FOR EACH ROW
            EXECUTE FUNCTION update_inspection_room_updated_at()';
        EXECUTE 'COMMENT ON COLUMN "InspectionRoom"."updatedAt" IS ''Automatically updated timestamp''';
    END IF;
END $$;

-- =====================================================================
-- FIX 6: Add indexes for performance (if missing)
-- =====================================================================
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

-- 5. Check for any existing data that might need conversion (should be 0 after migration)
SELECT COUNT(*) as float_properties FROM "Property" WHERE "totalArea" IS NOT NULL AND "totalArea" != FLOOR("totalArea");
SELECT COUNT(*) as float_units FROM "Unit" WHERE "area" IS NOT NULL AND "area" != FLOOR("area");

-- =====================================================================
-- DATA MIGRATION NOTES
-- =====================================================================
-- Note: The ALTER COLUMN statements above use USING ROUND()::INTEGER
-- which automatically converts existing float values to integers during the type change.
-- No separate UPDATE statements are needed.

-- =====================================================================
-- ROLLBACK (if needed)
-- =====================================================================
-- If you need to rollback these changes:

-- DROP TRIGGER IF EXISTS update_unit_image_updated_at_trigger ON "UnitImage";
-- DROP TRIGGER IF EXISTS update_unit_owner_updated_at_trigger ON "UnitOwner";
-- DROP TRIGGER IF EXISTS update_inspection_room_updated_at ON "InspectionRoom";
-- DROP FUNCTION IF EXISTS update_unit_image_updated_at();
-- DROP FUNCTION IF EXISTS update_unit_owner_updated_at();
-- DROP FUNCTION IF EXISTS update_inspection_room_updated_at();

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
-- 8. The script is idempotent - safe to run multiple times
-- =====================================================================

