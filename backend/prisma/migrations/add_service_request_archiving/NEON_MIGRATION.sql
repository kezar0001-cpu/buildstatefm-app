-- ============================================================================
-- Service Request Archiving Migration for Neon PostgreSQL
-- ============================================================================
-- Run this SQL in your Neon SQL Editor or via psql
-- This migration adds archiving support to Service Requests
-- ============================================================================

-- Step 1: Add archivedAt timestamp column to ServiceRequest table
-- This tracks when a service request was archived
ALTER TABLE "ServiceRequest"
ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);

COMMENT ON COLUMN "ServiceRequest"."archivedAt" IS 'Timestamp when the service request was archived. Approved requests archive after 24h, rejected requests archive after 24h.';

-- Step 2: Add ARCHIVED status to ServiceRequestStatus enum
-- PostgreSQL requires special handling for adding enum values
DO $$
BEGIN
    -- Check if ARCHIVED value already exists in the enum
    IF NOT EXISTS (
        SELECT 1
        FROM pg_enum e
        JOIN pg_type t ON e.enumtypid = t.oid
        WHERE t.typname = 'ServiceRequestStatus'
        AND e.enumlabel = 'ARCHIVED'
    ) THEN
        -- Add ARCHIVED as a new enum value
        ALTER TYPE "ServiceRequestStatus" ADD VALUE 'ARCHIVED';
        RAISE NOTICE 'Added ARCHIVED status to ServiceRequestStatus enum';
    ELSE
        RAISE NOTICE 'ARCHIVED status already exists in ServiceRequestStatus enum';
    END IF;
END $$;

-- Step 3: Create index on archivedAt for efficient archiving queries
-- This speeds up queries that filter or sort by archivedAt
CREATE INDEX IF NOT EXISTS "ServiceRequest_archivedAt_idx"
ON "ServiceRequest"("archivedAt");

COMMENT ON INDEX "ServiceRequest_archivedAt_idx" IS 'Index for efficient queries on archived service requests';

-- Step 4: Create composite index for approved requests archiving
-- Helps the cron job quickly find approved requests that need archiving
CREATE INDEX IF NOT EXISTS "ServiceRequest_status_approvedAt_idx"
ON "ServiceRequest"("status", "approvedAt")
WHERE "status" IN ('APPROVED', 'APPROVED_BY_OWNER');

COMMENT ON INDEX "ServiceRequest_status_approvedAt_idx" IS 'Composite index for archiving approved requests after 24 hours';

-- Step 5: Create composite index for rejected requests archiving
-- Helps the cron job quickly find rejected requests that need archiving
CREATE INDEX IF NOT EXISTS "ServiceRequest_status_rejectedAt_idx"
ON "ServiceRequest"("status", "rejectedAt")
WHERE "status" IN ('REJECTED', 'REJECTED_BY_OWNER');

COMMENT ON INDEX "ServiceRequest_status_rejectedAt_idx" IS 'Composite index for archiving rejected requests after 24 hours';

-- Step 6: Create partial index to efficiently filter out archived items
-- Makes queries that exclude archived items faster
CREATE INDEX IF NOT EXISTS "ServiceRequest_status_not_archived_idx"
ON "ServiceRequest"("status")
WHERE "status" != 'ARCHIVED';

COMMENT ON INDEX "ServiceRequest_status_not_archived_idx" IS 'Partial index for efficient filtering of active (non-archived) service requests';

-- Step 7: Verify the migration was successful
-- This will output the column and enum values to confirm
DO $$
DECLARE
    col_exists boolean;
    enum_exists boolean;
    index_count int;
BEGIN
    -- Check if archivedAt column exists
    SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'ServiceRequest'
        AND column_name = 'archivedAt'
    ) INTO col_exists;

    -- Check if ARCHIVED enum value exists
    SELECT EXISTS (
        SELECT 1
        FROM pg_enum e
        JOIN pg_type t ON e.enumtypid = t.oid
        WHERE t.typname = 'ServiceRequestStatus'
        AND e.enumlabel = 'ARCHIVED'
    ) INTO enum_exists;

    -- Count indexes created
    SELECT COUNT(*) INTO index_count
    FROM pg_indexes
    WHERE tablename = 'ServiceRequest'
    AND indexname LIKE '%archived%';

    -- Report results
    RAISE NOTICE '=== Migration Verification ===';
    RAISE NOTICE 'archivedAt column exists: %', col_exists;
    RAISE NOTICE 'ARCHIVED enum value exists: %', enum_exists;
    RAISE NOTICE 'Archiving indexes created: %', index_count;

    IF col_exists AND enum_exists AND index_count >= 2 THEN
        RAISE NOTICE '✓ Migration completed successfully!';
    ELSE
        RAISE WARNING '⚠ Migration may be incomplete. Please review the results.';
    END IF;
END $$;

-- Step 8: Display current ServiceRequestStatus enum values (for verification)
SELECT
    e.enumlabel as "Status Value",
    e.enumsortorder as "Sort Order"
FROM pg_enum e
JOIN pg_type t ON e.enumtypid = t.oid
WHERE t.typname = 'ServiceRequestStatus'
ORDER BY e.enumsortorder;

-- ============================================================================
-- Migration Complete!
-- ============================================================================
--
-- NEXT STEPS:
-- 1. Verify the output shows ARCHIVED status in the enum list
-- 2. Ensure ENABLE_CRON_JOBS=true in your backend .env file
-- 3. Restart your backend server to activate the archiving cron job
-- 4. The cron job will run every hour to archive:
--    - Approved requests older than 24 hours
--    - Rejected requests older than 24 hours
--
-- TESTING:
-- To manually test archiving, you can run this query:
--
-- UPDATE "ServiceRequest"
-- SET "status" = 'ARCHIVED', "archivedAt" = NOW()
-- WHERE "status" IN ('APPROVED', 'APPROVED_BY_OWNER')
-- AND "approvedAt" < NOW() - INTERVAL '24 hours';
--
-- ============================================================================
