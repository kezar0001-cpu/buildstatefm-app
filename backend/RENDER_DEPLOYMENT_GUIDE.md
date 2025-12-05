# Render Deployment Guide - Fixing Prisma Migration Issues

## Current Issue

Your deployment is failing with:
```
Error: P1001: Can't reach database server at `ep-dark-credit-abk6f688.eu-west-2.aws.neon.tech:5432`
```

This happens during `npx prisma migrate deploy` because the `DIRECT_URL` environment variable is not properly configured in Render.

## Quick Fix Steps

### Step 1: Get Your Neon Connection Strings

1. Go to your [Neon Console](https://console.neon.tech)
2. Select your project
3. Navigate to **Connection Details**
4. You'll see two types of connection strings:

   **Pooled Connection (for queries):**
   ```
   postgresql://user:password@ep-dark-credit-abk6f688-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require
   ```

   **Direct Connection (for migrations):**
   ```
   postgresql://user:password@ep-dark-credit-abk6f688.eu-west-2.aws.neon.tech/neondb?sslmode=require
   ```

   Note: The direct connection does NOT include `-pooler` in the hostname.

### Step 2: Configure Render Environment Variables

1. Go to your Render Dashboard
2. Select your backend service
3. Go to **Environment** tab
4. Add or update these variables:

   | Variable | Value |
   |----------|-------|
   | `DATABASE_URL` | Your **pooled** connection string from Neon |
   | `DIRECT_URL` | Your **direct** connection string from Neon |

   **Important:**
   - Make sure BOTH variables are set
   - The direct URL should NOT include `pgbouncer` or `-pooler` in the hostname
   - Both should include `?sslmode=require` at the end

### Step 3: Verify Your Neon Database

Before redeploying, verify your Neon database is active:

1. In Neon Console, check if your project shows "Active"
2. If it shows "Suspended", click to activate it
3. Free tier Neon databases auto-suspend after inactivity
4. Ensure your database has not been deleted

### Step 4: Redeploy

After setting the environment variables:
1. Click **Manual Deploy** in Render
2. Or push a new commit to trigger automatic deployment

## Understanding the Error

### Why Two URLs?

- **DATABASE_URL (Pooled)**: Used for application queries, provides connection pooling for better performance
- **DIRECT_URL (Direct)**: Used for migrations, bypasses the connection pooler to ensure migrations work correctly

### Common Mistakes

1. **Not setting DIRECT_URL at all** → Prisma can't connect during migrations
2. **Using the same pooled URL for both** → May cause migration issues
3. **Typo in the connection string** → Connection fails
4. **Database suspended** → Neon free tier auto-suspends inactive databases

## Troubleshooting

### Test Your Connection Strings Locally

Create a test script to verify your connection strings work:

```javascript
// test-connection.js
import pg from 'pg';

const { Client } = pg;

async function testConnection(url, name) {
  const client = new Client({ connectionString: url });
  try {
    await client.connect();
    console.log(`✅ ${name} connection successful`);
    await client.end();
    return true;
  } catch (error) {
    console.error(`❌ ${name} connection failed:`, error.message);
    return false;
  }
}

// Test both connections
await testConnection(process.env.DATABASE_URL, 'Pooled');
await testConnection(process.env.DIRECT_URL, 'Direct');
```

Run with:
```bash
node test-connection.js
```

### Check Render Logs

Look for these in your Render build logs:

1. **Connection string being used**: The error shows which host Prisma is trying to connect to
2. **SSL/TLS errors**: Ensure `?sslmode=require` is in your connection string
3. **Timeout errors**: Check if Neon database is suspended

### Verify Environment Variables in Render

In the Render dashboard:
1. Go to Environment tab
2. Check that DIRECT_URL shows the right value
3. Make sure there are no extra spaces or quotes
4. Connection strings should start with `postgresql://`

### Alternative: Use Same URL for Both (Temporary)

If you can't get the direct connection working, temporarily set both to the same value:

```bash
DATABASE_URL=your_pooled_connection_string
DIRECT_URL=your_pooled_connection_string
```

This is NOT recommended for production but can help you deploy while troubleshooting.

## Neon-Specific Notes

### Free Tier Limitations

- Auto-suspends after 5 minutes of inactivity
- First query after suspension may be slow (cold start)
- Limited to 1 project and 10 branches

### Activation

If your database is suspended:
1. Go to Neon Console
2. Click on your project
3. Click "Activate" if you see a suspended notice
4. Wait for it to become active (usually < 30 seconds)

### Connection String Format

Neon provides connection strings in this format:

```
postgresql://[user]:[password]@[endpoint].[region].aws.neon.tech/[database]?sslmode=require
```

**Pooled endpoint** includes `-pooler`:
```
ep-dark-credit-abk6f688-pooler.eu-west-2.aws.neon.tech
```

**Direct endpoint** does NOT include `-pooler`:
```
ep-dark-credit-abk6f688.eu-west-2.aws.neon.tech
```

## After Successful Deployment

Once your deployment succeeds, you should see:

```
✔ Generated Prisma Client (v6.19.0)
Prisma schema loaded from prisma/schema.prisma
Datasource "db": PostgreSQL database "neondb"
Database migrations completed successfully
```

## Need More Help?

1. **Check Render Status**: https://status.render.com
2. **Check Neon Status**: https://neon.tech/status
3. **Render Docs**: https://render.com/docs/databases
4. **Neon Docs**: https://neon.tech/docs/connect/connection-pooling

## Checklist

Before each deployment, verify:

- [ ] Neon database is active (not suspended)
- [ ] `DATABASE_URL` is set in Render environment
- [ ] `DIRECT_URL` is set in Render environment
- [ ] Both URLs include `?sslmode=require`
- [ ] Direct URL does NOT include `-pooler`
- [ ] Connection strings match your Neon dashboard
- [ ] No extra spaces or quotes in environment variables
