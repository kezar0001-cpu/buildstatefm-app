-- CreateTable (idempotent - safe to run if table already exists)
CREATE TABLE IF NOT EXISTS "PropertyNote" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PropertyNote_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey (idempotent - only add if doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PropertyNote_propertyId_fkey'
  ) THEN
    ALTER TABLE "PropertyNote" ADD CONSTRAINT "PropertyNote_propertyId_fkey"
      FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PropertyNote_authorId_fkey'
  ) THEN
    ALTER TABLE "PropertyNote" ADD CONSTRAINT "PropertyNote_authorId_fkey"
      FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- CreateIndex (idempotent - only create if doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'PropertyNote_propertyId_idx'
  ) THEN
    CREATE INDEX "PropertyNote_propertyId_idx" ON "PropertyNote"("propertyId");
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'PropertyNote_authorId_idx'
  ) THEN
    CREATE INDEX "PropertyNote_authorId_idx" ON "PropertyNote"("authorId");
  END IF;
END $$;
