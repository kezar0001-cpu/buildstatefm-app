# Run Migration Now - Multiple Options

## ✅ Option 1: Run SQL Directly (FASTEST - No Node.js needed!)

Since Node.js isn't in your PATH, you can run the SQL migration directly:

### Using psql (if you have it):
```bash
psql $DATABASE_URL -f prisma/migrations/add_recommendation_archiving/migration.sql
```

### Or copy/paste the SQL into your database client:
1. Open your database client (pgAdmin, DBeaver, TablePlus, etc.)
2. Connect to your Neon database
3. Open the file: `prisma/migrations/add_recommendation_archiving/migration.sql`
4. Copy all the SQL and paste it into your database client
5. Execute it

**The SQL file is at:** `backend/prisma/migrations/add_recommendation_archiving/migration.sql`

---

## Option 2: Fix Node.js PATH

If you're using **nvm-windows**:
```powershell
nvm use <version>
# Then run: npx prisma migrate dev --name add_recommendation_archiving
```

If Node.js is installed but not in PATH:
1. Find where Node.js is installed (check Program Files, AppData, etc.)
2. Add it to your system PATH
3. Restart terminal
4. Run: `npx prisma migrate dev --name add_recommendation_archiving`

---

## Option 3: Use Git Bash (if you have it)

Git Bash often has Node.js in PATH:
```bash
cd backend
npx prisma migrate dev --name add_recommendation_archiving
```

---

## What the Migration Does

The migration will:
1. ✅ Add `rejectedAt` timestamp column to `Recommendation` table
2. ✅ Add `ARCHIVED` value to `RecommendationStatus` enum  
3. ✅ Create indexes for efficient archiving queries

**After running, verify:**
- Check that `Recommendation` table has `rejectedAt` column
- Check that `ARCHIVED` is available in the enum

---

## Quick SQL Copy-Paste

Here's the SQL to run directly:

```sql
-- Add rejectedAt field
ALTER TABLE "Recommendation" ADD COLUMN IF NOT EXISTS "rejectedAt" TIMESTAMP(3);

-- Add ARCHIVED to enum
DO $$ BEGIN
    ALTER TYPE "RecommendationStatus" ADD VALUE IF NOT EXISTS 'ARCHIVED';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS "Recommendation_rejectedAt_idx" ON "Recommendation"("rejectedAt");
CREATE INDEX IF NOT EXISTS "Recommendation_status_rejectedAt_idx" ON "Recommendation"("status", "rejectedAt") WHERE "status" = 'REJECTED';
```

