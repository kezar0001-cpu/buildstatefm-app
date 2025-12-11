-- Migration: Add inspection archiving support
-- Adds archivedAt to Inspection to support auto-archiving of completed inspections

-- Step 1: Add archivedAt field to Inspection table
ALTER TABLE "Inspection" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);

-- Step 2: Create index on archivedAt for efficient archiving queries
CREATE INDEX IF NOT EXISTS "Inspection_archivedAt_idx" ON "Inspection"("archivedAt");

-- Step 3: Create composite index to filter non-archived inspections efficiently
CREATE INDEX IF NOT EXISTS "Inspection_status_not_archived_idx" ON "Inspection"("status") WHERE "archivedAt" IS NULL;
