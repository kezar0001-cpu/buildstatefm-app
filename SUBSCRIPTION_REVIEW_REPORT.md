# Subscription Workflow Review Report

**Date:** Review Complete  
**Scope:** Full-stack subscription system review  
**Status:** Issues Found - Fixes Required

---

## Executive Summary

A comprehensive review of the subscription workflow has identified **4 issues** that require intervention:

- **1 CRITICAL** issue that will cause database errors
- **2 MODERATE** issues that could cause incorrect behavior
- **1 MINOR** issue affecting analytics accuracy

All issues are fixable without altering Stripe configuration or creating new Stripe objects.

---

## Issues Found

### 🔴 CRITICAL: Schema Enum Mismatch (BASIC vs STARTER)

**Severity:** CRITICAL  
**Location:** `backend/prisma/schema.prisma`  
**Root Cause:** The Prisma schema enum `SubscriptionPlan` includes `STARTER` but the codebase consistently uses `BASIC`. When the code attempts to save `subscriptionPlan: 'BASIC'` to the database, Prisma will throw a validation error because `BASIC` is not in the enum.

**Impact:**
- Subscription creation will fail with database constraint errors
- Webhook processing will fail when trying to update subscription plans
- User subscription updates will fail silently or throw errors

**Evidence:**
- Schema enum: `FREE_TRIAL, STARTER, PROFESSIONAL, ENTERPRISE`
- Code usage: All references use `BASIC` (billing.js, frontend, etc.)
- Migration file: Only includes `STARTER`

**Fix Required:** Add `BASIC` to the `SubscriptionPlan` enum in the schema.

---

### 🟡 MODERATE: Missing Upgrade/Downgrade Handling

**Severity:** MODERATE  
**Location:** `backend/src/routes/billing.js` (checkout endpoint)  
**Root Cause:** When a user with an active subscription attempts to subscribe to a different plan, the system creates a new checkout session without checking for existing subscriptions. This could result in:
- Multiple active subscriptions for the same user
- Billing confusion
- Incorrect subscription state

**Impact:**
- Users can create duplicate subscriptions
- Stripe will have multiple active subscriptions for the same customer
- Database may have multiple ACTIVE subscription records

**Evidence:**
- `/checkout` endpoint does not check for existing active subscriptions
- No logic to cancel/update existing subscription before creating new one
- Frontend allows plan selection even when user has active subscription

**Fix Required:** Add logic to handle existing subscriptions:
- If user has active subscription, update it via Stripe subscription modification
- If user has cancelled subscription, allow new checkout
- Prevent duplicate active subscriptions

---

### 🟡 MODERATE: Plan Normalization Doesn't Handle BASIC/STARTER Mapping

**Severity:** MODERATE  
**Location:** `backend/src/routes/billing.js` (`normalisePlan` function)  
**Root Cause:** The `normalisePlan` function doesn't map between `BASIC` and `STARTER`, which are used interchangeably in the codebase. If the schema is updated to include both, the normalization should handle both values.

**Impact:**
- Inconsistent plan names in database
- Potential issues when reading subscription data
- Confusion in plan resolution logic

**Evidence:**
- `normalisePlan` only checks if plan exists in `PLAN_PRICE_MAP`
- No explicit mapping between BASIC and STARTER
- Code comment mentions "backward compatibility" but no mapping exists

**Fix Required:** Update `normalisePlan` to map `STARTER` to `BASIC` (or vice versa) for consistency.

---

### 🟢 MINOR: Churn Analysis Uses Incorrect Plan Name

**Severity:** MINOR  
**Location:** `backend/src/routes/subscriptions.js` (churn-analysis endpoint)  
**Root Cause:** The churn analysis endpoint uses `BASIC` in the `planPrices` object, but if the database has `STARTER` values, the MRR calculation will be incorrect.

**Impact:**
- Incorrect MRR calculations for BASIC/STARTER plans
- Analytics data will be inaccurate
- Revenue reporting will be wrong

**Evidence:**
- Line 288: `BASIC: 29` in planPrices
- Database may have `STARTER` values
- No mapping between BASIC and STARTER in this endpoint

**Fix Required:** Add `STARTER` to planPrices or ensure consistent plan name usage.

---

## System Validation Results

### ✅ Working Correctly

1. **Webhook Handlers:** All Stripe webhook events are properly handled
   - `checkout.session.completed` ✅
   - `customer.subscription.updated` ✅
   - `customer.subscription.deleted` ✅
   - `invoice.payment_failed` ✅
   - `invoice.payment_succeeded` ✅

2. **Role-Based Access Control:** Subscription endpoints properly restrict access to PROPERTY_MANAGER and ADMIN roles ✅

3. **Idempotency:** Webhook events are tracked to prevent duplicate processing ✅

4. **Error Handling:** Comprehensive error handling exists for Stripe operations ✅

5. **Database Updates:** Both User model and Subscription model are updated correctly ✅

6. **Frontend Flow:** Subscription page correctly handles checkout, confirmation, and cancellation ✅

### ⚠️ Areas of Concern (Not Bugs, But Worth Monitoring)

1. **Subscription Upgrades:** No explicit upgrade/downgrade flow - relies on Stripe's subscription modification
2. **Trial Expiration:** Trial expiration logic is correct but could benefit from clearer messaging
3. **Payment Failure Recovery:** Payment failure handling is good, but recovery flow could be more user-friendly

---

## Recommended Fixes

### Fix 1: Add BASIC to SubscriptionPlan Enum

**File:** `backend/prisma/schema.prisma`

```prisma
enum SubscriptionPlan {
  FREE_TRIAL
  STARTER
  BASIC      // Add this line
  PROFESSIONAL
  ENTERPRISE
}
```

**Action:** Create and run a Prisma migration to add `BASIC` to the enum.

---

### Fix 2: Update Plan Normalization

**File:** `backend/src/routes/billing.js`

Update `normalisePlan` function to map STARTER to BASIC:

```javascript
function normalisePlan(plan) {
  if (!plan) return undefined;
  const upper = String(plan).trim().toUpperCase();
  if (upper === 'FREE_TRIAL') return upper;
  // Map STARTER to BASIC for consistency
  if (upper === 'STARTER') return 'BASIC';
  return PLAN_PRICE_MAP[upper] ? upper : undefined;
}
```

---

### Fix 3: Update Churn Analysis

**File:** `backend/src/routes/subscriptions.js`

Update `planPrices` to include both BASIC and STARTER:

```javascript
const planPrices = {
  BASIC: 29,
  STARTER: 29,  // Add this line
  PROFESSIONAL: 79,
  ENTERPRISE: 149,
};
```

---

### Fix 4: Add Existing Subscription Check (Optional but Recommended)

**File:** `backend/src/routes/billing.js`

Add check in `/checkout` endpoint to handle existing subscriptions:

```javascript
// Before creating checkout session, check for existing subscription
const existingSubscription = await prisma.subscription.findFirst({
  where: {
    userId: user.id,
    status: 'ACTIVE',
    stripeSubscriptionId: { not: null },
  },
});

if (existingSubscription) {
  // Instead of creating new checkout, update existing subscription
  // This would require Stripe subscription modification API
  // For now, return error or handle upgrade flow
}
```

**Note:** This is a more complex fix that may require additional Stripe API integration. Marked as optional but recommended for production stability.

---

## Testing Recommendations

After applying fixes, test the following scenarios:

1. ✅ New subscription creation (trial → paid)
2. ✅ Subscription cancellation (immediate and end-of-period)
3. ✅ Payment failure and recovery
4. ✅ Webhook event processing (all event types)
5. ✅ Plan changes (upgrade/downgrade) - if Fix 4 is implemented
6. ✅ Role-based access (verify non-property-managers cannot access)
7. ✅ Database constraint validation (verify BASIC can be saved)

---

## Conclusion

The subscription system is **functionally correct** but has **critical schema mismatch** that will cause runtime errors. The fixes are straightforward and do not require changes to Stripe configuration. Once the schema issue is resolved, the system should operate correctly.

**Recommendation:** Apply all fixes before deploying to production.
