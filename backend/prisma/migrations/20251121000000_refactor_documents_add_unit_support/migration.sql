-- AlterTable: Add unitId support to PropertyDocument
ALTER TABLE "PropertyDocument"
  ADD COLUMN IF NOT EXISTS "unitId" TEXT;

-- CreateIndex: Add index on unitId
CREATE INDEX IF NOT EXISTS "PropertyDocument_unitId_idx" ON "PropertyDocument"("unitId");

-- AddForeignKey: Link PropertyDocument to Unit (optional relationship)
ALTER TABLE "PropertyDocument"
  ADD CONSTRAINT "PropertyDocument_unitId_fkey"
  FOREIGN KEY ("unitId")
  REFERENCES "Unit"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

-- AlterTable: Drop Cloudinary-specific columns (simplify schema)
ALTER TABLE "PropertyDocument"
  DROP COLUMN IF EXISTS "cloudinarySecureUrl",
  DROP COLUMN IF EXISTS "cloudinaryPublicId",
  DROP COLUMN IF EXISTS "cloudinaryResourceType",
  DROP COLUMN IF EXISTS "cloudinaryFormat";
