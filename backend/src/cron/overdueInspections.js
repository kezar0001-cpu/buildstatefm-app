import { prisma } from '../config/prismaClient.js';
import logger from '../utils/logger.js';
import { notifyInspectionOverdue } from '../utils/notificationService.js';
import { sendOverdueInspectionDigest } from '../utils/email.js';

const FALLBACK_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Hash a string to a 32-bit integer for use with PostgreSQL advisory locks
 * @param {string} str - The string to hash
 * @returns {number} A 32-bit integer
 */
function hashStringToInt(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

function createFallbackCron() {
  return {
    schedule(_expression, task) {
      const timer = setInterval(() => {
        try {
          const result = task();
          if (result?.catch) {
            result.catch((error) => {
              logger.error('Error running fallback overdue inspection task', {
                error: error.message,
              });
            });
          }
        } catch (error) {
          logger.error('Error executing fallback overdue inspection task', {
            error: error.message,
          });
        }
      }, FALLBACK_INTERVAL_MS);

      return {
        start: () => {},
        stop: () => clearInterval(timer),
      };
    },
  };
}

let cron;
try {
  const cronModule = await import('node-cron');
  cron = cronModule.default || cronModule;
} catch (error) {
  logger.warn('node-cron package unavailable, falling back to interval scheduler.', {
    error: error.message,
  });
  cron = createFallbackCron();
}

// Run daily at 8 AM
const DEFAULT_CRON_SCHEDULE = '0 8 * * *';

function getTimezone() {
  return process.env.CRON_TIMEZONE || 'UTC';
}

/**
 * Process overdue inspections and send notifications
 */
export async function processOverdueInspections() {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  try {
    // Find all overdue inspections that haven't been marked as overdue yet
    const overdueInspections = await prisma.inspection.findMany({
      where: {
        status: 'SCHEDULED',
        scheduledDate: {
          lt: now, // Past due date
        },
      },
      include: {
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        property: {
          select: {
            id: true,
            name: true,
            address: true,
            city: true,
            state: true,
            manager: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
        unit: {
          select: {
            id: true,
            unitNumber: true,
          },
        },
      },
    });

    if (!overdueInspections.length) {
      logger.debug('No overdue inspections found at this time.');
      return { processed: 0, notified: 0 };
    }

    logger.info(`Processing ${overdueInspections.length} overdue inspection(s).`);

    // Group inspections by property manager for digest emails
    const inspectionsByManager = new Map();

    for (const inspection of overdueInspections) {
      const managerId = inspection.property?.manager?.id;
      if (managerId) {
        if (!inspectionsByManager.has(managerId)) {
          inspectionsByManager.set(managerId, {
            manager: inspection.property.manager,
            inspections: [],
          });
        }
        inspectionsByManager.get(managerId).inspections.push(inspection);
      }

      // Send individual notifications to assigned technician
      if (inspection.assignedTo) {
        try {
          await notifyInspectionOverdue(inspection, inspection.assignedTo, inspection.property);
          logger.info('Sent overdue notification to technician', {
            inspectionId: inspection.id,
            technicianId: inspection.assignedTo.id,
          });
        } catch (notificationError) {
          logger.error('Failed to notify technician about overdue inspection', {
            inspectionId: inspection.id,
            technicianId: inspection.assignedTo.id,
            error: notificationError.message,
          });
        }
      }
    }

    // Send digest emails to property managers
    let digestsSent = 0;
    for (const [managerId, data] of inspectionsByManager) {
      try {
        await sendOverdueInspectionDigest(data.manager, data.inspections);
        logger.info('Sent overdue inspection digest to manager', {
          managerId,
          inspectionCount: data.inspections.length,
        });
        digestsSent++;
      } catch (emailError) {
        logger.error('Failed to send overdue inspection digest', {
          managerId,
          error: emailError.message,
        });
      }
    }

    return {
      processed: overdueInspections.length,
      notified: digestsSent,
    };
  } catch (error) {
    logger.error('Failed to process overdue inspections', {
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

/**
 * Schedule the overdue inspection cron job
 */
export function scheduleOverdueInspectionCron() {
  if (process.env.DISABLE_OVERDUE_INSPECTION_CRON === 'true') {
    logger.warn('Overdue inspection cron job is disabled via configuration.');
    return null;
  }

  const timezone = getTimezone();

  logger.info(
    `Scheduling overdue inspection cron job with expression "${DEFAULT_CRON_SCHEDULE}" (${timezone}).`
  );

  const task = cron.schedule(
    DEFAULT_CRON_SCHEDULE,
    () => {
      processOverdueInspections().catch((error) => {
        logger.error('Unhandled error in overdue inspection cron job', {
          error: error.message,
        });
      });
    },
    {
      timezone,
    }
  );

  // Run once on startup to ensure overdue inspections are handled immediately
  processOverdueInspections().catch((error) => {
    logger.error('Initial overdue inspection processing failed', {
      error: error.message,
    });
  });

  return task;
}

export default scheduleOverdueInspectionCron;
