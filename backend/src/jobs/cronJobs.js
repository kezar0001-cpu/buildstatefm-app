/**
 * Cron Jobs Scheduler
 *
 * Schedules recurring tasks like trial expiration reminders
 *
 * NOTE: This requires a cron-compatible environment. On platforms like Vercel or Netlify,
 * you'll need to use their scheduled functions feature or an external cron service like:
 * - Vercel Cron Jobs (vercel.json configuration)
 * - GitHub Actions scheduled workflows
 * - External services like EasyCron, cron-job.org, or AWS EventBridge
 */

import cron from 'node-cron';
import { checkAndSendTrialReminders, expireTrials } from '../utils/trialReminders.js';

/**
 * Initialize all cron jobs
 */
export function initializeCronJobs() {
  // Only run cron jobs if explicitly enabled via environment variable
  if (process.env.ENABLE_CRON_JOBS !== 'true') {
    console.log('Cron jobs disabled. Set ENABLE_CRON_JOBS=true to enable.');
    return;
  }

  console.log('Initializing cron jobs...');

  // Check for trial expirations and send reminders daily at 9:00 AM
  cron.schedule('0 9 * * *', async () => {
    console.log('Running daily trial reminder check...');
    try {
      await checkAndSendTrialReminders([7, 3, 1]); // Remind at 7, 3, and 1 days before expiration
      await expireTrials(); // Expire any trials that have passed their end date
    } catch (error) {
      console.error('Error in trial reminder cron job:', error);
    }
  });

  console.log('Cron jobs initialized successfully');
  console.log('- Trial reminders: Daily at 9:00 AM');
}

/**
 * Manual trigger endpoints for testing (should be protected by admin auth in routes)
 */
export async function triggerTrialReminders() {
  return await checkAndSendTrialReminders([7, 3, 1]);
}

export async function triggerExpireTrials() {
  return await expireTrials();
}
