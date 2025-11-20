-- Add Cloudinary metadata columns for PropertyDocument previews
ALTER TABLE "PropertyDocument"
  ADD COLUMN IF NOT EXISTS "cloudinarySecureUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "cloudinaryPublicId" TEXT,
  ADD COLUMN IF NOT EXISTS "cloudinaryResourceType" TEXT,
  ADD COLUMN IF NOT EXISTS "cloudinaryFormat" TEXT;
