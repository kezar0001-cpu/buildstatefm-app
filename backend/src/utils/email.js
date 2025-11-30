import { Resend } from 'resend';
import { getRedisClient, getConnectedRedisClient } from '../config/redisClient.js';
import logger from './logger.js';

let resendClient;

// Email retry configuration
const RETRY_CONFIG = {
  MAX_RETRIES: 3,
  INITIAL_DELAY_MS: 1000, // 1 second
  MAX_DELAY_MS: 30000, // 30 seconds
  BACKOFF_MULTIPLIER: 2,
  RETRY_QUEUE_PREFIX: 'email:retry:',
  RETRY_QUEUE_TTL: 86400, // 24 hours
};

function getResendClient() {
  if (resendClient) {
    return resendClient;
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }

  resendClient = new Resend(apiKey);
  return resendClient;
}

function ensureResendClient() {
  const client = getResendClient();

  if (!client) {
    throw new Error('Resend API key is not configured');
  }

  return client;
}

/**
 * Email Retry Queue Manager
 * Manages retry state and scheduling for failed email attempts
 */
class EmailRetryQueue {
  constructor() {
    this.redis = getRedisClient();
  }

  async ensureRedisClient() {
    if (this.redis?.isOpen) {
      return this.redis;
    }

    const client = await getConnectedRedisClient();
    this.redis = client;
    return client;
  }

  /**
   * Generate unique key for email retry tracking
   */
  getRetryKey(emailId) {
    return `${RETRY_CONFIG.RETRY_QUEUE_PREFIX}${emailId}`;
  }

  /**
   * Store retry attempt information
   */
  async storeRetryAttempt(emailId, attemptNumber, emailData, error) {
    const redisClient = await this.ensureRedisClient();

    if (!redisClient?.isOpen) {
      logger.warn('[EmailRetry] Redis not available, cannot store retry attempt', {
        emailId,
        attemptNumber,
      });
      return;
    }

    try {
      const key = this.getRetryKey(emailId);
      const retryData = {
        emailId,
        attemptNumber,
        emailData: {
          to: emailData.to,
          subject: emailData.subject,
          from: emailData.from,
        },
        error: {
          message: error?.message,
          code: error?.code,
          statusCode: error?.statusCode,
        },
        timestamp: new Date().toISOString(),
      };

      await redisClient.set(key, JSON.stringify(retryData), {
        EX: RETRY_CONFIG.RETRY_QUEUE_TTL,
      });

      logger.info('[EmailRetry] Stored retry attempt', {
        emailId,
        attemptNumber,
        to: emailData.to,
      });
    } catch (err) {
      logger.error('[EmailRetry] Failed to store retry attempt', {
        emailId,
        error: err.message,
      });
    }
  }

  /**
   * Get retry attempt information
   */
  async getRetryAttempt(emailId) {
    const redisClient = await this.ensureRedisClient();

    if (!redisClient?.isOpen) {
      return null;
    }

    try {
      const key = this.getRetryKey(emailId);
      const data = await redisClient.get(key);
      return data ? JSON.parse(data) : null;
    } catch (err) {
      logger.error('[EmailRetry] Failed to get retry attempt', {
        emailId,
        error: err.message,
      });
      return null;
    }
  }

  /**
   * Remove retry attempt from queue (on success)
   */
  async removeRetryAttempt(emailId) {
    const redisClient = await this.ensureRedisClient();

    if (!redisClient?.isOpen) {
      return;
    }

    try {
      const key = this.getRetryKey(emailId);
      await redisClient.del(key);
      logger.info('[EmailRetry] Removed retry attempt', { emailId });
    } catch (err) {
      logger.error('[EmailRetry] Failed to remove retry attempt', {
        emailId,
        error: err.message,
      });
    }
  }

  /**
   * Calculate exponential backoff delay
   */
  calculateBackoffDelay(attemptNumber) {
    const delay = Math.min(
      RETRY_CONFIG.INITIAL_DELAY_MS * Math.pow(RETRY_CONFIG.BACKOFF_MULTIPLIER, attemptNumber - 1),
      RETRY_CONFIG.MAX_DELAY_MS
    );
    return delay;
  }
}

const emailRetryQueue = new EmailRetryQueue();

/**
 * Generate unique email ID for tracking
 */
function generateEmailId(to, subject) {
  return `${to}-${subject}-${Date.now()}`;
}

/**
 * Sleep utility for retry delays
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Extract error details from various error types
 */
function extractErrorDetails(error) {
  return {
    message: error?.message || 'Unknown error',
    code: error?.code || error?.error?.code || 'UNKNOWN_ERROR',
    statusCode: error?.statusCode || error?.error?.statusCode,
    name: error?.name,
  };
}

/**
 * Send email with retry logic and exponential backoff
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject
 * @param {string} html - Email HTML content
 * @param {object} metadata - Optional metadata for tracking (e.g., jobId, userId)
 * @param {number} attemptNumber - Current attempt number (for internal use)
 */
async function sendEmailWithRetry(to, subject, html, metadata = {}, attemptNumber = 1) {
  const emailId = metadata.emailId || generateEmailId(to, subject);
  const emailFrom = process.env.EMAIL_FROM || 'Buildstate <no-reply@buildtstate.com.au>';

  const logContext = {
    emailId,
    to,
    subject,
    attemptNumber,
    maxRetries: RETRY_CONFIG.MAX_RETRIES,
    ...metadata,
  };

  try {
    logger.info('[Email] Attempting to send email', logContext);

    const resend = ensureResendClient();

    const emailData = {
      from: emailFrom,
      to: to,
      subject: subject,
      html: html,
    };

    const { data, error } = await resend.emails.send(emailData);

    if (error) {
      const errorDetails = extractErrorDetails(error);

      logger.error('[Email] Resend API returned error', {
        ...logContext,
        error: errorDetails,
      });

      // Store retry attempt in Redis
      await emailRetryQueue.storeRetryAttempt(emailId, attemptNumber, emailData, errorDetails);

      // Determine if we should retry
      if (attemptNumber < RETRY_CONFIG.MAX_RETRIES) {
        const delay = emailRetryQueue.calculateBackoffDelay(attemptNumber);

        logger.warn('[Email] Retrying email after delay', {
          ...logContext,
          delayMs: delay,
          nextAttempt: attemptNumber + 1,
        });

        await sleep(delay);

        return sendEmailWithRetry(to, subject, html, { ...metadata, emailId }, attemptNumber + 1);
      } else {
        logger.error('[Email] Max retry attempts reached, email failed permanently', {
          ...logContext,
          error: errorDetails,
        });

        throw new Error(`Failed to send email after ${RETRY_CONFIG.MAX_RETRIES} attempts: ${errorDetails.message}`);
      }
    }

    // Success - remove from retry queue
    await emailRetryQueue.removeRetryAttempt(emailId);

    logger.info('[Email] Email sent successfully', {
      ...logContext,
      emailDataId: data?.id,
    });

    return data;
  } catch (error) {
    const errorDetails = extractErrorDetails(error);

    logger.error('[Email] Exception while sending email', {
      ...logContext,
      error: errorDetails,
      stack: error.stack,
    });

    // Store retry attempt in Redis
    await emailRetryQueue.storeRetryAttempt(
      emailId,
      attemptNumber,
      { from: emailFrom, to, subject },
      errorDetails
    );

    // Determine if we should retry
    if (attemptNumber < RETRY_CONFIG.MAX_RETRIES) {
      const delay = emailRetryQueue.calculateBackoffDelay(attemptNumber);

      logger.warn('[Email] Retrying email after exception', {
        ...logContext,
        delayMs: delay,
        nextAttempt: attemptNumber + 1,
      });

      await sleep(delay);

      return sendEmailWithRetry(to, subject, html, { ...metadata, emailId }, attemptNumber + 1);
    } else {
      logger.error('[Email] Max retry attempts reached after exception', {
        ...logContext,
        error: errorDetails,
      });

      throw error;
    }
  }
}

/**
 * Send a generic email
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject
 * @param {string} html - Email HTML content
 * @param {object} metadata - Optional metadata for tracking (e.g., jobId, userId)
 */
export async function sendEmail(to, subject, html, metadata = {}) {
  return sendEmailWithRetry(to, subject, html, metadata);
}

/**
 * Send password reset email
 * @param {string} to - Recipient email address
 * @param {string} resetUrl - Password reset URL with selector and token
 * @param {string} firstName - User's first name
 * @param {object} metadata - Optional metadata for tracking (e.g., userId)
 */
export async function sendPasswordResetEmail(to, resetUrl, firstName, metadata = {}) {
  const subject = 'Reset Your Password';
  const html = generatePasswordResetEmailHTML(firstName, resetUrl);

  return sendEmailWithRetry(to, subject, html, {
    ...metadata,
    emailType: 'password_reset',
    firstName,
  });
}

/**
 * Generate HTML content for password reset email
 */
function generatePasswordResetEmailHTML(firstName, resetUrl) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password</title>
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
      border-left: 4px solid #ffc107;
      padding: 15px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .link {
      word-break: break-all;
      color: #1976d2;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">Buildstate</div>
    </div>

    <h1>Reset Your Password</h1>

    <p>Hi ${firstName},</p>

    <p>We received a request to reset your password for your account. Click the button below to create a new password:</p>

    <div class="button-container">
      <a href="${resetUrl}" class="button">Reset Password</a>
    </div>

    <p>Or copy and paste this link into your browser:</p>
    <p class="link">${resetUrl}</p>

    <div class="warning">
      <strong>Important:</strong> This link will expire in 20 minutes for security reasons. If you didn't request a password reset, you can safely ignore this email.
    </div>

    <p>For security reasons, this password reset link can only be used once.</p>

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
 * Send team invite email
 * @param {string} to - Recipient email address
 * @param {string} inviteUrl - Invite signup URL with token
 * @param {string} inviterName - Name of the person who sent the invite
 * @param {string} role - Role the user is being invited as
 * @param {string} propertyName - Optional property name
 * @param {string} unitName - Optional unit name
 * @param {object} metadata - Optional metadata for tracking (e.g., inviteId, inviterId)
 */
export async function sendInviteEmail(to, inviteUrl, inviterName, role, propertyName = null, unitName = null, metadata = {}) {
  const subject = 'You\'ve been invited to join Buildstate';
  const html = generateInviteEmailHTML(inviteUrl, inviterName, role, propertyName, unitName);

  return sendEmailWithRetry(to, subject, html, {
    ...metadata,
    emailType: 'team_invite',
    inviterName,
    role,
    propertyName,
    unitName,
  });
}

/**
 * Generate HTML content for team invite email
 */
function generateInviteEmailHTML(inviteUrl, inviterName, role, propertyName, unitName) {
  // Format role for display
  const roleDisplay = role.charAt(0) + role.slice(1).toLowerCase();

  // Build assignment details
  let assignmentDetails = '';
  if (unitName && propertyName) {
    assignmentDetails = `<p>You will be assigned to <strong>${unitName}</strong> at <strong>${propertyName}</strong>.</p>`;
  } else if (propertyName) {
    assignmentDetails = `<p>You will be assigned to <strong>${propertyName}</strong>.</p>`;
  }

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You've been invited to Buildstate</title>
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
    .info-box {
      background-color: #e3f2fd;
      border-left: 4px solid #1976d2;
      padding: 15px;
      margin: 20px 0;
      border-radius: 4px;
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
      border-left: 4px solid #ffc107;
      padding: 15px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .link {
      word-break: break-all;
      color: #1976d2;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">Buildstate</div>
    </div>

    <h1>You've been invited!</h1>

    <p>Hello,</p>

    <p><strong>${inviterName}</strong> has invited you to join their team on Buildstate as a <strong>${roleDisplay}</strong>.</p>

    ${assignmentDetails}

    <div class="info-box">
      <strong>What is Buildstate?</strong>
      <p style="margin-top: 10px; margin-bottom: 0;">Buildstate is a comprehensive property management platform that helps teams manage properties, coordinate maintenance, and collaborate effectively.</p>
    </div>

    <p>Click the button below to accept the invitation and create your account:</p>

    <div class="button-container">
      <a href="${inviteUrl}" class="button">Accept Invitation</a>
    </div>

    <p>Or copy and paste this link into your browser:</p>
    <p class="link">${inviteUrl}</p>

    <div class="warning">
      <strong>Important:</strong> This invitation link will expire in 7 days. If you didn't expect this invitation, you can safely ignore this email.
    </div>

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
 * Send overdue inspection digest email to a property manager
 * @param {object} manager - Manager object with id, email, firstName, lastName
 * @param {array} inspections - Array of overdue inspection objects
 */
export async function sendOverdueInspectionDigest(manager, inspections) {
  const emailTemplates = (await import('./emailTemplates.js')).default;

  const emailContent = emailTemplates.overdueInspectionDigest({
    managerName: `${manager.firstName} ${manager.lastName}`,
    inspectionCount: inspections.length,
    inspections: inspections,
  });

  return sendEmailWithRetry(manager.email, emailContent.subject, emailContent.html, {
    emailType: 'overdue_inspection_digest',
    managerId: manager.id,
    inspectionCount: inspections.length,
  });
}
