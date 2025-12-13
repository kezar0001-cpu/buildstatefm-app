
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

- **Service Requests filters (mobile-friendly):** `frontend/src/pages/ServiceRequestsPage.jsx`
  - On mobile, search is full-width and filters are in a `Collapse` toggled by a "Filters" button with an active-count chip.
  - On desktop, filters remain inline in a single row.
- **Navigation config:** `frontend/src/utils/navigationConfig.js`
  - Defines `NAVIGATION_ITEMS` and `MOBILE_NAV_ITEMS` by role.

## RBAC
- **Option 1 (Technician/Tenant read-only):** Technicians and tenants can access Properties/Units pages but only in read-only mode.
  - **No create/edit/delete/assignment UI** is shown for read-only roles.
  - `/properties/:id/edit` remains blocked for non-edit roles.
  - Backend supports scoped read access and gates non-PM roles by the property manager subscription.

- **Jobs (backend):** `backend/src/routes/jobs.js`
  - TENANT cannot access jobs endpoints (use service requests).
  - OWNER/TECHNICIAN reads and technician actions (`/accept`, `/reject`, status updates) are gated by the *property manager* subscription (ACTIVE or TRIAL not expired).
  - ADMIN is not subscription-gated.

- **Inspections (backend):**
  - `backend/src/routes/inspections.js` gates non-PM/non-admin inspection access by the *property manager* subscription (not technician subscription).
  - `backend/src/controllers/inspectionController.js` filters technician list results to only properties whose manager subscription is active.
  - ADMIN is not subscription-gated (uses `requireActiveSubscriptionUnlessAdmin` where needed).

## Patterns
- **MVP feature hiding (Reports):**
  - Removed Reports from `navigationConfig.js` + RotaryFooter + Admin menu.
  - Removed `/reports*` routes from `frontend/src/App.jsx`.
  - Disabled backend mounts for reports by removing `reports`/`new-reports` from `backend/src/routes/index.js` and `/api/reports` from `backend/src/index.js`.

- **Admin user deletion policy**:
  - Default: *safe-delete* (disable + anonymize + revoke credentials) via `DELETE /api/admin/users/:id`.
  - Hard delete: `GET /api/admin/users/:id/deletion-preview` + `DELETE /api/admin/users/:id/hard?force=true`.
  - Hard delete blocks without `force=true` when it would cascade-delete core data (properties/service requests/jobs).

## CI
- **GitHub Actions:** `.github/workflows/ci.yml`
  - Runs **frontend** `npm ci`, **smoke tests** (small subset), then `npm run build`.
  - Intentionally does **not** run the full `vitest` suite to keep checks fast and avoid flaky/slow UI tests.
