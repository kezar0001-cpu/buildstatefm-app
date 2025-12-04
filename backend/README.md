# Buildstate FM Backend

This package contains the backend API for the **Buildstate FM** Facilities Management and Services Marketplace app.  It is implemented with **Node.js**, **Express**, **Prisma**, **Zod** and **PostgreSQL**.  The API is multi‑tenant via an `orgId` field on every table.

## Prerequisites

* **Node.js** 18 or later
* **PostgreSQL** database (local or hosted)
* npm

**Windows Users:** See [WINDOWS_SETUP.md](WINDOWS_SETUP.md) for Windows-specific instructions, especially regarding Prisma CLI execution.

## Setup

1. **Clone this repository** (or copy these files into your project).
2. Install dependencies:

   ```sh
   cd agentfm-backend
   npm install
   ```

3. **Configure environment variables**.  Create a `.env` file in the root of `agentfm-backend` with the following contents:

   ```env
   DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE"
   PORT=3000
   ```

   Replace the PostgreSQL connection string with your own credentials.  The `PORT` variable controls which port the API listens on.

4. **Generate the Prisma client and run migrations**.  Prisma uses a declarative schema defined in `prisma/schema.prisma`.  To create the database tables and generate the client run:

   ```sh
   npx prisma generate
   npx prisma migrate dev --name init
   ```

   The first command generates the type‑safe Prisma client in `node_modules/@prisma/client`.  The second command creates a new migration named `init` and applies it to your PostgreSQL database.  You only need to run migrations when the schema changes.

5. **Start the development server**:

   ```sh
   npm run dev
   ```

   By default the server will listen on `http://localhost:3000`.  You can change the port by setting the `PORT` environment variable.

## API overview

The API follows a RESTful structure.  All requests and responses are JSON.  The routes are namespaced as follows:

| Route | Methods | Description |
|------|---------|-------------|
| `/properties` | GET, POST | List or create properties |
| `/properties/:id` | GET, PATCH, DELETE | Retrieve, update or delete a property |
| `/properties/:propertyId/units` | GET, POST | List or create units under a property |
| `/units/:unitId` | GET, PATCH, DELETE | Retrieve, update or delete a unit |
| `/inspections` | GET, POST | List or schedule inspections |
| `/inspections/:id` | GET | Retrieve a specific inspection and its findings |
| `/inspections/:id/findings` | POST | Add findings to an inspection |
| `/inspections/:id/complete` | POST | Complete an inspection, compute PCI and generate recommendations |
| `/recommendations` | GET | List recommendations |
| `/recommendations/:id/convert` | POST | Convert a recommendation into a job |
| `/jobs` | GET, POST | List or create jobs |
| `/jobs/:id` | PATCH | Update job status, schedule or vendor assignment |
| `/plans` | GET, POST | List or create maintenance plans (owner/manager only) |
| `/subscriptions` | GET, POST | List or create subscriptions |
| `/subscriptions/:id` | PATCH | Update subscription status |
| `/dashboard` | GET | Retrieve aggregate metrics for the organisation |
| `/reports/owner` | POST | Request an owner report (stub) |
| `/reports/:id.pdf` | GET | Retrieve a generated report (stub) |

Authentication is stubbed for now; every request assumes a user with `orgId` of `demo‑org` and role `owner`.  Integrate your own auth provider (e.g. Clerk or Auth0) by populating `req.user` in `src/index.js`.

## Inspection API schema alignment

`GET /api/inspections` returned a 500 response because the production database never received the inspection tables that the route expects.
The Prisma client attempted to join on `Inspection`, `InspectionAttachment`, `InspectionReminder`, and `InspectionAuditLog`, but none of those tables (or their new columns such as inspection `tags`) existed yet.
The latest migrations first create any missing inspection tables and then align their columns with the Prisma schema.
After running `npx prisma migrate deploy` followed by `npx prisma generate`, the inspections list endpoint resolves successfully and returns an empty list when no inspections match the filters.

## Development notes

* This scaffold focuses on the **MVP** features: properties, units, inspections, recommendations, jobs, maintenance plans, subscriptions and a basic dashboard.
* Use **Prisma** for all database access.  The schema is defined in `prisma/schema.prisma` and should be extended carefully when adding new features.
* **Zod** is used for request validation.  If a request body fails validation, the API responds with a 400 status and validation errors.
* Multi‑tenancy is enforced by filtering on `orgId` in every query.
* The recommendation rule engine is defined in `src/config/rules.json` and used by `applyRules` in `src/utils/pci.js`.  Adjust the rules or severity scores to suit your business logic.
* The report endpoints (`/reports/owner` and `/reports/:id.pdf`) are currently stubs.  To implement PDF generation use **Puppeteer** to render a server‑side React template or static HTML into PDF and send via email.

## Next steps

1. **Authentication**: Replace the hard‑coded user in `src/index.js` with a real auth provider.  Ensure that `req.user` contains the user’s `id`, `orgId` and `role` for use by the route guards.
2. **File uploads**: Implement S3 (or compatible) pre‑signed uploads for inspection photo storage.
3. **Notifications**: Integrate Resend or SendGrid for email notifications and a WhatsApp Business API for WhatsApp messages.
4. **Admin UI**: Build out the front‑end (see `agentfm-frontend` folder) to consume this API.
5. **Report generation**: Use Puppeteer to generate owner reports as PDFs and email them to owners.  Build an HTML template that summarises KPIs, jobs and recommendations for the selected period.