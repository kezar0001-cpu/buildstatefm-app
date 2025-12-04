# Prisma Migration Guide

## Recent Changes

### Downgrade from Prisma 7 to Prisma 6.19.0

We've downgraded from Prisma 7.1.0 to Prisma 6.19.0 due to compatibility and stability issues.

### Added Direct Database URL Support

The Prisma schema now includes `directUrl` configuration, which is essential for databases that use connection pooling (like Neon).

## Environment Configuration

### Required Environment Variables

You need to set up two database URLs in your `.env` file:

1. **DATABASE_URL**: The pooled connection string (for regular queries)
2. **DIRECT_URL**: The direct (non-pooled) connection string (for migrations)

#### For Neon Database:

Neon provides two types of connection strings:

- **Pooled connection** (with pgbouncer): Use this for `DATABASE_URL`
  ```
  DATABASE_URL="postgresql://user:password@ep-xxx.pooler.neon.tech/dbname?pgbouncer=true"
  ```

- **Direct connection** (without pgbouncer): Use this for `DIRECT_URL`
  ```
  DIRECT_URL="postgresql://user:password@ep-xxx.neon.tech/dbname"
  ```

You can find both connection strings in your Neon dashboard:
1. Go to your Neon project
2. Navigate to the "Connection Details" section
3. Toggle between "Pooled connection" and "Direct connection"

#### For Local Development:

If you're using a local PostgreSQL database, both URLs can be the same:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/agentfm"
DIRECT_URL="postgresql://user:password@localhost:5432/agentfm"
```

## Fixing Migration Drift

If you have migration drift between your Prisma schema and your Neon database, follow these steps:

### Step 1: Check Migration Status

```bash
cd backend
npx prisma migrate status
```

This will show you which migrations are pending or out of sync.

### Step 2: Resolve the Drift

**Option A: If you're in development and it's safe to reset**

```bash
# WARNING: This will delete all data!
npx prisma migrate reset
```

**Option B: If you have production data (recommended)**

1. First, check what migrations are applied in the database:
   ```bash
   npx prisma migrate status
   ```

2. If migrations are pending, deploy them:
   ```bash
   npx prisma migrate deploy
   ```

3. If the schema has changes not reflected in migrations:
   ```bash
   # Create a new migration for the changes
   npx prisma migrate dev --name fix_schema_drift
   ```

4. If there are manual changes in the database not in the schema:
   ```bash
   # Pull the database schema into Prisma
   npx prisma db pull

   # Then create a migration
   npx prisma migrate dev --name sync_with_database
   ```

### Step 3: Generate Prisma Client

After resolving drift, regenerate the Prisma client:

```bash
npx prisma generate
```

## Handling Standalone Migration Files

If you see standalone SQL files in the `migrations` folder (like `add_basic_enum.sql`), these need to be applied manually or converted to proper Prisma migrations:

1. **Check if already applied**: Connect to your database and verify if the changes exist
2. **Apply manually**: If not applied, run the SQL directly on your database
3. **Clean up**: Once applied, consider moving these files to a `manual-migrations` folder for documentation

## Troubleshooting

### Error: "Failed to fetch engine file" (403 Forbidden)

This can happen in restricted network environments. Solutions:

1. **Use a VPN or different network** if possible
2. **Download engines manually**:
   ```bash
   PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1 npx prisma generate
   ```
3. **Use pre-built binaries**:
   ```bash
   # Set environment variable
   export PRISMA_ENGINES_MIRROR=https://your-mirror-url
   ```

### Error: "Migration failed to apply"

1. Check your `DIRECT_URL` is configured correctly
2. Ensure the database user has proper permissions
3. Review the migration SQL for any issues
4. Check database logs for specific errors

### Schema Drift Warnings

If Prisma warns about schema drift:

1. Use `npx prisma db pull` to sync from database
2. Use `npx prisma migrate dev` to create migrations from schema
3. Review changes carefully before applying

## Best Practices

1. **Always backup your database** before running migrations in production
2. **Test migrations locally** before deploying to production
3. **Use `migrate deploy`** in production, not `migrate dev`
4. **Keep migrations folder in version control** to track schema changes
5. **Document manual SQL changes** that can't be expressed in Prisma schema

## Production Deployment Checklist

- [ ] Update `.env` with both `DATABASE_URL` and `DIRECT_URL`
- [ ] Test migrations in staging environment first
- [ ] Backup production database
- [ ] Run `npx prisma migrate deploy` (not `migrate dev`)
- [ ] Verify application starts successfully
- [ ] Check database connection pooling is working
- [ ] Monitor for any runtime errors

## Additional Resources

- [Prisma Migration Guide](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- [Neon Database Documentation](https://neon.tech/docs/introduction)
- [Connection Pooling with Prisma](https://www.prisma.io/docs/guides/performance-and-optimization/connection-management)
