# Subscription System Setup Guide

This guide provides step-by-step instructions for setting up and configuring the complete subscription system for BuildState FM.

## Table of Contents

1. [Database Migration](#1-database-migration)
2. [Stripe Configuration](#2-stripe-configuration)
3. [Environment Variables](#3-environment-variables)
4. [Stripe Product Setup](#4-stripe-product-setup)
5. [Webhook Configuration](#5-webhook-configuration)
6. [Testing the System](#6-testing-the-system)
7. [Troubleshooting](#7-troubleshooting)

---

## 1. Database Migration

### Run Prisma Migration

The schema has been updated to include:
- **BASIC** plan (replaces STARTER)
- **StripeWebhookEvent** model for idempotency tracking

Run the migration:

```bash
cd backend
npx prisma migrate dev --name add-basic-plan-and-webhook-events
npx prisma generate
```

### Data Migration (if you have existing STARTER subscriptions)

If you have existing users with `STARTER` plan, update them to `BASIC`:

```sql
UPDATE "User"
SET "subscriptionPlan" = 'BASIC'
WHERE "subscriptionPlan" = 'STARTER';

UPDATE "Subscription"
SET "planId" = 'BASIC', "planName" = 'BASIC'
WHERE "planId" = 'STARTER' OR "planName" = 'STARTER';
```

---

## 2. Stripe Configuration

### Create a Stripe Account

1. Go to [https://stripe.com](https://stripe.com) and create an account
2. Verify your email and complete onboarding
3. Switch to **Test Mode** for development (toggle in top right)

### Get API Keys

1. Navigate to **Developers → API keys**
2. Copy your **Publishable key** (starts with `pk_test_...`)
3. Copy your **Secret key** (starts with `sk_test_...`)
4. **IMPORTANT**: Never commit these keys to version control

---

## 3. Environment Variables

### Backend (.env)

Add the following to your `backend/.env` file:

```env
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_your_secret_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
STRIPE_PRICE_ID_BASIC=price_your_basic_price_id
STRIPE_PRICE_ID_PROFESSIONAL=price_your_professional_price_id
STRIPE_PRICE_ID_ENTERPRISE=price_your_enterprise_price_id

# Optional: Stripe Checkout URLs
STRIPE_SUCCESS_URL=http://localhost:5173/subscriptions?success=1
STRIPE_CANCEL_URL=http://localhost:5173/subscriptions?canceled=1

# Frontend URL (for email links and redirects)
FRONTEND_URL=http://localhost:5173
```

### Frontend (.env)

```env
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key_here
```

### Production Deployment (Vercel/Render)

Add all environment variables in your deployment platform:

**Vercel:**
- Go to Project Settings → Environment Variables
- Add each variable for Production, Preview, and Development

**Render:**
- Go to Dashboard → Your Service → Environment
- Add each key-value pair

---

## 4. Stripe Product Setup

### Create Products and Prices

1. **Navigate to Products:**
   - Go to **Products** in the Stripe Dashboard
   - Click **+ Add Product**

2. **Create Basic Plan ($29/month):**
   - Name: `Basic Plan`
   - Description: `Up to 10 properties, 1 property manager, basic features`
   - Pricing:
     - Type: `Recurring`
     - Price: `$29.00 USD`
     - Billing period: `Monthly`
   - Click **Save product**
   - **Copy the Price ID** (starts with `price_...`)
   - Add to `.env` as `STRIPE_PRICE_ID_BASIC`

3. **Create Professional Plan ($79/month):**
   - Name: `Professional Plan`
   - Description: `Up to 50 properties, 5 team members, advanced features`
   - Pricing:
     - Type: `Recurring`
     - Price: `$79.00 USD`
     - Billing period: `Monthly`
   - Click **Save product**
   - **Copy the Price ID** (starts with `price_...`)
   - Add to `.env` as `STRIPE_PRICE_ID_PROFESSIONAL`

4. **Create Enterprise Plan ($149/month):**
   - Name: `Enterprise Plan`
   - Description: `Unlimited properties, unlimited team members, all features`
   - Pricing:
     - Type: `Recurring`
     - Price: `$149.00 USD`
     - Billing period: `Monthly`
   - Click **Save product**
   - **Copy the Price ID** (starts with `price_...`)
   - Add to `.env` as `STRIPE_PRICE_ID_ENTERPRISE`

### Enable Promotional Codes (Optional)

1. Go to **Products → Coupons**
2. Create discount codes (e.g., 20% off first month)
3. The checkout flow automatically supports promo codes

---

## 5. Webhook Configuration

### Why Webhooks Are Critical

Webhooks ensure your database stays in sync with Stripe when:
- Payments succeed or fail
- Subscriptions are updated or cancelled
- Cards expire or are updated
- Scheduled plan changes occur

### Create Webhook Endpoint

1. **Navigate to Webhooks:**
   - Go to **Developers → Webhooks**
   - Click **+ Add endpoint**

2. **Configure Endpoint:**
   - **Endpoint URL**: `https://your-domain.com/api/billing/webhook`
     - For local testing: Use [ngrok](https://ngrok.com) or [Stripe CLI](https://stripe.com/docs/stripe-cli)
     - Example with ngrok: `https://abc123.ngrok.io/api/billing/webhook`
   - **Description**: `BuildState FM Billing Webhook`

3. **Select Events to Listen To:**
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
   - `customer.subscription.schedule.created`

4. **Copy Webhook Secret:**
   - After saving, click on your webhook
   - Click **Reveal** next to "Signing secret"
   - Copy the secret (starts with `whsec_...`)
   - Add to `.env` as `STRIPE_WEBHOOK_SECRET`

### Local Testing with Stripe CLI

For local development:

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe  # macOS
# or download from https://stripe.com/docs/stripe-cli

# Login
stripe login

# Forward webhooks to local server
stripe listen --forward-to localhost:3000/api/billing/webhook

# This will print your webhook secret - add it to .env
```

---

## 6. Testing the System

### Test Checkout Flow

1. **Start your servers:**
   ```bash
   # Backend
   cd backend && npm run dev

   # Frontend
   cd frontend && npm run dev
   ```

2. **Create a test user:**
   - Sign up at `http://localhost:5173/signup`
   - You'll be on a 14-day free trial

3. **Test subscription:**
   - Go to `/subscriptions`
   - Click "Subscribe Now" on any plan
   - Use Stripe test card: `4242 4242 4242 4242`
   - Expiry: Any future date
   - CVC: Any 3 digits
   - ZIP: Any 5 digits

4. **Verify subscription:**
   - Check database: User should have `subscriptionStatus = 'ACTIVE'`
   - Check Stripe Dashboard: Should show active subscription
   - Test property limits:
     - Basic: Try creating 11 properties (should be blocked)
     - Professional: Should allow up to 50
     - Enterprise: Unlimited

### Test Webhook Events

1. **Trigger test events in Stripe:**
   - Go to **Developers → Events**
   - Click **Send test webhook**
   - Select event type (e.g., `invoice.payment_failed`)
   - Click **Send test webhook**

2. **Check logs:**
   ```bash
   # Backend logs should show:
   >>> INSIDE billing.js webhook handler <<<
   Processing invoice.payment_failed
   ```

3. **Verify database updates:**
   ```sql
   SELECT * FROM "StripeWebhookEvent" ORDER BY "createdAt" DESC LIMIT 10;
   ```

### Test Upgrade/Downgrade

1. Log in with an active subscriber
2. Go to `/subscriptions`
3. Click "Change Your Plan"
4. Click "Upgrade Now" or "Downgrade" on a different plan
5. Complete checkout
6. Verify:
   - Stripe shows the new subscription
   - Old subscription is cancelled
   - Proration credit/charge is applied
   - Database reflects new plan

### Test Cancellation

1. Go to `/subscriptions`
2. Scroll to "Billing Management"
3. Click "Cancel Subscription"
4. Choose "Cancel at Period End"
5. Verify:
   - User retains access until period end
   - Database shows subscription still ACTIVE
   - UI shows "Access until [date]"
   - After period end, webhook should update status to CANCELLED

---

## 7. Troubleshooting

### ❌ "Stripe is not configured" Error

**Cause**: Missing or invalid Stripe credentials

**Fix:**
1. Verify `STRIPE_SECRET_KEY` in backend `.env`
2. Ensure key starts with `sk_test_` (test mode) or `sk_live_` (production)
3. Restart backend server after updating `.env`

### ❌ "Unknown plan or missing price id" Error

**Cause**: `STRIPE_PRICE_ID_*` environment variables not set

**Fix:**
1. Create products in Stripe Dashboard (see Section 4)
2. Copy Price IDs and add to `.env`
3. Restart backend server

### ❌ Webhook signature verification failed

**Cause**: Incorrect `STRIPE_WEBHOOK_SECRET` or raw body parsing issue

**Fix:**
1. Verify `STRIPE_WEBHOOK_SECRET` in `.env` matches Stripe Dashboard
2. Ensure webhook endpoint uses raw body (already configured in `server.js`)
3. For ngrok: Use `https://` URL, not `http://`
4. Check backend logs for detailed error message

### ❌ "No active subscription found" for invoices/payment method

**Cause**: User's subscription record missing `stripeCustomerId`

**Fix:**
1. Check database:
   ```sql
   SELECT * FROM "Subscription" WHERE "userId" = 'user_id_here';
   ```
2. If missing, trigger a new checkout (old subscription may be corrupted)
3. Or manually update from Stripe Dashboard:
   ```sql
   UPDATE "Subscription"
   SET "stripeCustomerId" = 'cus_xxx', "stripeSubscriptionId" = 'sub_xxx'
   WHERE "userId" = 'user_id_here';
   ```

### ❌ Property limit not enforced

**Cause**: Subscription plan not set or middleware not applied

**Fix:**
1. Verify user has correct `subscriptionPlan` in database
2. Check that property creation route includes `requireActiveSubscription` middleware
3. Verify `subscriptionLimits.js` is imported correctly

### ❌ Database migration fails

**Cause**: Existing data conflicts with new schema

**Fix:**
1. Backup your database first:
   ```bash
   pg_dump your_database > backup.sql
   ```
2. Run data migration SQL (see Section 1)
3. Then run Prisma migration
4. If still failing, inspect error and adjust migration

---

## Subscription Plan Entitlements

### Basic Plan ($29/month)
- ✅ Up to 10 properties
- ✅ Unlimited units
- ✅ Basic inspections
- ✅ Job management
- ✅ Service requests
- ✅ 1 property manager
- ✅ Email support
- ✅ Mobile access
- ❌ Maintenance plans & scheduling
- ❌ Analytics dashboard
- ❌ Recurring inspections
- ❌ Custom inspection templates
- ❌ API access

### Professional Plan ($79/month)
- ✅ Up to 50 properties
- ✅ Unlimited units
- ✅ Advanced inspections with templates
- ✅ Job management
- ✅ Service requests
- ✅ Up to 5 team members
- ✅ Priority email support
- ✅ Mobile access
- ✅ Maintenance plans & scheduling
- ✅ Analytics dashboard
- ✅ Recurring inspections
- ✅ Technician & owner invites
- ❌ Custom inspection templates
- ❌ Audit trails & compliance
- ❌ API access

### Enterprise Plan ($149/month)
- ✅ Unlimited properties
- ✅ Unlimited units
- ✅ Advanced inspections with templates
- ✅ Job management
- ✅ Service requests
- ✅ Unlimited team members
- ✅ Dedicated support
- ✅ Mobile access
- ✅ Maintenance plans & scheduling
- ✅ Advanced analytics & reporting
- ✅ Custom inspection templates
- ✅ Audit trails & compliance
- ✅ API access
- ✅ Custom integrations

---

## Production Deployment Checklist

- [ ] Run database migration in production
- [ ] Set all Stripe environment variables (production keys)
- [ ] Create production Stripe products and prices
- [ ] Configure production webhook endpoint (use production domain)
- [ ] Enable Stripe production mode
- [ ] Test checkout flow end-to-end in production
- [ ] Verify webhooks are received and processed
- [ ] Monitor logs for errors
- [ ] Set up Stripe Dashboard alerts for payment failures
- [ ] Document customer support procedures for billing issues

---

## Support

If you encounter issues not covered here:

1. Check backend logs for detailed error messages
2. Verify all environment variables are set correctly
3. Test with Stripe test cards before using real cards
4. Review Stripe Dashboard events for detailed webhook data
5. Check database for subscription and webhook event records

For Stripe-specific issues, consult:
- [Stripe Documentation](https://stripe.com/docs)
- [Stripe Support](https://support.stripe.com)
- [Stripe API Reference](https://stripe.com/docs/api)
