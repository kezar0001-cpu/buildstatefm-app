# Backend Security Audit Report

**Project:** agentfm-app  
**Scope:** Backend API (Express + Prisma) production-readiness review focused on auth/RBAC consistency, resource-level authorization, subscription gating, and information/PII leakage.  
**Status:** In-progress audit; key high-risk issues addressed.  

## Executive Summary
This audit found several **high-risk authorization/scoping issues** where certain endpoints could return cross-tenant data when filters fell back to an empty `{}` ("all data") for some roles. It also found several **medium-risk PII exposure** cases (emails returned more broadly than needed) and **consistency gaps** (subscription gating applied on some uploads endpoints but not others).

The changes below were implemented to harden production security with minimal behavioral impact.

## Highest-Priority Findings (Fixed)

### 1) Cross-tenant analytics exposure in `/api/dashboard/analytics`
- **Risk:** High (potential cross-tenant data exposure)
- **Location:** `backend/src/routes/dashboard.js`
- **Issue:** Property scoping could become empty for roles other than `PROPERTY_MANAGER`/`OWNER`, effectively querying analytics across all properties.
- **Fix:** Restricted endpoint to `ADMIN`, `PROPERTY_MANAGER`, `OWNER` and enforced property scoping; invalid `propertyId` now returns **403** instead of falling back to all properties.

### 2) Tenant activity feed scoping bug in dashboard activity
- **Risk:** High (potential cross-tenant data exposure)
- **Location:** `backend/controllers/dashboardController.js` (`getRecentActivity`)
- **Issue:** For `TENANT`, `inspectionWhere` could become `{}` (unscoped), potentially returning inspections across all properties.
- **Fix:** TENANT activity queries now scope inspections to propertyIds derived from active tenancies; no-tenancy case uses `{ propertyId: { in: [] } }`.

### 3) Recurring inspections endpoints lacked resource-level access control
- **Risk:** High (cross-tenant data exposure)
- **Location:** `backend/src/routes/recurringInspections.js`
- **Issue:** `GET /recurring-inspections` and related endpoints were authenticated but not scoped to accessible properties.
- **Fix:** Added role-based property scoping:
  - `ADMIN`: all
  - `PROPERTY_MANAGER`: managed properties
  - `OWNER`: owned properties
  - `TENANT`: active tenancy properties
  - `TECHNICIAN`: assigned-job properties
  Also added manager subscription gating for non-PM/non-admin reads and PM ownership checks for write endpoints.

### 4) Inspection templates endpoints could leak templates across properties
- **Risk:** High (cross-tenant data exposure)
- **Location:** `backend/src/routes/inspectionTemplates.js`
- **Issue:** List/get endpoints were not sufficiently scoped by accessible properties.
- **Fix:** Added role-based property scoping while still allowing global/default templates; added manager subscription gating for non-PM/non-admin; enforced PM ownership checks for property-scoped templates.

### 5) Reports endpoints were still reachable via `backend/server.js`
- **Risk:** High (expanded attack surface; unmaintained feature)
- **Location:** `backend/server.js`
- **Issue:** `/api/reports` was mounted even though Reports are intended to be disabled/hidden.
- **Fix:** Removed `/api/reports` mount (and import) from `backend/server.js`.

## Medium-Priority Findings (Fixed)

### 6) Upload endpoints inconsistently enforced subscription gating
- **Risk:** Medium (abuse risk / inconsistent access control)
- **Location:** `backend/src/routes/uploads.js`
- **Issue:** Some endpoints were `requireAuth` only while others required `requireActiveSubscription`.
- **Fix:** Added `requireActiveSubscription` to:
  - `POST /uploads/inspection-photos`
  - `POST /uploads/responsive-image`
  - `POST /uploads/cloudfront-url`
  - `POST /uploads/cloudfront-responsive-urls`

### 7) Global search endpoint had an unscoped fallback for unsupported roles
- **Risk:** Medium (possible cross-tenant results if role check bypassed/expanded)
- **Location:** `backend/src/routes/search.js`
- **Issue:** Unsupported roles could fall through with `{}` filters.
- **Fix:** Explicitly handled `ADMIN` and added deny-by-default (403) for unsupported roles.

### 8) Public invite token verification returned more PII/data than needed
- **Risk:** Medium (PII exposure if token leaks)
- **Location:** `backend/src/routes/invites.js`
- **Fix:** `GET /api/invites/:token` no longer returns invitee email; limited property/unit fields to essentials.

### 9) PII reduction: service requests requester email
- **Risk:** Medium
- **Location:** `backend/src/routes/serviceRequests.js`
- **Fix:** `requestedBy.email` now only included for `PROPERTY_MANAGER` in list endpoints (`GET /` and `GET /archived`).

### 10) PII reduction: jobs and plans technician email
- **Risk:** Medium
- **Locations:**
  - `backend/src/routes/jobs.js`
  - `backend/src/routes/plans.js`
- **Fix:** In jobs/plans list/get responses, technician email is included only for `PROPERTY_MANAGER`/`ADMIN` where applicable.

### 11) Recommendations endpoints exposed actor emails broadly
- **Risk:** Medium
- **Location:** `backend/src/routes/recommendations.js`
- **Fix:** `createdBy.email` and `approvedBy.email` now only included for `PROPERTY_MANAGER`/`ADMIN`.

## Notable Bug Fix (Non-security)

### `jobs.js` route corruption around accept/reject
- **Impact:** Server parse errors / broken endpoint
- **Location:** `backend/src/routes/jobs.js`
- **Fix:** Removed stray/duplicated code introduced by patching, restored a proper `POST /api/jobs/:id/reject`, and fixed undefined `includeAssigneeEmail` reference in `POST /api/jobs`.

## What Remains (Recommended Follow-ups)

### A) Standardize “resource scoping helpers”
Multiple routes implement similar “get accessible property IDs” logic. Consolidating into shared helpers would reduce future regressions.

### B) Subscription usage endpoint correctness
- **Location:** `backend/src/routes/subscriptions.js` (`GET /usage`)
- **Note:** For non-PM roles with multiple properties/managers, it may pick an arbitrary manager relationship via `findFirst`. This is not a direct leak but could be confusing.

### C) Review any remaining endpoints returning email addresses
We reduced several exposures, but a repo-wide pass to ensure emails are only returned to roles that need them is recommended.

## Role-by-Role Validation Checklist

### ADMIN
- Can access admin dashboards and analytics.
- Cannot access disabled Reports endpoints (`/api/reports` should 404).

### PROPERTY_MANAGER
- Can list/create/update jobs; can see assigned technician emails.
- Can manage inspection templates and recurring inspections only for managed properties.
- Can create invites and see their invite list.

### OWNER
- Can view properties they own, jobs for those properties, and recommendations.
- Should not receive tenant/service-request requester emails by default.

### TENANT
- Can create/view their own service requests.
- Cannot access recommendations.
- Dashboard activity should only contain items from their tenancy properties.

### TECHNICIAN
- Can view jobs assigned to them.
- Cannot access service requests list.
- Search returns only assigned jobs.

## Readiness Score (Current)
**8 / 10** for backend security hardening relative to the scoped review targets.

- **Strong:** Major cross-tenant leaks addressed; deny-by-default improved; admin routes protected.
- **Remaining:** Consolidation of access helpers; a final repo-wide sweep to ensure no other unscoped `{}` fallbacks remain.
