# Fix for Failed Recommendation Migration

## Problem

The migration `20250125000000_add_property_id_to_recommendations` failed because the `propertyId` column already exists in the production database. Prisma won't apply new migrations when there's a failed migration in the history.

## Solution

The migration has been fixed to be **idempotent** (can run multiple times safely). It now checks if columns, constraints, and indexes exist before trying to create them.

## Quick Fix Options

### Option 1: Using SQL Script (Recommended for Production)

Connect to your production database and run:

```bash
psql $DATABASE_URL -f backend/resolve-recommendation-migration.sql
```

Or manually run this SQL:

```sql
UPDATE "_prisma_migrations"
SET 
  rolled_back_at = NOW(),
  logs = COALESCE(logs, '') || E'\n\n--- MANUAL ROLLBACK ---\nMarked as rolled back to allow re-application with idempotent fixes.'
WHERE migration_name = '20250125000000_add_property_id_to_recommendations'
  AND finished_at IS NULL
  AND rolled_back_at IS NULL;
```

### Option 2: Using Prisma CLI (If you have shell access)

If you have access to Render shell or your deployment environment:

```bash
npx prisma migrate resolve --rolled-back 20250125000000_add_property_id_to_recommendations
```

### Option 3: Using Render Dashboard

1. Go to your Render dashboard
2. Open the shell for your backend service
3. Run the SQL command from Option 1, or use Prisma CLI from Option 2

## After Resolving

Once the failed migration is marked as rolled back:

1. **Commit and push the fixed migration** (already done - the migration is now idempotent)
2. **Trigger a new deployment** - The migration will now succeed because:
   - The failed migration is marked as rolled back
   - The fixed migration checks for column existence before creating
   - All operations are idempotent

## What the Fix Does

The updated migration now:

1. ✅ Checks if `propertyId` column exists before adding it
2. ✅ Checks if foreign key constraint exists before adding it
3. ✅ Checks if index exists before creating it
4. ✅ Only updates NULL values (won't overwrite existing data)
5. ✅ Only makes column NOT NULL if it's currently nullable
6. ✅ Only drops NOT NULL constraint if it exists

This makes the migration **safe to run multiple times** and handles the case where the column already exists.

## Verification

After the migration runs successfully, verify:

```sql
-- Check that propertyId column exists and is NOT NULL
SELECT column_name, is_nullable, data_type
FROM information_schema.columns
WHERE table_name = 'Recommendation' AND column_name = 'propertyId';

-- Check that foreign key constraint exists
SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'Recommendation' AND constraint_name = 'Recommendation_propertyId_fkey';

-- Check that index exists
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'Recommendation' AND indexname = 'Recommendation_propertyId_idx';
```

