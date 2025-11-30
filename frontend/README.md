# Buildstate FM Frontend

This package contains the React frontend for the **Buildstate FM** Facilities Management and Services Marketplace app.  It is built with **Vite**, **React** (18), **React Router**, **TanStack Query**, **MUI**, **react‑hook‑form**, **Zod** and **i18next**.  The frontend communicates with the Buildstate FM backend API to manage properties, units, inspections, recommendations, jobs, plans and subscriptions.

## Prerequisites

* **Node.js** 18 or later
* **npm**
* The Buildstate FM backend running locally or accessible via network (see the backend `README.md` for setup)

## Setup

1. **Install dependencies**:
   ```bash
   cd agentfm-frontend
   npm install
   ```

2. **Configure environment** (optional):
   If your backend runs on a different host/port than the default `http://localhost:3000`, create a `.env` file in the project root and set `VITE_API_BASE_URL`:

   ```env
   VITE_API_BASE_URL="http://localhost:3000"
   ```

3. **Start the development server**:
   ```bash
   npm run dev
   ```
   The frontend will be available at `http://localhost:5173` by default.  It will proxy API calls directly to the URL specified in `VITE_API_BASE_URL`.

4. **Build for production**:
   ```bash
   npm run build
   ```
   This will output a static build to `dist/` which can be served by any static web server.  Make sure to configure your backend or reverse proxy to route API requests to the backend server.

## Highlights

* **Internationalisation (i18n)**: Language switching between English and Arabic is supported via the `react‑i18next` library.  Use the language toggle button in the navigation bar to switch.  All translatable text keys are defined in `src/i18n.js`.
* **State management**: Data fetching and caching is handled by **@tanstack/react‑query**.  Each page component uses `useQuery` to fetch data from the backend API and automatically keeps it in sync.
* **Forms & validation**: Forms use **react‑hook‑form** with **Zod** schemas for validation and error messages.  This ensures consistent validation rules across the frontend and backend.
* **Material UI (MUI)**: The UI uses Material UI components for a consistent look and responsive layout.  Feel free to customise the theme or add your own components.
* **Routing**: Client‑side navigation is handled by **react‑router‑dom**.  See `src/App.jsx` for the list of routes.

## Pages

The following pages are included in the MVP scaffold:

| Path | Component | Description |
|------|-----------|-------------|
| `/` | Dashboard | Shows KPI cards for open jobs, overdue jobs, completed jobs (30d), average PCI and pending recommendations. |
| `/properties` | Properties | Lists properties and allows creation of new properties. |
| `/properties/:id` | PropertyDetail | Shows a single property with its units and allows adding units. |
| `/plans` | Plans | Lists maintenance plans and allows creation of new plans (owner/manager only). |
| `/inspections` | Inspections | Lists inspections and schedules new inspections. |
| `/jobs` | Jobs | Lists jobs and allows updating their status. |
| `/recommendations` | Recommendations | Lists recommendations and allows conversion into jobs. |
| `/subscriptions` | Subscriptions | Lists subscriptions, allows creation of new subscriptions and updating their status. |
| `/reports` | Reports | Allows requesting owner reports for a property over a date range (stubbed backend). |

Each page is built to communicate with the corresponding backend endpoint.  When the backend API is extended, you can adjust the queries and mutations accordingly.

## Next steps

1. **Authentication**: Integrate a real authentication provider (e.g. Clerk or Auth0) and protect routes based on user roles.  Currently the frontend assumes the user is already authenticated.
2. **Enhanced error handling**: Provide user‑friendly feedback when API calls fail (snackbars, alert banners).
3. **Optimistic updates**: For job status changes and form submissions, use optimistic UI patterns to improve perceived performance.
4. **Styling**: Customise the MUI theme to match your branding and add more responsive layouts.
5. **Report viewing**: Implement a page to view generated PDF reports.  Once the backend supports PDF generation, you can embed or download the PDF via `/reports/:id.pdf`.