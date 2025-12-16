
# Project Index (agentfm-app)

## Overview
- Full-stack app with `frontend/` (Vite + React + MUI + React Query) and `backend/` (Express + Prisma).

## Architecture
- **Frontend routing:** `frontend/src/App.jsx` defines `react-router-dom` routes.
- **Main layout:** `frontend/src/components/Layout.jsx` wraps app content and renders the mobile footer nav.
- **Mobile footer nav:** `frontend/src/components/RotaryFooter.tsx` (fixed bottom, mobile only).

## Components
- **RotaryFooter (mobile nav):** `frontend/src/components/RotaryFooter.tsx`
  - Collapsible state persisted in `localStorage` key `ui:rotaryFooterCollapsed` via `Layout.jsx`.
  - Swipe uses pointer capture (no framer drag) for smoothness; snap-on-release removed.

- **Admin Analytics (platform metrics):** `frontend/src/pages/admin/AdminAnalyticsPage.jsx`
  - Route: `/admin/analytics` (wrapped by `AdminLayout` in `frontend/src/App.jsx`).
  - Tabs: Overview, Product, Operations, Users, Subscriptions, System.
  - Data sources (backend):
    - `GET /api/admin/analytics/users?period=7d|30d|90d` (user growth)
    - `GET /api/admin/analytics/subscriptions` (plan distribution + conversion/churn counts)
    - `GET /api/admin/analytics/operations?period=7d|30d|90d` (volume + backlog + cycle times)
    - `GET /api/admin/analytics/product?period=7d|30d|90d` (activation funnel + weekly active PMs)
    - `GET /api/admin/health` (system health snapshot)
  - Uses `recharts` for simple charts (user growth, plan distribution, operations volume, product weekly active).

- **Getting Started checklist (Dashboard):** `frontend/src/components/OnboardingChecklist.jsx`
  - Uses `/api/dashboard/summary` to detect step completion.
  - Step completion is *sticky* per-user: once a step is observed as complete, its step id is persisted in `localStorage` under `onboarding:completed:<userId|email>` so it never reverts to unchecked.
  - Checklist hides once all steps are complete.
  - Inspection step uses `summary.inspections.completedAllTime` so completed inspections still count even after archiving.

- **Standardized FilterBar (app-wide):** `frontend/src/components/FilterBar/FilterBar.tsx`
  - Desktop: single-line, no wrapping; secondary filters live in a "More filters" Popover.
  - Mobile: search full-width + a single "Filters" button (Drawer) + optional Clear; never overflows.
  - View toggles are desktop-only (FilterBar enforces this).
- **Navigation config:** `frontend/src/utils/navigationConfig.js`
  - Defines `NAVIGATION_ITEMS` and `MOBILE_NAV_ITEMS` by role.

## RBAC
- **Option 1 (Technician/Tenant read-only):** Technicians and tenants can access Properties/Units pages but only in read-only mode.
  - **No create/edit/delete/assignment UI** is shown for read-only roles.
  - `/properties/:id/edit` remains blocked for non-edit roles.
  - Backend supports scoped read access and gates non-PM roles by the property manager subscription.

- **Units (backend):** `backend/src/routes/units.js`
  - `GET /units/:id/activity` uses `ensureUnitAccess(unitId, req.user)` for resource-level authorization.

- **Jobs (backend):** `backend/src/routes/jobs.js`
  - TENANT cannot access jobs endpoints (use service requests).
  - OWNER/TECHNICIAN reads and technician actions (`/accept`, `/reject`, status updates) are gated by the *property manager* subscription (ACTIVE or TRIAL not expired).
  - ADMIN is not subscription-gated.

- **Inspections (backend):**
  - `backend/src/routes/inspections.js` gates non-PM/non-admin inspection access by the *property manager* subscription (not technician subscription).
  - `backend/src/controllers/inspectionController.js` filters technician list results to only properties whose manager subscription is active.
  - ADMIN is not subscription-gated (uses `requireActiveSubscriptionUnlessAdmin` where needed).

## Patterns
- **Frontend test patterns (Vitest + Testing Library + MUI):**
  - In `UnitDetailPage.test.jsx`, prefer role-based queries for MUI (`getByRole('tab'|'button'|'dialog')`) and use a `textContent` matcher helper for labels split across multiple nodes.
  - Avoid broad `url.includes('/units/unit-123')` mocks because it also matches nested endpoints like `/units/unit-123/tenants`; prefer exact matching (`url === '/units/unit-123'`).
  - RBAC-gated UI in pages using `getCurrentUser()` can be tested by seeding `localStorage.setItem('user', JSON.stringify({ role: 'ADMIN' }))`.

- **Invite-based signup (prefill email + simplified UI):**
  - Backend invite verification endpoint `GET /api/invites/:token` returns `invite.email` so the signup page can prefill and lock the email field.
  - Signup UI no longer shows Google signup or the "or sign up with email" divider.
  - Regression test: `frontend/src/__tests__/SignUp.invite.test.jsx`.

- **Auth registration (backend) gotcha:**
  - `backend/src/routes/auth.js` must only write fields that exist in Prisma `User` model; writing non-existent fields will throw and surface as 500 `Registration failed`.

- **Tenant routing + My Unit empty-state:**
  - Tenant **Dashboard** lives at `/tenant/dashboard`.
  - Tenant **My Unit** lives at `/tenant/unit` and shows:
    - A clear empty-state when `GET /api/tenants/my-units` returns no units.
    - Assigned property/unit details + inspection report links (read-only) when units exist.
  - Navigation updated in `frontend/src/utils/navigationConfig.js` (tenant "My Unit" now points to `/tenant/unit`).
  - Route added in `frontend/src/App.jsx` (`/tenant/unit` -> `TenantUnitPage`).
  - Tenant dashboard also shows an empty-state + disables "New Service Request" when no unit is assigned.
  - Regression test: `frontend/src/__tests__/TenantUnitPage.emptyState.test.jsx`.

- **Tenant dashboard gotchas (duplicate units + service request empty state):**
  - `frontend/src/pages/TenantDashboard.jsx`:
    - Deduplicate `/tenants/my-units` results before rendering (prevents the "Your Unit" section from showing duplicated rows when API returns duplicates).
    - `DataState` does **not** use a `data` prop; to show an empty state, pass `isEmpty` (and pass `isError` for errors).
  - Regression test: `frontend/src/__tests__/TenantDashboard.emptyServiceRequests.test.jsx`.

- **MVP feature hiding (Reports):**
  - Removed Reports from `navigationConfig.js` + RotaryFooter + Admin menu.
  - Removed `/reports*` routes from `frontend/src/App.jsx`.
  - Disabled backend mount for reports by removing `/api/reports` from `backend/server.js`.

- **List page filter toolbars (standardized FilterBar):**
  - Canonical UI is `frontend/src/components/FilterBar/FilterBar.tsx`.
  - Desktop: search + limited inline primary filters + "More filters" Popover; never wraps.
  - Mobile: search + "Filters" (Drawer); no view toggle.
  - Pages migrated include:
    - `frontend/src/pages/{Jobs,Properties,Inspections,Plans,ServiceRequests,Recommendations,Reports}Page.jsx`
    - `frontend/src/pages/admin/{AdminUsers,BlogAdmin}Page.jsx`

- **Service Requests Kanban card layout (responsive):**
  - `frontend/src/pages/ServiceRequestsPage.jsx` `ServiceRequestKanban` uses wider columns on desktop (`xs=12 md=6 lg=4 xl=3`) and card internals are optimized for narrow columns.
  - Card title is line-clamped (2 lines) and chips wrap with row/column gaps.
  - Property + Unit block always renders (Unit shows `Property-wide` when no unit) and text uses word wrapping to avoid clipped info.

- **Dashboard summary tenant counts + cache invalidation:**
  - `backend/controllers/dashboardController.js` includes `summary.tenants.total` (counts active `UnitTenant` assignments scoped to the user-accessible properties).
  - `backend/src/routes/units.js` invalidates dashboard summary cache pattern `cache:/api/dashboard/summary:user:<userId>*` after tenant assignment updates so dashboard/checklist reflects changes immediately.

- **Service Request convert-to-job fallback (no owners):**
  - When a property has **no owners**, the property manager can convert a service request to a job without waiting for owner approval.
  - Backend: `POST /api/service-requests/:id/convert-to-job` allows conversion if `property.owners.length === 0`; otherwise requires `APPROVED_BY_OWNER`.
  - Frontend: convert actions are enabled when status is `APPROVED_BY_OWNER` **or** the property has no owners.

- **Service Requests: unified Convert-to-Job UI + mobile actions:**
  - Removed legacy inline `ConvertToJobDialog` from `frontend/src/pages/ServiceRequestsPage.jsx` to avoid duplicate convert flows.
  - Direct Convert buttons open `ConvertServiceRequestToJobDialog` directly (standalone) and do not open `ServiceRequestDetailModal` behind it.
  - Convert inside `ServiceRequestDetailModal` continues to open the convert dialog within the modal.
  - Mobile: `ConvertServiceRequestToJobDialog` is `fullScreen` on small devices and `DialogActions` stack full-width.
  - Mobile: `ServiceRequestDetailModal` `DialogActions` and review submit button row stack full-width to prevent overlapping buttons.

## SEO / Crawling
- **Sitemap + robots:**
  - Frontend static files live in `frontend/public/` and are copied to Vercel output root by Vite.
  - `frontend/public/sitemap.xml` is a sitemap index that points to `https://api.buildstate.com.au/sitemap.xml`.
  - Backend serves dynamic `GET /sitemap.xml` (includes published blog posts from DB) and `GET /robots.txt`.

- **Blog API normalization: join-row shapes + counts:**
  - Blog post `categories`/`tags` are join rows; the related objects may be under `category`/`tag` *or* `BlogCategory`/`BlogTag` depending on normalization.
  - Blog category/tag endpoints return `publishedPostsCount` (instead of `_count.posts`).
  - Frontend mapping should be null-safe and support both shapes to avoid `Cannot read properties of undefined (reading 'name')`.
  - Also applies to blog post detail page (`frontend/src/pages/BlogPostPage.jsx`) SEO tags and tag/category chips.

- **Trial days remaining (fix 15 vs 14):**
  - Backend trial length is 14 days, but frontend `calculateDaysRemaining()` previously forced `endDate` to 23:59:59 and used `Math.ceil()`, which could display 15 days immediately after signup.
  - Fix: `frontend/src/utils/date.js` now computes remaining days from the exact `trialEndDate` timestamp (no end-of-day bump) and avoids mutating the Date object.

- **Backend security audit report:**
  - `BACKEND_SECURITY_AUDIT_REPORT.md`

- **Canonical auth middleware (backend):**
  - Prefer `requireAuth` from `backend/src/middleware/auth.js` for protected routes to ensure DB user lookup + `isActive` enforcement.
  - Billing routes in `backend/src/routes/billing.js` standardized on `requireAuth` across `/checkout`, `/confirm`, `/invoices`, `/payment-method`, `/portal`, `/change-plan`, `/cancel`.

- **Production-safe health endpoints (backend):**
  - `GET /api/v2/uploads/health` in `backend/src/routes/uploadsV2.js` avoids leaking storage configuration in production (returns only `ok` + `timestamp`).

- **Render/Linux case-sensitivity gotcha (backend):**
  - Route import paths must match filename casing exactly (e.g. `uploadsV2.js` vs `uploadsv2.js`) or Render will crash with `ERR_MODULE_NOT_FOUND`.

- **Resource-scoped list endpoints (backend):**
  - `backend/src/routes/recurringInspections.js` and `backend/src/routes/inspectionTemplates.js` enforce role-based property scoping to avoid cross-tenant data leaks.
  - Non-admin/non-PM access is gated by the property manager subscription state for the underlying property.

- **Admin user deletion policy**:
  - Default: *safe-delete* (disable + anonymize + revoke credentials) via `DELETE /api/admin/users/:id`.
  - Hard delete: `GET /api/admin/users/:id/deletion-preview` + `DELETE /api/admin/users/:id/hard?force=true`.
  - Hard delete blocks without `force=true` when it would cascade-delete core data (properties/service requests/jobs).

## CI
- **GitHub Actions:** `.github/workflows/ci.yml`
  - Runs **frontend** `npm ci`, **smoke tests** (small subset), then `npm run build`.
  - Intentionally does **not** run the full `vitest` suite to keep checks fast and avoid flaky/slow UI tests.
