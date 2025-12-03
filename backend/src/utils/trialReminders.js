/**
 * Trial Expiration Email Reminders
 *
 * Sends automated emails to property managers when their trial is approaching expiration
 */

import { prisma } from '../config/prismaClient.js';
import { sendEmail } from './email.js';

/**
 * Get trial expiration email HTML
 * @param {object} user - User object
 * @param {number} daysRemaining - Days until trial expires
 * @returns {string} HTML email content
 */
function getTrialExpirationEmailHTML(user, daysRemaining) {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

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
      color: #d32f2f;
      font-size: 24px;
      margin-bottom: 20px;
    }
    p {
      margin-bottom: 15px;
      color: #555;
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
    .warning {
      background-color: #fff3cd;
      border-left: 4px solid #ff9800;
      padding: 15px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .features {
      background-color: #f5f5f5;
      padding: 20px;
      border-radius: 4px;
      margin: 20px 0;
    }
    .features ul {
      margin: 10px 0;
      padding-left: 20px;
    }
    .features li {
      margin-bottom: 8px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">Buildstate FM</div>
    </div>

    <h1>Your Trial is Expiring in ${daysRemaining} Day${daysRemaining === 1 ? '' : 's'}</h1>

    <p>Hi ${user.firstName},</p>

    <p>This is a friendly reminder that your Buildstate FM trial period will expire in <strong>${daysRemaining} day${daysRemaining === 1 ? '' : 's'}</strong>.</p>

    <div class="warning">
      <strong>Important:</strong> After your trial expires, you'll need an active subscription to continue managing your properties and accessing your data.
    </div>

    <div class="features">
      <p><strong>Choose the plan that fits your needs:</strong></p>
      <ul>
        <li><strong>Basic ($29/month)</strong> - Up to 10 properties, 25 inspections/month</li>
        <li><strong>Professional ($79/month)</strong> - Up to 50 properties, 100 inspections/month, advanced features</li>
        <li><strong>Enterprise ($149/month)</strong> - Unlimited properties, inspections, and team members</li>
      </ul>
      <p><em>All plans include access to every feature - only usage limits differ.</em></p>
    </div>

    <p>Upgrade now to ensure uninterrupted access to your property management tools:</p>

    <div class="button-container">
      <a href="${frontendUrl}/subscriptions" class="button">Upgrade Now</a>
    </div>

    <p>Have questions about which plan is right for you? Our team is here to help!</p>

    <p>Thank you for choosing Buildstate FM!</p>

    <div class="footer">
      <p>This is an automated email from Buildstate FM. Please do not reply to this message.</p>
      <p>&copy; ${new Date().getFullYear()} Buildstate FM. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Send trial expiration reminder to a user
 * @param {object} user - User object
 * @param {number} daysRemaining - Days until trial expires
 * @returns {Promise<void>}
 */
export async function sendTrialExpirationReminder(user, daysRemaining) {
  const subject = `Your Buildstate FM Trial Expires in ${daysRemaining} Day${daysRemaining === 1 ? '' : 's'}`;
  const html = getTrialExpirationEmailHTML(user, daysRemaining);

  try {
    await sendEmail(user.email, subject, html);
    console.log(`Trial expiration reminder sent to ${user.email} (${daysRemaining} days remaining)`);
  } catch (error) {
    console.error(`Failed to send trial expiration reminder to ${user.email}:`, error);
    throw error;
  }
}

/**
 * Check for trials expiring soon and send reminders
 * Should be called daily via cron job
 * @param {number[]} reminderDays - Days before expiration to send reminders (default: [7, 3, 1])
 * @returns {Promise<object>} Summary of sent reminders
 */
export async function checkAndSendTrialReminders(reminderDays = [7, 3, 1]) {
  console.log('Checking for trial expirations...');

  const results = {
    checked: 0,
    sent: 0,
    failed: 0,
    errors: [],
  };

  try {
    // Find all users on trial (property managers only)
    const trialUsers = await prisma.user.findMany({
      where: {
        role: 'PROPERTY_MANAGER',
        subscriptionStatus: 'TRIAL',
        trialEndDate: {
          not: null,
        },
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        trialEndDate: true,
      },
    });

    results.checked = trialUsers.length;

    for (const user of trialUsers) {
      const now = new Date();
      const trialEnd = new Date(user.trialEndDate);
      const daysRemaining = Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24));

      // Skip if already expired
      if (daysRemaining <= 0) {
        continue;
      }

      // Check if this is a reminder day
      if (reminderDays.includes(daysRemaining)) {
        try {
          await sendTrialExpirationReminder(user, daysRemaining);
          results.sent++;
        } catch (error) {
          results.failed++;
          results.errors.push({
            userId: user.id,
            email: user.email,
            error: error.message,
          });
        }
      }
    }

    console.log(`Trial reminder check complete: ${results.sent} sent, ${results.failed} failed out of ${results.checked} trial users`);

    return results;
  } catch (error) {
    console.error('Error checking trial expirations:', error);
    throw error;
  }
}

/**
 * Expire trials that have passed their end date
 * Should be called daily via cron job
 * @returns {Promise<number>} Number of trials expired
 */
export async function expireTrials() {
  console.log('Checking for expired trials...');

  try {
    const now = new Date();

    // Find and update expired trials
    const result = await prisma.user.updateMany({
      where: {
        subscriptionStatus: 'TRIAL',
        trialEndDate: {
          lt: now,
        },
      },
      data: {
        subscriptionStatus: 'SUSPENDED',
      },
    });

    console.log(`Expired ${result.count} trial subscriptions`);

    return result.count;
  } catch (error) {
    console.error('Error expiring trials:', error);
    throw error;
  }
}
