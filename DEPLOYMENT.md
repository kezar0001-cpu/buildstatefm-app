# Deployment Guide for Buildstate FM (Buildstate)

## Overview
This guide covers the deployment configuration for the Buildstate FM application, including environment variables, domain setup, and troubleshooting.

## Architecture

### Domains
- **Frontend**: https://www.buildstate.com.au (Vercel)
- **API Backend**: https://api.buildstate.com.au (Render/Railway/etc.)
- **Alternative Frontend**: https://agentfm.vercel.app

### Technology Stack
- **Frontend**: Vite + React (Static SPA)
- **Backend**: Node.js + Express + Prisma
- **Database**: PostgreSQL
- **Hosting**: Vercel (Frontend), Render (Backend)

## Environment Variables

### Frontend Environment Variables (Vercel)

Set these in your Vercel project settings under "Environment Variables":

```bash
# API Base URL - Points to the backend API
VITE_API_BASE_URL=https://api.buildstate.com.au

# Optional: Google OAuth (if using)
VITE_GOOGLE_CLIENT_ID=your-google-client-id
```

**Important Notes:**
- The `VITE_` prefix is required for Vite to expose variables to the client
- If `VITE_API_BASE_URL` is not set, the app will use sensible defaults:
  - Development: `http://localhost:3000`
  - Production: `https://api.buildstate.com.au`
- These variables are baked into the build at build-time, not runtime

### Backend Environment Variables (Render/Railway)

Set these in your backend hosting platform:

```bash
# Database
DATABASE_URL=postgresql://user:password@host:5432/database

# Server
PORT=3000
NODE_ENV=production

# Security
JWT_SECRET=your-secure-random-jwt-secret-min-32-chars
SESSION_SECRET=your-secure-random-session-secret-min-32-chars

# Frontend URLs (for CORS)
FRONTEND_URL=https://www.buildstate.com.au
CORS_ORIGINS=https://www.buildstate.com.au,https://buildstate.com.au,https://agentfm.vercel.app

# Google OAuth (optional)
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=https://api.buildstate.com.au/api/auth/google/callback

# Stripe (optional)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID_STARTER=price_...
STRIPE_PRICE_ID_PROFESSIONAL=price_...
STRIPE_PRICE_ID_ENTERPRISE=price_...
STRIPE_SUCCESS_URL=https://www.buildstate.com.au/subscriptions?success=1
STRIPE_CANCEL_URL=https://www.buildstate.com.au/subscriptions?canceled=1
```

## Vercel Configuration

### vercel.json

The `frontend/vercel.json` file configures:

1. **API Rewrites**: Proxies `/api/*` requests to the backend
2. **SPA Routing**: Fallback to `/` for client-side routing
3. **CORS Headers**: Ensures credentials are passed correctly

```json
{
  "framework": "vite",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://api.buildstate.com.au/api/:path*"
    },
    {
      "source": "/(.*)",
      "destination": "/"
    }
  ],
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        {
          "key": "Access-Control-Allow-Credentials",
          "value": "true"
        }
      ]
    }
  ]
}
```

**Why this is needed:**
- Without the API rewrite, requests to `/api/auth/login` would go to `www.buildstate.com.au/api/auth/login` (which doesn't exist)
- With the rewrite, they're proxied to `api.buildstate.com.au/api/auth/login` (the actual backend)

## Backend CORS Configuration

The backend (`backend/src/index.js`) is configured to accept requests from:

```javascript
const allowlist = new Set([
  'https://www.buildstate.com.au',
  'https://buildstate.com.au',
  'https://api.buildstate.com.au',
  'https://agentfm.vercel.app',
  'http://localhost:5173',  // Development
  'http://localhost:3000',  // Development
]);
```

**Session Cookies:**
```javascript
cookie: {
  secure: process.env.NODE_ENV === 'production',  // HTTPS only in production
  httpOnly: true,                                  // Prevent XSS
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',  // Cross-domain
  maxAge: 7 * 24 * 60 * 60 * 1000,               // 7 days
}
```

## Deployment Steps

### Initial Setup

1. **Deploy Backend First**
   ```bash
   cd backend
   # Set all environment variables in your hosting platform
   # Deploy to Render/Railway/etc.
   # Note the deployed URL (e.g., https://api.buildstate.com.au)
   ```

2. **Configure DNS**
   - Point `api.buildstate.com.au` to your backend hosting
   - Point `www.buildstate.com.au` to Vercel

3. **Deploy Frontend**
   ```bash
   cd frontend
   # Set VITE_API_BASE_URL in Vercel environment variables
   # Deploy to Vercel
   ```

### Updating the Application

**Frontend Changes:**
```bash
git push origin main
# Vercel auto-deploys on push
```

**Backend Changes:**
```bash
git push origin main
# Render/Railway auto-deploys on push
# Or manually trigger deployment
```

**Environment Variable Changes:**
- Frontend: Update in Vercel dashboard → Redeploy
- Backend: Update in hosting platform → Restart service

## Troubleshooting

### Issue: Blank Page on www.buildstate.com.au

**Symptoms:**
- Page loads but shows nothing
- Console shows network errors
- API calls fail with 404 or CORS errors

**Causes & Solutions:**

1. **Missing VITE_API_BASE_URL**
   - **Check**: Vercel environment variables
   - **Fix**: Set `VITE_API_BASE_URL=https://api.buildstate.com.au`
   - **Verify**: The code now has a fallback, but explicit is better

2. **API Rewrite Not Working**
   - **Check**: `frontend/vercel.json` has the rewrite rule
   - **Fix**: Ensure the rewrite is before the SPA fallback
   - **Verify**: Network tab should show requests going to `api.buildstate.com.au`

3. **CORS Errors**
   - **Check**: Backend CORS configuration includes frontend domain
   - **Fix**: Add `www.buildstate.com.au` to `CORS_ORIGINS`
   - **Verify**: Response headers include `Access-Control-Allow-Origin`

4. **Cookie Issues**
   - **Check**: Backend session configuration
   - **Fix**: Ensure `sameSite: 'none'` and `secure: true` in production
   - **Verify**: Cookies are set in browser dev tools

### Issue: API Calls Return 401 Unauthorized

**Causes & Solutions:**

1. **Token Not Stored**
   - **Check**: localStorage has `auth_token`
   - **Fix**: Login again
   - **Verify**: Token is included in Authorization header

2. **Token Expired**
   - **Check**: JWT expiration (default 7 days)
   - **Fix**: Login again
   - **Verify**: New token is issued

3. **Wrong JWT Secret**
   - **Check**: Backend `JWT_SECRET` environment variable
   - **Fix**: Ensure it matches across deployments
   - **Verify**: Token can be decoded with the secret

### Issue: Google OAuth Not Working

**Causes & Solutions:**

1. **Redirect URI Mismatch**
   - **Check**: Google Cloud Console → OAuth consent screen
   - **Fix**: Add `https://api.buildstate.com.au/api/auth/google/callback`
   - **Verify**: Callback URL matches exactly

2. **Missing Environment Variables**
   - **Check**: Backend has `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`
   - **Fix**: Set both variables
   - **Verify**: Backend logs show "✅ Google OAuth enabled"

### Issue: Stripe Webhooks Failing

**Causes & Solutions:**

1. **Wrong Webhook Secret**
   - **Check**: Stripe dashboard → Webhooks
   - **Fix**: Copy the signing secret to `STRIPE_WEBHOOK_SECRET`
   - **Verify**: Webhook events show as successful

2. **Webhook URL Incorrect**
   - **Check**: Stripe webhook endpoint
   - **Fix**: Set to `https://api.buildstate.com.au/api/billing/webhook`
   - **Verify**: Test webhook in Stripe dashboard

## Testing Checklist

### Pre-Deployment
- [ ] All environment variables set
- [ ] Database migrations run
- [ ] Build succeeds locally
- [ ] Tests pass

### Post-Deployment
- [ ] Frontend loads without errors
- [ ] API calls reach backend
- [ ] Login works (email/password)
- [ ] Google OAuth works (if enabled)
- [ ] Session persists across page reloads
- [ ] CORS headers present
- [ ] Cookies are set correctly
- [ ] Images upload successfully
- [ ] Stripe checkout works (if enabled)

## Monitoring

### Frontend (Vercel)
- **Logs**: Vercel dashboard → Deployments → Logs
- **Analytics**: Vercel dashboard → Analytics
- **Errors**: Browser console + Vercel logs

### Backend (Render/Railway)
- **Logs**: Hosting platform dashboard → Logs
- **Health Check**: `https://api.buildstate.com.au/health`
- **Errors**: Server logs + error tracking service

### Database
- **Connection**: Check `DATABASE_URL` is correct
- **Migrations**: Ensure all migrations are applied
- **Performance**: Monitor query performance

## Security Checklist

- [ ] JWT_SECRET is strong and unique (min 32 chars)
- [ ] SESSION_SECRET is strong and unique (min 32 chars)
- [ ] DATABASE_URL uses SSL in production
- [ ] CORS origins are explicitly listed (no wildcards)
- [ ] Cookies use `secure: true` in production
- [ ] Cookies use `httpOnly: true`
- [ ] API rate limiting enabled (if applicable)
- [ ] Sensitive data not logged
- [ ] Environment variables not committed to git

## Rollback Procedure

### Frontend Rollback
1. Go to Vercel dashboard
2. Navigate to Deployments
3. Find the last working deployment
4. Click "Promote to Production"

### Backend Rollback
1. Go to hosting platform dashboard
2. Navigate to Deployments
3. Rollback to previous version
4. Or: `git revert <commit>` and push

## Support

### Documentation
- Frontend: `frontend/README.md`
- Backend: `backend/README.md`
- Properties Workflow: `frontend/docs/PROPERTIES_WORKFLOW.md`

### Common Commands
```bash
# Check frontend build
cd frontend && npm run build

# Check backend locally
cd backend && npm run dev

# Test API endpoint
curl https://api.buildstate.com.au/health

# Check environment variables (Vercel)
vercel env ls

# Check environment variables (Render)
# Use the dashboard or CLI
```

### Getting Help
1. Check this documentation
2. Review error logs
3. Check browser console
4. Verify environment variables
5. Test API endpoints directly
6. Contact development team

## Additional Resources

- [Vite Environment Variables](https://vitejs.dev/guide/env-and-mode.html)
- [Vercel Rewrites](https://vercel.com/docs/concepts/projects/project-configuration#rewrites)
- [Express CORS](https://expressjs.com/en/resources/middleware/cors.html)
- [Prisma Deployment](https://www.prisma.io/docs/guides/deployment)
