# Properties Workflow - Deployment Guide

**Date**: 2024  
**Status**: Ready for Production Deployment

---

## Pre-Deployment Checklist

- [x] All code changes reviewed and tested
- [x] Database schema changes validated
- [x] Migration SQL tested on staging
- [x] Integration tests passing
- [x] Frontend changes verified
- [x] Backend changes verified
- [x] Documentation complete

---

## Deployment Steps

### Step 1: Backup Database

**CRITICAL**: Always backup before running migrations!

```bash
# PostgreSQL backup
pg_dump -U your_user -d your_database > backup_$(date +%Y%m%d_%H%M%S).sql

# Verify backup
ls -lh backup_*.sql
```

---

### Step 2: Apply Database Migration

**Option A: Using the comprehensive PostgreSQL patch (Recommended)**

```bash
# Connect to database
psql -U your_user -d your_database

# Run the migration
\i PROPERTY_WORKFLOW_FIXES_POSTGRESQL_PATCH.sql

# Or from command line
psql -U your_user -d your_database -f PROPERTY_WORKFLOW_FIXES_POSTGRESQL_PATCH.sql
```

**Option B: Using the specific migration file**

```bash
psql -U your_user -d your_database -f backend/prisma/migrations/manual_fix_unit_image_and_unit_owner_updated_at.sql
```

**Verify Migration**:
```sql
-- Check UnitImage.updatedAt
SELECT column_name, column_default 
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'UnitImage' AND column_name = 'updatedAt';

-- Check UnitOwner.updatedAt
SELECT column_name, column_default 
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'UnitOwner' AND column_name = 'updatedAt';

-- Check triggers
SELECT trigger_name, event_manipulation, event_object_table
FROM information_schema.triggers 
WHERE trigger_name IN (
  'update_unit_image_updated_at_trigger',
  'update_unit_owner_updated_at_trigger'
);
```

---

### Step 3: Deploy Backend Changes

1. **Deploy Updated Files**:
   - `backend/prisma/schema.prisma`
   - `backend/src/routes/units.js`

2. **Regenerate Prisma Client** (if needed):
   ```bash
   cd backend
   npx prisma generate
   ```

3. **Restart Backend Service**:
   ```bash
   # Example for PM2
   pm2 restart buildstate-backend
   
   # Example for systemd
   sudo systemctl restart buildstate-backend
   ```

4. **Verify Backend**:
   ```bash
   # Check logs
   tail -f logs/backend.log
   
   # Test health endpoint
   curl https://api.yourdomain.com/health
   ```

---

### Step 4: Deploy Frontend Changes

1. **Deploy Updated Files**:
   - `frontend/src/components/UnitForm.jsx`
   - `frontend/src/schemas/unitSchema.js`

2. **Build Frontend**:
   ```bash
   cd frontend
   npm run build
   ```

3. **Deploy to Vercel** (or your hosting):
   ```bash
   vercel --prod
   ```

4. **Verify Frontend**:
   - Check deployment status
   - Test property creation flow
   - Test unit creation flow

---

### Step 5: Post-Deployment Verification

#### 5.1 Test Property Creation

1. Create a new property through the UI
2. Verify:
   - Property is created successfully
   - Total area is stored as integer
   - Images upload correctly
   - Response includes `success: true`

#### 5.2 Test Unit Creation

1. Create a unit with area value (try float like 850.7)
2. Verify:
   - Unit is created successfully
   - Area is stored as integer (851)
   - Response includes `success: true`
   - Images upload correctly

#### 5.3 Test Unit Update

1. Update a unit's area value
2. Verify:
   - Unit is updated successfully
   - Area is converted to integer
   - updatedAt field updates automatically

#### 5.4 Test Database Triggers

```sql
-- Test UnitImage.updatedAt auto-update
UPDATE "UnitImage" 
SET caption = 'Test caption' 
WHERE id = 'some-image-id';

-- Verify updatedAt changed
SELECT id, caption, "updatedAt" 
FROM "UnitImage" 
WHERE id = 'some-image-id';

-- Test UnitOwner.updatedAt auto-update
UPDATE "UnitOwner" 
SET "ownershipPercentage" = 50.0 
WHERE id = 'some-owner-id';

-- Verify updatedAt changed
SELECT id, "ownershipPercentage", "updatedAt" 
FROM "UnitOwner" 
WHERE id = 'some-owner-id';
```

---

## Rollback Procedure

If issues occur, follow these steps:

### 1. Rollback Database Changes

```sql
-- Remove triggers
DROP TRIGGER IF EXISTS update_unit_image_updated_at_trigger ON "UnitImage";
DROP TRIGGER IF EXISTS update_unit_owner_updated_at_trigger ON "UnitOwner";

-- Remove functions
DROP FUNCTION IF EXISTS update_unit_image_updated_at();
DROP FUNCTION IF EXISTS update_unit_owner_updated_at();

-- Restore from backup if needed
psql -U your_user -d your_database < backup_YYYYMMDD_HHMMSS.sql
```

### 2. Rollback Code Changes

```bash
# Revert to previous commit
git revert <commit-hash>

# Or restore from backup
git checkout <previous-tag>
```

### 3. Restart Services

```bash
# Restart backend
pm2 restart buildstate-backend

# Redeploy frontend
vercel --prod
```

---

## Monitoring

### Key Metrics to Monitor

1. **Error Rates**:
   - Property creation errors
   - Unit creation errors
   - Image upload errors

2. **Response Times**:
   - Property creation endpoint
   - Unit creation endpoint
   - Image upload endpoint

3. **Database Performance**:
   - Query execution times
   - Trigger execution times
   - Index usage

### Log Monitoring

```bash
# Backend logs
tail -f logs/backend.log | grep -i "property\|unit"

# Database logs
tail -f /var/log/postgresql/postgresql.log | grep -i "trigger\|function"
```

---

## Troubleshooting

### Issue: Migration Fails

**Symptoms**: SQL errors during migration

**Solutions**:
1. Check database version compatibility
2. Verify user has necessary permissions
3. Check for existing triggers/functions
4. Review error messages carefully

### Issue: Backend Errors After Deployment

**Symptoms**: 500 errors, Prisma errors

**Solutions**:
1. Verify Prisma client is regenerated
2. Check database connection
3. Verify schema matches database
4. Check backend logs

### Issue: Frontend Errors

**Symptoms**: API calls failing, validation errors

**Solutions**:
1. Check browser console for errors
2. Verify API endpoints are accessible
3. Check CORS settings
4. Verify response format matches expectations

---

## Support

For issues or questions:
- See `PROPERTIES_WORKFLOW_COMPLETE_AUDIT_AND_FIXES.md` for detailed documentation
- See `PROPERTIES_WORKFLOW_FINAL_VERIFICATION.md` for verification checklist
- Check integration tests: `backend/__tests__/integration/properties-workflow.test.js`

---

**End of Deployment Guide**

