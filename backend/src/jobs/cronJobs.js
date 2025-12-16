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
import { sendEmail } from '../utils/email.js';
import { getApiTelemetrySnapshot } from '../middleware/logger.js';

let lastAlertSentAtMs = 0;

async function checkAndSendSystemAlerts() {
  const alertTo = process.env.ALERT_EMAIL?.trim();
  if (!alertTo) return;

  const resendApiKey = process.env.RESEND_API_KEY?.trim();
  if (!resendApiKey) return;

  const now = Date.now();
  const cooldownMs = 6 * 60 * 60 * 1000;
  if (lastAlertSentAtMs && now - lastAlertSentAtMs < cooldownMs) {
    return;
  }

  const telemetry = getApiTelemetrySnapshot({ windowMs: 15 * 60 * 1000, now });

  const [unprocessedStripeWebhooks, oldestUnprocessedWebhook, propertyManagers] = await Promise.all([
    prisma.stripeWebhookEvent.count({ where: { processed: false } }),
    prisma.stripeWebhookEvent.findFirst({
      where: { processed: false },
      orderBy: { createdAt: 'asc' },
      select: { eventType: true, createdAt: true },
    }),
    prisma.user.findMany({
      where: { role: 'PROPERTY_MANAGER' },
      select: {
        id: true,
        email: true,
        subscriptionStatus: true,
        subscriptionPlan: true,
        subscriptions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { status: true, planName: true },
        },
      },
    }),
  ]);

  const normalise = (value) => {
    if (!value) return null;
    return String(value).trim().toUpperCase();
  };

  let missingSubscriptionCount = 0;
  let mismatchCount = 0;
  propertyManagers.forEach((pm) => {
    const latest = Array.isArray(pm.subscriptions) ? pm.subscriptions[0] : null;
    if (!latest) {
      missingSubscriptionCount += 1;
      return;
    }

    const userStatus = normalise(pm.subscriptionStatus);
    const subStatus = normalise(latest.status);
    const userPlan = normalise(pm.subscriptionPlan);
    const subPlan = normalise(latest.planName);

    const isMismatch = (userStatus && subStatus && userStatus !== subStatus) || (userPlan && subPlan && userPlan !== subPlan);
    if (isMismatch) mismatchCount += 1;
  });

  const oldestCreatedAt = oldestUnprocessedWebhook?.createdAt ? new Date(oldestUnprocessedWebhook.createdAt) : null;
  const oldestAgeMinutes = oldestCreatedAt ? Math.round((now - oldestCreatedAt.getTime()) / (60 * 1000)) : null;

  const shouldAlert =
    (telemetry?.sampleSize || 0) >= 50 &&
    ((telemetry?.totals?.errorRate || 0) > 0.05 ||
      (telemetry?.latencyMs?.p95 != null && telemetry.latencyMs.p95 > 2000) ||
      unprocessedStripeWebhooks > 50 ||
      (oldestAgeMinutes != null && oldestAgeMinutes > 30) ||
      missingSubscriptionCount > 0 ||
      mismatchCount > 0);

  if (!shouldAlert) return;

  const subject = 'Buildstate FM: System alerts triggered';
  const html = `
    <h2>System alerts triggered</h2>
    <p><strong>Timestamp:</strong> ${new Date(now).toISOString()}</p>
    <h3>API telemetry (last 15m)</h3>
    <ul>
      <li>Requests: ${telemetry?.totals?.requests ?? 0}</li>
      <li>Error rate: ${(((telemetry?.totals?.errorRate ?? 0) * 100) || 0).toFixed(2)}%</li>
      <li>p95 latency: ${telemetry?.latencyMs?.p95 != null ? Math.round(telemetry.latencyMs.p95) + 'ms' : '—'}</li>
      <li>max latency: ${telemetry?.latencyMs?.max != null ? Math.round(telemetry.latencyMs.max) + 'ms' : '—'}</li>
    </ul>
    <h3>Stripe webhook backlog</h3>
    <ul>
      <li>Unprocessed: ${unprocessedStripeWebhooks}</li>
      <li>Oldest: ${oldestUnprocessedWebhook ? `${oldestUnprocessedWebhook.eventType} (${oldestAgeMinutes ?? '?'}m)` : '—'}</li>
    </ul>
    <h3>Data quality</h3>
    <ul>
      <li>PMs missing subscription record: ${missingSubscriptionCount}</li>
      <li>PM subscription mismatches: ${mismatchCount}</li>
    </ul>
    <p>Check Admin Analytics → System for more details.</p>
  `;

  await sendEmail(alertTo, subject, html, {
    event: 'system_alert',
    windowMs: telemetry?.windowMs,
  });
  lastAlertSentAtMs = now;
}

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

  // Archive completed inspections after 24 hours - runs every hour
  cron.schedule('0 * * * *', async () => {
    console.log('Running inspection archiving check...');
    try {
      await archiveInspections();
    } catch (error) {
      console.error('Error in inspection archiving cron job:', error);
    }
  });

  // Archive completed/cancelled jobs after 24 hours - runs every hour
  cron.schedule('0 * * * *', async () => {
    console.log('Running job archiving check...');
    try {
      await archiveJobs();
    } catch (error) {
      console.error('Error in job archiving cron job:', error);
    }
  });

  // System alert checks - runs every 15 minutes
  cron.schedule('*/15 * * * *', async () => {
    try {
      await checkAndSendSystemAlerts();
    } catch (error) {
      console.error('Error in system alert cron job:', error);
    }
  });

  console.log('Cron jobs initialized successfully');
  console.log('- Trial reminders: Daily at 9:00 AM');
  console.log('- Recommendation archiving: Every hour');
  console.log('- Service request archiving: Every hour');
  console.log('- Inspection archiving: Every hour');
  console.log('- Job archiving: Every hour');
  console.log('- System alerts: Every 15 minutes (requires ALERT_EMAIL + RESEND_API_KEY)');
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
 * Archive jobs that have been completed or cancelled for more than 24 hours.
 * We keep the status as-is and set archivedAt, then rely on queries
 * to exclude archived jobs from normal views.
 */
export async function archiveJobs() {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const result = await prisma.job.updateMany({
    where: {
      archivedAt: null,
      OR: [
        {
          status: 'COMPLETED',
          completedDate: {
            not: null,
            lte: twentyFourHoursAgo,
          },
        },
        {
          status: 'CANCELLED',
          updatedAt: {
            lte: twentyFourHoursAgo,
          },
        },
      ],
    },
    data: {
      archivedAt: new Date(),
    },
  });

  if (result.count > 0) {
    console.log(`Archived ${result.count} job(s) that were completed/cancelled more than 24 hours ago`);
  }

  return result;
}

/**
 * Archive service requests based on approval/rejection timing
 * - Approved requests: archived after 24 hours
 * - Rejected requests: archived after 24 hours
 */
export async function archiveServiceRequests() {
  const now = Date.now();
  const twentyFourHoursAgo = new Date(now - 24 * 60 * 60 * 1000);

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

  // Archive rejected requests after 24 hours
  const rejectedResult = await prisma.serviceRequest.updateMany({
    where: {
      status: {
        in: ['REJECTED', 'REJECTED_BY_OWNER'],
      },
      rejectedAt: {
        not: null,
        lte: twentyFourHoursAgo,
      },
    },
    data: {
      status: 'ARCHIVED',
      archivedAt: new Date(),
    },
  });

  if (rejectedResult.count > 0) {
    console.log(`Archived ${rejectedResult.count} rejected service request(s) that were rejected more than 24 hours ago`);
  }

  return {
    approved: approvedResult.count,
    rejected: rejectedResult.count,
    total: approvedResult.count + rejectedResult.count,
  };
}

/**
 * Archive inspections that have been completed for more than 24 hours.
 * We keep the status as COMPLETED and set archivedAt, then rely on queries
 * to exclude archived inspections from normal views.
 */
export async function archiveInspections() {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const result = await prisma.inspection.updateMany({
    where: {
      archivedAt: null,
      OR: [
        {
          status: 'COMPLETED',
          completedDate: {
            not: null,
            lte: twentyFourHoursAgo,
          },
        },
        {
          status: 'CANCELLED',
          updatedAt: {
            lte: twentyFourHoursAgo,
          },
        },
      ],
    },
    data: {
      archivedAt: new Date(),
    },
  });

  if (result.count > 0) {
    console.log(`Archived ${result.count} inspection(s) that were completed more than 24 hours ago`);
  }

  return result;
}
