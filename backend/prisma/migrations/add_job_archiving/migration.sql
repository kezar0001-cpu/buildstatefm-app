-- Migration: Add job archiving support
-- Adds archivedAt to Job to support auto-archiving of completed/cancelled jobs

-- Step 1: Add archivedAt field to Job table
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);

-- Step 2: Create index on archivedAt for efficient archiving queries
CREATE INDEX IF NOT EXISTS "Job_archivedAt_idx" ON "Job"("archivedAt");

-- Step 3: Create partial index to filter non-archived jobs efficiently
CREATE INDEX IF NOT EXISTS "Job_status_not_archived_idx" ON "Job"("status") WHERE "archivedAt" IS NULL;
