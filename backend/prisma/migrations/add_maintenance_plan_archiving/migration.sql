-- Migration: Add maintenance plan archiving support
-- Adds archivedAt to MaintenancePlan to support soft-archiving

-- Step 1: Add archivedAt field to MaintenancePlan table
ALTER TABLE "MaintenancePlan" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);

-- Step 2: Create index on archivedAt for efficient archiving queries
CREATE INDEX IF NOT EXISTS "MaintenancePlan_archivedAt_idx" ON "MaintenancePlan"("archivedAt");

-- Step 3: Create partial index to filter non-archived plans efficiently
CREATE INDEX IF NOT EXISTS "MaintenancePlan_not_archived_idx" ON "MaintenancePlan"("nextDueDate") WHERE "archivedAt" IS NULL;
