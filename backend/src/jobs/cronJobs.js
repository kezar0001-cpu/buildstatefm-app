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
import { prisma } from '../config/prismaClient.js';

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

  // Archive rejected recommendations after 24 hours - runs every hour
  cron.schedule('0 * * * *', async () => {
    console.log('Running recommendation archiving check...');
    try {
      await archiveRejectedRecommendations();
    } catch (error) {
      console.error('Error in recommendation archiving cron job:', error);
    }
  });

  // Archive service requests - runs every hour
  cron.schedule('0 * * * *', async () => {
    console.log('Running service request archiving check...');
    try {
      await archiveServiceRequests();
    } catch (error) {
      console.error('Error in service request archiving cron job:', error);
    }
  });

  console.log('Cron jobs initialized successfully');
  console.log('- Trial reminders: Daily at 9:00 AM');
  console.log('- Recommendation archiving: Every hour');
  console.log('- Service request archiving: Every hour');
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

/**
 * Archive rejected recommendations that have been rejected for more than 24 hours
 */
export async function archiveRejectedRecommendations() {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  
  const result = await prisma.recommendation.updateMany({
    where: {
      status: 'REJECTED',
      rejectedAt: {
        not: null,
        lte: twentyFourHoursAgo,
      },
    },
    data: {
      status: 'ARCHIVED',
    },
  });

  if (result.count > 0) {
    console.log(`Archived ${result.count} rejected recommendation(s) that were rejected more than 24 hours ago`);
  }

  return result;
}

/**
 * Archive service requests based on approval/rejection timing
 * - Approved requests: archived after 24 hours
 * - Rejected requests: archived after 25 hours
 */
export async function archiveServiceRequests() {
  const now = Date.now();
  const twentyFourHoursAgo = new Date(now - 24 * 60 * 60 * 1000);
  const twentyFiveHoursAgo = new Date(now - 25 * 60 * 60 * 1000);

  // Archive approved requests after 24 hours
  const approvedResult = await prisma.serviceRequest.updateMany({
    where: {
      status: {
        in: ['APPROVED', 'APPROVED_BY_OWNER'],
      },
      approvedAt: {
        not: null,
        lte: twentyFourHoursAgo,
      },
    },
    data: {
      status: 'ARCHIVED',
      archivedAt: new Date(),
    },
  });

  if (approvedResult.count > 0) {
    console.log(`Archived ${approvedResult.count} approved service request(s) that were approved more than 24 hours ago`);
  }

  // Archive rejected requests after 25 hours
  const rejectedResult = await prisma.serviceRequest.updateMany({
    where: {
      status: {
        in: ['REJECTED', 'REJECTED_BY_OWNER'],
      },
      rejectedAt: {
        not: null,
        lte: twentyFiveHoursAgo,
      },
    },
    data: {
      status: 'ARCHIVED',
      archivedAt: new Date(),
    },
  });

  if (rejectedResult.count > 0) {
    console.log(`Archived ${rejectedResult.count} rejected service request(s) that were rejected more than 25 hours ago`);
  }

  return {
    approved: approvedResult.count,
    rejected: rejectedResult.count,
    total: approvedResult.count + rejectedResult.count,
  };
}
