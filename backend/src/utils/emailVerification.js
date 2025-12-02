import crypto from 'crypto';
import { prisma } from '../config/prismaClient.js';

/**
 * Generate a secure email verification token
 * @param {string} userId - User ID
 * @returns {Promise<{selector: string, verifier: string}>}
 */
export async function generateEmailVerificationToken(userId) {
  // Generate secure random tokens
  const selector = crypto.randomBytes(32).toString('hex');
  const verifier = crypto.randomBytes(32).toString('hex');

  // Hash the verifier before storing (never store plain tokens)
  const hashedVerifier = crypto.createHash('sha256').update(verifier).digest('hex');

  // Store in database with 24-hour expiration
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24);

  await prisma.emailVerificationToken.create({
    data: {
      userId,
      selector,
      hashedVerifier,
      expiresAt,
    },
  });

  return { selector, verifier };
}

/**
 * Verify email verification token
 * @param {string} selector - Token selector
 * @param {string} verifier - Token verifier
 * @returns {Promise<{userId: string} | null>}
 */
export async function verifyEmailVerificationToken(selector, verifier) {
  if (!selector || !verifier) {
    return null;
  }

  // Find token by selector
  const tokenRecord = await prisma.emailVerificationToken.findFirst({
    where: {
      selector,
      used: false,
    },
  });

  if (!tokenRecord) {
    return null;
  }

  // Check expiration
  if (new Date() > new Date(tokenRecord.expiresAt)) {
    // Clean up expired token
    await prisma.emailVerificationToken.delete({
      where: { id: tokenRecord.id },
    });
    return null;
  }

  // Hash the provided verifier and compare with stored hash
  const hashedVerifier = crypto.createHash('sha256').update(verifier).digest('hex');

  if (hashedVerifier !== tokenRecord.hashedVerifier) {
    return null;
  }

  // Mark token as used
  await prisma.emailVerificationToken.update({
    where: { id: tokenRecord.id },
    data: { used: true },
  });

  return { userId: tokenRecord.userId };
}

/**
 * Send email verification email
 * @param {string} email - User email
 * @param {string} selector - Token selector
 * @param {string} verifier - Token verifier
 */
export async function sendVerificationEmail(email, selector, verifier) {
  const { sendEmail } = await import('./email.js');

  const frontendUrl = process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:5173';
  const verificationLink = `${frontendUrl}/verify-email?selector=${selector}&token=${verifier}`;

  const subject = 'Verify Your Email - BuildState FM';
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-weight: 600; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0;">Welcome to BuildState FM!</h1>
          </div>
          <div class="content">
            <p>Hi there,</p>
            <p>Thank you for signing up for BuildState FM. To complete your registration and start managing your properties, please verify your email address.</p>
            <p style="text-align: center;">
              <a href="${verificationLink}" class="button">Verify Email Address</a>
            </p>
            <p>Or copy and paste this link into your browser:</p>
            <p style="background: white; padding: 15px; border-radius: 6px; word-break: break-all; font-size: 14px; border-left: 4px solid #667eea;">
              ${verificationLink}
            </p>
            <p><strong>This link will expire in 24 hours.</strong></p>
            <p>If you didn't create an account with BuildState FM, you can safely ignore this email.</p>
          </div>
          <div class="footer">
            <p>BuildState FM - Facilities Management Platform</p>
            <p>© ${new Date().getFullYear()} BuildState. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  const text = `
Welcome to BuildState FM!

Thank you for signing up. Please verify your email address by visiting this link:

${verificationLink}

This link will expire in 24 hours.

If you didn't create an account with BuildState FM, you can safely ignore this email.

BuildState FM - Facilities Management Platform
© ${new Date().getFullYear()} BuildState. All rights reserved.
  `.trim();

  try {
    await sendEmail({
      to: email,
      subject,
      html,
      text,
    });
  } catch (error) {
    console.error('Failed to send verification email:', error);
    // Don't throw - we want registration to succeed even if email fails
    // User can request resend later
  }
}

/**
 * Clean up expired verification tokens (run as cron job)
 */
export async function cleanupExpiredTokens() {
  const deleted = await prisma.emailVerificationToken.deleteMany({
    where: {
      expiresAt: {
        lt: new Date(),
      },
    },
  });

  console.log(`Cleaned up ${deleted.count} expired email verification tokens`);
  return deleted.count;
}
