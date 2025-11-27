-- CreateEnum
CREATE TYPE "PropertyImageCategory" AS ENUM ('EXTERIOR', 'INTERIOR', 'KITCHEN', 'BATHROOM', 'BEDROOM', 'OTHER');

-- AlterTable
ALTER TABLE "PropertyImage" ADD COLUMN "category" "PropertyImageCategory" NOT NULL DEFAULT 'OTHER';

-- CreateIndex
CREATE INDEX "PropertyImage_category_idx" ON "PropertyImage"("category");
