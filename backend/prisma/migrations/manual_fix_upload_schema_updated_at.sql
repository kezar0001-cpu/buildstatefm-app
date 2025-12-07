-- =====================================================================
-- MANUAL MIGRATION: Fix InspectionPhoto, InspectionIssue, and PropertyDocument updatedAt fields
-- =====================================================================
-- This migration adds @updatedAt behavior to:
-- 1. InspectionPhoto.updatedAt
-- 2. InspectionIssue.updatedAt  
-- 3. PropertyDocument.updatedAt
-- Run this on your production PostgreSQL database
-- =====================================================================

-- Fix 1: InspectionPhoto.updatedAt - Add @updatedAt behavior
DO $$
BEGIN
    -- Check if column exists and is NOT NULL
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'InspectionPhoto' 
        AND column_name = 'updatedAt'
        AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE "InspectionPhoto" ALTER COLUMN "updatedAt" DROP NOT NULL;
    END IF;
END $$;

-- Add column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'InspectionPhoto' 
        AND column_name = 'updatedAt'
    ) THEN
        ALTER TABLE "InspectionPhoto" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
    ELSE
        -- Set default value if column exists
        ALTER TABLE "InspectionPhoto" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;
    END IF;
END $$;

-- Make it NOT NULL
ALTER TABLE "InspectionPhoto" ALTER COLUMN "updatedAt" SET NOT NULL;

-- Create or replace function to update updatedAt
CREATE OR REPLACE FUNCTION update_inspection_photo_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop trigger if exists, then create it
DROP TRIGGER IF EXISTS update_inspection_photo_updated_at_trigger ON "InspectionPhoto";
CREATE TRIGGER update_inspection_photo_updated_at_trigger
    BEFORE UPDATE ON "InspectionPhoto"
    FOR EACH ROW
    EXECUTE FUNCTION update_inspection_photo_updated_at();

COMMENT ON COLUMN "InspectionPhoto"."updatedAt" IS 'Automatically updated timestamp';

-- Fix 2: InspectionIssue.updatedAt - Add @updatedAt behavior
DO $$
BEGIN
    -- Check if column exists and is NOT NULL
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'InspectionIssue' 
        AND column_name = 'updatedAt'
        AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE "InspectionIssue" ALTER COLUMN "updatedAt" DROP NOT NULL;
    END IF;
END $$;

-- Set default value
ALTER TABLE "InspectionIssue" 
  ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- Make it NOT NULL again
ALTER TABLE "InspectionIssue" 
  ALTER COLUMN "updatedAt" SET NOT NULL;

-- Create or replace function to update updatedAt
CREATE OR REPLACE FUNCTION update_inspection_issue_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop trigger if exists, then create it
DROP TRIGGER IF EXISTS update_inspection_issue_updated_at_trigger ON "InspectionIssue";
CREATE TRIGGER update_inspection_issue_updated_at_trigger
    BEFORE UPDATE ON "InspectionIssue"
    FOR EACH ROW
    EXECUTE FUNCTION update_inspection_issue_updated_at();

COMMENT ON COLUMN "InspectionIssue"."updatedAt" IS 'Automatically updated timestamp';

-- Fix 3: PropertyDocument.updatedAt - Add @updatedAt behavior
DO $$
BEGIN
    -- Check if column exists and is NOT NULL
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'PropertyDocument' 
        AND column_name = 'updatedAt'
        AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE "PropertyDocument" ALTER COLUMN "updatedAt" DROP NOT NULL;
    END IF;
END $$;

-- Set default value
ALTER TABLE "PropertyDocument" 
  ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- Make it NOT NULL again
ALTER TABLE "PropertyDocument" 
  ALTER COLUMN "updatedAt" SET NOT NULL;

-- Create or replace function to update updatedAt
CREATE OR REPLACE FUNCTION update_property_document_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop trigger if exists, then create it
DROP TRIGGER IF EXISTS update_property_document_updated_at_trigger ON "PropertyDocument";
CREATE TRIGGER update_property_document_updated_at_trigger
    BEFORE UPDATE ON "PropertyDocument"
    FOR EACH ROW
    EXECUTE FUNCTION update_property_document_updated_at();

COMMENT ON COLUMN "PropertyDocument"."updatedAt" IS 'Automatically updated timestamp';

-- =====================================================================
-- VERIFICATION QUERIES
-- =====================================================================
-- Run these to verify the changes:

-- 1. Verify InspectionPhoto.updatedAt has default and trigger
SELECT column_name, column_default 
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'InspectionPhoto' AND column_name = 'updatedAt';

SELECT trigger_name, event_manipulation, event_object_table
FROM information_schema.triggers 
WHERE trigger_name = 'update_inspection_photo_updated_at_trigger';

-- 2. Verify InspectionIssue.updatedAt has default and trigger
SELECT column_name, column_default 
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'InspectionIssue' AND column_name = 'updatedAt';

SELECT trigger_name, event_manipulation, event_object_table
FROM information_schema.triggers 
WHERE trigger_name = 'update_inspection_issue_updated_at_trigger';

-- 3. Verify PropertyDocument.updatedAt has default and trigger
SELECT column_name, column_default 
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'PropertyDocument' AND column_name = 'updatedAt';

SELECT trigger_name, event_manipulation, event_object_table
FROM information_schema.triggers 
WHERE trigger_name = 'update_property_document_updated_at_trigger';

-- =====================================================================
-- NOTES
-- =====================================================================
-- 1. InspectionPhoto.updatedAt now automatically updates on record changes via trigger
-- 2. InspectionIssue.updatedAt now automatically updates on record changes via trigger
-- 3. PropertyDocument.updatedAt now automatically updates on record changes via trigger
-- 4. All changes are backward compatible
-- 5. This script is for PostgreSQL (not MySQL)
-- =====================================================================

