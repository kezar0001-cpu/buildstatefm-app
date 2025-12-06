import { prisma } from '../config/prismaClient.js';
import logger from '../utils/logger.js';
import { notifyJobAssigned } from '../utils/notificationService.js';

const FALLBACK_INTERVAL_MS = 24 * 60 * 60 * 1000;

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
              logger.error('Error running fallback maintenance plan task', {
                error: error.message,
              });
            });
          }
        } catch (error) {
          logger.error('Error executing fallback maintenance plan task', {
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

const DEFAULT_CRON_SCHEDULE = '0 0 * * *'; // Once per day at midnight

function getTimezone() {
  return process.env.CRON_TIMEZONE || 'UTC';
}

function calculateNextDueDate(currentDueDate, frequency) {
  const baseDate = currentDueDate ? new Date(currentDueDate) : new Date();
  const nextDate = new Date(baseDate);
  // Normalize frequency to handle both uppercase enum values and lowercase variations
  const normalizedFrequency = (frequency || '').trim().toUpperCase();

  switch (normalizedFrequency) {
    case 'DAILY':
      nextDate.setDate(nextDate.getDate() + 1);
      break;
    case 'WEEKLY':
      nextDate.setDate(nextDate.getDate() + 7);
      break;
    case 'BIWEEKLY':
      nextDate.setDate(nextDate.getDate() + 14);
      break;
    case 'MONTHLY':
      nextDate.setMonth(nextDate.getMonth() + 1);
      break;
    case 'QUARTERLY':
      nextDate.setMonth(nextDate.getMonth() + 3);
      break;
    case 'SEMIANNUALLY':
      nextDate.setMonth(nextDate.getMonth() + 6);
      break;
    case 'ANNUALLY':
    case 'YEARLY':
      nextDate.setFullYear(nextDate.getFullYear() + 1);
      break;
    default:
      // Default to monthly if frequency is not recognized
      logger.warn(`Unknown frequency "${frequency}", defaulting to monthly`, { frequency });
      nextDate.setMonth(nextDate.getMonth() + 1);
      break;
  }

  return nextDate;
}

async function createJobForPlan(plan) {
  const now = new Date();
  const nextDueDate = calculateNextDueDate(plan.nextDueDate, plan.frequency);
  const scheduledDate = plan.nextDueDate || now;

  const result = await prisma.$transaction(async (tx) => {
    // Acquire an advisory lock on the maintenance plan ID to prevent concurrent job creation
    // The lock is automatically released at transaction end
    // Using a hash of the plan ID to convert it to a numeric lock ID
    const lockId = hashStringToInt(plan.id);
    await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(${lockId})`);

    // Defensive check: Verify no job was already created for this nextDueDate
    // This prevents duplicates even if multiple cron jobs somehow bypass the lock
    const existingJob = await tx.job.findFirst({
      where: {
        maintenancePlanId: plan.id,
        scheduledDate: scheduledDate,
      },
    });

    if (existingJob) {
      logger.info('Job already exists for this maintenance plan and scheduled date', {
        planId: plan.id,
        jobId: existingJob.id,
        scheduledDate: scheduledDate,
      });
      return existingJob;
    }

    const job = await tx.job.create({
      data: {
        title: `Maintenance: ${plan.name}`,
        description:
          plan.description || `Scheduled maintenance task generated for ${plan.name}`,
        status: 'OPEN',
        priority: 'MEDIUM',
        propertyId: plan.propertyId,
        maintenancePlanId: plan.id,
        scheduledDate: scheduledDate,
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
          },
        },
      },
    });

    await tx.maintenancePlan.update({
      where: { id: plan.id },
      data: {
        lastCompletedDate: now,
        nextDueDate,
      },
    });

    return job;
  });

  if (result.assignedTo) {
    try {
      await notifyJobAssigned(result, result.assignedTo, result.property);
    } catch (notificationError) {
      logger.error('Failed to notify assigned technician for maintenance job', {
        planId: plan.id,
        jobId: result.id,
        error: notificationError.message,
      });
    }
  }

  return result;
}

export async function processMaintenancePlans() {
  const now = new Date();

  try {
    const duePlans = await prisma.maintenancePlan.findMany({
      where: {
        isActive: true,
        autoCreateJobs: true,
        nextDueDate: {
          lte: now,
        },
      },
      include: {
        property: {
          select: {
            id: true,
            name: true,
            address: true,
            city: true,
            state: true,
          },
        },
      },
    });

    if (!duePlans.length) {
      logger.debug('No maintenance plans due for automatic job creation at this time.');
      return;
    }

    logger.info(`Processing ${duePlans.length} maintenance plan(s) for automatic jobs.`);

    for (const plan of duePlans) {
      try {
        const job = await createJobForPlan(plan);
        logger.info('Automatically created maintenance job from plan', {
          planId: plan.id,
          jobId: job.id,
        });
      } catch (planError) {
        logger.error('Failed to process maintenance plan for automatic job creation', {
          planId: plan.id,
          error: planError.message,
        });
      }
    }
  } catch (error) {
    logger.error('Failed to process maintenance plans for automatic jobs', {
      error: error.message,
    });
  }
}

export function scheduleMaintenancePlanCron() {
  if (process.env.DISABLE_MAINTENANCE_PLAN_CRON === 'true') {
    logger.warn('Maintenance plan cron job is disabled via configuration.');
    return null;
  }

  const timezone = getTimezone();

  logger.info(
    `Scheduling maintenance plan cron job with expression "${DEFAULT_CRON_SCHEDULE}" (${timezone}).`
  );

  const task = cron.schedule(
    DEFAULT_CRON_SCHEDULE,
    () => {
      processMaintenancePlans().catch((error) => {
        logger.error('Unhandled error in maintenance plan cron job', {
          error: error.message,
        });
      });
    },
    {
      timezone,
    }
  );

  // Run once on startup to ensure overdue plans are handled immediately
  processMaintenancePlans().catch((error) => {
    logger.error('Initial maintenance plan processing failed', {
      error: error.message,
    });
  });

  return task;
}

export default scheduleMaintenancePlanCron;
