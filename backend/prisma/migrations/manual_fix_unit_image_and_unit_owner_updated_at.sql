-- =====================================================================
-- MANUAL MIGRATION: Fix UnitImage and UnitOwner updatedAt fields
-- =====================================================================
-- This migration adds @updatedAt behavior to UnitImage.updatedAt and UnitOwner.updatedAt
-- Run this on your production PostgreSQL database
-- =====================================================================

-- Fix 1: UnitImage.updatedAt - Add @updatedAt behavior
-- First, ensure the column allows NULL temporarily (if needed)
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
        ALTER TABLE "UnitImage" ALTER COLUMN "updatedAt" DROP NOT NULL;
    END IF;
END $$;

-- Set default value
ALTER TABLE "UnitImage" 
  ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- Make it NOT NULL again
ALTER TABLE "UnitImage" 
  ALTER COLUMN "updatedAt" SET NOT NULL;

-- Create or replace function to update updatedAt (if not exists)
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

-- Fix 2: UnitOwner.updatedAt - Add @updatedAt behavior
-- First, ensure the column allows NULL temporarily (if needed)
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
        ALTER TABLE "UnitOwner" ALTER COLUMN "updatedAt" DROP NOT NULL;
    END IF;
END $$;

-- Set default value
ALTER TABLE "UnitOwner" 
  ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- Make it NOT NULL again
ALTER TABLE "UnitOwner" 
  ALTER COLUMN "updatedAt" SET NOT NULL;

-- Create or replace function to update updatedAt (if not exists)
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
-- VERIFICATION QUERIES
-- =====================================================================
-- Run these to verify the changes:

-- 1. Verify UnitImage.updatedAt has default and trigger
SELECT column_name, column_default 
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'UnitImage' AND column_name = 'updatedAt';

SELECT trigger_name, event_manipulation, event_object_table
FROM information_schema.triggers 
WHERE trigger_name = 'update_unit_image_updated_at_trigger';

-- 2. Verify UnitOwner.updatedAt has default and trigger
SELECT column_name, column_default 
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'UnitOwner' AND column_name = 'updatedAt';

SELECT trigger_name, event_manipulation, event_object_table
FROM information_schema.triggers 
WHERE trigger_name = 'update_unit_owner_updated_at_trigger';

-- =====================================================================
-- NOTES
-- =====================================================================
-- 1. UnitImage.updatedAt now automatically updates on record changes via trigger
-- 2. UnitOwner.updatedAt now automatically updates on record changes via trigger
-- 3. All changes are backward compatible
-- 4. This script is for PostgreSQL (not MySQL)
-- =====================================================================

