import express from 'express';
import { z } from 'zod';
import validate from '../middleware/validate.js';
import { prisma } from '../config/prismaClient.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { sendError, ErrorCodes } from '../utils/errorHandler.js';

const router = express.Router();

// Validation schemas
const createPromoCodeSchema = z.object({
  code: z.string().min(3).max(50).toUpperCase(),
  description: z.string().optional(),
  discountType: z.enum(['FIXED', 'PERCENTAGE']),
  discountAmount: z.number().min(0).optional(),
  discountPercentage: z.number().min(0).max(100).optional(),
  maxUses: z.number().int().positive().optional(),
  expiresAt: z.string().datetime().optional(),
  applicablePlans: z.array(z.enum(['BASIC', 'PROFESSIONAL', 'ENTERPRISE'])).default([]),
});

const updatePromoCodeSchema = z.object({
  description: z.string().optional(),
  discountType: z.enum(['FIXED', 'PERCENTAGE']).optional(),
  discountAmount: z.number().min(0).optional(),
  discountPercentage: z.number().min(0).max(100).optional(),
  maxUses: z.number().int().positive().optional(),
  expiresAt: z.string().datetime().optional(),
  applicablePlans: z.array(z.enum(['BASIC', 'PROFESSIONAL', 'ENTERPRISE'])).optional(),
  isActive: z.boolean().optional(),
});

// GET /api/promo-codes - List all promo codes (ADMIN only)
router.get('/', requireAuth, requireRole('ADMIN'), async (req, res) => {
  try {
    const { active, search, page = 1, limit = 50 } = req.query;

    const where = {};

    if (active !== undefined) {
      where.isActive = active === 'true';
    }

    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [promoCodes, total] = await Promise.all([
      prisma.promoCode.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.promoCode.count({ where }),
    ]);

    res.json({
      promoCodes,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Error fetching promo codes:', error);
    return sendError(res, 500, 'Failed to fetch promo codes', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

// GET /api/promo-codes/:id - Get single promo code (ADMIN only)
router.get('/:id', requireAuth, requireRole('ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;

    const promoCode = await prisma.promoCode.findUnique({
      where: { id },
    });

    if (!promoCode) {
      return sendError(res, 404, 'Promo code not found', ErrorCodes.RES_NOT_FOUND);
    }

    res.json(promoCode);
  } catch (error) {
    console.error('Error fetching promo code:', error);
    return sendError(res, 500, 'Failed to fetch promo code', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

// POST /api/promo-codes - Create promo code (ADMIN only)
router.post('/', requireAuth, requireRole('ADMIN'), validate(createPromoCodeSchema), async (req, res) => {
  try {
    const data = req.body;

    // Validate discount type and amount/percentage match
    if (data.discountType === 'FIXED' && !data.discountAmount) {
      return sendError(res, 400, 'discountAmount required for FIXED discount type', ErrorCodes.VAL_INVALID_REQUEST);
    }

    if (data.discountType === 'PERCENTAGE' && !data.discountPercentage) {
      return sendError(res, 400, 'discountPercentage required for PERCENTAGE discount type', ErrorCodes.VAL_INVALID_REQUEST);
    }

    // Check if code already exists
    const existing = await prisma.promoCode.findUnique({
      where: { code: data.code },
    });

    if (existing) {
      return sendError(res, 409, 'Promo code already exists', ErrorCodes.RES_ALREADY_EXISTS);
    }

    const promoCode = await prisma.promoCode.create({
      data: {
        ...data,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
        createdBy: req.user.id,
      },
    });

    res.status(201).json(promoCode);
  } catch (error) {
    console.error('Error creating promo code:', error);
    return sendError(res, 500, 'Failed to create promo code', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

// PUT /api/promo-codes/:id - Update promo code (ADMIN only)
router.put('/:id', requireAuth, requireRole('ADMIN'), validate(updatePromoCodeSchema), async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;

    const existing = await prisma.promoCode.findUnique({
      where: { id },
    });

    if (!existing) {
      return sendError(res, 404, 'Promo code not found', ErrorCodes.RES_NOT_FOUND);
    }

    const updated = await prisma.promoCode.update({
      where: { id },
      data: {
        ...data,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
      },
    });

    res.json(updated);
  } catch (error) {
    console.error('Error updating promo code:', error);
    return sendError(res, 500, 'Failed to update promo code', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

// DELETE /api/promo-codes/:id - Delete promo code (ADMIN only)
router.delete('/:id', requireAuth, requireRole('ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await prisma.promoCode.findUnique({
      where: { id },
    });

    if (!existing) {
      return sendError(res, 404, 'Promo code not found', ErrorCodes.RES_NOT_FOUND);
    }

    await prisma.promoCode.delete({
      where: { id },
    });

    res.json({ success: true, message: 'Promo code deleted successfully' });
  } catch (error) {
    console.error('Error deleting promo code:', error);
    return sendError(res, 500, 'Failed to delete promo code', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

// POST /api/promo-codes/validate - Validate promo code (authenticated users)
router.post('/validate', requireAuth, async (req, res) => {
  try {
    const { code, plan } = req.body;

    if (!code) {
      return sendError(res, 400, 'Code required', ErrorCodes.VAL_MISSING_FIELD);
    }

    const promoCode = await prisma.promoCode.findUnique({
      where: { code: code.toUpperCase() },
    });

    if (!promoCode) {
      return res.json({ valid: false, reason: 'Invalid promo code' });
    }

    if (!promoCode.isActive) {
      return res.json({ valid: false, reason: 'Promo code is no longer active' });
    }

    if (promoCode.expiresAt && new Date(promoCode.expiresAt) < new Date()) {
      return res.json({ valid: false, reason: 'Promo code has expired' });
    }

    if (promoCode.maxUses && promoCode.currentUses >= promoCode.maxUses) {
      return res.json({ valid: false, reason: 'Promo code usage limit reached' });
    }

    if (plan && promoCode.applicablePlans.length > 0 && !promoCode.applicablePlans.includes(plan)) {
      return res.json({ valid: false, reason: `Promo code not applicable to ${plan} plan` });
    }

    res.json({
      valid: true,
      promoCode: {
        code: promoCode.code,
        description: promoCode.description,
        discountType: promoCode.discountType,
        discountAmount: promoCode.discountAmount,
        discountPercentage: promoCode.discountPercentage,
      },
    });
  } catch (error) {
    console.error('Error validating promo code:', error);
    return sendError(res, 500, 'Failed to validate promo code', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

export default router;
