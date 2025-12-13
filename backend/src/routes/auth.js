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

function hashRefreshToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

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

async function issueAuthTokens(user, res) {
  const basePayload = { id: user.id, email: user.email, role: user.role };
  const accessToken = signAccessToken(basePayload);
  const refreshToken = signRefreshToken(basePayload);
  const refreshTokenHash = hashRefreshToken(refreshToken);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      refreshTokenHash,
    },
  });

  if (res) {
    setRefreshTokenCookie(res, refreshToken);
  }
  return { accessToken };
}

/**
 * Calculate trial end date with A/B testing support
 * @param {Date} baseDate - Base date to calculate from
 * @param {string} variant - A/B testing variant (A, B, C) or null
 * @returns {object} { trialEndDate, variant }
 */
function calculateTrialEndDate(baseDate = new Date(), variant = null) {
  let trialDays = TRIAL_PERIOD_DAYS; // Default 14 days
  
  // A/B testing for trial lengths (only if enabled)
  if (process.env.ENABLE_TRIAL_AB_TESTING === 'true' && !variant) {
    // Randomly assign variant for property managers
    const random = Math.random();
    if (random < 0.33) {
      variant = 'A'; // 14 days (default)
      trialDays = 14;
    } else if (random < 0.66) {
      variant = 'B'; // 7 days
      trialDays = 7;
    } else {
      variant = 'C'; // 21 days
      trialDays = 21;
    }
  } else if (variant) {
    // Use provided variant
    switch (variant) {
      case 'A':
        trialDays = 14;
        break;
      case 'B':
        trialDays = 7;
        break;
      case 'C':
        trialDays = 21;
        break;
      default:
        trialDays = TRIAL_PERIOD_DAYS;
    }
  }

  const endDate = new Date(baseDate);
  endDate.setDate(endDate.getDate() + trialDays);
  
  return { trialEndDate: endDate, variant: variant || 'A' };
}

async function ensureTrialState(user, updateLoginTime = false) {
  if (!user) return user;

  const now = new Date();
  const updates = {};
  let trialEndDate = user.trialEndDate ? new Date(user.trialEndDate) : null;

  if (user.subscriptionStatus === 'TRIAL') {
    const baseDate = user.createdAt ? new Date(user.createdAt) : now;

    if (!trialEndDate) {
      const trialData = calculateTrialEndDate(baseDate);
      trialEndDate = trialData.trialEndDate;
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
  gdprConsentGiven: z.boolean().optional().default(false),
  marketingConsentGiven: z.boolean().optional().default(false),
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
const ADMIN_SETUP_PIN = process.env.ADMIN_SETUP_PIN || null;

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

    // Allow bypass only if an explicit recovery PIN is configured.
    // This prevents a hardcoded default PIN from being used in production.
    const recoveryEnabled = Boolean(ADMIN_SETUP_PIN);
    const isRecoveryMode = recoveryEnabled && adminSecret === ADMIN_SETUP_PIN;

    if (isProduction && adminExists && !recoveryEnabled) {
      return sendError(
        res,
        403,
        'Admin recovery is not configured. Please set ADMIN_SETUP_PIN to enable recovery mode.',
        ErrorCodes.AUTH_INSUFFICIENT_PERMISSIONS
      );
    }

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

    const { accessToken } = await issueAuthTokens(user, res);

    const { passwordHash: _ph, ...userWithoutPassword } = user;

    res.status(201).json({
      success: true,
      token: accessToken,
      accessToken,
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
    const { firstName, lastName, email, password, phone, role, inviteToken, gdprConsentGiven, marketingConsentGiven } = registerSchema.parse(req.body);

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

    // A/B testing for trial lengths (only for property managers)
    // Randomly assign trial variant: 'A' (14 days), 'B' (7 days), 'C' (21 days)
    let trialVariant = null;
    let trialDays = TRIAL_PERIOD_DAYS;

    if (userRole === 'PROPERTY_MANAGER' && process.env.ENABLE_TRIAL_AB_TESTING === 'true') {
      const variants = ['A', 'B', 'C'];
      trialVariant = variants[Math.floor(Math.random() * variants.length)];

      // Variant A: 14 days (default)
      // Variant B: 7 days
      // Variant C: 21 days
      if (trialVariant === 'B') {
        trialDays = 7;
      } else if (trialVariant === 'C') {
        trialDays = 21;
      }
    }

    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + trialDays);

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
        trialVariant,
        gdprConsentGiven,
        gdprConsentDate: gdprConsentGiven ? new Date() : null,
        marketingConsentGiven,
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

    const { accessToken } = await issueAuthTokens(user, res);

    // ✅ SEND EMAIL VERIFICATION (async, don't block registration)
    (async () => {
      try {
        const { generateEmailVerificationToken, sendVerificationEmail } = await import('../utils/emailVerification.js');
        const { selector, verifier } = await generateEmailVerificationToken(user.id);
        await sendVerificationEmail(user.email, selector, verifier);
      } catch (error) {
        console.error('Failed to send verification email:', error);
        // Don't block registration if email fails
      }
    })();

    // Strip passwordHash
    const userWithTrial = await ensureTrialState(user);
    const { passwordHash: _ph, ...userWithoutPassword } = userWithTrial;

    res.status(201).json({
      success: true,
      token: accessToken,
      accessToken,
      user: userWithoutPassword,
      message: 'Account created successfully! Please check your email to verify your account.',
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

    // Security: Regenerate session to prevent session fixation attacks
    if (req.session && typeof req.session.regenerate === 'function') {
      return new Promise((resolve, reject) => {
        req.session.regenerate((err) => {
          if (err) {
            console.error('Session regeneration error:', err);
            // Continue with login even if regeneration fails
          }
          handleSuccessfulLogin(user, res).then(resolve).catch(reject);
        });
      });
    }

    // If no session middleware, proceed normally
    return handleSuccessfulLogin(user, res);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendError(res, 400, 'Validation error', ErrorCodes.VAL_VALIDATION_ERROR, error.errors);
    }
    console.error('Login error:', error);
    return sendError(res, 500, 'Login failed', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

// Helper function to handle successful login
async function handleSuccessfulLogin(user, res) {
  // ❌ Removed: subscription checks (not on User in this schema)

  const { accessToken } = await issueAuthTokens(user, res);

  // Combine trial state check and lastLoginAt update in single operation
  const userWithTrial = await ensureTrialState(user, true);

  const { passwordHash: _ph, ...userWithoutPassword } = userWithTrial;
  res.json({ success: true, token: accessToken, accessToken, user: userWithoutPassword });
}

// ========================================
// POST /api/auth/refresh
// Implements refresh token rotation for security
// ========================================
router.post('/refresh', async (req, res) => {
  try {
    const cookieToken = req.cookies?.[REFRESH_COOKIE_NAME];
    const refreshToken = cookieToken;

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
      select: { id: true, email: true, role: true, refreshTokenHash: true },
    });

    if (!user) {
      return sendError(res, 401, 'User not found', ErrorCodes.RES_USER_NOT_FOUND);
    }

    const tokenHash = hashRefreshToken(refreshToken);
    if (!user.refreshTokenHash || user.refreshTokenHash !== tokenHash) {
      res.clearCookie(REFRESH_COOKIE_NAME, refreshCookieOptions());
      await prisma.user.update({
        where: { id: user.id },
        data: { refreshTokenHash: null },
      });
      return sendError(res, 401, 'Invalid refresh token', ErrorCodes.AUTH_INVALID_TOKEN);
    }

    // ✅ TOKEN ROTATION: Issue new refresh token, old one is invalidated by cookie overwrite
    // In future: implement token revocation list for additional security
    const { accessToken } = await issueAuthTokens(user, res);

    res.json({ success: true, token: accessToken, accessToken });
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

  // ✅ CSRF PROTECTION: Generate and store state token
  const stateToken = crypto.randomBytes(32).toString('hex');
  const stateData = JSON.stringify({ token: stateToken, role, timestamp: Date.now() });
  const encodedState = Buffer.from(stateData).toString('base64');

  // Store state in session for validation
  if (req.session) {
    req.session.oauthState = stateToken;
  }

  passport.authenticate('google', { scope: ['openid', 'profile', 'email'], state: encodedState })(req, res, next);
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

    // ✅ CSRF PROTECTION: Validate state parameter
    const stateParam = req.query.state;
    if (stateParam) {
      try {
        const stateData = JSON.parse(Buffer.from(stateParam, 'base64').toString());
        const { token, timestamp } = stateData;

        // Check if state is too old (5 minutes)
        if (Date.now() - timestamp > 5 * 60 * 1000) {
          console.error('OAuth state token expired');
          return res.redirect(`${process.env.FRONTEND_URL || 'https://www.buildstate.com.au'}/signin?error=state_expired`);
        }

        // Validate against session
        if (req.session && req.session.oauthState !== token) {
          console.error('OAuth state mismatch - potential CSRF attack');
          return res.redirect(`${process.env.FRONTEND_URL || 'https://www.buildstate.com.au'}/signin?error=state_mismatch`);
        }

        // Clear state from session
        if (req.session) {
          delete req.session.oauthState;
        }
      } catch (error) {
        console.error('OAuth state validation error:', error);
        return res.redirect(`${process.env.FRONTEND_URL || 'https://www.buildstate.com.au'}/signin?error=invalid_state`);
      }
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

      const { accessToken } = await issueAuthTokens(user, res);

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
  const cookieToken = req.cookies?.[REFRESH_COOKIE_NAME];

  const clearServerRefresh = async () => {
    if (!cookieToken) return;
    try {
      const decoded = verifyRefreshToken(cookieToken);
      if (decoded?.id) {
        await prisma.user.update({
          where: { id: decoded.id },
          data: { refreshTokenHash: null },
        });
      }
    } catch {
      // ignore
    }
  };

  req.logout(async (err) => {
    if (err) return sendError(res, 500, 'Logout failed', ErrorCodes.ERR_INTERNAL_SERVER);
    await clearServerRefresh();
    res.clearCookie(REFRESH_COOKIE_NAME, refreshCookieOptions());
    res.json({ success: true, message: 'Logged out successfully' });
  });
});

// ========================================
// POST /api/auth/verify-email
// Verify user email address with token
// ========================================
router.post('/verify-email', async (req, res) => {
  try {
    const { selector, token } = req.body;
    if (!selector || !token) {
      return sendError(res, 400, 'Verification token is required', ErrorCodes.VAL_MISSING_FIELD);
    }

    // Import the verification utility
    const { verifyEmailVerificationToken } = await import('../utils/emailVerification.js');

    const result = await verifyEmailVerificationToken(selector, token);

    if (!result) {
      return sendError(res, 400, 'Invalid or expired verification token', ErrorCodes.AUTH_INVALID_TOKEN);
    }

    // Mark user's email as verified
    const user = await prisma.user.update({
      where: { id: result.userId },
      data: { emailVerified: true },
      select: { id: true, email: true, emailVerified: true, firstName: true, lastName: true },
    });

    res.json({
      success: true,
      message: 'Email verified successfully',
      user,
    });
  } catch (error) {
    console.error('Email verification error:', error);
    return sendError(res, 500, 'Email verification failed', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

// ========================================
// POST /api/auth/resend-verification
// Resend email verification link
// ========================================
router.post('/resend-verification', requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, email: true, emailVerified: true },
    });

    if (!user) {
      return sendError(res, 404, 'User not found', ErrorCodes.RES_USER_NOT_FOUND);
    }

    if (user.emailVerified) {
      return sendError(res, 400, 'Email already verified', ErrorCodes.VAL_VALIDATION_ERROR);
    }

    // Import verification utilities
    const { generateEmailVerificationToken, sendVerificationEmail } = await import('../utils/emailVerification.js');

    // Generate and send new verification token
    const { selector, verifier } = await generateEmailVerificationToken(user.id);
    await sendVerificationEmail(user.email, selector, verifier);

    res.json({
      success: true,
      message: 'Verification email sent',
    });
  } catch (error) {
    console.error('Resend verification error:', error);
    return sendError(res, 500, 'Failed to resend verification', ErrorCodes.ERR_INTERNAL_SERVER);
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

    // Security: Always perform bcrypt comparison to prevent timing attacks
    // Use a dummy hash if record doesn't exist to maintain constant-time response
    const dummyHash = '$2b$10$dummyhashforconstanttimecomparison1234567890123456789012';
    const hashToCompare = passwordReset?.verifier || dummyHash;
    
    // Verify the token against stored hashed verifier (or dummy hash)
    const isValidToken = await bcrypt.compare(String(token), hashToCompare);

    // Validate token exists and is valid
    if (!passwordReset || !isValidToken) {
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

    // Security: Always perform bcrypt comparison to prevent timing attacks
    // Use a dummy hash if record doesn't exist to maintain constant-time response
    const dummyHash = '$2b$10$dummyhashforconstanttimecomparison1234567890123456789012';
    const hashToCompare = passwordReset?.verifier || dummyHash;
    
    // Verify the token against stored hashed verifier (or dummy hash)
    const isValidToken = await bcrypt.compare(token, hashToCompare);

    // Validate token exists and is valid
    if (!passwordReset || !isValidToken) {
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