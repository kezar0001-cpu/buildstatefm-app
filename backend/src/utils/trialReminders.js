/**
 * Trial Expiration Reminders
 * 
 * Sends automated email reminders to property managers at 7, 3, and 1 days before trial expiration.
 */

import prisma from '../config/prismaClient.js';
import { sendEmail } from './email.js';
import logger from './logger.js';

/**
 * Generate HTML email template for trial expiration reminder
 */
function generateTrialExpirationEmailHTML(user, daysRemaining, planOptions) {
  const firstName = user.firstName || 'there';
  const plan = user.subscriptionPlan || 'FREE_TRIAL';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Trial Expiring Soon</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f4f4f4;
    }
    .container {
      background-color: #ffffff;
      border-radius: 8px;
      padding: 40px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
    }
    .logo {
      font-size: 28px;
      font-weight: bold;
      color: #1976d2;
      margin-bottom: 10px;
    }
    h1 {
      color: #333;
      font-size: 24px;
      margin-bottom: 20px;
    }
    p {
      margin-bottom: 15px;
      color: #555;
    }
    .warning {
      background-color: #fff3cd;
      border-left: 4px solid #ffc107;
      padding: 15px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .plans {
      margin: 30px 0;
    }
    .plan-card {
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 15px;
    }
    .plan-name {
      font-size: 20px;
      font-weight: bold;
      color: #1976d2;
      margin-bottom: 10px;
    }
    .plan-price {
      font-size: 24px;
      font-weight: bold;
      color: #333;
      margin-bottom: 10px;
    }
    .plan-features {
      list-style: none;
      padding: 0;
      margin: 10px 0;
    }
    .plan-features li {
      padding: 5px 0;
      color: #666;
    }
    .button {
      display: inline-block;
      padding: 14px 28px;
      background-color: #1976d2;
      color: #ffffff !important;
      text-decoration: none;
      border-radius: 5px;
      font-weight: 600;
      margin: 20px 0;
      text-align: center;
    }
    .button:hover {
      background-color: #1565c0;
    }
    .button-container {
      text-align: center;
      margin: 30px 0;
    }
    .footer {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #eee;
      font-size: 12px;
      color: #999;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">Buildstate</div>
    </div>

    <h1>Your Trial Expires in ${daysRemaining} ${daysRemaining === 1 ? 'Day' : 'Days'}</h1>

    <p>Hi ${firstName},</p>

    <p>Your free trial period is ending soon. To continue using Buildstate and access all features, please choose a subscription plan that fits your needs.</p>

    <div class="warning">
      <strong>Important:</strong> After your trial expires, you'll still be able to view your existing data, but you won't be able to create new properties, jobs, or inspections until you subscribe.
    </div>

    <div class="plans">
      <div class="plan-card">
        <div class="plan-name">Basic Plan</div>
        <div class="plan-price">$29/month</div>
        <ul class="plan-features">
          <li>✓ Up to 10 properties</li>
          <li>✓ 1 team member</li>
          <li>✓ 25 inspections per month</li>
          <li>✓ All core features</li>
        </ul>
      </div>

      <div class="plan-card">
        <div class="plan-name">Professional Plan</div>
        <div class="plan-price">$79/month</div>
        <ul class="plan-features">
          <li>✓ Up to 50 properties</li>
          <li>✓ 5 team members</li>
          <li>✓ 100 inspections per month</li>
          <li>✓ Advanced analytics</li>
          <li>✓ All core features</li>
        </ul>
      </div>

      <div class="plan-card">
        <div class="plan-name">Enterprise Plan</div>
        <div class="plan-price">$149/month</div>
        <ul class="plan-features">
          <li>✓ Unlimited properties</li>
          <li>✓ Unlimited team members</li>
          <li>✓ Unlimited inspections</li>
          <li>✓ Priority support</li>
          <li>✓ Custom integrations</li>
          <li>✓ All features</li>
        </ul>
      </div>
    </div>

    <p>All plans include access to every feature - the only difference is usage limits. Choose the plan that matches your scale.</p>

    <div class="button-container">
      <a href="${process.env.FRONTEND_URL || 'https://buildtstate.com.au'}/subscriptions" class="button">Choose Your Plan</a>
    </div>

    <p>If you have any questions, please don't hesitate to contact our support team.</p>

    <div class="footer">
      <p>This is an automated email from Buildstate. Please do not reply to this message.</p>
      <p>&copy; ${new Date().getFullYear()} Buildstate. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Send trial expiration reminder email
 * @param {object} user - User object with email, firstName, lastName
 * @param {number} daysRemaining - Days remaining until trial expiration
 */
export async function sendTrialExpirationReminder(user, daysRemaining) {
  try {
    const subject = `Your Buildstate Trial Expires in ${daysRemaining} ${daysRemaining === 1 ? 'Day' : 'Days'}`;
    const html = generateTrialExpirationEmailHTML(user, daysRemaining);

    await sendEmail(user.email, subject, html, {
      emailType: 'trial_expiration_reminder',
      userId: user.id,
      daysRemaining,
    });

    logger.info('[TrialReminder] Sent trial expiration reminder', {
      userId: user.id,
      email: user.email,
      daysRemaining,
    });

    return true;
  } catch (error) {
    logger.error('[TrialReminder] Failed to send trial expiration reminder', {
      userId: user.id,
      email: user.email,
      daysRemaining,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Check and send trial expiration reminders
 * @param {array} reminderDays - Array of days before expiration to send reminders (e.g., [7, 3, 1])
 */
export async function checkAndSendTrialReminders(reminderDays = [7, 3, 1]) {
  try {
    const now = new Date();
    const remindersSent = [];

    for (const days of reminderDays) {
      // Calculate the target date (days before expiration)
      const targetDate = new Date(now);
      targetDate.setDate(targetDate.getDate() + days);
      targetDate.setHours(0, 0, 0, 0);

      const nextDay = new Date(targetDate);
      nextDay.setDate(nextDay.getDate() + 1);

      // Find users whose trial expires on the target date
      const users = await prisma.user.findMany({
        where: {
          role: 'PROPERTY_MANAGER',
          subscriptionStatus: 'TRIAL',
          trialEndDate: {
            gte: targetDate,
            lt: nextDay,
          },
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          subscriptionPlan: true,
          trialEndDate: true,
        },
      });

      // Send reminders to each user
      for (const user of users) {
        try {
          await sendTrialExpirationReminder(user, days);
          remindersSent.push({
            userId: user.id,
            email: user.email,
            daysRemaining: days,
          });
        } catch (error) {
          logger.error('[TrialReminder] Failed to send reminder to user', {
            userId: user.id,
            error: error.message,
          });
        }
      }
    }

    logger.info('[TrialReminder] Completed trial reminder check', {
      remindersSent: remindersSent.length,
      details: remindersSent,
    });

    return remindersSent;
  } catch (error) {
    logger.error('[TrialReminder] Error checking trial reminders', {
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

/**
 * Expire trials that have passed their end date
 * Automatically suspends users whose trial has expired
 */
export async function expireTrials() {
  try {
    const now = new Date();

    // Find users with expired trials
    const expiredTrials = await prisma.user.findMany({
      where: {
        role: 'PROPERTY_MANAGER',
        subscriptionStatus: 'TRIAL',
        trialEndDate: {
          lte: now,
        },
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
      },
    });

    // Update subscription status to SUSPENDED
    const userIds = expiredTrials.map(u => u.id);
    
    if (userIds.length > 0) {
      await prisma.user.updateMany({
        where: {
          id: {
            in: userIds,
          },
        },
        data: {
          subscriptionStatus: 'SUSPENDED',
        },
      });

      logger.info('[TrialReminder] Expired trials', {
        count: expiredTrials.length,
        userIds,
      });
    }

    return {
      expired: expiredTrials.length,
      userIds,
    };
  } catch (error) {
    logger.error('[TrialReminder] Error expiring trials', {
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

