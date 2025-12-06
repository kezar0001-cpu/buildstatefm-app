-- PostgreSQL SQL for Neon Database
-- Run this SQL directly in your Neon database to add the NotificationPreference table
-- Note: Neon uses PostgreSQL, not MySQL

-- CreateTable
CREATE TABLE IF NOT EXISTS "NotificationPreference" (
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

-- CreateIndex (only if they don't exist)
CREATE UNIQUE INDEX IF NOT EXISTS "NotificationPreference_userId_key" ON "NotificationPreference"("userId");
CREATE INDEX IF NOT EXISTS "NotificationPreference_userId_idx" ON "NotificationPreference"("userId");

-- AddForeignKey (only if they don't exist)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'NotificationPreference_userId_fkey') THEN
        ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

