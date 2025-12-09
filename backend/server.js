// ============================================
//  Buildstate FM Backend – With Sentry Enabled
// ============================================

import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import passport from 'passport';
import path from 'path';
import fs from 'fs';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import mongoSanitize from 'express-mongo-sanitize';
import compression from 'compression';
import prisma, { prisma as prismaInstance } from './src/config/prismaClient.js';
import logger from './src/utils/logger.js';

import scheduleMaintenancePlanCron from './src/cron/maintenancePlans.js';
import { startRecurringInspectionCron } from './src/services/recurringInspectionService.js';
import scheduleOverdueInspectionCron from './src/cron/overdueInspections.js';
import { initializeCronJobs } from './src/jobs/cronJobs.js';
import { initWebsocket } from './src/websocket.js';

// Load environment
dotenv.config();
logger.info('>>> STARTING Buildstate FM Backend <<<');

// =======================================================
//  SENTRY INITIALIZATION (Must be before all middleware)
// =======================================================
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  integrations: [
    new Sentry.Integrations.Http({ tracing: true }),
    new Sentry.Integrations.Express({ app: undefined }),
    nodeProfilingIntegration()
  ],
  tracesSampleRate: 1.0,
  profilesSampleRate: 1.0
});

// Validate environment variables
import { validateEnvironment } from './src/utils/validateEnv.js';
validateEnvironment(true);

// Export Prisma instance
export { prismaInstance as prisma };

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Attach Express instance to Sentry after app creation
Sentry.getCurrentHub().getClient()?.getOptions().integrations?.forEach((intg) => {
  if (intg.name === "Express") intg._app = app;
});

// ===================================================
//  Sentry request + tracing handlers (FIRST MIDDLEWARE)
// ===================================================
app.use(Sentry.Handlers.requestHandler());
app.use(Sentry.Handlers.tracingHandler());

// ----------------------
// Cron Jobs
// ----------------------
scheduleMaintenancePlanCron();
startRecurringInspectionCron();
scheduleOverdueInspectionCron();
initializeCronJobs();

// ----------------------
// Trust Proxy (Render)
// ----------------------
app.set('trust proxy', 1);

// ----------------------
// CORS SETUP
// ----------------------
const allowlist = new Set(
  (process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : [])
    .map(s => s.trim())
    .filter(Boolean)
);

if (process.env.FRONTEND_URL) allowlist.add(process.env.FRONTEND_URL.trim());

[
  'https://www.buildstate.com.au',
  'https://buildstate.com.au',
  'https://api.buildstate.com.au',
  'https://agentfm.vercel.app',
  'http://localhost:5173'
].forEach((o) => allowlist.add(o));

const dynamicOriginMatchers = [/https:\/\/.+\.vercel\.app$/];

const corsOptions = {
  origin(origin, cb) {
    if (!origin) return cb(null, true);
    if (allowlist.has(origin)) return cb(null, true);
    if (dynamicOriginMatchers.some(r => r.test(origin))) return cb(null, true);
    logger.warn(`CORS Blocked: ${origin}`);
    return cb(null, false);
  },
  credentials: true
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// ----------------------
// Security Headers
// ----------------------
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' }
  })
);

// ----------------------
// Basic API Rate Limiter (Not Redis-based)
// ----------------------
app.use(
  '/api/',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200
  })
);

// ----------------------
// Sanitization, Compression, Cookies
// ----------------------
app.use(mongoSanitize());
app.use(compression());
app.use(cookieParser());

// ----------------------
// Static Uploads Folder (Local Fallback)
// ----------------------
const uploadPath = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });

app.use('/api/uploads', express.static(uploadPath));
app.use('/uploads', express.static(uploadPath));

// ----------------------
// Sessions
// ----------------------
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'replace-this-session-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    }
  })
);

// ----------------------
// Passport Auth
// ----------------------
import './src/config/passport.js';
app.use(passport.initialize());
app.use(passport.session());

// ----------------------
// Routes
// ----------------------
import authRoutes from './src/routes/auth.js';
import billingRoutes, { webhook as stripeWebhook } from './src/routes/billing.js';
import propertiesRoutes from './src/routes/properties.js';
import tenantsRoutes from './src/routes/tenants.js';
import unitsRoutes from './src/routes/units.js';
import jobsRoutes from './src/routes/jobs.js';
import inspectionsRoutes from './src/routes/inspections.js';
import inspectionTemplatesRoutes from './src/routes/inspectionTemplates.js';
import recurringInspectionsRoutes from './src/routes/recurringInspections.js';
import subscriptionsRoutes from './src/routes/subscriptions.js';
import uploadsRoutes from './src/routes/uploads.js';
import uploadsv2Routes from './src/routes/uploadsv2.js';
import reportsRoutes from './src/routes/reports.js';
import recommendationsRoutes from './src/routes/recommendations.js';
import plansRoutes from './src/routes/plans.js';
import dashboardRoutes from './src/routes/dashboard.js';
import serviceRequestsRoutes from './src/routes/serviceRequests.js';
import usersRouter from './src/routes/users.js';
import invitesRoutes from './src/routes/invites.js';
import notificationsRoutes from './src/routes/notifications.js';
import searchRoutes from './src/routes/search.js';
import jobTemplatesRoutes from './src/routes/jobTemplates.js';
import notificationPreferencesRoutes from './src/routes/notificationPreferences.js';

// ----------------------
// Stripe Webhook (Raw Body required)
// ----------------------
app.post('/api/billing/webhook', express.raw({ type: 'application/json' }), stripeWebhook);

// ----------------------
// Normal Body Parsers
// ----------------------
app.use(express.json({ limit: '4mb' }));
app.use(express.urlencoded({ extended: true }));

// ----------------------
// Mount Main Routes
// ----------------------
app.use('/api/auth', authRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/properties', propertiesRoutes);
app.use('/api/tenants', tenantsRoutes);
app.use('/api/units', unitsRoutes);
app.use('/api/jobs', jobsRoutes);
app.use('/api/inspections', inspectionsRoutes);
app.use('/api/inspection-templates', inspectionTemplatesRoutes);
app.use('/api/recurring-inspections', recurringInspectionsRoutes);
app.use('/api/subscriptions', subscriptionsRoutes);
app.use('/api/uploads', uploadsRoutes);

// New v2 Upload Engine
app.use('/api/v2/uploads', uploadsv2Routes);

app.use('/api/reports', reportsRoutes);
app.use('/api/recommendations', recommendationsRoutes);
app.use('/api/plans', plansRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/service-requests', serviceRequestsRoutes);
app.use('/api/users', usersRouter);
app.use('/api/invites', invitesRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/job-templates', jobTemplatesRoutes);
app.use('/api/notification-preferences', notificationPreferencesRoutes);

// ----------------------
// Health Check
// ----------------------
app.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({ status: 'unhealthy' });
  }
});

// ----------------------
// Root
// ----------------------
app.get('/', (_req, res) => {
  res.json({ status: 'ok', message: 'Buildstate FM API is running' });
});

// ----------------------
// 404 Handler
// ----------------------
app.use('*', (req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

// ===================================================================
//  Sentry Error Handler (before final error handler)
// ===================================================================
app.use(Sentry.Handlers.errorHandler());

// ----------------------
// Final Error Handler
// ----------------------
app.use((err, req, res, _next) => {
  logger.error('Unhandled error:', err);

  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || "Internal server error",
    ...(process.env.NODE_ENV !== "production" && { stack: err.stack })
  });
});

// ----------------------
// Start Server
// ----------------------
async function startServer() {
  try {
    const server = app.listen(PORT, () =>
      logger.info(`Backend listening on port ${PORT}`)
    );

    initWebsocket(server);
  } catch (error) {
    logger.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
