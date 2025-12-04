-- Script to resolve failed migration state for propertyId column
-- This marks the failed migration as rolled back so it can be re-applied with the idempotent fix

-- Check current migration status
SELECT migration_name, finished_at, rolled_back_at, logs
FROM "_prisma_migrations"
WHERE migration_name = '20250125000000_add_property_id_to_recommendations';

-- Mark the failed migration as rolled back
UPDATE "_prisma_migrations"
SET 
  rolled_back_at = NOW(),
  logs = COALESCE(logs, '') || E'\n\n--- MANUAL ROLLBACK ---\nMarked as rolled back to allow re-application with idempotent fixes.\nOriginal error: column "propertyId" of relation "Recommendation" already exists\nFix: Made migration idempotent by checking for column/constraint/index existence before creating.'
WHERE migration_name = '20250125000000_add_property_id_to_recommendations'
  AND finished_at IS NULL
  AND rolled_back_at IS NULL;

-- Verify the update
SELECT migration_name, finished_at, rolled_back_at
FROM "_prisma_migrations"
WHERE migration_name = '20250125000000_add_property_id_to_recommendations';

-- Show all migrations status
SELECT migration_name, 
       finished_at IS NOT NULL as completed,
       rolled_back_at IS NOT NULL as rolled_back,
       started_at
FROM "_prisma_migrations"
ORDER BY started_at DESC
LIMIT 10;

