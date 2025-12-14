import { Router } from 'express';
import multer from 'multer';
import prisma from '../config/prismaClient.js';
import {
  requireAuth,
  requireRole,
  requireActiveSubscription,
  requireUsage,
  isSubscriptionActive,
} from '../middleware/auth.js';

import { getInspectionsThisMonth } from '../utils/usageTracking.js';
import { sendError, ErrorCodes } from '../utils/errorHandler.js';
import { isValidInspectionTransition } from '../utils/statusTransitions.js';
import * as inspectionController from '../controllers/inspectionController.js';
import * as inspectionDetailsController from '../controllers/inspectionDetailsController.js';

const router = Router();

// Roles
const ROLE_MANAGER = 'PROPERTY_MANAGER';
const ROLE_TECHNICIAN = 'TECHNICIAN';
const ROLE_OWNER = 'OWNER';
const ROLE_TENANT = 'TENANT';
const ROLE_ADMIN = 'ADMIN';

const requireActiveSubscriptionUnlessAdmin = (req, res, next) => {
  if (req.user?.role === ROLE_ADMIN) {
    return next();
  }
  return requireActiveSubscription(req, res, next);
};

// Middleware: Hydrate User
const hydrateInspectionUser = async (req, res, next) => {
  try {
    if (!req.user?.id) {
      return sendError(res, 401, 'Unauthorized', ErrorCodes.AUTH_UNAUTHORIZED);
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        managedProperties: { select: { id: true } },
        ownedProperties: { select: { propertyId: true } },
        tenantUnits: { select: { unitId: true, isActive: true } },
      },
    });

    if (!user) {
      return sendError(res, 401, 'User not found', ErrorCodes.AUTH_UNAUTHORIZED);
    }

    // Augment user object for access control checks
    req.user = {
      ...user,
      managedPropertyIds: user.managedProperties?.map(p => p.id) ?? [],
      ownedPropertyIds: user.ownedProperties?.map(p => p.propertyId) ?? [],
      tenantUnitIds: user.tenantUnits?.filter(l => l.isActive).map(l => l.unitId) ?? [],
    };
    next();
  } catch (error) {
    console.error('Failed to hydrate inspection user', error);
    return sendError(res, 401, 'Unauthorized', ErrorCodes.AUTH_UNAUTHORIZED);
  }
};

// Middleware: Ensure Access
const ensureInspectionAccess = async (req, res, next) => {
  try {
    const inspection = await prisma.inspection.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        propertyId: true,
        unitId: true,
        assignedToId: true,
      },
    });

    if (!inspection) {
      return sendError(res, 404, 'Inspection not found', ErrorCodes.RES_INSPECTION_NOT_FOUND);
    }

    const user = req.user;
    let hasAccess = false;

    if (user.role === ROLE_ADMIN) {
      hasAccess = true;
    } else if (user.role === ROLE_MANAGER) {
      // Manager can access if they manage the property (or if it's a system-wide admin, but we assume property manager scope here)
      hasAccess = inspection.propertyId ? user.managedPropertyIds.includes(inspection.propertyId) : true; 
    } else if (user.role === ROLE_OWNER) {
      hasAccess = inspection.propertyId ? user.ownedPropertyIds.includes(inspection.propertyId) : false;
    } else if (user.role === ROLE_TECHNICIAN) {
      hasAccess = inspection.assignedToId === user.id;
    } else if (user.role === ROLE_TENANT) {
      hasAccess = inspection.unitId ? user.tenantUnitIds.includes(inspection.unitId) : false;
    }

    if (!hasAccess) {
      return sendError(res, 403, 'Forbidden', ErrorCodes.ACC_ACCESS_DENIED);
    }

    req.inspection = inspection;
    next();
  } catch (error) {
    console.error('Failed to check inspection access', error);
    sendError(res, 500, 'Failed to verify permissions', ErrorCodes.ERR_INTERNAL_SERVER);
  }
};

const ensureManagerSubscriptionActiveForInspection = async (req, res, next) => {
  try {
    if (!req.user) {
      return sendError(res, 401, 'Unauthorized', ErrorCodes.AUTH_UNAUTHORIZED);
    }

    if (req.user.role === ROLE_MANAGER || req.user.role === ROLE_ADMIN) {
      return next();
    }

    const propertyId = req.inspection?.propertyId;
    if (!propertyId) {
      return next();
    }

    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      select: {
        id: true,
        manager: {
          select: {
            id: true,
            subscriptionStatus: true,
            trialEndDate: true,
          },
        },
      },
    });

    if (!property) {
      return next();
    }

    if (isSubscriptionActive(property.manager)) {
      return next();
    }

    return sendError(
      res,
      403,
      "This property's subscription has expired. Please contact your property manager.",
      ErrorCodes.SUB_MANAGER_SUBSCRIPTION_REQUIRED,
    );
  } catch (error) {
    console.error('Failed to verify manager subscription for inspection', error);
    return sendError(res, 500, 'Failed to verify subscription', ErrorCodes.ERR_INTERNAL_SERVER);
  }
};

// Multer setup for signatures
const signatureUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB max
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'image/png' || file.mimetype === 'image/jpeg') {
      cb(null, true);
    } else {
      cb(new Error('Only PNG and JPEG images are allowed for signatures'));
    }
  },
});

// Apply global middleware for this router
router.use(requireAuth);
router.use(hydrateInspectionUser);

// --- Main Inspection Routes ---

router.get('/tags', inspectionController.getTags);
router.get('/analytics', inspectionController.getAnalytics);
router.get('/calendar', inspectionController.getCalendar);
router.get('/overdue', requireAuth, hydrateInspectionUser, inspectionController.getOverdueInspections);
router.get('/inspectors', requireAuth, async (req, res) => {
  try {
    const inspectors = await prisma.user.findMany({
      where: { role: ROLE_TECHNICIAN },
      select: { id: true, firstName: true, lastName: true, email: true },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    });
    res.json({ inspectors });
  } catch (error) {
    console.error('Failed to load inspectors', error);
    sendError(res, 500, 'Failed to load inspectors', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

// Inspections are only accessible to Property Managers, Owners and Technicians
router.get('/', requireAuth, requireRole(ROLE_MANAGER, ROLE_TECHNICIAN, ROLE_OWNER, ROLE_ADMIN), hydrateInspectionUser, inspectionController.listInspections);

router.post(
  '/',
  requireRole(ROLE_MANAGER),
  requireActiveSubscriptionUnlessAdmin,
  requireUsage('inspectionsPerMonth', async (userId) => await getInspectionsThisMonth(userId)),
  inspectionController.createInspection
);
router.post(
  '/bulk',
  requireRole(ROLE_MANAGER),
  requireActiveSubscriptionUnlessAdmin,
  requireUsage('inspectionsPerMonth', async (userId) => await getInspectionsThisMonth(userId)),
  inspectionController.bulkCreateInspections
);
router.get('/:id', ensureInspectionAccess, ensureManagerSubscriptionActiveForInspection, inspectionController.getInspection);
router.get('/:id/batch', ensureInspectionAccess, ensureManagerSubscriptionActiveForInspection, inspectionDetailsController.getBatchedInspectionDetails);
router.patch('/:id', requireRole(ROLE_MANAGER, ROLE_TECHNICIAN, ROLE_ADMIN), ensureInspectionAccess, ensureManagerSubscriptionActiveForInspection, inspectionController.updateInspection);
router.delete('/:id', requireRole(ROLE_MANAGER, ROLE_ADMIN), requireActiveSubscriptionUnlessAdmin, ensureInspectionAccess, inspectionController.deleteInspection);

// --- Workflow Actions ---

router.post('/:id/reminders', requireRole(ROLE_MANAGER), ensureInspectionAccess, inspectionController.createReminder);

router.post('/:id/complete', requireRole(ROLE_MANAGER, ROLE_TECHNICIAN, ROLE_ADMIN), ensureInspectionAccess, ensureManagerSubscriptionActiveForInspection, inspectionController.completeInspection);
router.post('/:id/generate-summary', requireRole(ROLE_MANAGER, ROLE_TECHNICIAN, ROLE_ADMIN), ensureInspectionAccess, ensureManagerSubscriptionActiveForInspection, inspectionController.generateSummary);
router.post('/:id/approve', requireRole(ROLE_MANAGER, ROLE_ADMIN), ensureInspectionAccess, inspectionController.approveInspection);
router.post('/:id/reject', requireRole(ROLE_MANAGER, ROLE_ADMIN), ensureInspectionAccess, inspectionController.rejectInspection);
router.post('/:id/signature', requireAuth, ensureInspectionAccess, ensureManagerSubscriptionActiveForInspection, signatureUpload.single('signature'), inspectionController.uploadSignature);
router.get('/:id/report/pdf', requireAuth, ensureInspectionAccess, ensureManagerSubscriptionActiveForInspection, inspectionController.generatePDF);

// --- Sub-resources: Rooms ---

router.get('/:id/rooms', ensureInspectionAccess, inspectionDetailsController.getRooms);
router.post('/:id/rooms', ensureInspectionAccess, inspectionDetailsController.addRoom);
router.patch('/:id/rooms/:roomId', ensureInspectionAccess, inspectionDetailsController.updateRoom);
router.delete('/:id/rooms/:roomId', ensureInspectionAccess, inspectionDetailsController.deleteRoom);

// --- Sub-resources: Checklist Items ---

router.post('/:id/rooms/:roomId/checklist/generate', ensureInspectionAccess, inspectionDetailsController.generateAIChecklist);
router.post('/:id/rooms/:roomId/checklist', ensureInspectionAccess, inspectionDetailsController.addChecklistItem);
router.patch('/:id/rooms/:roomId/checklist/:itemId', ensureInspectionAccess, inspectionDetailsController.updateChecklistItem);
router.delete('/:id/rooms/:roomId/checklist/:itemId', ensureInspectionAccess, inspectionDetailsController.deleteChecklistItem);

// --- Sub-resources: Issues ---

router.get('/:id/issues', ensureInspectionAccess, inspectionDetailsController.getIssues);
router.post('/:id/issues', ensureInspectionAccess, inspectionDetailsController.addIssue);
router.patch('/:id/issues/:issueId', ensureInspectionAccess, inspectionDetailsController.updateIssue);
router.delete('/:id/issues/:issueId', ensureInspectionAccess, inspectionDetailsController.deleteIssue);

// --- Sub-resources: Photos ---

router.get('/:id/photos', ensureInspectionAccess, inspectionDetailsController.getPhotos);
router.post('/:id/photos', ensureInspectionAccess, inspectionDetailsController.addPhoto);
router.patch('/:id/photos/:photoId', ensureInspectionAccess, inspectionDetailsController.updatePhoto);
router.delete('/:id/photos/:photoId', ensureInspectionAccess, inspectionDetailsController.deletePhoto);

 // --- Misc Routes (kept from original if needed, simplified) ---
 // Note: /inspectors route is defined above before /:id to avoid route conflicts
 
 export default router;