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
import prisma, { prisma as prismaInstance } from './config/prismaClient.js';
import logger from './utils/logger.js';
import scheduleMaintenancePlanCron from './cron/maintenancePlans.js';
import scheduleBlogAutomationCron from './cron/blogAutomation.js';

// ---- Load env
dotenv.config();

logger.info('>>> STARTING AgentFM Backend <<<');

// ---- Prisma (re-exported for backwards compatibility)
export { prismaInstance as prisma };

// ---- App
const app = express();
const PORT = process.env.PORT || 3000;

// ---- Cron Jobs
const maintenancePlanCronTask = scheduleMaintenancePlanCron();
const blogAutomationCronTask = scheduleBlogAutomationCron();

// Trust proxy so secure cookies & redirects work behind Render/CF
app.set('trust proxy', 1);

// ---- CORS (MUST come before rate limiters and other middleware)
const allowlist = new Set(
  (process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : [])
    .map((s) => s && s.trim())
    .filter(Boolean)
);
if (process.env.FRONTEND_URL) allowlist.add(process.env.FRONTEND_URL.trim());
[
  'https://www.buildstate.com.au',
  'https://buildstate.com.au',
  'https://api.buildstate.com.au',
  'https://agentfm.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
].forEach((o) => allowlist.add(o));
const dynamicOriginMatchers = [
  /https:\/\/.+\.vercel\.app$/,
];

const corsOptions = {
  origin(origin, cb) {
    // No origin (same-origin requests, Postman, etc.)
    if (!origin) {
      logger.debug('CORS: No origin header, allowing request');
      return cb(null, true);
    }

    // Check allowlist
    if (allowlist.has(origin)) {
      logger.debug(`CORS: Origin ${origin} found in allowlist`);
      return cb(null, true);
    }

    // Check dynamic matchers (e.g., *.vercel.app)
    if (dynamicOriginMatchers.some((regex) => regex.test(origin))) {
      logger.debug(`CORS: Origin ${origin} matched dynamic pattern`);
      return cb(null, true);
    }

    // Reject origin (but don't throw error - this ensures CORS headers are still sent)
    logger.warn(`CORS: Blocked origin: ${origin}`);
    return cb(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['set-cookie'],
  preflightContinue: false,
  optionsSuccessStatus: 204
};

app.use(cors(corsOptions));

// Explicit OPTIONS handler for all routes to ensure preflight requests work
app.options('*', cors(corsOptions));

// ---- Security Middleware
// Helmet helps secure Express apps by setting various HTTP headers
const connectSrc = new Set(["'self'", 'https:', 'wss:']);

function normaliseOrigin(origin) {
  if (!origin) return null;
  return origin.trim().replace(/\/$/, '') || null;
}

function addOriginWithWebsocketVariants(origin) {
  const normalised = normaliseOrigin(origin);
  if (!normalised) return;
  connectSrc.add(normalised);
  if (normalised.startsWith('http')) {
    connectSrc.add(normalised.replace(/^http/, 'ws'));
  }
}

addOriginWithWebsocketVariants(process.env.API_URL);
addOriginWithWebsocketVariants(process.env.APP_URL);
addOriginWithWebsocketVariants(process.env.FRONTEND_URL);
addOriginWithWebsocketVariants(process.env.VITE_API_BASE_URL);
addOriginWithWebsocketVariants('https://agentfm-backend.onrender.com');
addOriginWithWebsocketVariants('https://api.buildstate.com.au');

for (const origin of allowlist) {
  addOriginWithWebsocketVariants(origin);
}

const contentSecurityPolicy = {
  directives: {
    defaultSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    scriptSrc: ["'self'"],
    imgSrc: ["'self'", "data:", "https:"],
    connectSrc: Array.from(connectSrc),
    frameSrc: Array.from(connectSrc), // Allow iframes from API domains for document preview
    childSrc: Array.from(connectSrc), // Fallback for frameSrc
  },
};

app.use(helmet({
  contentSecurityPolicy,
  crossOriginEmbedderPolicy: false, // Allow embedding for OAuth
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// Rate limiting to prevent brute force attacks
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to all API routes
app.use('/api/', limiter);

// Stricter rate limiting for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: 'Too many authentication attempts, please try again later.',
  skipSuccessfulRequests: true,
});

const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: 'Too many password reset attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/auth/login', authLimiter);
app.use('/api/auth/signup', authLimiter);
app.use('/api/auth/forgot-password', forgotPasswordLimiter);

// Data sanitization against NoSQL query injection
app.use(mongoSanitize());

// Compression middleware
app.use(compression());
app.use(cookieParser());

// ---- Serve Static Files ---
const uploadPath = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true });
}
app.use('/uploads', express.static(uploadPath));
app.use('/api/uploads', express.static(uploadPath));

// ---- Session
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'replace-this-session-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  })
);

// ---- Passport
import './config/passport.js';
app.use(passport.initialize());
app.use(passport.session());

// ---- Middleware
import requestLogger from './middleware/logger.js';

// ---- Routes (Import all route handlers)
import authRoutes from './routes/auth.js';
import billingRoutes, { webhook as stripeWebhook } from './routes/billing.js';
import propertiesRoutes from './routes/properties.js';
import tenantsRoutes from './routes/tenants.js';
// import maintenanceRoutes from './routes/maintenance.js'; // DISABLED: Uses non-existent models, use serviceRequests instead
import unitsRoutes from './routes/units.js';
import jobsRoutes from './routes/jobs.js';
import inspectionsRoutes from './routes/inspections.js';
import subscriptionsRoutes from './routes/subscriptions.js';
import uploadsRoutes from './routes/uploads.js';
import reportsRoutes from './routes/reports.js';
import recommendationsRoutes from './routes/recommendations.js';
import plansRoutes from './routes/plans.js';
import dashboardRoutes from './routes/dashboard.js';
import serviceRequestsRoutes from './routes/serviceRequests.js';
import usersRouter from './routes/users.js';
import invitesRoutes from './routes/invites.js';
import notificationsRoutes from './routes/notifications.js';
import searchRoutes from './routes/search.js';
import blogRoutes from './routes/blog.js';

// ===================================================================
//
// ⚠️ CRITICAL FIX: Stripe webhook MUST come before express.json()
//    and before app.use('/api/billing', billingRoutes)
//
// ===================================================================
app.post('/api/billing/webhook', express.raw({ type: 'application/json' }), stripeWebhook);

// ---- Body parsers (MUST come AFTER webhook but BEFORE other routes)
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// ---- Request/Response Logging (MUST come AFTER body parsers but BEFORE routes)
app.use(requestLogger);

// ---- Mount routes (MUST come AFTER body parsers and logging middleware)
app.use('/api/auth', authRoutes);
app.use('/api/billing', billingRoutes); // This will now correctly ignore the webhook path
app.use('/api/properties', propertiesRoutes);
app.use('/api/tenants', tenantsRoutes);
// app.use('/api/maintenance', maintenanceRoutes); // DISABLED: Uses non-existent models, use /api/service-requests instead
app.use('/api/units', unitsRoutes);
app.use('/api/jobs', jobsRoutes);
app.use('/api/inspections', inspectionsRoutes);
app.use('/api/subscriptions', subscriptionsRoutes);
app.use('/api/upload', uploadsRoutes); // Changed to /upload (singular) to avoid conflict with static /api/uploads
app.use('/api/reports', reportsRoutes);
app.use('/api/recommendations', recommendationsRoutes);
app.use('/api/plans', plansRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/service-requests', serviceRequestsRoutes);
app.use('/api/users', usersRouter);
app.use('/api/invites', invitesRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/blog', blogRoutes);


// ---- Health, Root, 404, Error Handler, and Shutdown logic
app.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    const healthData = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: 'connected',
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      }
    };
    res.json(healthData);
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(503).json({ 
      status: 'unhealthy', 
      timestamp: new Date().toISOString(),
      error: 'Database connection failed' 
    });
  }
});

app.get('/', (_req, res) => {
  res.json({ status: 'ok', message: 'AgentFM API is running' });
});

app.use('*', (req, res) => {
  logger.warn(`404 - Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

app.use((err, req, res, _next) => {
  logger.error('Unhandled error:', {
    error: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip
  });
  
  if (res.headersSent) {
    return;
  }
  
  const status = err.statusCode || err.status || 500;
  const message = process.env.NODE_ENV === 'production' 
    ? 'Internal server error' 
    : err.message || 'Internal server error';
    
  res.status(status).json({
    success: false,
    message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
});

async function startServer() {
  try {
    const server = app.listen(PORT, () => {
      logger.info(`✅ AgentFM backend listening on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`Database: ${process.env.DATABASE_URL ? 'Connected' : 'Not configured'}`);
    });

    let shuttingDown = false;
    const shutdown = async (signal) => {
      if (shuttingDown) return;
      shuttingDown = true;
      logger.info(`Received ${signal}. Shutting down gracefully...`);
      const closeServer = new Promise((resolve) => {
        server.close(() => {
          resolve();
        });
      });
      if (maintenancePlanCronTask) {
        try {
          maintenancePlanCronTask.stop();
        } catch (cronError) {
          logger.error('Error stopping maintenance plan cron task:', cronError);
        }
      }
      try {
        await Promise.allSettled([closeServer, prisma.$disconnect()]);
        logger.info('Shutdown complete. Goodbye!');
        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (error) {
    logger.error('❌ Failed to start AgentFM backend:', error);
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

startServer();