-- Migration: Add refresh token rotation support
-- Adds refreshTokenHash to User so refresh tokens can be rotated and revoked server-side.

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "refreshTokenHash" TEXT;

CREATE INDEX IF NOT EXISTS "User_refreshTokenHash_idx" ON "User"("refreshTokenHash");
