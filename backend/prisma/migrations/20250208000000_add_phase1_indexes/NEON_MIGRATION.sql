-- PostgreSQL SQL for Neon Database
-- Run this SQL directly in your Neon database to add Phase 1 performance indexes
-- Note: Neon uses PostgreSQL, not MySQL

-- Job indexes for common filter combinations
CREATE INDEX IF NOT EXISTS "Job_assignedToId_status_idx" ON "Job"("assignedToId", "status");
CREATE INDEX IF NOT EXISTS "Job_scheduledDate_status_idx" ON "Job"("scheduledDate", "status") WHERE "scheduledDate" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "Job_createdAt_status_idx" ON "Job"("createdAt", "status");

-- Inspection indexes for common filter combinations
CREATE INDEX IF NOT EXISTS "Inspection_assignedToId_status_idx" ON "Inspection"("assignedToId", "status");
CREATE INDEX IF NOT EXISTS "Inspection_scheduledDate_status_idx" ON "Inspection"("scheduledDate", "status") WHERE "scheduledDate" IS NOT NULL;

-- Service Request indexes for common filter combinations
CREATE INDEX IF NOT EXISTS "ServiceRequest_requestedById_status_idx" ON "ServiceRequest"("requestedById", "status");
CREATE INDEX IF NOT EXISTS "ServiceRequest_category_status_idx" ON "ServiceRequest"("category", "status");
CREATE INDEX IF NOT EXISTS "ServiceRequest_createdAt_status_idx" ON "ServiceRequest"("createdAt", "status");

-- Recommendation indexes for common filter combinations
CREATE INDEX IF NOT EXISTS "Recommendation_propertyId_status_idx" ON "Recommendation"("propertyId", "status");
CREATE INDEX IF NOT EXISTS "Recommendation_createdAt_status_idx" ON "Recommendation"("createdAt", "status");

-- Notification indexes for common filter combinations
CREATE INDEX IF NOT EXISTS "Notification_userId_isRead_createdAt_idx" ON "Notification"("userId", "isRead", "createdAt");

-- PropertyDocument indexes for common filter combinations
CREATE INDEX IF NOT EXISTS "PropertyDocument_propertyId_accessLevel_idx" ON "PropertyDocument"("propertyId", "accessLevel");
CREATE INDEX IF NOT EXISTS "PropertyDocument_unitId_accessLevel_idx" ON "PropertyDocument"("unitId", "accessLevel") WHERE "unitId" IS NOT NULL;

