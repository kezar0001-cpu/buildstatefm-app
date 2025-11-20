-- Migration: Add Property Documents Feature
-- This script safely adds the PropertyDocument table and related enums
-- Run this with: psql $DATABASE_URL -f apply-property-documents-migration.sql

BEGIN;

-- CreateEnum (only if not exists)
DO $$ BEGIN
    CREATE TYPE "PropertyDocumentCategory" AS ENUM (
        'LEASE_AGREEMENT',
        'INSURANCE',
        'PERMIT',
        'INSPECTION_REPORT',
        'MAINTENANCE_RECORD',
        'FINANCIAL',
        'LEGAL',
        'PHOTOS',
        'OTHER'
    );
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE 'PropertyDocumentCategory enum already exists, skipping...';
END $$;

-- CreateEnum (only if not exists)
DO $$ BEGIN
    CREATE TYPE "PropertyDocumentAccessLevel" AS ENUM (
        'PUBLIC',
        'TENANT',
        'OWNER',
        'PROPERTY_MANAGER'
    );
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE 'PropertyDocumentAccessLevel enum already exists, skipping...';
END $$;

-- Drop existing table if it exists (WARNING: This will delete any existing data)
DROP TABLE IF EXISTS "PropertyDocument" CASCADE;

-- CreateTable
CREATE TABLE "PropertyDocument" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "cloudinarySecureUrl" TEXT,
    "cloudinaryPublicId" TEXT,
    "cloudinaryResourceType" TEXT,
    "cloudinaryFormat" TEXT,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "category" "PropertyDocumentCategory" NOT NULL,
    "description" TEXT,
    "accessLevel" "PropertyDocumentAccessLevel" NOT NULL,
    "uploaderId" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PropertyDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PropertyDocument_propertyId_idx" ON "PropertyDocument"("propertyId");
CREATE INDEX "PropertyDocument_uploaderId_idx" ON "PropertyDocument"("uploaderId");
CREATE INDEX "PropertyDocument_category_idx" ON "PropertyDocument"("category");
CREATE INDEX "PropertyDocument_accessLevel_idx" ON "PropertyDocument"("accessLevel");

-- AddForeignKey
ALTER TABLE "PropertyDocument"
    ADD CONSTRAINT "PropertyDocument_propertyId_fkey"
    FOREIGN KEY ("propertyId")
    REFERENCES "Property"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;

ALTER TABLE "PropertyDocument"
    ADD CONSTRAINT "PropertyDocument_uploaderId_fkey"
    FOREIGN KEY ("uploaderId")
    REFERENCES "User"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;

-- Record migration in Prisma's migration table
INSERT INTO "_prisma_migrations" (
    "id",
    "checksum",
    "finished_at",
    "migration_name",
    "logs",
    "rolled_back_at",
    "started_at",
    "applied_steps_count"
) VALUES (
    gen_random_uuid()::text,
    'property_documents_migration',
    NOW(),
    '20251112120000_add_property_documents',
    NULL,
    NULL,
    NOW(),
    1
)
ON CONFLICT DO NOTHING;

COMMIT;

-- Verify the table was created
SELECT
    'PropertyDocument table created successfully!' as status,
    COUNT(*) as document_count
FROM "PropertyDocument";
