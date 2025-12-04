-- Migration: Add BASIC to SubscriptionPlan enum
-- This migration adds the BASIC value to the SubscriptionPlan enum in PostgreSQL

-- Check if BASIC already exists in the enum (PostgreSQL 9.1+)
DO $$
BEGIN
    -- Add BASIC to the enum if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'BASIC' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'SubscriptionPlan')
    ) THEN
        ALTER TYPE "SubscriptionPlan" ADD VALUE 'BASIC';
    END IF;
END $$;

-- Verify the enum now includes BASIC
-- You can check with: SELECT unnest(enum_range(NULL::"SubscriptionPlan"));

