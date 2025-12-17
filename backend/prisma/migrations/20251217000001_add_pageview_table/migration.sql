-- Create PageView table for traffic analytics

CREATE TABLE IF NOT EXISTS "PageView" (
  "id" TEXT NOT NULL,
  "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "path" TEXT NOT NULL,
  "referrer" TEXT,
  "userAgent" TEXT,
  "ipAddress" TEXT,
  "sessionId" TEXT NOT NULL,

  CONSTRAINT "PageView_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PageView_sessionId_idx" ON "PageView"("sessionId");
CREATE INDEX IF NOT EXISTS "PageView_timestamp_idx" ON "PageView"("timestamp");
CREATE INDEX IF NOT EXISTS "PageView_path_idx" ON "PageView"("path");
