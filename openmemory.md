
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

## Patterns
- **MVP feature hiding (Reports):**
  - Removed Reports from `navigationConfig.js` + RotaryFooter + Admin menu.
  - Removed `/reports*` routes from `frontend/src/App.jsx`.
  - Disabled backend mounts for reports by removing `reports`/`new-reports` from `backend/src/routes/index.js` and `/api/reports` from `backend/src/index.js`.
