# How to Fix the "npm error Missing: ... from lock file" Deploys

Your Render deployment is failing because it is running `npm ci` (which requires a perfect lockfile match) instead of `npm install` (which we need for the recent Prisma updates).

**The System is IGNORING the `render.yaml` configuration because you have likely set a manual Build Command in the Render Dashboard.**

## 🛑 REQUIRED Manual Step

1.  **Log in to Render**: [dashboard.render.com](https://dashboard.render.com/)
2.  Click on your **Backend Service** (`agentfm-backend`).
3.  Click on **Settings** in the left sidebar.
4.  Scroll down to the **Build & Deploy** section.
5.  Find the **Build Command** field.

### If there is text in the Build Command box:

**OPTION A (Recommended):**
Delete all the text in the box and save. This will force Render to use the command we defined in your `render.yaml` file, which is already correctly set up.

**OPTION B (Manual Override):**
Replace the existing text with this EXACT command:

```bash
npm install && npx prisma generate && node -e "const pg = require('pg'); const url = process.env.DIRECT_URL || process.env.DATABASE_URL; const check = async (retries = 20) => { if (retries <= 0) { console.error('Aborting: Database unreachable'); process.exit(1); } try { const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 10000 }); await client.connect(); console.log('✅ Database protocol handshake successful'); await client.end(); process.exit(0); } catch (e) { console.log('⏳ Waiting for database credentials check... (' + retries + ') ' + e.message); await new Promise(r => setTimeout(r, 3000)); return check(retries - 1); } }; check();" && npx prisma migrate deploy
```

### If the box is already empty:

1.  Double-check you are looking at the **Backend** service.
2.  Go to the **Frontend** service and check its settings too. Ideally, clear that Build Command as well, or set it to `npm install && npm run build`.

## 🚀 After Saving:

Trigger a **Manual Deploy** of the latest commit.

The build will now use `npm install`, which will automatically resolve the `Missing... from lock file` errors and allow the deployment to succeed.
