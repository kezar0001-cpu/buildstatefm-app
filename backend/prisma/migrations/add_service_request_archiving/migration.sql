-- Migration: Add service request archiving support
-- This migration adds the archivedAt field and ARCHIVED status to support auto-archiving
-- Approved requests are archived after 24 hours
-- Rejected requests are archived after 25 hours

-- Step 1: Add archivedAt field to ServiceRequest table
ALTER TABLE "ServiceRequest" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);

-- Step 2: Add ARCHIVED to ServiceRequestStatus enum
-- Note: PostgreSQL doesn't support adding enum values directly in older versions
-- We'll use ALTER TYPE ... ADD VALUE which requires a new transaction
DO $$ BEGIN
    ALTER TYPE "ServiceRequestStatus" ADD VALUE IF NOT EXISTS 'ARCHIVED';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Step 3: Create index on archivedAt for efficient archiving queries
CREATE INDEX IF NOT EXISTS "ServiceRequest_archivedAt_idx" ON "ServiceRequest"("archivedAt");

-- Step 4: Create composite index on status and timestamps for archiving queries
CREATE INDEX IF NOT EXISTS "ServiceRequest_status_approvedAt_idx" ON "ServiceRequest"("status", "approvedAt") WHERE "status" IN ('APPROVED', 'APPROVED_BY_OWNER');
CREATE INDEX IF NOT EXISTS "ServiceRequest_status_rejectedAt_idx" ON "ServiceRequest"("status", "rejectedAt") WHERE "status" IN ('REJECTED', 'REJECTED_BY_OWNER');

-- Step 5: Create index to filter out archived items efficiently
CREATE INDEX IF NOT EXISTS "ServiceRequest_status_not_archived_idx" ON "ServiceRequest"("status") WHERE "status" != 'ARCHIVED';
