-- Migration: Add maintenance plan technician assignment support
-- Adds assignedToId to MaintenancePlan to allow assigning a plan to a technician.

ALTER TABLE "MaintenancePlan" ADD COLUMN IF NOT EXISTS "assignedToId" TEXT;

CREATE INDEX IF NOT EXISTS "MaintenancePlan_assignedToId_idx" ON "MaintenancePlan"("assignedToId");

ALTER TABLE "MaintenancePlan" ADD CONSTRAINT "MaintenancePlan_assignedToId_fkey"
  FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
