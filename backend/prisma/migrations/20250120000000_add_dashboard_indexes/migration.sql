-- Add composite indexes for dashboard query optimization
-- These indexes improve performance for dashboard summary queries

-- UnitTenant: Composite index for tenant property lookups
CREATE INDEX IF NOT EXISTS "UnitTenant_tenantId_isActive_idx" ON "UnitTenant"("tenantId", "isActive");

-- Job: Composite index for job counts by property and status
CREATE INDEX IF NOT EXISTS "Job_propertyId_status_idx" ON "Job"("propertyId", "status");

-- Inspection: Composite index for inspection queries by property, status, and date
CREATE INDEX IF NOT EXISTS "Inspection_propertyId_status_scheduledDate_idx" ON "Inspection"("propertyId", "status", "scheduledDate");

-- ServiceRequest: Composite index for service request counts by property and status
CREATE INDEX IF NOT EXISTS "ServiceRequest_propertyId_status_idx" ON "ServiceRequest"("propertyId", "status");

-- Property: Composite index for property queries by manager and status
CREATE INDEX IF NOT EXISTS "Property_managerId_status_idx" ON "Property"("managerId", "status");

-- Unit: Composite index for unit queries by property and status
CREATE INDEX IF NOT EXISTS "Unit_propertyId_status_idx" ON "Unit"("propertyId", "status");


