-- Add lifetime access support and make passwordHash nullable

-- Ensure users created via OAuth (or legacy users) can have no password hash
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'User'
      AND column_name = 'passwordHash'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL;
  END IF;
END $$;

-- Add lifetime flag to user
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isLifetime" BOOLEAN NOT NULL DEFAULT false;

-- Lifetime purchases table
CREATE TABLE IF NOT EXISTS "LifetimePurchase" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "stripeCheckoutSessionId" TEXT NOT NULL,
  "stripeCustomerId" TEXT,
  "stripePaymentIntentId" TEXT,
  "stripePaymentLinkId" TEXT,
  "amount" INTEGER,
  "currency" TEXT,
  "paidAt" TIMESTAMP(3),
  "userId" TEXT,
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "LifetimePurchase_pkey" PRIMARY KEY ("id")
);

-- Uniqueness and indexes
CREATE UNIQUE INDEX IF NOT EXISTS "LifetimePurchase_stripeCheckoutSessionId_key" ON "LifetimePurchase"("stripeCheckoutSessionId");
CREATE INDEX IF NOT EXISTS "LifetimePurchase_email_idx" ON "LifetimePurchase"("email");
CREATE INDEX IF NOT EXISTS "LifetimePurchase_userId_idx" ON "LifetimePurchase"("userId");

-- FK to User
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND table_name = 'LifetimePurchase'
      AND constraint_name = 'LifetimePurchase_userId_fkey'
  ) THEN
    ALTER TABLE "LifetimePurchase"
      ADD CONSTRAINT "LifetimePurchase_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
