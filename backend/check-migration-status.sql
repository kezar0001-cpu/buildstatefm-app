-- Check if the recommendation archiving migration has been applied
-- Run this in your database client to verify migration status

-- 1. Check if rejectedAt column exists
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'Recommendation' 
  AND column_name = 'rejectedAt';

-- 2. Check if ARCHIVED status exists in enum
SELECT 
    t.typname as enum_name,
    e.enumlabel as enum_value
FROM pg_type t 
JOIN pg_enum e ON t.oid = e.enumtypid  
WHERE t.typname = 'RecommendationStatus'
  AND e.enumlabel = 'ARCHIVED';

-- 3. Check migration history
SELECT 
    migration_name,
    finished_at IS NOT NULL as completed,
    rolled_back_at IS NOT NULL as rolled_back,
    started_at,
    finished_at
FROM "_prisma_migrations"
WHERE migration_name = 'add_recommendation_archiving'
ORDER BY started_at DESC
LIMIT 1;

-- 4. Check indexes
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'Recommendation'
  AND indexname LIKE '%rejectedAt%';

