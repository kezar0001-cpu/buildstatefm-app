-- Migration: Add recommendation archiving support
-- This migration adds the rejectedAt field and ARCHIVED status to support 24-hour auto-archiving

-- Step 1: Add rejectedAt field to Recommendation table
ALTER TABLE "Recommendation" ADD COLUMN IF NOT EXISTS "rejectedAt" TIMESTAMP(3);

-- Step 2: Add ARCHIVED to RecommendationStatus enum
-- Note: PostgreSQL doesn't support adding enum values directly in older versions
-- We'll use ALTER TYPE ... ADD VALUE which requires a new transaction
DO $$ BEGIN
    ALTER TYPE "RecommendationStatus" ADD VALUE IF NOT EXISTS 'ARCHIVED';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Step 3: Create index on rejectedAt for efficient archiving queries
CREATE INDEX IF NOT EXISTS "Recommendation_rejectedAt_idx" ON "Recommendation"("rejectedAt");

-- Step 4: Create index on status for filtering archived items
CREATE INDEX IF NOT EXISTS "Recommendation_status_rejectedAt_idx" ON "Recommendation"("status", "rejectedAt") WHERE "status" = 'REJECTED';

