# Fixing Neon Database Connection Issues

## Your Current Error

```
Error: P1001: Can't reach database server at `ep-dark-credit-abk6f688.eu-west-2.aws.neon.tech:5432`
```

Since you confirmed both `DATABASE_URL` and `DIRECT_URL` are configured in Render, the issue is that Prisma cannot reach your Neon database.

## Most Likely Cause: Database Suspended

Neon free tier databases **auto-suspend after 5 minutes of inactivity**. This is the most common cause of P1001 errors.

### How to Fix:

1. **Go to Neon Console**: https://console.neon.tech
2. **Select your project** with endpoint `ep-dark-credit-abk6f688`
3. **Check the status**:
   - If it says "Suspended" or "Inactive" → Click "Activate"
   - Wait 10-30 seconds for it to become active
4. **Immediately redeploy** in Render while the database is active

### Keep Database Active During Deploy

During Render deployment:
- Go to Neon Console
- Keep the browser tab open on your project
- This sometimes helps keep the connection alive
- Or run a simple query in the Neon SQL Editor to wake it up

## Other Possible Causes

### 1. Connection String Has Changed

Neon occasionally rotates endpoints. Verify your connection strings:

1. In Neon Console, go to **Connection Details**
2. Copy the **FRESH** connection strings (both pooled and direct)
3. Update them in Render environment variables:
   - `DATABASE_URL`: Should include `-pooler` in hostname
   - `DIRECT_URL`: Should NOT include `-pooler`

**Example:**
```bash
# Pooled (for DATABASE_URL)
postgresql://user:pass@ep-dark-credit-abk6f688-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require

# Direct (for DIRECT_URL)
postgresql://user:pass@ep-dark-credit-abk6f688.eu-west-2.aws.neon.tech/neondb?sslmode=require
```

### 2. Verify SSL Mode

Ensure both connection strings end with `?sslmode=require` or `?ssl=true`

### 3. Check Neon Project Status

1. Go to Neon Console
2. Check if your project shows any warnings or errors
3. Verify you haven't hit free tier limits:
   - Storage limit: 512 MB
   - Compute time limit: Check your usage

### 4. Test Connection Locally

Create a file `test-neon.js` in your backend:

```javascript
import pg from 'pg';
const { Client } = pg;

async function testNeonConnection() {
  const directUrl = 'YOUR_DIRECT_URL_HERE'; // Paste from Neon Console

  console.log('Testing connection to:', directUrl.split('@')[1].split('/')[0]);

  const client = new Client({
    connectionString: directUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connection successful!');

    const result = await client.query('SELECT version()');
    console.log('PostgreSQL version:', result.rows[0].version);

    await client.end();
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    console.error('Error code:', error.code);
  }
}

testNeonConnection();
```

Run with:
```bash
node test-neon.js
```

If this fails locally, the issue is with your Neon database or connection string, not Render.

## Migration Drift Issue

You mentioned there's drift between migrations and the database. This might be because:

1. **Migrations were applied directly to the database** (not through Prisma)
2. **Database was reset** but migrations weren't
3. **Manual schema changes** were made

### How to Resolve Drift

Once the connection is working, run these commands:

**Option 1: Reset and Reapply (if safe to delete data)**
```bash
# Locally with your Neon connection strings in .env
npx prisma migrate reset
npx prisma migrate deploy
```

**Option 2: Mark Migrations as Applied (if database schema is correct)**
```bash
# This tells Prisma the migrations are already applied
npx prisma migrate resolve --applied "MIGRATION_NAME"
```

**Option 3: Baseline (if database has schema but no migration history)**
```bash
# Create a baseline migration
npx prisma migrate resolve --applied "0_init"
```

### Check Current Migration Status

Once connected, run:
```bash
npx prisma migrate status
```

This will show:
- Which migrations are pending
- Which migrations have been applied
- If there's any drift

## Standalone Migration Files

I noticed you have standalone SQL files in the migrations folder:
- `add_basic_enum.sql`
- `add_property_id_to_recommendations_standalone.sql`

These are NOT automatically applied by Prisma. You need to:

1. **Connect to Neon SQL Editor**
2. **Run these SQL files manually**, or
3. **Convert them to proper Prisma migrations**

### To check if they've been applied:

```sql
-- Check if BASIC enum value exists
SELECT unnest(enum_range(NULL::"SubscriptionPlan"));

-- Check if recommendations table has propertyId
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'Recommendation' AND column_name = 'propertyId';
```

## Quick Deployment Fix

If you need to deploy ASAP while troubleshooting:

1. **Temporarily skip migrations** in your build command:
   ```bash
   # In Render, change build command to:
   npm ci && npx prisma generate
   ```

2. **Deploy the app**

3. **Run migrations manually** after deployment:
   - SSH into your Render instance, or
   - Use Render Shell
   - Run: `npx prisma migrate deploy`

## Action Plan

1. ✅ **Activate Neon Database**
   - Go to console.neon.tech
   - Ensure project is active

2. ✅ **Verify Connection Strings**
   - Get fresh strings from Neon
   - Update in Render if different

3. ✅ **Redeploy Immediately**
   - While database is active
   - Monitor the build logs

4. ✅ **Fix Drift After Deployment**
   - Once app is running
   - Handle migration drift separately

## Still Having Issues?

If the problem persists:

1. **Share the exact DIRECT_URL format** (mask password):
   ```
   postgresql://user:****@ep-dark-credit-abk6f688.eu-west-2.aws.neon.tech/neondb?sslmode=require
   ```

2. **Check if Neon project is in the correct region** (eu-west-2 in your case)

3. **Try creating a new Neon database** as a test

4. **Contact Neon support** if the database appears active but can't be reached

5. **Check Render's network status** for any ongoing issues
