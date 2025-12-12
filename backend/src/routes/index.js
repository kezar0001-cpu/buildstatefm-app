import { Router } from 'express';

// Core route imports
import authRouter from './auth.js';
import jobsRouter from './jobs.js';
import unitsRouter from './units.js';
import propertiesRouter from './properties.js';
import dashboardRouter from './dashboard.js';
import inspectionsRouter from './inspections.js';

// Feature route imports
import billingRouter from './billing.js';
import invitesRouter from './invites.js';
import plansRouter from './plans.js';
import recommendationsRouter from './recommendations.js';
import serviceRequestsRouter from './serviceRequests.js';
import subscriptionsRouter from './subscriptions.js';
import tenantsRouter from './tenants.js';
import uploadsRouter from './uploads.js';
import usersRouter from './users.js';
import blogRouter from './blog.js';

// Previously missing route imports - now registered
import notificationsRouter from './notifications.js';
import searchRouter from './search.js';
import recurringInspectionsRouter from './recurringInspections.js';
import inspectionTemplatesRouter from './inspectionTemplates.js';

const router = Router();

// Existing routes
router.use('/auth', authRouter);
router.use('/jobs', jobsRouter);
router.use('/units', unitsRouter);
router.use('/properties', propertiesRouter);
router.use('/dashboard', dashboardRouter);
router.use('/inspections', inspectionsRouter);

// Feature routes
router.use('/billing', billingRouter);
router.use('/invites', invitesRouter);
router.use('/plans', plansRouter);
router.use('/recommendations', recommendationsRouter);
router.use('/serviceRequests', serviceRequestsRouter);
router.use('/subscriptions', subscriptionsRouter);
router.use('/tenants', tenantsRouter);
router.use('/uploads', uploadsRouter);
router.use('/users', usersRouter);
router.use('/blog', blogRouter);

// Previously missing routes - now registered
router.use('/notifications', notificationsRouter);
router.use('/search', searchRouter);
router.use('/recurring-inspections', recurringInspectionsRouter);
router.use('/inspection-templates', inspectionTemplatesRouter);

// Health check
router.get('/health', (_req, res) => res.json({ ok: true }));

export default router;