-- Add PENDING_APPROVAL status to InspectionStatus enum
ALTER TYPE "InspectionStatus" ADD VALUE 'PENDING_APPROVAL';

-- Create RecurrenceFrequency enum
CREATE TYPE "RecurrenceFrequency" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY');

-- Create InspectionTemplate table
CREATE TABLE "InspectionTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "InspectionType" NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "propertyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InspectionTemplate_pkey" PRIMARY KEY ("id")
);

-- Create InspectionTemplateRoom table
CREATE TABLE "InspectionTemplateRoom" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "roomType" "RoomType",
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InspectionTemplateRoom_pkey" PRIMARY KEY ("id")
);

-- Create InspectionTemplateChecklistItem table
CREATE TABLE "InspectionTemplateChecklistItem" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InspectionTemplateChecklistItem_pkey" PRIMARY KEY ("id")
);

-- Create RecurringInspection table
CREATE TABLE "RecurringInspection" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "InspectionType" NOT NULL,
    "propertyId" TEXT NOT NULL,
    "unitId" TEXT,
    "assignedToId" TEXT,
    "frequency" "RecurrenceFrequency" NOT NULL,
    "interval" INTEGER NOT NULL DEFAULT 1,
    "dayOfMonth" INTEGER,
    "dayOfWeek" INTEGER,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "nextDueDate" TIMESTAMP(3) NOT NULL,
    "lastGeneratedDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "templateId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecurringInspection_pkey" PRIMARY KEY ("id")
);

-- Add approval workflow fields to Inspection table
ALTER TABLE "Inspection" ADD COLUMN "rejectionReason" TEXT;
ALTER TABLE "Inspection" ADD COLUMN "rejectedById" TEXT;
ALTER TABLE "Inspection" ADD COLUMN "rejectedAt" TIMESTAMP(3);
ALTER TABLE "Inspection" ADD COLUMN "approvedById" TEXT;
ALTER TABLE "Inspection" ADD COLUMN "approvedAt" TIMESTAMP(3);
ALTER TABLE "Inspection" ADD COLUMN "templateId" TEXT;
ALTER TABLE "Inspection" ADD COLUMN "recurringInspectionId" TEXT;

-- Create indexes for InspectionTemplate
CREATE INDEX "InspectionTemplate_type_idx" ON "InspectionTemplate"("type");
CREATE INDEX "InspectionTemplate_propertyId_idx" ON "InspectionTemplate"("propertyId");
CREATE INDEX "InspectionTemplate_isActive_idx" ON "InspectionTemplate"("isActive");

-- Create indexes for InspectionTemplateRoom
CREATE INDEX "InspectionTemplateRoom_templateId_idx" ON "InspectionTemplateRoom"("templateId");

-- Create indexes for InspectionTemplateChecklistItem
CREATE INDEX "InspectionTemplateChecklistItem_roomId_idx" ON "InspectionTemplateChecklistItem"("roomId");

-- Create indexes for RecurringInspection
CREATE INDEX "RecurringInspection_propertyId_idx" ON "RecurringInspection"("propertyId");
CREATE INDEX "RecurringInspection_unitId_idx" ON "RecurringInspection"("unitId");
CREATE INDEX "RecurringInspection_assignedToId_idx" ON "RecurringInspection"("assignedToId");
CREATE INDEX "RecurringInspection_templateId_idx" ON "RecurringInspection"("templateId");
CREATE INDEX "RecurringInspection_nextDueDate_idx" ON "RecurringInspection"("nextDueDate");
CREATE INDEX "RecurringInspection_isActive_idx" ON "RecurringInspection"("isActive");

-- Create indexes for new Inspection fields
CREATE INDEX "Inspection_rejectedById_idx" ON "Inspection"("rejectedById");
CREATE INDEX "Inspection_approvedById_idx" ON "Inspection"("approvedById");
CREATE INDEX "Inspection_templateId_idx" ON "Inspection"("templateId");
CREATE INDEX "Inspection_recurringInspectionId_idx" ON "Inspection"("recurringInspectionId");

-- Add foreign key constraints
ALTER TABLE "InspectionTemplate" ADD CONSTRAINT "InspectionTemplate_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InspectionTemplateRoom" ADD CONSTRAINT "InspectionTemplateRoom_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "InspectionTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InspectionTemplateChecklistItem" ADD CONSTRAINT "InspectionTemplateChecklistItem_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "InspectionTemplateRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RecurringInspection" ADD CONSTRAINT "RecurringInspection_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecurringInspection" ADD CONSTRAINT "RecurringInspection_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecurringInspection" ADD CONSTRAINT "RecurringInspection_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RecurringInspection" ADD CONSTRAINT "RecurringInspection_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "InspectionTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_rejectedById_fkey" FOREIGN KEY ("rejectedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "InspectionTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_recurringInspectionId_fkey" FOREIGN KEY ("recurringInspectionId") REFERENCES "RecurringInspection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
