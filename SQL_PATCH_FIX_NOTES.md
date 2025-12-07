# SQL Patch Fix Notes

## Issue Encountered

**Error**: `syntax error at or near "COLUMN" (SQLSTATE 42601)`

**Cause**: In PostgreSQL `DO` blocks, you cannot use `ALTER TABLE` statements directly. You must use `EXECUTE` with dynamic SQL strings.

## Solution

Two versions of the SQL patch are provided:

### Version 1: PROPERTY_WORKFLOW_FIXES_POSTGRESQL_PATCH.sql
- Uses conditional logic with `DO` blocks
- All `ALTER TABLE` statements inside `DO` blocks use `EXECUTE`
- More complex but handles edge cases

### Version 2: PROPERTY_WORKFLOW_FIXES_POSTGRESQL_PATCH_SIMPLE.sql (RECOMMENDED)
- Direct `ALTER TABLE` statements (no `DO` blocks for ALTER)
- Simpler and easier to debug
- Safe to run multiple times (idempotent)
- **Use this version if you encounter syntax errors**

## Fixed Syntax

### ❌ Incorrect (causes syntax error):
```sql
DO $$
BEGIN
    IF EXISTS (...) THEN
        ALTER TABLE "Property" ALTER COLUMN "totalArea" TYPE INTEGER;
        ALTER COLUMN "totalArea" DROP NOT NULL;  -- ERROR: Missing ALTER TABLE
    END IF;
END $$;
```

### ✅ Correct (using EXECUTE):
```sql
DO $$
BEGIN
    IF EXISTS (...) THEN
        EXECUTE 'ALTER TABLE "Property" ALTER COLUMN "totalArea" TYPE INTEGER USING ROUND("totalArea")::INTEGER';
        EXECUTE 'ALTER TABLE "Property" ALTER COLUMN "totalArea" DROP NOT NULL';
    END IF;
END $$;
```

### ✅ Correct (simpler, no DO block):
```sql
ALTER TABLE "Property" 
  ALTER COLUMN "totalArea" TYPE INTEGER USING ROUND("totalArea")::INTEGER;

ALTER TABLE "Property" 
  ALTER COLUMN "totalArea" DROP NOT NULL;
```

## Recommendation

**Use `PROPERTY_WORKFLOW_FIXES_POSTGRESQL_PATCH_SIMPLE.sql`** - it's simpler, easier to debug, and avoids the DO block syntax issues.

