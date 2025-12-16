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
import requestLogger, { errorLogger } from './src/middleware/logger.js';

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
  // Use only supported integrations to avoid runtime errors in local/dev.
  // The Http and Express integrations are omitted because they are not
  // available on the currently installed @sentry/node version.
  integrations: [
    nodeProfilingIntegration(),
  ],
  tracesSampleRate: 1.0,
  profilesSampleRate: 1.0,
});

// Validate environment variables
import { validateEnvironment } from './src/utils/validateEnv.js';
validateEnvironment(true);

// Export Prisma instance
export { prismaInstance as prisma };

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Note: Express-specific integration wiring is skipped because we're not
// using Sentry's Express integration in this configuration.

// ===================================================
//  Sentry request + tracing handlers (FIRST MIDDLEWARE)
// ===================================================
if (Sentry.Handlers && typeof Sentry.Handlers.requestHandler === 'function') {
  app.use(Sentry.Handlers.requestHandler());
}

if (Sentry.Handlers && typeof Sentry.Handlers.tracingHandler === 'function') {
  app.use(Sentry.Handlers.tracingHandler());
}

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

app.use(requestLogger);

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
import uploadsv2Routes from './src/routes/uploadsV2.js'; // Fix case-sensitive import path
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
import adminRoutes from './src/routes/admin.js';
import blogRoutes from './src/routes/blog.js';

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
app.use('/api/v2/uploads', uploadsv2Routes); // Fix case-sensitive import path

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
app.use('/api/admin', adminRoutes);
app.use('/api/blog', blogRoutes);

// ----------------------
// Health Check
// ----------------------
app.get('/sitemap.xml', async (_req, res) => {
  try {
    const baseUrl = (process.env.FRONTEND_URL || 'https://www.buildstate.com.au').replace(/\/$/, '');

    const posts = await prisma.blogPost.findMany({
      where: {
        status: 'PUBLISHED',
        publishedAt: { lte: new Date() },
      },
      select: {
        slug: true,
        updatedAt: true,
        publishedAt: true,
      },
      orderBy: { publishedAt: 'desc' },
    });

    const escapeXml = (value) => {
      return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
    };

    const staticUrls = [
      { loc: `${baseUrl}/`, changefreq: 'weekly', priority: '1.0' },
      { loc: `${baseUrl}/blog`, changefreq: 'daily', priority: '0.8' },
      { loc: `${baseUrl}/signin`, changefreq: 'monthly', priority: '0.2' },
      { loc: `${baseUrl}/signup`, changefreq: 'monthly', priority: '0.2' },
      { loc: `${baseUrl}/forgot-password`, changefreq: 'monthly', priority: '0.1' },
    ];

    const urlEntries = [
      ...staticUrls.map((u) => {
        return [
          '  <url>',
          `    <loc>${escapeXml(u.loc)}</loc>`,
          u.lastmod ? `    <lastmod>${escapeXml(u.lastmod)}</lastmod>` : null,
          u.changefreq ? `    <changefreq>${escapeXml(u.changefreq)}</changefreq>` : null,
          u.priority ? `    <priority>${escapeXml(u.priority)}</priority>` : null,
          '  </url>',
        ]
          .filter(Boolean)
          .join('\n');
      }),
      ...posts.map((p) => {
        const lastmod = (p.updatedAt || p.publishedAt || new Date()).toISOString();
        return [
          '  <url>',
          `    <loc>${escapeXml(`${baseUrl}/blog/${p.slug}`)}</loc>`,
          `    <lastmod>${escapeXml(lastmod)}</lastmod>`,
          '    <changefreq>weekly</changefreq>',
          '    <priority>0.6</priority>',
          '  </url>',
        ].join('\n');
      }),
    ].join('\n');

    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      urlEntries,
      '</urlset>',
      '',
    ].join('\n');

    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.status(200).send(xml);
  } catch (err) {
    logger.error('Error generating sitemap.xml', { err });
    return res.status(500).send('Failed to generate sitemap');
  }
});

app.get('/robots.txt', (_req, res) => {
  const baseUrl = (process.env.FRONTEND_URL || 'https://www.buildstate.com.au').replace(/\/$/, '');
  const content = `User-agent: *\nAllow: /\n\nSitemap: ${baseUrl}/sitemap.xml\n`;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300');
  return res.status(200).send(content);
});

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

app.use(errorLogger);

// ===================================================================
//  Sentry Error Handler (before final error handler)
// ===================================================================
if (Sentry.Handlers && typeof Sentry.Handlers.errorHandler === 'function') {
  app.use(Sentry.Handlers.errorHandler());
}

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
