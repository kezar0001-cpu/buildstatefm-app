-- CreateTable: Add NotificationPreference table
-- This migration adds the NotificationPreference table to support user notification preferences

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "pushEnabled" BOOLEAN NOT NULL DEFAULT true,
    "jobAssigned" BOOLEAN NOT NULL DEFAULT true,
    "jobStatusChanged" BOOLEAN NOT NULL DEFAULT true,
    "jobCompleted" BOOLEAN NOT NULL DEFAULT true,
    "inspectionScheduled" BOOLEAN NOT NULL DEFAULT true,
    "inspectionCompleted" BOOLEAN NOT NULL DEFAULT true,
    "serviceRequestCreated" BOOLEAN NOT NULL DEFAULT true,
    "serviceRequestApproved" BOOLEAN NOT NULL DEFAULT true,
    "paymentFailed" BOOLEAN NOT NULL DEFAULT true,
    "paymentSucceeded" BOOLEAN NOT NULL DEFAULT true,
    "trialExpiring" BOOLEAN NOT NULL DEFAULT true,
    "emailDigestFrequency" TEXT NOT NULL DEFAULT 'DAILY',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreference_userId_key" ON "NotificationPreference"("userId");

-- CreateIndex
CREATE INDEX "NotificationPreference_userId_idx" ON "NotificationPreference"("userId");

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

