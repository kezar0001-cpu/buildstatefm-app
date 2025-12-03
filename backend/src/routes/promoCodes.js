import express from 'express';
import { z } from 'zod';
import { prisma } from '../config/prismaClient.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { sendError, ErrorCodes } from '../utils/errorHandler.js';

const router = express.Router();

// Validation schemas
const createPromoCodeSchema = z.object({
  code: z.string().min(3).max(50).regex(/^[A-Z0-9_-]+$/i, 'Code must contain only letters, numbers, hyphens, and underscores'),
  description: z.string().optional(),
  discountType: z.enum(['FIXED', 'PERCENTAGE']),
  discountValue: z.number().positive(),
  applicablePlans: z.array(z.string()).default([]),
  maxUses: z.number().int().positive().nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  isActive: z.boolean().default(true),
});

const updatePromoCodeSchema = createPromoCodeSchema.partial();

// GET /api/promo-codes - List all promo codes (admin only)
router.get('/', requireAuth, requireRole('ADMIN'), async (req, res) => {
  try {
    const { search, isActive, page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    
    if (search) {
      where.code = {
        contains: search,
        mode: 'insensitive',
      };
    }

    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    const [promoCodes, total] = await Promise.all([
      prisma.promoCode.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: {
          createdAt: 'desc',
        },
      }),
      prisma.promoCode.count({ where }),
    ]);

    res.json({
      promoCodes,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Error fetching promo codes:', error);
    return sendError(res, 500, 'Failed to fetch promo codes', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

// GET /api/promo-codes/:id - Get single promo code (admin only)
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

// POST /api/promo-codes - Create new promo code (admin only)
router.post('/', requireAuth, requireRole('ADMIN'), async (req, res) => {
  try {
    const data = createPromoCodeSchema.parse(req.body);

    // Check if code already exists
    const existing = await prisma.promoCode.findUnique({
      where: { code: data.code.toUpperCase() },
    });

    if (existing) {
      return sendError(res, 409, 'Promo code already exists', ErrorCodes.RES_ALREADY_EXISTS);
    }

    const promoCode = await prisma.promoCode.create({
      data: {
        ...data,
        code: data.code.toUpperCase(),
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
      },
    });

    res.status(201).json(promoCode);
  } catch (error) {
    if (error.name === 'ZodError') {
      return sendError(res, 400, 'Validation error', ErrorCodes.VAL_VALIDATION_ERROR, error.errors);
    }
    console.error('Error creating promo code:', error);
    return sendError(res, 500, 'Failed to create promo code', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

// PUT /api/promo-codes/:id - Update promo code (admin only)
router.put('/:id', requireAuth, requireRole('ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;
    const data = updatePromoCodeSchema.parse(req.body);

    // Check if promo code exists
    const existing = await prisma.promoCode.findUnique({
      where: { id },
    });

    if (!existing) {
      return sendError(res, 404, 'Promo code not found', ErrorCodes.RES_NOT_FOUND);
    }

    // If code is being updated, check for duplicates
    if (data.code && data.code.toUpperCase() !== existing.code) {
      const duplicate = await prisma.promoCode.findUnique({
        where: { code: data.code.toUpperCase() },
      });

      if (duplicate) {
        return sendError(res, 409, 'Promo code already exists', ErrorCodes.RES_ALREADY_EXISTS);
      }
    }

    const promoCode = await prisma.promoCode.update({
      where: { id },
      data: {
        ...data,
        ...(data.code && { code: data.code.toUpperCase() }),
        ...(data.expiresAt && { expiresAt: new Date(data.expiresAt) }),
      },
    });

    res.json(promoCode);
  } catch (error) {
    if (error.name === 'ZodError') {
      return sendError(res, 400, 'Validation error', ErrorCodes.VAL_VALIDATION_ERROR, error.errors);
    }
    console.error('Error updating promo code:', error);
    return sendError(res, 500, 'Failed to update promo code', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

// DELETE /api/promo-codes/:id - Delete promo code (admin only)
router.delete('/:id', requireAuth, requireRole('ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;

    const promoCode = await prisma.promoCode.findUnique({
      where: { id },
    });

    if (!promoCode) {
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
      return sendError(res, 400, 'Promo code is required', ErrorCodes.VAL_MISSING_FIELD);
    }

    const promoCode = await prisma.promoCode.findUnique({
      where: { code: code.toUpperCase() },
    });

    if (!promoCode) {
      return sendError(res, 404, 'Promo code not found', ErrorCodes.RES_NOT_FOUND);
    }

    // Check if promo code is active
    if (!promoCode.isActive) {
      return sendError(res, 400, 'Promo code is not active', ErrorCodes.BIZ_OPERATION_NOT_ALLOWED);
    }

    // Check if promo code has expired
    if (promoCode.expiresAt && new Date(promoCode.expiresAt) < new Date()) {
      return sendError(res, 400, 'Promo code has expired', ErrorCodes.BIZ_OPERATION_NOT_ALLOWED);
    }

    // Check if promo code has reached max uses
    if (promoCode.maxUses !== null && promoCode.currentUses >= promoCode.maxUses) {
      return sendError(res, 400, 'Promo code has reached maximum uses', ErrorCodes.BIZ_OPERATION_NOT_ALLOWED);
    }

    // Check if promo code applies to the specified plan
    if (plan && promoCode.applicablePlans.length > 0) {
      if (!promoCode.applicablePlans.includes(plan.toUpperCase())) {
        return sendError(res, 400, 'Promo code does not apply to this plan', ErrorCodes.BIZ_OPERATION_NOT_ALLOWED);
      }
    }

    // Calculate discount
    let discountAmount = 0;
    if (promoCode.discountType === 'FIXED') {
      discountAmount = promoCode.discountValue;
    } else if (promoCode.discountType === 'PERCENTAGE') {
      // For percentage, we need the plan price to calculate
      const planPrices = {
        BASIC: 29,
        PROFESSIONAL: 79,
        ENTERPRISE: 149,
      };
      const planPrice = planPrices[plan?.toUpperCase()] || 0;
      discountAmount = (planPrice * promoCode.discountValue) / 100;
    }

    res.json({
      valid: true,
      promoCode: {
        id: promoCode.id,
        code: promoCode.code,
        description: promoCode.description,
        discountType: promoCode.discountType,
        discountValue: promoCode.discountValue,
        discountAmount: Math.round(discountAmount * 100) / 100,
      },
    });
  } catch (error) {
    console.error('Error validating promo code:', error);
    return sendError(res, 500, 'Failed to validate promo code', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

export default router;

