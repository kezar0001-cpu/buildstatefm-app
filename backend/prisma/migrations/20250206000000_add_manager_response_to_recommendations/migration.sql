-- Add manager response fields to Recommendation table
-- This allows property managers to respond to rejection notes from owners

ALTER TABLE "Recommendation" ADD COLUMN "managerResponse" TEXT;
ALTER TABLE "Recommendation" ADD COLUMN "managerResponseAt" TIMESTAMP(3);
