-- Migration: Add property archiving support
-- Adds archivedAt to Property to support soft-archiving

-- Step 1: Add archivedAt field to Property table
ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);

-- Step 2: Create index on archivedAt for efficient archiving queries
CREATE INDEX IF NOT EXISTS "Property_archivedAt_idx" ON "Property"("archivedAt");

-- Step 3: Create partial index to filter non-archived properties efficiently
CREATE INDEX IF NOT EXISTS "Property_not_archived_idx" ON "Property"("createdAt") WHERE "archivedAt" IS NULL;
