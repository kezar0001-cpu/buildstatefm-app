# How to Run the Recommendation Archiving Migration

## Option 1: Using Prisma CLI (Recommended)

**Restart your terminal** (to restore PATH), then run:

```bash
cd backend
npx prisma migrate dev --name add_recommendation_archiving
```

## Option 2: Run SQL Directly

If you have direct database access, you can run the SQL migration file directly:

1. Open your database client (pgAdmin, DBeaver, etc.) or use psql
2. Connect to your database
3. Run the SQL from: `backend/prisma/migrations/add_recommendation_archiving/migration.sql`

Or using psql:
```bash
psql $DATABASE_URL -f backend/prisma/migrations/add_recommendation_archiving/migration.sql
```

## Option 3: Using the Helper Script

After restarting your terminal:

```powershell
cd backend
.\migrate.ps1
```

## What the Migration Does

1. Adds `rejectedAt` timestamp field to `Recommendation` table
2. Adds `ARCHIVED` status to `RecommendationStatus` enum
3. Creates indexes for efficient archiving queries

## Verification

After migration, verify it worked:

```bash
npx prisma studio
# Or check your database directly
```

The `Recommendation` table should now have:
- `rejectedAt` column (nullable timestamp)
- `ARCHIVED` value available in the status enum
