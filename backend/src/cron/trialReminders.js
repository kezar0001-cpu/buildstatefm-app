/**
 * Trial Reminder Cron Jobs
 * 
 * Schedules daily tasks to:
 * 1. Send trial expiration reminders (7, 3, 1 days before expiration)
 * 2. Expire trials that have passed their end date
 */

import { checkAndSendTrialReminders, expireTrials } from '../utils/trialReminders.js';
import logger from '../utils/logger.js';

const FALLBACK_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Hash a string to a 32-bit integer for use with PostgreSQL advisory locks
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
              logger.error('Error running fallback trial reminder task', {
                error: error.message,
              });
            });
          }
        } catch (error) {
          logger.error('Error executing fallback trial reminder task', {
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
  // Dynamic import for node-cron (handles cases where it might not be installed)
  const cronModule = await import('node-cron');
  cron = cronModule.default || cronModule;
} catch (error) {
  logger.warn('node-cron not available, using fallback interval timer');
  cron = createFallbackCron();
}

/**
 * Schedule trial reminder checks
 * Runs daily at 9:00 AM UTC
 */
export function scheduleTrialReminders() {
  const cronExpression = process.env.TRIAL_REMINDER_CRON || '0 9 * * *'; // Default: 9 AM daily

  const job = cron.schedule(cronExpression, async () => {
    try {
      logger.info('[TrialReminders] Starting daily trial reminder check');
      
      // Send reminders for trials expiring in 7, 3, and 1 days
      const reminderResults = await checkAndSendTrialReminders([7, 3, 1]);
      
      logger.info('[TrialReminders] Reminder check complete', {
        checked: reminderResults.checked,
        sent: reminderResults.sent,
        failed: reminderResults.failed,
      });

      if (reminderResults.errors.length > 0) {
        logger.error('[TrialReminders] Some reminders failed', {
          errors: reminderResults.errors,
        });
      }
    } catch (error) {
      logger.error('[TrialReminders] Error in trial reminder cron job', {
        error: error.message,
        stack: error.stack,
      });
    }
  });

  logger.info('[TrialReminders] Scheduled trial reminder cron job', {
    expression: cronExpression,
  });

  return job;
}

/**
 * Schedule trial expiration checks
 * Runs daily at midnight UTC
 */
export function scheduleTrialExpiration() {
  const cronExpression = process.env.TRIAL_EXPIRATION_CRON || '0 0 * * *'; // Default: midnight daily

  const job = cron.schedule(cronExpression, async () => {
    try {
      logger.info('[TrialExpiration] Starting daily trial expiration check');
      
      const expiredCount = await expireTrials();
      
      logger.info('[TrialExpiration] Expiration check complete', {
        expired: expiredCount,
      });
    } catch (error) {
      logger.error('[TrialExpiration] Error in trial expiration cron job', {
        error: error.message,
        stack: error.stack,
      });
    }
  });

  logger.info('[TrialExpiration] Scheduled trial expiration cron job', {
    expression: cronExpression,
  });

  return job;
}

/**
 * Start all trial-related cron jobs
 */
export function startTrialCronJobs() {
  const reminderJob = scheduleTrialReminders();
  const expirationJob = scheduleTrialExpiration();

  return {
    reminder: reminderJob,
    expiration: expirationJob,
    stop: () => {
      reminderJob.stop();
      expirationJob.stop();
    },
  };
}

