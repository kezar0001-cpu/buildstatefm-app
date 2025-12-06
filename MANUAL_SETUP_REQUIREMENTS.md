# Manual Setup Requirements for Buildstate FM

This document outlines all manual configuration steps required before the application can function correctly in production.

## Critical Setup Steps

### 1. Environment Variables

#### Backend (Render/Production Server)

**REQUIRED - Application will not start without these:**
```env
DATABASE_URL=postgresql://user:password@host:port/database
JWT_SECRET=<min 32 characters, use strong random string>
NODE_ENV=production
FRONTEND_URL=https://www.buildstate.com.au
```

**REQUIRED for File Uploads:**
```env
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=<your-access-key>
AWS_SECRET_ACCESS_KEY=<your-secret-key>
AWS_S3_BUCKET_NAME=<your-bucket-name>
```

**OPTIONAL but Recommended:**
```env
REDIS_URL=redis://host:port
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
RESEND_API_KEY=re_...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
ANTHROPIC_API_KEY=...
UNSPLASH_ACCESS_KEY=...
DIRECT_URL=<for Prisma migrations, same as DATABASE_URL>
```

#### Frontend (Vercel/Production)

**REQUIRED:**
```env
VITE_API_BASE_URL=https://api.buildstate.com.au
```

**What breaks if missing:**
- `DATABASE_URL`: Backend cannot connect to database, application crashes
- `JWT_SECRET`: Authentication completely fails, users cannot log in
- `AWS_*`: File uploads fail, images/documents cannot be stored
- `VITE_API_BASE_URL`: Frontend cannot communicate with backend

### 2. AWS S3 Bucket Configuration

**Steps:**
1. Create S3 bucket in AWS Console
2. Configure CORS settings:
```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
    "AllowedOrigins": ["https://www.buildstate.com.au", "http://localhost:5173"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```
3. Set bucket policy for public read access (if needed for images)
4. Configure lifecycle policies for cost optimization
5. Enable versioning (optional but recommended)

**What breaks if not done:**
- All file uploads fail with 500 errors
- Images cannot be displayed
- Documents cannot be uploaded or accessed

### 3. Stripe Configuration

**Steps:**
1. Create Stripe account
2. Get API keys from Stripe Dashboard
3. Configure webhook endpoint: `https://api.buildstate.com.au/api/stripe/webhook`
4. Add webhook events:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
5. Copy webhook signing secret to `STRIPE_WEBHOOK_SECRET`

**What breaks if not done:**
- Subscription management fails
- Payment processing does not work
- Users cannot upgrade/downgrade plans
- Webhook events are not processed

### 4. Database Setup

**Steps:**
1. Create PostgreSQL database (Neon, AWS RDS, or other provider)
2. Run Prisma migrations:
```bash
cd backend
npx prisma migrate deploy
```
3. Verify connection with test script
4. Set up database backups (automated daily recommended)

**What breaks if not done:**
- Application cannot start
- All data operations fail
- Schema is not initialized

### 5. OAuth Configuration (if using Google OAuth)

**Steps:**
1. Go to Google Cloud Console
2. Create OAuth 2.0 credentials
3. Add authorized redirect URIs:
   - `https://www.buildstate.com.au/auth/callback`
   - `http://localhost:5173/auth/callback` (for development)
4. Copy Client ID and Secret to environment variables

**What breaks if not done:**
- Google OAuth login fails
- Users cannot sign in with Google

### 6. Email Service (Resend)

**Steps:**
1. Create Resend account
2. Verify domain (if using custom domain)
3. Get API key from dashboard
4. Add to `RESEND_API_KEY` environment variable

**What breaks if not done:**
- Email notifications do not send
- Password reset emails fail
- Invitation emails fail

### 7. Cron Jobs Setup

**For Maintenance Plans:**
- Ensure cron job is enabled: `ENABLE_MAINTENANCE_PLAN_CRON=true`
- Verify cron schedule in `backend/src/cron/maintenancePlans.js`
- Test that jobs are created on schedule

**For Recurring Inspections:**
- Ensure cron job is enabled: `ENABLE_RECURRING_INSPECTION_CRON=true`
- Verify cron schedule in `backend/src/services/recurringInspectionService.js`

**What breaks if not done:**
- Recurring maintenance jobs are not automatically created
- Recurring inspections are not generated
- Scheduled tasks do not run

### 8. Redis Setup (Optional but Recommended)

**Steps:**
1. Create Redis instance (AWS ElastiCache, Redis Cloud, etc.)
2. Get connection URL
3. Add to `REDIS_URL` environment variable

**What breaks if not done:**
- Caching does not work (performance impact)
- Dashboard data may load slower
- No impact on core functionality

## Verification Checklist

Before going live, verify:

- [ ] All environment variables are set
- [ ] Database migrations have been run
- [ ] S3 bucket is accessible and CORS is configured
- [ ] Stripe webhook is configured and tested
- [ ] Email service is working (test password reset)
- [ ] OAuth redirects are configured (if using)
- [ ] Cron jobs are enabled and running
- [ ] Frontend can connect to backend API
- [ ] File uploads work end-to-end
- [ ] Authentication flow works
- [ ] Subscription flow works

## Testing Each Component

### Test Database Connection
```bash
cd backend
node test-db-connection.js
```

### Test S3 Upload
- Create a property and upload an image
- Verify image appears in S3 bucket
- Verify image URL is accessible

### Test Stripe Integration
- Create a test subscription
- Verify webhook receives events
- Check subscription status updates

### Test Email Service
- Request password reset
- Verify email is received
- Check email formatting

## Support Contacts

If any manual setup fails:
- AWS: Check AWS Console and IAM permissions
- Stripe: Check Stripe Dashboard webhook logs
- Database: Check connection string and network access
- Email: Check Resend dashboard for delivery status

