-- PostgreSQL SQL for Neon Database
-- Run this SQL directly in your Neon database to add the RecommendationComment table
-- Note: Neon uses PostgreSQL, not MySQL

-- CreateTable
CREATE TABLE IF NOT EXISTS "RecommendationComment" (
    "id" TEXT NOT NULL,
    "recommendationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecommendationComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (only if they don't exist)
CREATE INDEX IF NOT EXISTS "RecommendationComment_recommendationId_idx" ON "RecommendationComment"("recommendationId");
CREATE INDEX IF NOT EXISTS "RecommendationComment_userId_idx" ON "RecommendationComment"("userId");
CREATE INDEX IF NOT EXISTS "RecommendationComment_createdAt_idx" ON "RecommendationComment"("createdAt");

-- AddForeignKey (only if they don't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'RecommendationComment_recommendationId_fkey'
    ) THEN
        ALTER TABLE "RecommendationComment" 
        ADD CONSTRAINT "RecommendationComment_recommendationId_fkey" 
        FOREIGN KEY ("recommendationId") 
        REFERENCES "Recommendation"("id") 
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'RecommendationComment_userId_fkey'
    ) THEN
        ALTER TABLE "RecommendationComment" 
        ADD CONSTRAINT "RecommendationComment_userId_fkey" 
        FOREIGN KEY ("userId") 
        REFERENCES "User"("id") 
        ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

