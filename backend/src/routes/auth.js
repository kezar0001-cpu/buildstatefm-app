import { Router } from 'express';
import bcrypt from 'bcryptjs';
import passport from 'passport';
import { z } from 'zod';
import crypto from 'crypto';
import { prisma } from '../config/prismaClient.js';
import { sendPasswordResetEmail } from '../utils/email.js';
import {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from '../utils/jwt.js';
import { validatePassword, getPasswordErrorMessage } from '../utils/passwordValidation.js';
import { sendError, ErrorCodes } from '../utils/errorHandler.js';

const TRIAL_PERIOD_DAYS = 14;
const REFRESH_COOKIE_NAME = 'refreshToken';

const isProduction = process.env.NODE_ENV === 'production';

function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/api/auth',
  };
}

function setRefreshTokenCookie(res, refreshToken) {
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions());
}

function issueAuthTokens(user, res) {
  const basePayload = { id: user.id, email: user.email, role: user.role };
  const accessToken = signAccessToken(basePayload);
  const refreshToken = signRefreshToken(basePayload);
  if (res) {
    setRefreshTokenCookie(res, refreshToken);
  }
  return { accessToken, refreshToken };
}

function calculateTrialEndDate(baseDate = new Date()) {
  const endDate = new Date(baseDate);
  endDate.setDate(endDate.getDate() + TRIAL_PERIOD_DAYS);
  return endDate;
}

async function ensureTrialState(user, updateLoginTime = false) {
  if (!user) return user;

  const now = new Date();
  const updates = {};
  let trialEndDate = user.trialEndDate ? new Date(user.trialEndDate) : null;

  if (user.subscriptionStatus === 'TRIAL') {
    const baseDate = user.createdAt ? new Date(user.createdAt) : now;

    if (!trialEndDate) {
      trialEndDate = calculateTrialEndDate(baseDate);
      updates.trialEndDate = trialEndDate;
    }

    if (trialEndDate && trialEndDate <= now) {
      updates.subscriptionStatus = 'SUSPENDED';
    }
  }

  // Optionally update lastLoginAt during login (combine with other updates)
  if (updateLoginTime) {
    updates.lastLoginAt = now;
  }

  if (Object.keys(updates).length > 0) {
    await prisma.user.update({
      where: { id: user.id },
      data: updates,
    });

    return {
      ...user,
      ...updates,
      trialEndDate: updates.trialEndDate ?? trialEndDate ?? user.trialEndDate,
    };
  }

  return {
    ...user,
    trialEndDate: trialEndDate ?? user.trialEndDate ?? null,
  };
}

const router = Router();

// ========================================
// AUTH MIDDLEWARE
// ========================================
const requireAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return sendError(res, 401, 'No token provided', ErrorCodes.AUTH_NO_TOKEN);
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = verifyAccessToken(token);
    if (decoded.tokenType !== 'access') {
      throw new Error('Invalid token type');
    }
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
      // orgId removed (not in schema)
    };
    next();
  } catch {
    return sendError(res, 401, 'Invalid or expired token', ErrorCodes.AUTH_INVALID_TOKEN);
  }
};

// ========================================
// VALIDATION SCHEMAS
// ========================================

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['PROPERTY_MANAGER', 'OWNER', 'TECHNICIAN', 'TENANT', 'ADMIN']).optional()
});

const registerSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(1, 'Password is required'),
  phone: z.string().optional().refine((phone) => {
    if (!phone) return true;
    return /^\+[1-9]\d{1,14}$/.test(phone.replace(/[\s\-\(\)]/g, ''));
  }, {
    message: "Phone number must be in a valid international format, e.g., +971 4 xxx-xxxx",
  }),
  role: z.enum(['PROPERTY_MANAGER', 'OWNER', 'TECHNICIAN', 'TENANT']).optional(),
  inviteToken: z.string().optional(), // Support for invite-based registration
});

const adminSetupSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(1, 'Password is required'),
  phone: z.string().optional(),
  adminSecret: z.string().optional(),
});

// The secret PIN to bypass the single-admin restriction
// In production, this should strictly come from environment variables
const ADMIN_SETUP_PIN = process.env.ADMIN_SETUP_PIN || 'Buildstate FM-2025-Secure-Setup';

// ========================================
// GET /api/auth/setup/check
// Check if admin setup is required
// ========================================
router.get('/setup/check', async (req, res) => {
  try {
    const adminExists = await prisma.user.findFirst({
      where: { role: 'ADMIN' },
    });

    res.json({
      success: true,
      setupRequired: !adminExists,
    });
  } catch (error) {
    console.error('Setup check error:', error);
    return sendError(res, 500, 'Setup check failed', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

// ========================================
// POST /api/auth/setup
// Create first admin account (only works if no admin exists OR if recovery PIN is provided)
// ========================================
router.post('/setup', async (req, res) => {
  try {
    const { firstName, lastName, email, password, phone, adminSecret } = adminSetupSchema.parse(req.body);

    // Check if any admin already exists
    const adminExists = await prisma.user.findFirst({
      where: { role: 'ADMIN' },
    });

    // Allow bypass if the correct secret PIN is provided
    const isRecoveryMode = adminSecret === ADMIN_SETUP_PIN;

    if (adminExists && !isRecoveryMode) {
      return sendError(res, 403, 'Admin account already exists', ErrorCodes.BIZ_SETUP_ALREADY_COMPLETED);
    }

    // Validate password strength and requirements
    const passwordValidation = validatePassword(password, [email, firstName, lastName]);
    if (!passwordValidation.isValid) {
      return sendError(
        res,
        400,
        getPasswordErrorMessage(passwordValidation),
        ErrorCodes.VAL_PASSWORD_WEAK,
        passwordValidation.requirements
      );
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return sendError(res, 400, 'Email already registered', ErrorCodes.BIZ_EMAIL_ALREADY_REGISTERED);
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        firstName,
        lastName,
        email,
        passwordHash,
        phone,
        role: 'ADMIN',
        subscriptionPlan: 'ENTERPRISE', // Admin gets enterprise plan
        subscriptionStatus: 'ACTIVE',
        emailVerified: true, // Auto-verify admin
      },
    });

    const { accessToken, refreshToken } = issueAuthTokens(user, res);

    const { passwordHash: _ph, ...userWithoutPassword } = user;

    res.status(201).json({
      success: true,
      token: accessToken,
      accessToken,
      refreshToken,
      user: userWithoutPassword,
      message: 'Admin account created successfully!',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendError(res, 400, 'Validation error', ErrorCodes.VAL_VALIDATION_ERROR, error.errors);
    }
    console.error('Admin setup error:', error);
    return sendError(res, 500, 'Admin setup failed', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

// ========================================
// POST /api/auth/register
// ========================================
router.post('/register', async (req, res) => {
  try {
    const { firstName, lastName, email, password, phone, role, inviteToken } = registerSchema.parse(req.body);

    // Validate password strength and requirements
    const passwordValidation = validatePassword(password, [email, firstName, lastName]);
    if (!passwordValidation.isValid) {
      return sendError(
        res,
        400,
        getPasswordErrorMessage(passwordValidation),
        ErrorCodes.VAL_PASSWORD_WEAK,
        passwordValidation.requirements
      );
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return sendError(res, 400, 'Email already registered', ErrorCodes.BIZ_EMAIL_ALREADY_REGISTERED);
    }

    let userRole = 'PROPERTY_MANAGER'; // Default role for direct signup
    let invite = null;

    // RESTRICTION: Only PROPERTY_MANAGER can sign up without an invite
    // All other roles (OWNER, TENANT, TECHNICIAN) require an invite token
    const requestedRole = role || 'PROPERTY_MANAGER';

    if (requestedRole !== 'PROPERTY_MANAGER' && !inviteToken) {
      return sendError(
        res,
        400,
        'Only Property Managers can sign up directly. Other roles require an invitation.',
        ErrorCodes.AUTH_INSUFFICIENT_PERMISSIONS
      );
    }

    // If registering via invite, verify the invite
    if (inviteToken) {
      invite = await prisma.invite.findUnique({
        where: { token: inviteToken },
        include: {
          property: true,
          unit: true,
        },
      });

      if (!invite) {
        return sendError(res, 400, 'Invalid invite token', ErrorCodes.RES_INVITE_NOT_FOUND);
      }

      if (invite.status !== 'PENDING') {
        return sendError(res, 400, 'Invite has already been used', ErrorCodes.BIZ_INVITE_ALREADY_ACCEPTED);
      }

      if (new Date() > new Date(invite.expiresAt)) {
        return sendError(res, 400, 'Invite has expired', ErrorCodes.BIZ_INVITE_EXPIRED);
      }

      if (invite.email !== email) {
        return sendError(res, 400, 'Email does not match invite', ErrorCodes.VAL_INVALID_EMAIL);
      }

      userRole = invite.role;
    } else {
      // For non-invite signups, ensure role is PROPERTY_MANAGER
      userRole = 'PROPERTY_MANAGER';
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const trialEndDate = calculateTrialEndDate();

    const user = await prisma.user.create({
      data: {
        firstName,
        lastName,
        email,
        passwordHash,
        phone,
        role: userRole,
        subscriptionPlan: 'FREE_TRIAL',
        subscriptionStatus: 'TRIAL',
        trialEndDate,
      },
    });

    // If this was an invite-based signup, update the invite status
    if (invite) {
      await prisma.invite.update({
        where: { id: invite.id },
        data: {
          status: 'ACCEPTED',
          invitedUserId: user.id,
        },
      });

      // If the invite was for a specific unit (tenant), create UnitTenant relationship
      if (userRole === 'TENANT' && invite.unitId) {
        await prisma.unitTenant.create({
          data: {
            unitId: invite.unitId,
            tenantId: user.id,
            leaseStart: new Date(),
            leaseEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year default
            rentAmount: 0, // To be filled in later
            isActive: true,
          },
        });
      }

      // If the invite was for a property (owner), create PropertyOwner relationship
      if (userRole === 'OWNER' && invite.propertyId) {
        await prisma.propertyOwner.create({
          data: {
            propertyId: invite.propertyId,
            ownerId: user.id,
            ownershipPercentage: 100,
            startDate: new Date(),
          },
        });
      }
    }

    const { accessToken, refreshToken } = issueAuthTokens(user, res);

    // Strip passwordHash
    const userWithTrial = await ensureTrialState(user);
    const { passwordHash: _ph, ...userWithoutPassword } = userWithTrial;

    res.status(201).json({
      success: true,
      token: accessToken,
      accessToken,
      refreshToken,
      user: userWithoutPassword,
      message: 'Account created successfully!',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendError(res, 400, 'Validation error', ErrorCodes.VAL_VALIDATION_ERROR, error.errors);
    }
    console.error('Registration error:', error);
    return sendError(res, 500, 'Registration failed', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

// ========================================
// POST /api/auth/login
// ========================================
router.post('/login', async (req, res) => {
  try {
    const { email, password, role } = loginSchema.parse(req.body);
    const whereClause = role ? { email, role } : { email };

    const user = await prisma.user.findFirst({
      where: whereClause,
      // ❌ Removed: include: { org: true }
    });

    if (!user) {
      return sendError(res, 401, 'Invalid email or password', ErrorCodes.AUTH_INVALID_CREDENTIALS);
    }

    if (!user.passwordHash) {
      return sendError(res, 401, 'Please login with Google', ErrorCodes.AUTH_INVALID_CREDENTIALS);
    }

    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      return sendError(res, 401, 'Invalid email or password', ErrorCodes.AUTH_INVALID_CREDENTIALS);
    }

    // ❌ Removed: subscription checks (not on User in this schema)

    const { accessToken, refreshToken } = issueAuthTokens(user, res);

    // Combine trial state check and lastLoginAt update in single operation
    const userWithTrial = await ensureTrialState(user, true);

    const { passwordHash: _ph, ...userWithoutPassword } = userWithTrial;
    res.json({ success: true, token: accessToken, accessToken, refreshToken, user: userWithoutPassword });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendError(res, 400, 'Validation error', ErrorCodes.VAL_VALIDATION_ERROR, error.errors);
    }
    console.error('Login error:', error);
    return sendError(res, 500, 'Login failed', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

// ========================================
// POST /api/auth/refresh
// ========================================
router.post('/refresh', async (req, res) => {
  try {
    const cookieToken = req.cookies?.[REFRESH_COOKIE_NAME];
    const bodyToken = req.body?.refreshToken || req.body?.token;
    const refreshToken = bodyToken || cookieToken;

    if (!refreshToken) {
      return sendError(res, 401, 'Refresh token is required', ErrorCodes.AUTH_NO_TOKEN);
    }

    let decoded;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch (error) {
      const message = error?.name === 'TokenExpiredError'
        ? 'Refresh token expired'
        : 'Invalid refresh token';
      const code = error?.name === 'TokenExpiredError'
        ? ErrorCodes.AUTH_TOKEN_EXPIRED
        : ErrorCodes.AUTH_INVALID_TOKEN;
      return sendError(res, 401, message, code);
    }

    if (decoded.tokenType !== 'refresh') {
      return sendError(res, 401, 'Invalid refresh token', ErrorCodes.AUTH_INVALID_TOKEN);
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, email: true, role: true },
    });

    if (!user) {
      return sendError(res, 401, 'User not found', ErrorCodes.RES_USER_NOT_FOUND);
    }

    const { accessToken, refreshToken: newRefreshToken } = issueAuthTokens(user, res);

    res.json({ success: true, token: accessToken, accessToken, refreshToken: newRefreshToken });
  } catch (error) {
    console.error('Refresh token error:', error);
    return sendError(res, 500, 'Failed to refresh token', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

// ========================================
// GET /api/auth/google
// ========================================
router.get('/google', (req, res, next) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return sendError(res, 503, 'Google OAuth is not configured. Please use email/password signup.', ErrorCodes.EXT_SERVICE_UNAVAILABLE);
  }
  const { role = 'PROPERTY_MANAGER' } = req.query;
  if (!['PROPERTY_MANAGER'].includes(role)) {
    return sendError(res, 400, 'Google signup is only available for Property Managers', ErrorCodes.AUTH_INSUFFICIENT_PERMISSIONS);
  }
  passport.authenticate('google', { scope: ['openid', 'profile', 'email'], state: role })(req, res, next);
});

// ========================================
// GET /api/auth/google/callback
// ========================================
router.get(
  '/google/callback',
  (req, res, next) => {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      const frontendUrl = process.env.FRONTEND_URL || 'https://www.buildstate.com.au';
      return res.redirect(`${frontendUrl}/signin?error=oauth_not_configured`);
    }
    next();
  },
  passport.authenticate('google', {
    failureRedirect: `${process.env.FRONTEND_URL || 'https://www.buildstate.com.au'}/signin?error=auth_failed`,
  }),
  async (req, res) => {
    try {
      const user = req.user;

      // ❌ Removed: subscription checks (not present)

      const { accessToken } = issueAuthTokens(user, res);

      const dashboardRoutes = {
        PROPERTY_MANAGER: '/dashboard',
        OWNER: '/owner/dashboard',
        TECHNICIAN: '/technician/dashboard',
        TENANT: '/tenant/dashboard',
      };

      const nextPath = dashboardRoutes[user.role] || '/dashboard';
      const frontendUrl = process.env.FRONTEND_URL || 'https://www.buildstate.com.au';

      // Redirect to auth/callback page which will handle token storage
      res.redirect(`${frontendUrl}/auth/callback?token=${accessToken}&next=${encodeURIComponent(nextPath)}`);
    } catch (error) {
      console.error('OAuth callback error:', error);
      const frontendUrl = process.env.FRONTEND_URL || 'https://www.buildstate.com.au';
      res.redirect(`${frontendUrl}/signin?error=auth_failed`);
    }
  }
);

// ========================================
// GET /api/auth/me
// ========================================
router.get('/me', requireAuth, async (req, res) => {
  try {
    let user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        subscriptionStatus: true,
        subscriptionPlan: true,
        trialEndDate: true,
      },
    });

    if (!user) return sendError(res, 404, 'User not found', ErrorCodes.RES_USER_NOT_FOUND);

    user = await ensureTrialState(user);

    res.json({ success: true, user });
  } catch (error) {
    console.error('Get user error:', error);
    return sendError(res, 500, 'Failed to get user', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

// ========================================
// POST /api/auth/logout
// ========================================
router.post('/logout', (req, res) => {
  req.logout((err) => {
    if (err) return sendError(res, 500, 'Logout failed', ErrorCodes.ERR_INTERNAL_SERVER);
    res.clearCookie(REFRESH_COOKIE_NAME, refreshCookieOptions());
    res.json({ success: true, message: 'Logged out successfully' });
  });
});

// ========================================
// POST /api/auth/verify-email
// ========================================
router.post('/verify-email', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return sendError(res, 400, 'Verification token is required', ErrorCodes.VAL_MISSING_FIELD);
    // Placeholder
    res.json({ success: true, message: 'Email verified successfully' });
  } catch (error) {
    console.error('Email verification error:', error);
    return sendError(res, 500, 'Email verification failed', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

// ========================================
// PASSWORD RESET ENDPOINTS
// ========================================

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

const resetPasswordSchema = z.object({
  selector: z.string().min(1, 'Selector is required'),
  token: z.string().min(1, 'Token is required'),
  password: z.string().min(1, 'Password is required'),
});

// ========================================
// POST /api/auth/forgot-password
// Request a password reset
// ========================================
router.post('/forgot-password', async (req, res) => {
  try {
    const rawEmail = typeof req.body.email === 'string' ? req.body.email : '';
    const normalizedEmail = rawEmail.trim().toLowerCase();
    const { email } = forgotPasswordSchema.parse({ email: normalizedEmail });

    // Always return success to prevent email enumeration
    const genericResponse = {
      success: true,
      message: 'If an account exists with this email, you will receive password reset instructions.',
    };

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
    });

    // If user doesn't exist, return generic response without sending email
    if (!user) {
      return res.json(genericResponse);
    }

    // Generate secure random tokens
    // Selector: publicly stored identifier (32 bytes = 64 hex chars)
    // Verifier: secret token that will be hashed (32 bytes = 64 hex chars)
    const selector = crypto.randomBytes(32).toString('hex');
    const verifier = crypto.randomBytes(32).toString('hex');

    // Hash the verifier before storing in database
    const hashedVerifier = await bcrypt.hash(verifier, 10);

    // Set expiration to 20 minutes from now
    const expiresAt = new Date(Date.now() + 20 * 60 * 1000);

    // Invalidate any existing password reset tokens for this user
    await prisma.passwordReset.deleteMany({
      where: { userId: user.id },
    });

    // Create new password reset token
    await prisma.passwordReset.create({
      data: {
        userId: user.id,
        selector,
        verifier: hashedVerifier,
        expiresAt,
      },
    });

    // Generate reset URL with selector and unhashed verifier
    const appUrl = process.env.APP_URL || 'https://www.buildstate.com.au';
    const resetUrl = `${appUrl}/reset-password?selector=${selector}&token=${verifier}`;

    // Send password reset email
    try {
      await sendPasswordResetEmail(user.email, resetUrl, user.firstName);
    } catch (emailError) {
      console.error('Failed to send password reset email:', emailError);
      // Still return success to prevent email enumeration
    }

    res.json(genericResponse);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendError(res, 400, 'Validation error', ErrorCodes.VAL_VALIDATION_ERROR, error.errors);
    }
    console.error('Forgot password error:', error);
    return sendError(res, 500, 'An error occurred. Please try again.', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

// ========================================
// GET /api/auth/reset-password/validate
// Validate a password reset token (optional endpoint)
// ========================================
router.get('/reset-password/validate', async (req, res) => {
  try {
    const { selector, token } = req.query;

    if (!selector || !token) {
      return sendError(res, 400, 'Invalid reset link', ErrorCodes.VAL_INVALID_REQUEST);
    }

    // Find the password reset record by selector
    const passwordReset = await prisma.passwordReset.findUnique({
      where: { selector: String(selector) },
      include: { user: true },
    });

    // Validate token
    if (!passwordReset) {
      return sendError(res, 400, 'Invalid or expired reset link', ErrorCodes.VAL_INVALID_REQUEST);
    }

    // Check if token has already been used
    if (passwordReset.usedAt) {
      return sendError(res, 400, 'This reset link has already been used', ErrorCodes.VAL_INVALID_REQUEST);
    }

    // Check if token has expired
    if (new Date() > new Date(passwordReset.expiresAt)) {
      return sendError(res, 400, 'This reset link has expired', ErrorCodes.VAL_INVALID_REQUEST);
    }

    // Verify the token against stored hashed verifier
    const isValidToken = await bcrypt.compare(String(token), passwordReset.verifier);

    if (!isValidToken) {
      return sendError(res, 400, 'Invalid reset link', ErrorCodes.VAL_INVALID_REQUEST);
    }

    // Token is valid
    res.json({
      success: true,
      message: 'Token is valid',
      email: passwordReset.user.email, // Return email for display purposes
    });
  } catch (error) {
    console.error('Token validation error:', error);
    return sendError(res, 500, 'An error occurred. Please try again.', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

// ========================================
// POST /api/auth/reset-password
// Reset password using valid token
// ========================================
router.post('/reset-password', async (req, res) => {
  try {
    const { selector, token, password } = resetPasswordSchema.parse(req.body);

    // Find the password reset record by selector
    const passwordReset = await prisma.passwordReset.findUnique({
      where: { selector },
      include: { user: true },
    });

    // Validate token exists
    if (!passwordReset) {
      return sendError(res, 400, 'Invalid or expired reset link', ErrorCodes.VAL_INVALID_REQUEST);
    }

    // Validate password strength and requirements
    const passwordValidation = validatePassword(password, [
      passwordReset.user.email,
      passwordReset.user.firstName,
      passwordReset.user.lastName,
    ]);
    if (!passwordValidation.isValid) {
      return sendError(
        res,
        400,
        getPasswordErrorMessage(passwordValidation),
        ErrorCodes.VAL_PASSWORD_WEAK,
        passwordValidation.requirements
      );
    }

    // Check if token has already been used
    if (passwordReset.usedAt) {
      return sendError(res, 400, 'This reset link has already been used', ErrorCodes.VAL_INVALID_REQUEST);
    }

    // Check if token has expired
    if (new Date() > new Date(passwordReset.expiresAt)) {
      return sendError(res, 400, 'This reset link has expired. Please request a new password reset.', ErrorCodes.VAL_INVALID_REQUEST);
    }

    // Verify the token against stored hashed verifier
    const isValidToken = await bcrypt.compare(token, passwordReset.verifier);

    if (!isValidToken) {
      return sendError(res, 400, 'Invalid reset link', ErrorCodes.VAL_INVALID_REQUEST);
    }

    // Hash the new password
    const newPasswordHash = await bcrypt.hash(password, 10);

    // Update user's password and mark token as used in a transaction
    await prisma.$transaction([
      prisma.user.update({
        where: { id: passwordReset.userId },
        data: {
          passwordHash: newPasswordHash,
          updatedAt: new Date(),
        },
      }),
      prisma.passwordReset.update({
        where: { id: passwordReset.id },
        data: {
          usedAt: new Date(),
        },
      }),
    ]);

    // Delete all password reset tokens for this user for additional security
    await prisma.passwordReset.deleteMany({
      where: { userId: passwordReset.userId },
    });

    res.json({
      success: true,
      message: 'Password has been reset successfully. You can now login with your new password.',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendError(res, 400, 'Validation error', ErrorCodes.VAL_VALIDATION_ERROR, error.errors);
    }
    console.error('Reset password error:', error);
    return sendError(res, 500, 'An error occurred. Please try again.', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

export default router;