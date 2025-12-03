import express from 'express';
import { z } from 'zod';
import validate from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { prisma } from '../config/prismaClient.js';
import { sendError, ErrorCodes } from '../utils/errorHandler.js';

const router = express.Router();

const DIGEST_FREQUENCIES = ['NONE', 'DAILY', 'WEEKLY', 'MONTHLY'];

const preferencesUpdateSchema = z.object({
  emailEnabled: z.boolean().optional(),
  pushEnabled: z.boolean().optional(),
  jobAssigned: z.boolean().optional(),
  jobStatusChanged: z.boolean().optional(),
  jobCompleted: z.boolean().optional(),
  inspectionScheduled: z.boolean().optional(),
  inspectionCompleted: z.boolean().optional(),
  serviceRequestCreated: z.boolean().optional(),
  serviceRequestApproved: z.boolean().optional(),
  paymentFailed: z.boolean().optional(),
  paymentSucceeded: z.boolean().optional(),
  trialExpiring: z.boolean().optional(),
  emailDigestFrequency: z.enum(DIGEST_FREQUENCIES).optional(),
});

// ========================================
// GET /api/notification-preferences
// Get current user's notification preferences
// ========================================
router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    let preferences = await prisma.notificationPreference.findUnique({
      where: { userId },
    });

    // Create default preferences if none exist
    if (!preferences) {
      preferences = await prisma.notificationPreference.create({
        data: {
          userId,
          emailEnabled: true,
          pushEnabled: true,
          jobAssigned: true,
          jobStatusChanged: true,
          jobCompleted: true,
          inspectionScheduled: true,
          inspectionCompleted: true,
          serviceRequestCreated: true,
          serviceRequestApproved: true,
          paymentFailed: true,
          paymentSucceeded: true,
          trialExpiring: true,
          emailDigestFrequency: 'DAILY',
        },
      });
    }

    res.json(preferences);
  } catch (error) {
    console.error('Error fetching notification preferences:', error);
    return sendError(res, 500, 'Failed to fetch notification preferences', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

// ========================================
// PATCH /api/notification-preferences
// Update current user's notification preferences
// ========================================
router.patch('/', requireAuth, validate(preferencesUpdateSchema), async (req, res) => {
  try {
    const userId = req.user.id;
    const data = req.body;

    // Validation: If emailDigestFrequency is being set, ensure emailEnabled is true
    if (data.emailDigestFrequency && data.emailDigestFrequency !== 'NONE') {
      const currentPrefs = await prisma.notificationPreference.findUnique({
        where: { userId },
      });

      const emailWillBeEnabled = data.emailEnabled !== undefined
        ? data.emailEnabled
        : currentPrefs?.emailEnabled ?? true;

      if (!emailWillBeEnabled) {
        return sendError(
          res,
          400,
          'Email digest requires email notifications to be enabled',
          ErrorCodes.VAL_INVALID_INPUT
        );
      }
    }

    // Upsert preferences (create if doesn't exist)
    const preferences = await prisma.notificationPreference.upsert({
      where: { userId },
      update: data,
      create: {
        userId,
        ...data,
      },
    });

    res.json(preferences);
  } catch (error) {
    console.error('Error updating notification preferences:', error);
    return sendError(res, 500, 'Failed to update notification preferences', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

// ========================================
// POST /api/notification-preferences/reset
// Reset notification preferences to defaults
// ========================================
router.post('/reset', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    const defaultPreferences = {
      emailEnabled: true,
      pushEnabled: true,
      jobAssigned: true,
      jobStatusChanged: true,
      jobCompleted: true,
      inspectionScheduled: true,
      inspectionCompleted: true,
      serviceRequestCreated: true,
      serviceRequestApproved: true,
      paymentFailed: true,
      paymentSucceeded: true,
      trialExpiring: true,
      emailDigestFrequency: 'DAILY',
    };

    const preferences = await prisma.notificationPreference.upsert({
      where: { userId },
      update: defaultPreferences,
      create: {
        userId,
        ...defaultPreferences,
      },
    });

    res.json(preferences);
  } catch (error) {
    console.error('Error resetting notification preferences:', error);
    return sendError(res, 500, 'Failed to reset notification preferences', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

export default router;
