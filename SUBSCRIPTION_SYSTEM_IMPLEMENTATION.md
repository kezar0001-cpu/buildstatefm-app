# Subscription System Implementation - Complete Guide

## Implementation Summary

This document outlines the complete redesign and implementation of the BuildState FM subscription system based on a **usage-based SaaS model**.

### Core Philosophy

**All subscription tiers (Basic $29, Professional $79, Enterprise $149) receive access to EVERY feature in the application.**

The only differentiator is **USAGE LIMITS**:
- Properties managed
- Team size
- Inspections per month
- Analytics depth (historical data retention)
- Automation capacity
- Storage
- API quotas

**Critical Rules:**
1. ✅ Every feature is accessible to all customers
2. ✅ Only property managers subscribe and pay
3. ✅ Team Management is available to all subscription levels
4. ✅ All team members (owners, tenants, technicians) operate inside the same shared workspace
5. ✅ Owners, tenants, and technicians NEVER see or interact with subscription/billing workflows

---

## What Has Been Implemented

### 1. Database Schema Updates (`backend/prisma/schema.prisma`)

**User Model Enhancements:**
- `trialVariant` (String) - A/B testing for trial lengths
- `gdprConsentGiven` (Boolean) - GDPR compliance
- `gdprConsentDate` (DateTime) - Consent timestamp
- `marketingConsentGiven` (Boolean) - Marketing opt-in

**Subscription Model Enhancements:**
- `enabledFeatureFlags` (String[]) - Enterprise feature flags
- `customLimits` (Json) - Custom usage limits for enterprise clients

**Org Model Enhancements:**
- `ownerId` (String) - Property manager who owns the organization
- `settings` (Json) - Organization-level settings
- `updatedAt` (DateTime) - Update tracking

**New Models:**
- `PromoCode` - Promo code management with discount types, usage limits, expiration
  - Supports FIXED and PERCENTAGE discount types
  - Plan-specific applicability
  - Usage tracking (currentUses vs maxUses)

### 2. Backend Implementation

#### A. Subscription Limits Refactored (`backend/src/utils/subscriptionLimits.js`)

**NEW USAGE-BASED LIMITS:**

| Limit Type | Basic ($29) | Professional ($79) | Enterprise ($149) |
|------------|-------------|-------------------|------------------|
| Properties | 10 | 50 | Unlimited |
| Team Members | 1 | 5 | Unlimited |
| Inspections/Month | 25 | 100 | Unlimited |
| Recurring Inspections | 5 | 25 | Unlimited |
| Custom Templates | 3 | 15 | Unlimited |
| Analytics History | 30 days | 180 days | Unlimited |
| Report Exports/Month | 10 | 50 | Unlimited |
| Automation Rules | 3 | 15 | Unlimited |
| Automation Runs/Month | 100 | 1,000 | Unlimited |
| Maintenance Plans | 5 | 25 | Unlimited |
| Jobs/Month | 50 | 250 | Unlimited |
| Storage | 5 GB | 50 GB | Unlimited |
| Document Uploads/Month | 50 | 250 | Unlimited |
| API Calls/Day | 100 | 1,000 | Unlimited |
| Webhooks | 2 | 10 | Unlimited |
| Integrations | 1 | 5 | Unlimited |

**Key Functions:**
- `hasFeature()` - Now always returns `true` (all features available)
- `hasReachedLimit()` - Check if usage limit reached
- `getRemainingUsage()` - Get remaining quota
- `getUsagePercentage()` - Get usage as percentage
- `getApproachingLimits()` - Get limits >= 80% used

#### B. Usage Tracking (`backend/src/utils/usageTracking.js`)

**Real-time usage calculation:**
- Property count
- Team member count
- Inspections this month
- Recurring inspections
- Custom templates
- Maintenance plans
- Jobs this month
- Document uploads this month

**Property Manager-Scoped:**
- For owners/tenants/technicians, usage is tracked against their property manager's subscription
- All team members share the same usage quotas

#### C. Usage Limit Middleware (`backend/src/middleware/auth.js`)

**NEW: `requireUsage(limitType, getCurrentUsageFn)`**

Enforces usage limits instead of feature blocks:
```javascript
requireUsage('properties', async (userId) => await getPropertyCount(userId))
```

**Features:**
- Automatically resolves property manager for non-PM roles
- Returns clear error messages with upgrade prompts
- Stores usage info in `req.usageInfo` for route handlers

#### D. Enhanced Subscription Routes (`backend/src/routes/subscriptions.js`)

**NEW ENDPOINTS:**

**GET `/api/subscriptions/usage`** (All authenticated users)
Returns comprehensive usage stats:
```json
{
  "plan": "PROFESSIONAL",
  "usage": {
    "properties": {
      "current": 15,
      "limit": 50,
      "remaining": 35,
      "percentage": 30,
      "isApproachingLimit": false,
      "hasReachedLimit": false
    },
    ...
  },
  "warnings": [...],
  "timestamp": "2025-12-02T..."
}
```

**GET `/api/subscriptions/churn-analysis`** (Admin only)
Returns comprehensive churn metrics:
- Cancellations, new subscriptions, reactivations
- Churn rate calculation
- MRR (Monthly Recurring Revenue) tracking
- Breakdown by plan
- Suspended subscriptions (payment failures)

#### E. Promo Codes System (`backend/src/routes/promoCodes.js`)

**ADMIN-ONLY ROUTES:**
- `GET /api/promo-codes` - List all promo codes (with search and filtering)
- `GET /api/promo-codes/:id` - Get single promo code
- `POST /api/promo-codes` - Create new promo code
- `PUT /api/promo-codes/:id` - Update promo code
- `DELETE /api/promo-codes/:id` - Delete promo code

**PUBLIC ROUTE:**
- `POST /api/promo-codes/validate` - Validate promo code (authenticated users)

**Features:**
- Fixed amount or percentage discounts
- Plan-specific applicability
- Max uses limit
- Expiration dates
- Active/inactive toggle

#### F. Enhanced Billing Routes (`backend/src/routes/billing.js`)

**Role Protection:**
- All billing routes now verify `PROPERTY_MANAGER` or `ADMIN` role
- Owners, tenants, technicians receive clear error: "Only property managers can manage subscriptions. Please contact your property manager."

**Add-ons Support:**
Checkout now accepts add-ons array:
```javascript
{
  plan: "PROFESSIONAL",
  addOns: [
    { type: "extraProperties", quantity: 10 },
    { type: "extraStorage", quantity: 1 }
  ]
}
```

**Supported Add-ons:**
- `extraProperties` - Additional property slots
- `extraTeamMembers` - Additional team members
- `extraStorage` - Additional storage capacity
- `extraAutomation` - Additional automation capacity

#### G. Trial Expiration Emails (`backend/src/utils/trialReminders.js`)

**Automated email reminders:**
- Sends to property managers at 7, 3, and 1 days before trial expiration
- Professional HTML email templates
- Highlights plan options with usage limits
- Clear upgrade CTA

**Functions:**
- `sendTrialExpirationReminder(user, daysRemaining)`
- `checkAndSendTrialReminders(reminderDays)` - Daily cron job
- `expireTrials()` - Automatically suspend expired trials

**Cron Job Scheduler (`backend/src/jobs/cronJobs.js`):**
- Runs daily at 9:00 AM
- Requires `ENABLE_CRON_JOBS=true` environment variable
- Compatible with external cron services for serverless platforms

#### H. GDPR Consent & A/B Testing (`backend/src/routes/auth.js`)

**Registration Enhancement:**
- `gdprConsentGiven` (Boolean) - Required for compliance
- `marketingConsentGiven` (Boolean) - Optional marketing opt-in
- `gdprConsentDate` - Timestamp when consent was given

**A/B Testing for Trial Lengths:**
- Randomly assigns property managers to variants A, B, or C
- Variant A: 14 days (default)
- Variant B: 7 days
- Variant C: 21 days
- Only enabled when `ENABLE_TRIAL_AB_TESTING=true`
- Stored in `user.trialVariant` for analytics

---

## Manual Setup Steps Required

### 1. **Stripe Configuration** ⚠️ CRITICAL

**Required Environment Variables:**
```bash
# Stripe API Keys
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Plan Price IDs (from Stripe Dashboard)
STRIPE_PRICE_ID_BASIC=price_...
STRIPE_PRICE_ID_PROFESSIONAL=price_...
STRIPE_PRICE_ID_ENTERPRISE=price_...

# Add-on Price IDs (optional)
STRIPE_ADDON_EXTRA_PROPERTIES=price_...
STRIPE_ADDON_EXTRA_TEAM_MEMBERS=price_...
STRIPE_ADDON_EXTRA_STORAGE=price_...
STRIPE_ADDON_EXTRA_AUTOMATION=price_...
```

**Steps:**
1. **Create Stripe Products and Prices:**
   - Go to Stripe Dashboard → Products
   - Create three recurring products:
     - Basic: $29/month
     - Professional: $79/month
     - Enterprise: $149/month
   - Copy the `price_xxx` IDs to environment variables

2. **Enable Stripe Billing Portal:**
   - Go to Settings → Billing → Customer portal
   - Enable "Allow customers to update payment methods"
   - Save settings

3. **Set up Webhook Endpoint:**
   - Go to Developers → Webhooks
   - Add endpoint: `https://your-domain.com/api/billing/webhook`
   - Select events:
     - `checkout.session.completed`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_failed`
     - `invoice.payment_succeeded`
   - Copy webhook signing secret to `STRIPE_WEBHOOK_SECRET`

**What breaks if not configured:**
- ❌ Users cannot subscribe to paid plans
- ❌ Checkout button will show "Stripe not configured" error
- ❌ Subscription status won't sync automatically

---

### 2. **Email Configuration (Nodemailer)** ⚠️ REQUIRED for trial reminders

**Required Environment Variables:**
```bash
# Gmail (recommended for development)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-specific-password

# OR use custom SMTP
EMAIL_HOST=smtp.your-provider.com
EMAIL_PORT=465
EMAIL_SECURE=true
EMAIL_USER=noreply@your-domain.com
EMAIL_PASS=your-password

# From address
EMAIL_FROM=BuildState FM <noreply@your-domain.com>
```

**Gmail Setup:**
1. Enable 2FA on your Google Account
2. Generate App Password: https://myaccount.google.com/apppasswords
3. Use app password as `EMAIL_PASS`

**What breaks if not configured:**
- ❌ Trial expiration emails won't send
- ❌ Email verification won't work
- ❌ Password reset emails won't send
- ❌ Payment failure notifications won't send

---

### 3. **Cron Jobs Setup** ⚠️ REQUIRED for trial reminders

**Option A: Traditional Server (VPS, EC2, etc.)**
```bash
# Enable cron in environment
ENABLE_CRON_JOBS=true
```
Cron runs automatically in the Node.js process.

**Option B: Serverless (Vercel, Netlify, etc.)**

You CANNOT run traditional cron jobs on serverless platforms. Use one of these alternatives:

**Vercel Cron Jobs:**
Create `vercel.json`:
```json
{
  "crons": [{
    "path": "/api/cron/trial-reminders",
    "schedule": "0 9 * * *"
  }]
}
```

Create route `/api/cron/trial-reminders`:
```javascript
import { checkAndSendTrialReminders, expireTrials } from '../../utils/trialReminders.js';

export default async function handler(req, res) {
  // Verify cron secret for security
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  await checkAndSendTrialReminders([7, 3, 1]);
  await expireTrials();

  res.json({ success: true });
}
```

**GitHub Actions (works with any platform):**
Create `.github/workflows/trial-reminders.yml`:
```yaml
name: Trial Reminders
on:
  schedule:
    - cron: '0 9 * * *'  # 9:00 AM UTC daily

jobs:
  remind:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger reminder endpoint
        run: |
          curl -X POST https://your-domain.com/api/cron/trial-reminders \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}"
```

**External Cron Services:**
- EasyCron (https://www.easycron.com/)
- cron-job.org (https://cron-job.org/)
- AWS EventBridge

**What breaks if not configured:**
- ❌ Trial expiration reminders won't send
- ❌ Expired trials won't automatically suspend
- Users will need to be manually reminded

---

### 4. **Database Migration** ⚠️ CRITICAL

Run Prisma migration to update database schema:
```bash
cd backend
npx prisma migrate dev --name subscription-usage-model
npx prisma generate
```

**What this does:**
- Adds GDPR consent fields to User table
- Adds trial variant field for A/B testing
- Adds enterprise feature flags to Subscription table
- Creates PromoCode table
- Updates Org table with ownerId and settings

**What breaks if not done:**
- ❌ Application will crash on startup
- ❌ Registration will fail
- ❌ Subscription features won't work

---

### 5. **Feature Flags & Optional Config**

**Optional Environment Variables:**
```bash
# A/B Testing
ENABLE_TRIAL_AB_TESTING=true  # Enable trial length variants

# Frontend URL
FRONTEND_URL=https://your-domain.com

# Cron job secret for security
CRON_SECRET=your-random-secret-key
```

---

## Multi-Phase Roadmap

### **PHASE 1: CORE USAGE-BASED FOUNDATION** ✅ COMPLETED

**Deliverables:**
1. ✅ Refactored subscription limits to usage-based model
2. ✅ Database schema updates (GDPR, A/B testing, PromoCode)
3. ✅ Usage tracking and middleware
4. ✅ Usage stats API endpoint
5. ✅ Churn analysis for admins
6. ✅ Promo codes system
7. ✅ Role-based billing access (property managers only)
8. ✅ Add-ons support in Stripe checkout
9. ✅ Trial expiration email system
10. ✅ GDPR consent handling
11. ✅ A/B testing for trial lengths

**Key Achievement:**
- Complete backend infrastructure for usage-based SaaS model
- Property manager-scoped subscriptions with team member sharing
- Automated trial management

---

### **PHASE 2: FRONTEND EXPERIENCE** (Type "continue" to see this phase)

---

## Quick Start Guide

### For Property Managers (Subscription Holders)

1. **Sign Up:**
   - Register as Property Manager
   - Automatically starts 14-day free trial (or variant A/B/C if testing enabled)
   - Must provide GDPR consent

2. **Invite Team Members:**
   - Invite owners, tenants, technicians from Team Management
   - They register via invite link
   - They inherit your subscription limits
   - They NEVER see billing pages

3. **Monitor Usage:**
   - Check `/api/subscriptions/usage` for current consumption
   - Receive warnings when approaching limits (80%+)
   - See upgrade prompts when limits reached

4. **Subscribe:**
   - Go to Subscriptions page (property managers only)
   - Choose plan based on usage needs:
     - Basic: 10 properties, 25 inspections/month
     - Professional: 50 properties, 100 inspections/month
     - Enterprise: Unlimited everything
   - Optionally add add-ons for extra capacity

5. **Manage Subscription:**
   - Update payment method via Stripe Billing Portal
   - Upgrade/downgrade plans
   - Cancel subscription (access until end of billing period)

### For Team Members (Owners, Tenants, Technicians)

1. **Registration:**
   - Receive invite email from property manager
   - Click link and complete registration
   - Automatically linked to property manager's subscription

2. **Access:**
   - Full access to all features
   - Subject to property manager's usage limits
   - No billing/subscription pages visible
   - Cannot upgrade or change subscription

---

## Testing Checklist

### Role-Based Access Testing

- [ ] Property Manager can access `/subscriptions` page
- [ ] Property Manager can create checkout session
- [ ] Owner accessing `/subscriptions` gets 403 error
- [ ] Tenant accessing `/subscriptions` gets 403 error
- [ ] Technician accessing `/subscriptions` gets 403 error
- [ ] Admin can access all subscription endpoints

### Usage Limit Testing

- [ ] Property count limit enforced
- [ ] Team member limit enforced
- [ ] Inspections per month limit enforced
- [ ] Usage stats endpoint returns correct data
- [ ] Approaching limit warnings (80%+) appear
- [ ] Upgrade prompts show when limit reached

### Trial & Subscription Testing

- [ ] New property manager gets 14-day trial
- [ ] Trial expiration email sent at 7, 3, 1 days
- [ ] Expired trials automatically suspended
- [ ] Subscription checkout works for all plans
- [ ] Webhooks correctly update subscription status
- [ ] Payment failure suspends subscription
- [ ] Payment success reactivates suspended subscription

### Team Member Testing

- [ ] Invited owner sees property manager's usage limits
- [ ] Invited tenant sees property manager's usage limits
- [ ] Invited technician sees property manager's usage limits
- [ ] Team members cannot access billing endpoints
- [ ] Team members share same workspace/data

### A/B Testing (if enabled)

- [ ] Trial variants assigned randomly
- [ ] Variant B gets 7-day trial
- [ ] Variant C gets 21-day trial
- [ ] `trialVariant` stored in database

### GDPR Testing

- [ ] Registration requires GDPR consent
- [ ] Consent date recorded
- [ ] Marketing consent optional
- [ ] User data export includes consent status

---

## Deployment Checklist

- [ ] Run database migration (`prisma migrate deploy`)
- [ ] Set all required environment variables
- [ ] Configure Stripe products and prices
- [ ] Enable Stripe Billing Portal
- [ ] Create Stripe webhook endpoint
- [ ] Configure email service (Gmail or SMTP)
- [ ] Set up cron jobs (native or external)
- [ ] Test trial expiration emails
- [ ] Test subscription checkout
- [ ] Test webhook event handling
- [ ] Verify role-based access control
- [ ] Test usage limit enforcement
- [ ] Monitor logs for errors

---

## Support & Troubleshooting

### Common Issues

**"Stripe is not configured" error:**
- Verify `STRIPE_SECRET_KEY` is set
- Check that price IDs are correct
- Ensure webhook secret is configured

**Trial emails not sending:**
- Check email environment variables
- Verify cron job is running
- Check email service logs

**Usage limits not enforced:**
- Ensure `requireUsage` middleware is applied to routes
- Check that usage tracking functions are working
- Verify property manager's plan is correct

**Team members see billing pages:**
- Check role-based middleware on billing routes
- Verify frontend route protection
- Clear browser cache

---

## Next Steps

After deploying Phase 1, you can:
1. Monitor usage patterns via churn analysis endpoint
2. Analyze A/B testing results for trial optimization
3. Add more usage metrics as needed
4. Create custom add-ons for enterprise clients
5. Proceed to Phase 2 for frontend enhancements

**Type "continue" to see Phase 2 and beyond.**
