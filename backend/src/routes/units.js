import { Router } from 'express';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import prisma from '../config/prismaClient.js';
import { requireAuth, requireRole, requireActiveSubscription, isSubscriptionActive } from '../middleware/auth.js';
import { asyncHandler, sendError, ErrorCodes } from '../utils/errorHandler.js';
import { createUploadMiddleware, getUploadedFileUrl, deleteImage } from '../services/uploadService.js';

const router = Router({ mergeParams: true });

// All unit routes require authentication
router.use(requireAuth);

const UNIT_STATUSES = [
  'AVAILABLE',
  'OCCUPIED',
  'MAINTENANCE',
  'VACANT',
  'PENDING_MOVE_IN',
  'PENDING_MOVE_OUT',
];

// Nested unit image routes
const unitImagesRouter = Router({ mergeParams: true });
router.use('/:id/images', unitImagesRouter);

const unitImageUpload = createUploadMiddleware({
  folder: 'units',
  maxFileSize: 10 * 1024 * 1024,
  maxFiles: 1,
  allowedExtensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
});

const unitImageUploadMiddleware = unitImageUpload.single('image');

const isMultipartRequest = (req) => {
  const header = req?.headers?.['content-type'];
  if (!header) return false;
  const [type] = header.split(';', 1);
  return type?.trim().toLowerCase() === 'multipart/form-data';
};

const maybeHandleImageUpload = (req, res, next) => {
  if (isMultipartRequest(req)) {
    return unitImageUploadMiddleware(req, res, next);
  }
  return next();
};

// Unit image validation schemas
const unitImageCreateSchema = z.object({
  imageUrl: z.string().min(1),
  caption: z.string().optional().nullable(),
  isPrimary: z.boolean().optional(),
});

const unitImageUpdateSchema = z.object({
  caption: z.string().optional().nullable(),
  isPrimary: z.boolean().optional(),
});

const unitImageReorderSchema = z.object({
  orderedImageIds: z.array(z.string()).min(1),
});

// Helper functions for unit images
const determineNewImagePrimaryFlag = (requested, context) => {
  if (requested === true) return true;
  if (!context.hasExistingImages) return true;
  if (!context.hasExistingPrimary) return true;
  return false;
};

const normalizeUnitImages = (unit) => {
  if (!unit) return [];

  if (Array.isArray(unit.unitImages) && unit.unitImages.length > 0) {
    return unit.unitImages.map((img) => ({
      id: img.id,
      imageUrl: img.imageUrl,
      caption: img.caption,
      isPrimary: img.isPrimary,
      displayOrder: img.displayOrder,
      createdAt: img.createdAt,
      updatedAt: img.updatedAt,
    }));
  }

  if (unit.imageUrl) {
    return [{
      id: `legacy-${unit.id}`,
      imageUrl: unit.imageUrl,
      caption: null,
      isPrimary: true,
      displayOrder: 0,
      createdAt: unit.createdAt,
      updatedAt: unit.updatedAt,
    }];
  }

  return [];
};

const syncUnitCoverImage = async (tx, unitId) => {
  const primaryImage = await tx.unitImage.findFirst({
    where: { unitId, isPrimary: true },
    orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
  });

  const fallbackImage = !primaryImage ? await tx.unitImage.findFirst({
    where: { unitId },
    orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
  }) : null;

  const targetUrl = primaryImage?.imageUrl || fallbackImage?.imageUrl || null;

  await tx.unit.update({
    where: { id: unitId },
    data: { imageUrl: targetUrl },
  });
};

const tenantIncludeSelection = {
  include: {
    tenant: {
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
      },
    },
  },
};

const tenantListArgs = {
  ...tenantIncludeSelection,
  orderBy: [
    { isActive: 'desc' },
    { createdAt: 'desc' },
  ],
};

const ownerIncludeSelection = {
  include: {
    // Prisma relation on UnitOwner -> User is named `User`
    User: {
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
      },
    },
  },
};

const ownerListArgs = {
  ...ownerIncludeSelection,
  orderBy: { createdAt: 'desc' },
};

const unitIncludeConfig = {
  property: {
    select: {
      id: true,
      name: true,
      address: true,
      city: true,
      state: true,
      zipCode: true,
      managerId: true,
      owners: {
        select: {
          ownerId: true,
        },
      },
    },
  },
  UnitImage: {
    orderBy: { displayOrder: 'asc' },
  },
  tenants: tenantListArgs,
  // Use the correct Unit relation name from the Prisma schema
  UnitOwner: ownerListArgs,
};

const unitCreateSchema = z.object({
  propertyId: z.string().min(1, 'Property ID is required'),
  unitNumber: z.string().min(1, 'Unit number is required'),
  floor: z
    .preprocess((value) => (value === '' || value == null ? null : Number(value)), z.number().int().nullable())
    .optional(),
  bedrooms: z
    .preprocess((value) => (value === '' || value == null ? null : Number(value)), z.number().int().nullable())
    .optional(),
  bathrooms: z
    .preprocess((value) => (value === '' || value == null ? null : Number(value)), z.number().nullable())
    .optional(),
  area: z
    .preprocess((value) => {
      if (value === '' || value == null) return null;
      const num = Number(value);
      return Number.isFinite(num) ? Math.round(num) : null;
    }, z.number().int().nullable())
    .optional(),
  rentAmount: z
    .preprocess((value) => (value === '' || value == null ? null : Number(value)), z.number().nullable())
    .optional(),
  status: z.enum(UNIT_STATUSES).optional().default('AVAILABLE'),
  description: z.string().nullable().optional(),
  imageUrl: z.string().url().nullable().optional(),
  images: z.array(unitImageCreateSchema).optional(),
});

const unitUpdateSchema = unitCreateSchema.partial().omit({ propertyId: true }).extend({
  status: z.enum(UNIT_STATUSES).optional(),
});

const tenantAssignmentSchema = z.object({
  tenantId: z.string().min(1, 'Tenant is required').optional(),
  leaseStart: z.string().min(1, 'Lease start date is required'),
  leaseEnd: z.string().min(1, 'Lease end date is required'),
  rentAmount: z.number().positive('Rent amount must be greater than zero'),
  depositAmount: z.number().min(0, 'Deposit amount cannot be negative').optional(),
});

const moveInSchema = tenantAssignmentSchema.extend({
  tenantId: z.string().min(1, 'Tenant is required'),
});

const moveOutSchema = z.object({
  moveOutDate: z.string().min(1, 'Move out date is required'),
});

const toPublicTenant = (tenant) => {
  if (!tenant) return tenant;

  return {
    id: tenant.id,
    unitId: tenant.unitId,
    tenantId: tenant.tenantId,
    leaseStart: tenant.leaseStart,
    leaseEnd: tenant.leaseEnd,
    rentAmount: tenant.rentAmount,
    depositAmount: tenant.depositAmount ?? null,
    isActive: Boolean(tenant.isActive),
    createdAt: tenant.createdAt,
    updatedAt: tenant.updatedAt,
    tenant: tenant.tenant
      ? {
          id: tenant.tenant.id,
          firstName: tenant.tenant.firstName,
          lastName: tenant.tenant.lastName,
          email: tenant.tenant.email,
          phone: tenant.tenant.phone,
        }
      : null,
  };
};

const toPublicOwner = (owner) => {
  if (!owner) return owner;

  return {
    id: owner.id,
    unitId: owner.unitId,
    ownerId: owner.ownerId,
    ownershipPercentage: owner.ownershipPercentage,
    startDate: owner.startDate,
    endDate: owner.endDate ?? null,
    createdAt: owner.createdAt,
    updatedAt: owner.updatedAt,
    // Map through the related User record
    owner: owner.User
      ? {
          id: owner.User.id,
          firstName: owner.User.firstName,
          lastName: owner.User.lastName,
          email: owner.User.email,
          phone: owner.User.phone,
        }
      : null,
  };
};

const toPublicUnit = (unit) => {
  if (!unit) return unit;

  const { property, tenants, UnitOwner, UnitImage, ...rest } = unit;

  return {
    ...rest,
    floor: unit.floor ?? null,
    bedrooms: unit.bedrooms ?? null,
    bathrooms: unit.bathrooms ?? null,
    area: unit.area ?? null,
    rentAmount: unit.rentAmount ?? null,
    description: unit.description ?? null,
    imageUrl: unit.imageUrl ?? null,
    images: normalizeUnitImages({ ...unit, unitImages: UnitImage }),
    property: property
      ? {
          id: property.id,
          name: property.name,
          address: property.address,
          city: property.city,
          state: property.state,
          zipCode: property.zipCode,
          managerId: property.managerId,
        }
      : null,
    tenants: Array.isArray(tenants) ? tenants.map(toPublicTenant) : [],
    owners: Array.isArray(UnitOwner) ? UnitOwner.map(toPublicOwner) : [],
  };
};

const ensurePropertyAccess = async (propertyId, user, { requireWrite = false } = {}) => {
  if (!propertyId) {
    return { allowed: false, status: 400, reason: 'Property ID is required' };
  }

  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    include: {
      owners: { select: { ownerId: true } },
      manager: {
        select: {
          id: true,
          subscriptionStatus: true,
          trialEndDate: true,
        },
      },
    },
  });

  if (!property) {
    return { allowed: false, status: 404, reason: 'Property not found' };
  }

  if (user.role === 'ADMIN') {
    return { allowed: true, property, canWrite: true };
  }

  if (user.role === 'PROPERTY_MANAGER' && property.managerId === user.id) {
    return { allowed: true, property, canWrite: true };
  }

  if (user.role === 'OWNER' && property.owners.some((owner) => owner.ownerId === user.id)) {
    if (requireWrite) {
      return { allowed: false, status: 403, reason: 'Owners have read-only access' };
    }
    return { allowed: true, property, canWrite: false };
  }

  if (user.role === 'TECHNICIAN') {
    const hasAssignedJob = await prisma.job.findFirst({
      where: {
        propertyId,
        assignedToId: user.id,
        archivedAt: null,
      },
      select: { id: true },
    });

    if (hasAssignedJob) {
      return { allowed: true, property, canWrite: false };
    }
  }

  if (user.role === 'TENANT') {
    const hasActiveLease = await prisma.unitTenant.findFirst({
      where: {
        tenantId: user.id,
        isActive: true,
        unit: { propertyId },
      },
    });

    if (hasActiveLease) {
      return { allowed: true, property, canWrite: false };
    }
  }

  return { allowed: false, status: 403, reason: 'Access denied to this property' };
};

const ensureManagerSubscriptionActive = (property, user) => {
  if (!property) return { allowed: false, status: 404, reason: 'Property not found' };
  if (user.role === 'PROPERTY_MANAGER' || user.role === 'ADMIN') {
    return { allowed: true };
  }
  if (isSubscriptionActive(property.manager)) {
    return { allowed: true };
  }
  return {
    allowed: false,
    status: 403,
    reason: "This property's subscription has expired. Please contact your property manager.",
    errorCode: ErrorCodes.SUB_MANAGER_SUBSCRIPTION_REQUIRED,
  };
};

const ensureUnitAccess = async (unitId, user, options = {}) => {
  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
    include: unitIncludeConfig,
  });

  if (!unit) {
    return { allowed: false, status: 404, reason: 'Unit not found' };
  }

  const access = await ensurePropertyAccess(unit.propertyId, user, options);
  if (!access.allowed) {
    return { ...access, unit: null };
  }

  return { ...access, unit };
};

const parseLimit = (value, defaultValue = 50) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return defaultValue;
  return Math.min(Math.max(parsed, 1), 100);
};

const parseOffset = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return parsed;
};

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const propertyId = req.query.propertyId || req.params.propertyId || null;
    const statusFilter = req.query.status;
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const includeTenants = (req.query.includeTenants || '').toString().toLowerCase() !== 'false';
    const includeProperty = (req.query.includeProperty || '').toString().toLowerCase() !== 'false';

    const limit = parseLimit(req.query.limit);
    const offset = parseOffset(req.query.offset);

    const where = {};

    if (propertyId) {
      const access = await ensurePropertyAccess(propertyId, req.user);
      if (!access.allowed) {
        return sendError(
          res,
          access.status,
          access.reason,
          access.status === 404 ? ErrorCodes.RES_NOT_FOUND : ErrorCodes.ACC_PROPERTY_ACCESS_DENIED,
        );
      }

      const subscriptionGate = ensureManagerSubscriptionActive(access.property, req.user);
      if (!subscriptionGate.allowed) {
        return sendError(res, subscriptionGate.status, subscriptionGate.reason, subscriptionGate.errorCode);
      }

      where.propertyId = propertyId;
    } else {
      switch (req.user.role) {
        case 'ADMIN':
          break;
        case 'PROPERTY_MANAGER':
          where.property = { managerId: req.user.id };
          break;
        case 'OWNER':
          where.property = { owners: { some: { ownerId: req.user.id } } };
          break;
        case 'TENANT':
          where.tenants = { some: { tenantId: req.user.id, isActive: true } };
          break;
        case 'TECHNICIAN':
          where.jobs = { some: { assignedToId: req.user.id, archivedAt: null } };
          break;
        default:
          return sendError(res, 403, 'Access denied to units', ErrorCodes.ACC_ACCESS_DENIED);
      }
    }

    // Subscription gate for non-PM roles when listing across properties
    if (!['PROPERTY_MANAGER', 'ADMIN'].includes(req.user.role)) {
      const now = new Date();
      where.property = {
        ...(where.property || {}),
        OR: [
          { manager: { subscriptionStatus: 'ACTIVE' } },
          { manager: { subscriptionStatus: 'TRIAL', trialEndDate: { gt: now } } },
        ],
      };
    }

    if (statusFilter) {
      const statuses = Array.isArray(statusFilter)
        ? statusFilter
        : statusFilter
            .toString()
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);

      if (statuses.length === 1) {
        where.status = statuses[0];
      } else if (statuses.length > 1) {
        where.status = { in: statuses };
      }
    }

    if (search) {
      where.OR = [
        { unitNumber: { contains: search, mode: 'insensitive' } },
        { property: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const include = {
      // Always include UnitImage so Edit Unit form can display existing images
      UnitImage: {
        orderBy: { displayOrder: 'asc' },
      },
    };
    if (includeTenants) {
      include.tenants = tenantListArgs;
    }
    if (includeProperty || !propertyId) {
      include.property = unitIncludeConfig.property;
    }

    const [units, total] = await Promise.all([
      prisma.unit.findMany({
        where,
        include,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.unit.count({ where }),
    ]);

    const items = units.map(toPublicUnit);
    const nextOffset = offset + limit < total ? offset + limit : null;

    res.json({
      success: true,
      items,
      total,
      limit,
      offset,
      hasMore: Boolean(nextOffset != null),
      nextOffset,
      page: Math.floor(offset / limit) + 1,
    });
  })
);

router.get(
  '/:unitId',
  asyncHandler(async (req, res) => {
    const { unitId } = req.params;
    const access = await ensureUnitAccess(unitId, req.user);

    if (!access.allowed) {
      return sendError(
        res,
        access.status,
        access.reason,
        access.status === 404 ? ErrorCodes.RES_NOT_FOUND : ErrorCodes.ACC_PROPERTY_ACCESS_DENIED,
      );
    }

    const subscriptionGate = ensureManagerSubscriptionActive(access.property, req.user);
    if (!subscriptionGate.allowed) {
      return sendError(res, subscriptionGate.status, subscriptionGate.reason, subscriptionGate.errorCode);
    }

    res.json({ success: true, unit: toPublicUnit(access.unit) });
  })
);

router.post(
  '/',
  requireRole('PROPERTY_MANAGER', 'ADMIN'),
  asyncHandler(async (req, res) => {
    const parsed = unitCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(
        res,
        400,
        'Validation error',
        ErrorCodes.VAL_VALIDATION_ERROR,
        parsed.error.flatten().fieldErrors,
      );
    }

    const data = parsed.data;
    const access = await ensurePropertyAccess(data.propertyId, req.user, { requireWrite: true });
    if (!access.allowed) {
      return sendError(
        res,
        access.status,
        access.reason,
        access.status === 404 ? ErrorCodes.RES_NOT_FOUND : ErrorCodes.ACC_PROPERTY_ACCESS_DENIED,
      );
    }

    const unit = await prisma.$transaction(async (tx) => {
      const createdUnit = await tx.unit.create({
        data: {
          propertyId: data.propertyId,
          unitNumber: data.unitNumber,
          floor: data.floor ?? null,
          bedrooms: data.bedrooms ?? null,
          bathrooms: data.bathrooms ?? null,
          // Fix: Ensure area is converted to integer (sqm) - schema expects Int
          area: data.area != null ? Math.round(Number(data.area)) : null,
          rentAmount: data.rentAmount ?? null,
          status: data.status ?? 'AVAILABLE',
          description: data.description ?? null,
          imageUrl: data.imageUrl ?? null,
        },
        include: unitIncludeConfig,
      });

      // Handle images array if provided
      if (data.images && Array.isArray(data.images) && data.images.length > 0) {
        const imageRecords = data.images.map((image, index) => ({
          id: randomUUID(),
          unitId: createdUnit.id,
          imageUrl: image.imageUrl,
          caption: image.caption ?? null,
          isPrimary: image.isPrimary ?? (index === 0),
          displayOrder: index,
          uploadedById: req.user.id,
        }));

        await tx.unitImage.createMany({ data: imageRecords });

        // Sync cover image from primary image
        await syncUnitCoverImage(tx, createdUnit.id);
      }

      return createdUnit;
    });

    res.status(201).json({ success: true, unit: toPublicUnit(unit) });
  })
);

router.patch(
  '/:unitId',
  requireRole('PROPERTY_MANAGER', 'ADMIN'),
  requireActiveSubscription,
  asyncHandler(async (req, res) => {
    const { unitId } = req.params;

    const access = await ensureUnitAccess(unitId, req.user, { requireWrite: true });
    if (!access.allowed) {
      return sendError(
        res,
        access.status,
        access.reason,
        access.status === 404 ? ErrorCodes.RES_NOT_FOUND : ErrorCodes.ACC_PROPERTY_ACCESS_DENIED,
      );
    }

    const parsed = unitUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(
        res,
        400,
        'Validation error',
        ErrorCodes.VAL_VALIDATION_ERROR,
        parsed.error.flatten().fieldErrors,
      );
    }

    const data = parsed.data;

    const unit = await prisma.$transaction(async (tx) => {
      const updatedUnit = await tx.unit.update({
        where: { id: unitId },
        data: {
          ...(data.unitNumber !== undefined && { unitNumber: data.unitNumber }),
          ...(data.floor !== undefined && { floor: data.floor ?? null }),
          ...(data.bedrooms !== undefined && { bedrooms: data.bedrooms ?? null }),
          ...(data.bathrooms !== undefined && { bathrooms: data.bathrooms ?? null }),
          // Fix: Ensure area is converted to integer (sqm) - schema expects Int
          ...(data.area !== undefined && { area: data.area != null ? Math.round(Number(data.area)) : null }),
          ...(data.rentAmount !== undefined && { rentAmount: data.rentAmount ?? null }),
          ...(data.status !== undefined && { status: data.status }),
          ...(data.description !== undefined && { description: data.description ?? null }),
          ...(data.imageUrl !== undefined && { imageUrl: data.imageUrl ?? null }),
        },
        include: unitIncludeConfig,
      });

      if (data.images !== undefined) {
        await tx.unitImage.deleteMany({ where: { unitId } });

        if (Array.isArray(data.images) && data.images.length > 0) {
          const imageRecords = data.images.map((image, index) => ({
            id: randomUUID(),
            unitId,
            imageUrl: image.imageUrl,
            caption: image.caption ?? null,
            isPrimary: image.isPrimary ?? index === 0,
            displayOrder: index,
            uploadedById: req.user.id,
          }));

          await tx.unitImage.createMany({ data: imageRecords });
        }

        await syncUnitCoverImage(tx, unitId);
      }

      return updatedUnit;
    });

    res.json({ success: true, unit: toPublicUnit(unit) });
  })
);

router.delete(
  '/:unitId',
  requireRole('PROPERTY_MANAGER', 'ADMIN'),
  requireActiveSubscription,
  asyncHandler(async (req, res) => {
    const { unitId } = req.params;
    const access = await ensureUnitAccess(unitId, req.user, { requireWrite: true });

    if (!access.allowed) {
      return sendError(
        res,
        access.status,
        access.reason,
        access.status === 404 ? ErrorCodes.RES_NOT_FOUND : ErrorCodes.ACC_PROPERTY_ACCESS_DENIED,
      );
    }

    await prisma.unit.delete({ where: { id: unitId } });
    res.status(204).send();
  })
);

router.get(
  '/:unitId/tenants',
  asyncHandler(async (req, res) => {
    const { unitId } = req.params;
    const access = await ensureUnitAccess(unitId, req.user);

    if (!access.allowed) {
      return sendError(
        res,
        access.status,
        access.reason,
        access.status === 404 ? ErrorCodes.RES_NOT_FOUND : ErrorCodes.ACC_PROPERTY_ACCESS_DENIED,
      );
    }

    const tenants = await prisma.unitTenant.findMany({
      where: { unitId },
      ...tenantListArgs,
    });

    res.json({ tenants: tenants.map(toPublicTenant) });
  })
);

router.post(
  '/:unitId/tenants',
  requireRole('PROPERTY_MANAGER', 'ADMIN'),
  asyncHandler(async (req, res) => {
    const { unitId } = req.params;
    const access = await ensureUnitAccess(unitId, req.user, { requireWrite: true });

    if (!access.allowed) {
      return sendError(
        res,
        access.status,
        access.reason,
        access.status === 404 ? ErrorCodes.RES_NOT_FOUND : ErrorCodes.ACC_PROPERTY_ACCESS_DENIED,
      );
    }

    const parsed = tenantAssignmentSchema.extend({ tenantId: z.string().min(1, 'Tenant is required') }).safeParse(req.body);
    if (!parsed.success) {
      return sendError(
        res,
        400,
        'Validation error',
        ErrorCodes.VAL_VALIDATION_ERROR,
        parsed.error.flatten().fieldErrors,
      );
    }

    const data = parsed.data;

    const tenant = await prisma.unitTenant.create({
      data: {
        unitId,
        tenantId: data.tenantId,
        leaseStart: new Date(data.leaseStart),
        leaseEnd: new Date(data.leaseEnd),
        rentAmount: data.rentAmount,
        depositAmount: data.depositAmount ?? null,
        isActive: true,
      },
      ...tenantIncludeSelection,
    });

    await prisma.unit.update({
      where: { id: unitId },
      data: { status: 'OCCUPIED' },
    });

    res.status(201).json({ tenant: toPublicTenant(tenant) });
  })
);

router.patch(
  '/:unitId/tenants/:tenantId',
  requireRole('PROPERTY_MANAGER', 'ADMIN'),
  asyncHandler(async (req, res) => {
    const { unitId, tenantId } = req.params;
    const access = await ensureUnitAccess(unitId, req.user, { requireWrite: true });

    if (!access.allowed) {
      return sendError(
        res,
        access.status,
        access.reason,
        access.status === 404 ? ErrorCodes.RES_NOT_FOUND : ErrorCodes.ACC_PROPERTY_ACCESS_DENIED,
      );
    }

    const parsed = tenantAssignmentSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(
        res,
        400,
        'Validation error',
        ErrorCodes.VAL_VALIDATION_ERROR,
        parsed.error.flatten().fieldErrors,
      );
    }

    const data = parsed.data;

    const existing = await prisma.unitTenant.findFirst({
      where: { unitId, tenantId },
      orderBy: { createdAt: 'desc' },
    });

    if (!existing) {
      return sendError(res, 404, 'Tenant assignment not found', ErrorCodes.RES_NOT_FOUND);
    }

    const tenant = await prisma.unitTenant.update({
      where: { id: existing.id },
      data: {
        leaseStart: new Date(data.leaseStart),
        leaseEnd: new Date(data.leaseEnd),
        rentAmount: data.rentAmount,
        depositAmount: data.depositAmount ?? null,
      },
      ...tenantIncludeSelection,
    });

    res.json({ tenant: toPublicTenant(tenant) });
  })
);

router.delete(
  '/:unitId/tenants/:tenantId',
  requireRole('PROPERTY_MANAGER', 'ADMIN'),
  asyncHandler(async (req, res) => {
    const { unitId, tenantId } = req.params;
    const access = await ensureUnitAccess(unitId, req.user, { requireWrite: true });

    if (!access.allowed) {
      return sendError(
        res,
        access.status,
        access.reason,
        access.status === 404 ? ErrorCodes.RES_NOT_FOUND : ErrorCodes.ACC_PROPERTY_ACCESS_DENIED,
      );
    }

    const existing = await prisma.unitTenant.findFirst({
      where: { unitId, tenantId },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });

    if (!existing) {
      return sendError(res, 404, 'Tenant assignment not found', ErrorCodes.RES_NOT_FOUND);
    }

    await prisma.unitTenant.delete({
      where: { id: existing.id },
    });

    const remaining = await prisma.unitTenant.count({ where: { unitId, isActive: true } });
    if (remaining === 0) {
      await prisma.unit.update({
        where: { id: unitId },
        data: { status: 'AVAILABLE' },
      });
    }

    res.status(204).send();
  })
);

// Move-in workflow endpoints
router.post(
  '/:unitId/move-in',
  requireRole('PROPERTY_MANAGER'),
  asyncHandler(async (req, res) => {
    const { unitId } = req.params;
    const { step, ...payload } = req.body || {};

    const access = await ensureUnitAccess(unitId, req.user, { requireWrite: true });
    if (!access.allowed) {
      return sendError(
        res,
        access.status,
        access.reason,
        access.status === 404 ? ErrorCodes.RES_NOT_FOUND : ErrorCodes.ACC_PROPERTY_ACCESS_DENIED,
      );
    }

    switch (step) {
      case 0: {
        const parsed = moveInSchema.safeParse(payload);
        if (!parsed.success) {
          return sendError(
            res,
            400,
            'Validation error',
            ErrorCodes.VAL_VALIDATION_ERROR,
            parsed.error.flatten().fieldErrors,
          );
        }

        const data = parsed.data;

        await prisma.unit.update({
          where: { id: unitId },
          data: { status: 'PENDING_MOVE_IN' },
        });

        await prisma.unitTenant.create({
          data: {
            unitId,
            tenantId: data.tenantId,
            leaseStart: new Date(data.leaseStart),
            leaseEnd: new Date(data.leaseEnd),
            rentAmount: data.rentAmount,
            depositAmount: data.depositAmount ?? null,
            isActive: false,
          },
        });

        return res.json({ message: 'Tenant invited and lease created' });
      }

      case 1: {
        const inspectionSchema = z.object({
          inspectionDate: z.string().min(1, 'Inspection date is required'),
        });
        const parsed = inspectionSchema.safeParse(payload);
        if (!parsed.success) {
          return sendError(
            res,
            400,
            'Validation error',
            ErrorCodes.VAL_VALIDATION_ERROR,
            parsed.error.flatten().fieldErrors,
          );
        }

        const inspectionDate = new Date(parsed.data.inspectionDate);

        await prisma.inspection.create({
          data: {
            title: `Move-in inspection for Unit ${access.unit.unitNumber}`,
            type: 'MOVE_IN',
            scheduledDate: inspectionDate,
            propertyId: access.unit.propertyId,
            unitId,
            status: 'SCHEDULED',
          },
        });

        return res.json({ message: 'Move-in inspection scheduled' });
      }

      case 4: {
        const pendingLease = await prisma.unitTenant.findFirst({
          where: { unitId, isActive: false },
          orderBy: { createdAt: 'desc' },
        });

        if (!pendingLease) {
          return sendError(res, 400, 'No pending lease found for unit', ErrorCodes.RES_NOT_FOUND);
        }

        await prisma.unitTenant.update({
          where: { id: pendingLease.id },
          data: { isActive: true },
        });

        await prisma.unit.update({
          where: { id: unitId },
          data: { status: 'OCCUPIED' },
        });

        return res.json({ message: 'Lease activated and move-in complete' });
      }

      default:
        return sendError(res, 400, 'Invalid move-in step', ErrorCodes.VAL_VALIDATION_ERROR);
    }
  })
);

router.post(
  '/:unitId/move-out',
  requireRole('PROPERTY_MANAGER'),
  asyncHandler(async (req, res) => {
    const { unitId } = req.params;
    const { step, ...payload } = req.body || {};

    const access = await ensureUnitAccess(unitId, req.user, { requireWrite: true });
    if (!access.allowed) {
      return sendError(
        res,
        access.status,
        access.reason,
        access.status === 404 ? ErrorCodes.RES_NOT_FOUND : ErrorCodes.ACC_PROPERTY_ACCESS_DENIED,
      );
    }

    switch (step) {
      case 0: {
        const parsed = moveOutSchema.safeParse(payload);
        if (!parsed.success) {
          return sendError(
            res,
            400,
            'Validation error',
            ErrorCodes.VAL_VALIDATION_ERROR,
            parsed.error.flatten().fieldErrors,
          );
        }

        await prisma.unit.update({
          where: { id: unitId },
          data: { status: 'PENDING_MOVE_OUT' },
        });

        return res.json({ message: 'Notice given' });
      }

      case 1: {
        const inspectionSchema = z.object({
          inspectionDate: z.string().min(1, 'Inspection date is required'),
        });
        const parsed = inspectionSchema.safeParse(payload);
        if (!parsed.success) {
          return sendError(
            res,
            400,
            'Validation error',
            ErrorCodes.VAL_VALIDATION_ERROR,
            parsed.error.flatten().fieldErrors,
          );
        }

        const inspectionDate = new Date(parsed.data.inspectionDate);

        await prisma.inspection.create({
          data: {
            title: `Move-out inspection for Unit ${access.unit.unitNumber}`,
            type: 'MOVE_OUT',
            scheduledDate: inspectionDate,
            propertyId: access.unit.propertyId,
            unitId,
            status: 'SCHEDULED',
          },
        });

        return res.json({ message: 'Move-out inspection scheduled' });
      }

      case 5: {
        const activeLease = await prisma.unitTenant.findFirst({
          where: { unitId, isActive: true },
          orderBy: { createdAt: 'desc' },
        });

        if (activeLease) {
          await prisma.unitTenant.update({
            where: { id: activeLease.id },
            data: { isActive: false },
          });
        }

        await prisma.unit.update({
          where: { id: unitId },
          data: { status: 'AVAILABLE' },
        });

        return res.json({ message: 'Unit marked as available and move-out complete' });
      }

      default:
        return sendError(res, 400, 'Invalid move-out step', ErrorCodes.VAL_VALIDATION_ERROR);
    }
  })
);

// Orchestrated move-in endpoint (single atomic operation)
router.post(
  '/:unitId/orchestrated-move-in',
  requireRole('PROPERTY_MANAGER'),
  asyncHandler(async (req, res) => {
    const { unitId } = req.params;
    const access = await ensureUnitAccess(unitId, req.user, { requireWrite: true });
    
    if (!access.allowed) {
      return sendError(
        res,
        access.status,
        access.reason,
        access.status === 404 ? ErrorCodes.RES_NOT_FOUND : ErrorCodes.ACC_PROPERTY_ACCESS_DENIED,
      );
    }

    const moveInSchema = z.object({
      tenantId: z.string().min(1).optional(),
      email: z.string().email().optional(),
      leaseStart: z.string().min(1, 'Lease start date is required'),
      leaseEnd: z.string().min(1, 'Lease end date is required'),
      rentAmount: z.number().positive('Rent amount must be greater than zero'),
      depositAmount: z.number().min(0).optional(),
      createInspection: z.boolean().optional(),
      inspectionDate: z.string().optional(),
    });

    const parsed = moveInSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(
        res,
        400,
        'Validation error',
        ErrorCodes.VAL_VALIDATION_ERROR,
        parsed.error.flatten().fieldErrors,
      );
    }

    const data = parsed.data;

    // Check if unit is available
    const activeTenants = await prisma.unitTenant.count({
      where: { unitId, isActive: true },
    });

    if (activeTenants > 0) {
      return sendError(res, 400, 'Unit already has active tenants', ErrorCodes.VAL_VALIDATION_ERROR);
    }

    let tenant;

    // Find or invite tenant
    if (data.tenantId) {
      tenant = await prisma.user.findUnique({
        where: { id: data.tenantId },
      });

      if (!tenant || tenant.role !== 'TENANT') {
        return sendError(res, 400, 'Invalid tenant', ErrorCodes.VAL_VALIDATION_ERROR);
      }
    } else if (data.email) {
      tenant = await prisma.user.findUnique({
        where: { email: data.email },
      });

      if (!tenant) {
        const invitation = await prisma.invitation.create({
          data: {
            email: data.email,
            role: 'TENANT',
            invitedBy: req.user.id,
            status: 'PENDING',
          },
        });

        return res.status(202).json({
          success: true,
          message: 'Tenant invitation created. Move-in will complete when tenant accepts.',
          invitation,
          pendingMoveIn: {
            unitId,
            leaseStart: data.leaseStart,
            leaseEnd: data.leaseEnd,
            rentAmount: data.rentAmount,
            depositAmount: data.depositAmount || null,
          },
        });
      }

      if (tenant.role !== 'TENANT') {
        return sendError(res, 400, 'User exists but is not a tenant', ErrorCodes.VAL_VALIDATION_ERROR);
      }
    } else {
      return sendError(res, 400, 'Either tenantId or email must be provided', ErrorCodes.VAL_VALIDATION_ERROR);
    }

    // Create tenant assignment and optionally inspection in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const unitTenant = await tx.unitTenant.create({
        data: {
          unitId,
          tenantId: tenant.id,
          leaseStart: new Date(data.leaseStart),
          leaseEnd: new Date(data.leaseEnd),
          rentAmount: data.rentAmount,
          depositAmount: data.depositAmount || null,
          isActive: true,
        },
        include: {
          tenant: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
            },
          },
        },
      });

      await tx.unit.update({
        where: { id: unitId },
        data: { status: data.createInspection ? 'PENDING_MOVE_IN' : 'OCCUPIED' },
      });

      let inspection = null;

      if (data.createInspection && data.inspectionDate) {
        inspection = await tx.inspection.create({
          data: {
            title: `Move-in Inspection - Unit ${access.unit.unitNumber}`,
            type: 'MOVE_IN',
            status: 'SCHEDULED',
            scheduledDate: new Date(data.inspectionDate),
            propertyId: access.unit.propertyId,
            unitId,
          },
        });

        await tx.notification.create({
          data: {
            userId: tenant.id,
            type: 'INSPECTION_SCHEDULED',
            title: 'Move-in Inspection Scheduled',
            message: `Your move-in inspection is scheduled for ${new Date(data.inspectionDate).toLocaleDateString()}`,
            entityType: 'inspection',
            entityId: inspection.id,
          },
        });
      }

      await tx.notification.create({
        data: {
          userId: tenant.id,
          type: 'SYSTEM',
          title: 'Welcome to Your New Home',
          message: `Your lease for Unit ${access.unit.unitNumber} begins on ${new Date(data.leaseStart).toLocaleDateString()}`,
          entityType: 'unit',
          entityId: unitId,
        },
      });

      return { unitTenant, inspection };
    });

    res.status(201).json({
      success: true,
      message: 'Move-in completed successfully',
      unitTenant: result.unitTenant,
      inspection: result.inspection,
      unit: {
        ...access.unit,
        status: data.createInspection ? 'PENDING_MOVE_IN' : 'OCCUPIED',
      },
    });
  })
);

// Orchestrated move-out endpoint (single atomic operation)
router.post(
  '/:unitId/orchestrated-move-out',
  requireRole('PROPERTY_MANAGER'),
  asyncHandler(async (req, res) => {
    const { unitId } = req.params;
    const access = await ensureUnitAccess(unitId, req.user, { requireWrite: true });

    if (!access.allowed) {
      return sendError(
        res,
        access.status,
        access.reason,
        access.status === 404 ? ErrorCodes.RES_NOT_FOUND : ErrorCodes.ACC_PROPERTY_ACCESS_DENIED,
      );
    }

    const moveOutSchema = z.object({
      tenantId: z.string().min(1, 'Tenant ID is required'),
      moveOutDate: z.string().min(1, 'Move-out date is required'),
      createInspection: z.boolean().optional(),
      inspectionDate: z.string().optional(),
      findings: z.string().optional(),
    });

    const parsed = moveOutSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(
        res,
        400,
        'Validation error',
        ErrorCodes.VAL_VALIDATION_ERROR,
        parsed.error.flatten().fieldErrors,
      );
    }

    const data = parsed.data;

    // Verify tenant is assigned to this unit
    const unitTenant = await prisma.unitTenant.findFirst({
      where: {
        unitId,
        tenantId: data.tenantId,
        isActive: true,
      },
      include: {
        tenant: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    if (!unitTenant) {
      return sendError(res, 404, 'Active tenant assignment not found', ErrorCodes.RES_NOT_FOUND);
    }

    const result = await prisma.$transaction(async (tx) => {
      let inspection = null;

      if (data.createInspection && data.inspectionDate) {
        inspection = await tx.inspection.create({
          data: {
            title: `Move-out Inspection - Unit ${access.unit.unitNumber}`,
            type: 'MOVE_OUT',
            status: 'SCHEDULED',
            scheduledDate: new Date(data.inspectionDate),
            propertyId: access.unit.propertyId,
            unitId,
            findings: data.findings || null,
          },
        });

        await tx.unit.update({
          where: { id: unitId },
          data: { status: 'PENDING_MOVE_OUT' },
        });

        await tx.notification.create({
          data: {
            userId: data.tenantId,
            type: 'INSPECTION_SCHEDULED',
            title: 'Move-out Inspection Scheduled',
            message: `Your move-out inspection is scheduled for ${new Date(data.inspectionDate).toLocaleDateString()}`,
            entityType: 'inspection',
            entityId: inspection.id,
          },
        });
      } else {
        // No inspection, deactivate immediately
        await tx.unitTenant.updateMany({
          where: {
            unitId,
            tenantId: data.tenantId,
            isActive: true,
          },
          data: {
            isActive: false,
            moveOutDate: new Date(data.moveOutDate),
          },
        });

        await tx.unit.update({
          where: { id: unitId },
          data: { status: 'AVAILABLE' },
        });
      }

      await tx.notification.create({
        data: {
          userId: data.tenantId,
          type: 'SYSTEM',
          title: 'Move-out Scheduled',
          message: `Your move-out from Unit ${access.unit.unitNumber} is scheduled for ${new Date(data.moveOutDate).toLocaleDateString()}`,
          entityType: 'unit',
          entityId: unitId,
        },
      });

      return { inspection };
    });

    res.json({
      success: true,
      message: data.createInspection
        ? 'Move-out inspection scheduled. Tenant will be deactivated after inspection.'
        : 'Tenant moved out successfully',
      inspection: result.inspection,
      unit: {
        ...access.unit,
        status: data.createInspection ? 'PENDING_MOVE_OUT' : 'AVAILABLE',
      },
    });
  })
);

// =============================================================================
// Unit Images Endpoints
// =============================================================================

// GET /units/:id/images - Get all images for a unit
unitImagesRouter.get('/', async (req, res) => {
  const unitId = req.params.id;

  try {
    const access = await ensureUnitAccess(unitId, req.user);

    if (!access.allowed) {
      return sendError(
        res,
        403,
        access.reason || 'Access denied to this unit',
        ErrorCodes.ACC_ACCESS_DENIED
      );
    }

    const unit = access.unit;

    if (!unit) {
      return sendError(res, 404, 'Unit not found', ErrorCodes.RES_UNIT_NOT_FOUND);
    }

    const images = await prisma.unitImage.findMany({
      where: { unitId },
      orderBy: [
        { displayOrder: 'asc' },
        { createdAt: 'asc' },
      ],
    });

    res.json({ success: true, images: normalizeUnitImages({ ...unit, unitImages: images }) });
  } catch (error) {
    console.error('Get unit images error:', error);
    return sendError(res, 500, 'Failed to fetch unit images', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

// POST /units/:id/images - Add a new image to a unit
unitImagesRouter.post('/', requireRole('PROPERTY_MANAGER'), maybeHandleImageUpload, async (req, res) => {
  const unitId = req.params.id;

  const cleanupUploadedFile = async () => {
    if (!req.file) return;

    try {
      const uploadedUrl = getUploadedFileUrl(req.file);
      if (uploadedUrl) {
        await deleteImage(uploadedUrl);
      }
    } catch (cleanupError) {
      console.error('Failed to remove uploaded file after error:', cleanupError);
    }
  };

  try {
    const unit = await prisma.unit.findUnique({
      where: { id: unitId },
      include: { property: { include: { owners: { select: { ownerId: true } } } } },
    });

    if (!unit) {
      await cleanupUploadedFile();
      return sendError(res, 404, 'Unit not found', ErrorCodes.RES_UNIT_NOT_FOUND);
    }

    const body = { ...(req.body ?? {}) };
    if (req.file) {
      const derivedUrl = getUploadedFileUrl(req.file);
      if (derivedUrl) {
        body.imageUrl = derivedUrl;
      }
    }

    const parsed = unitImageCreateSchema.parse(body);

    const [existingImages, existingPrimary] = await Promise.all([
      prisma.unitImage.findMany({
        where: { unitId },
        select: { id: true, displayOrder: true },
        orderBy: { displayOrder: 'desc' },
        take: 1,
      }),
      prisma.unitImage.findFirst({
        where: { unitId, isPrimary: true },
        select: { id: true },
      }),
    ]);

    const nextDisplayOrder = existingImages.length ? (existingImages[0].displayOrder ?? 0) + 1 : 0;
    const shouldBePrimary = determineNewImagePrimaryFlag(parsed.isPrimary, {
      hasExistingImages: existingImages.length > 0,
      hasExistingPrimary: Boolean(existingPrimary),
    });

    const createdImage = await prisma.$transaction(async (tx) => {
      const image = await tx.unitImage.create({
        data: {
          unitId,
          imageUrl: parsed.imageUrl,
          caption: parsed.caption ?? null,
          isPrimary: shouldBePrimary,
          displayOrder: nextDisplayOrder,
          uploadedById: req.user.id,
        },
      });

      if (shouldBePrimary) {
        await tx.unitImage.updateMany({
          where: {
            unitId,
            NOT: { id: image.id },
          },
          data: { isPrimary: false },
        });
      }

      await syncUnitCoverImage(tx, unitId);

      return image;
    });

    res.status(201).json({ success: true, image: normalizeUnitImages({ ...unit, unitImages: [createdImage] })[0] });
  } catch (error) {
    await cleanupUploadedFile();

    if (error instanceof z.ZodError) {
      return sendError(res, 400, 'Validation error', ErrorCodes.VAL_VALIDATION_ERROR, error.flatten());
    }

    console.error('Create unit image error:', error);
    return sendError(res, 500, 'Failed to add unit image', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

// PATCH /units/:id/images/:imageId - Update a unit image
unitImagesRouter.patch('/:imageId', requireRole('PROPERTY_MANAGER'), requireActiveSubscription, async (req, res) => {
  const unitId = req.params.id;
  const imageId = req.params.imageId;

  try {
    const unit = await prisma.unit.findUnique({
      where: { id: unitId },
      include: { property: { include: { owners: { select: { ownerId: true } } } } },
    });

    if (!unit) {
      return sendError(res, 404, 'Unit not found', ErrorCodes.RES_UNIT_NOT_FOUND);
    }

    const parsed = unitImageUpdateSchema.parse(req.body ?? {});

    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.unitImage.findUnique({ where: { id: imageId } });
      if (!existing || existing.unitId !== unitId) {
        return null;
      }

      const updateData = {};
      if (parsed.caption !== undefined) updateData.caption = parsed.caption ?? null;
      if (parsed.isPrimary !== undefined) updateData.isPrimary = parsed.isPrimary;

      const result = await tx.unitImage.update({
        where: { id: imageId },
        data: updateData,
      });

      if (parsed.isPrimary) {
        await tx.unitImage.updateMany({
          where: {
            unitId,
            NOT: { id: imageId },
          },
          data: { isPrimary: false },
        });
      }

      await syncUnitCoverImage(tx, unitId);

      return result;
    });

    if (!updated) {
      return sendError(res, 404, 'Unit image not found', ErrorCodes.RES_UNIT_NOT_FOUND);
    }

    res.json({ success: true, image: normalizeUnitImages({ ...unit, unitImages: [updated] })[0] });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendError(res, 400, 'Validation error', ErrorCodes.VAL_VALIDATION_ERROR, error.flatten());
    }

    console.error('Update unit image error:', error);
    return sendError(res, 500, 'Failed to update unit image', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

// DELETE /units/:id/images/:imageId - Delete a unit image
unitImagesRouter.delete('/:imageId', requireRole('PROPERTY_MANAGER'), requireActiveSubscription, async (req, res) => {
  const unitId = req.params.id;
  const imageId = req.params.imageId;

  try {
    const unit = await prisma.unit.findUnique({
      where: { id: unitId },
      include: { property: { include: { owners: { select: { ownerId: true } } } } },
    });

    if (!unit) {
      return sendError(res, 404, 'Unit not found', ErrorCodes.RES_UNIT_NOT_FOUND);
    }

    const deleted = await prisma.$transaction(async (tx) => {
      const existing = await tx.unitImage.findUnique({ where: { id: imageId } });
      if (!existing || existing.unitId !== unitId) {
        return null;
      }

      if (existing.imageUrl) {
        await deleteImage(existing.imageUrl);
      }

      await tx.unitImage.delete({ where: { id: imageId } });

      if (existing.isPrimary) {
        const nextPrimary = await tx.unitImage.findFirst({
          where: { unitId },
          orderBy: [
            { displayOrder: 'asc' },
            { createdAt: 'asc' },
          ],
        });

        if (nextPrimary) {
          await tx.unitImage.update({
            where: { id: nextPrimary.id },
            data: { isPrimary: true },
          });
        }
      }

      await syncUnitCoverImage(tx, unitId);

      return existing;
    });

    if (!deleted) {
      return sendError(res, 404, 'Unit image not found', ErrorCodes.RES_UNIT_NOT_FOUND);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete unit image error:', error);
    return sendError(res, 500, 'Failed to delete unit image', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

// POST /units/:id/images/reorder - Reorder unit images
unitImagesRouter.post('/reorder', requireRole('PROPERTY_MANAGER'), async (req, res) => {
  const unitId = req.params.id;

  try {
    const unit = await prisma.unit.findUnique({
      where: { id: unitId },
      include: { property: { include: { owners: { select: { ownerId: true } } } } },
    });

    if (!unit) {
      return sendError(res, 404, 'Unit not found', ErrorCodes.RES_UNIT_NOT_FOUND);
    }

    const parsed = unitImageReorderSchema.parse(req.body ?? {});

    const existingImages = await prisma.unitImage.findMany({
      where: { unitId },
      orderBy: [
        { displayOrder: 'asc' },
        { createdAt: 'asc' },
      ],
    });

    const existingIds = existingImages.map((img) => img.id);
    const providedIds = parsed.orderedImageIds;

    if (existingIds.length !== providedIds.length || !providedIds.every((id) => existingIds.includes(id))) {
      return sendError(res, 400, 'Ordered image ids do not match existing images', ErrorCodes.VAL_VALIDATION_ERROR);
    }

    await prisma.$transaction(
      providedIds.map((id, index) =>
        prisma.unitImage.update({
          where: { id },
          data: { displayOrder: index },
        })
      )
    );

    await syncUnitCoverImage(prisma, unitId);

    res.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendError(res, 400, 'Validation error', ErrorCodes.VAL_VALIDATION_ERROR, error.flatten());
    }

    console.error('Reorder unit images error:', error);
    return sendError(res, 500, 'Failed to reorder unit images', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

// GET /:id/activity - Get recent activity for a unit
router.get('/:id/activity', async (req, res) => {
  try {
    const unitId = req.params.id;

    const access = await ensureUnitAccess(unitId, req.user);
    if (!access.allowed) {
      return sendError(
        res,
        access.status || 403,
        access.reason || 'Access denied',
        ErrorCodes.ACC_PROPERTY_ACCESS_DENIED
      );
    }

    // Keep behavior: only property managers/owners/admin can access unit activity.
    if (!['PROPERTY_MANAGER', 'OWNER', 'ADMIN'].includes(req.user.role)) {
      return sendError(res, 403, 'Access denied', ErrorCodes.ACC_PROPERTY_ACCESS_DENIED);
    }

    // Parse and validate limit
    const parsedLimit = parseInt(req.query.limit);
    const limit = Math.min(Number.isNaN(parsedLimit) ? 20 : parsedLimit, 50);

    // Fetch jobs for this unit
    const jobs = await prisma.job.findMany({
      where: { unitId },
      include: {
        assignedTo: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    });

    // Fetch inspections for this unit
    const inspections = await prisma.inspection.findMany({
      where: { unitId },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    });

    // Fetch service requests for this unit
    const serviceRequests = await prisma.serviceRequest.findMany({
      where: { unitId },
      include: {
        requestedBy: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    });

    // Fetch tenant assignments for this unit
    const tenantAssignments = await prisma.unitTenant.findMany({
      where: { unitId },
      include: {
        tenant: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    });

    // Transform and combine all activities
    const activities = [];

    jobs.forEach((job) => {
      activities.push({
        type: 'job',
        id: job.id,
        title: job.title,
        description: job.assignedTo
          ? `Assigned to ${job.assignedTo.firstName} ${job.assignedTo.lastName}`
          : 'Job update',
        status: job.status,
        priority: job.priority,
        date: job.updatedAt,
      });
    });

    inspections.forEach((inspection) => {
      activities.push({
        type: 'inspection',
        id: inspection.id,
        title: inspection.title,
        description: inspection.status ? `Inspection ${inspection.status.toLowerCase()}` : 'Inspection update',
        status: inspection.status,
        date: inspection.updatedAt,
      });
    });

    serviceRequests.forEach((sr) => {
      activities.push({
        type: 'service_request',
        id: sr.id,
        title: sr.title,
        description: sr.requestedBy
          ? `Requested by ${sr.requestedBy.firstName} ${sr.requestedBy.lastName}`
          : 'Service request update',
        status: sr.status,
        priority: sr.priority,
        date: sr.updatedAt,
      });
    });

    tenantAssignments.forEach((assignment) => {
      activities.push({
        type: 'tenant_assignment',
        id: assignment.id,
        title: assignment.tenant
          ? `${assignment.tenant.firstName} ${assignment.tenant.lastName}`
          : 'Tenant',
        description: assignment.isActive
          ? `Lease: ${assignment.leaseStart?.toLocaleDateString()} - ${assignment.leaseEnd?.toLocaleDateString()}`
          : 'Past tenant',
        status: assignment.isActive ? 'ACTIVE' : 'INACTIVE',
        date: assignment.updatedAt,
      });
    });

    // Sort all activities by date (most recent first) and limit
    activities.sort((a, b) => new Date(b.date) - new Date(a.date));
    const limitedActivities = activities.slice(0, limit);

    res.json({
      success: true,
      activities: limitedActivities,
    });
  } catch (error) {
    console.error('Get unit activity error:', error);
    return sendError(res, 500, 'Failed to fetch unit activity', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

// POST /units/:id/owners - Assign owner to unit
router.post('/:id/owners', requireAuth, requireRole('PROPERTY_MANAGER'), async (req, res) => {
  const unitId = req.params.id;
  const assignOwnerSchema = z.object({
    ownerId: z.string(),
    ownershipPercentage: z.number().min(0).max(100).optional(),
  });

  try {
    const { ownerId, ownershipPercentage } = assignOwnerSchema.parse(req.body);

    // Get unit with property to verify access
    const unit = await prisma.unit.findUnique({
      where: { id: unitId },
      include: {
        property: {
          include: {
            owners: { select: { ownerId: true } },
          },
        },
      },
    });

    if (!unit) {
      return sendError(res, 404, 'Unit not found', ErrorCodes.RES_UNIT_NOT_FOUND);
    }

    // Verify user has access to the property
    const access = ensurePropertyAccess(unit.property, req.user, { requireWrite: true });
    if (!access.allowed) {
      return sendError(res, access.status, access.reason, ErrorCodes.ACC_PROPERTY_ACCESS_DENIED);
    }

    // Verify the owner exists and has OWNER role
    const owner = await prisma.user.findUnique({
      where: { id: ownerId },
    });

    if (!owner) {
      return sendError(res, 404, 'Owner not found', ErrorCodes.RES_USER_NOT_FOUND);
    }

    if (owner.role !== 'OWNER') {
      return sendError(res, 400, 'User must have OWNER role', ErrorCodes.VAL_VALIDATION_ERROR);
    }

    // Check if owner is already assigned to this unit
    const existingOwner = await prisma.unitOwner.findUnique({
      where: {
        unitId_ownerId: {
          unitId,
          ownerId,
        },
      },
    });

    if (existingOwner) {
      return sendError(res, 400, 'Owner is already assigned to this unit', ErrorCodes.RES_ALREADY_EXISTS);
    }

    // Create unit owner relationship
    const unitOwner = await prisma.unitOwner.create({
      data: {
        unitId,
        ownerId,
        ownershipPercentage: ownershipPercentage || 100.0,
      },
      include: {
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    res.status(201).json({
      success: true,
      unitOwner,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendError(res, 400, 'Validation error', ErrorCodes.VAL_VALIDATION_ERROR, error.flatten());
    }

    console.error('Assign unit owner error:', error);
    return sendError(res, 500, 'Failed to assign owner to unit', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

// DELETE /units/:id/owners/:ownerId - Remove owner from unit
router.delete('/:id/owners/:ownerId', requireAuth, requireRole('PROPERTY_MANAGER'), async (req, res) => {
  const { id: unitId, ownerId } = req.params;

  try {
    // Get unit with property to verify access
    const unit = await prisma.unit.findUnique({
      where: { id: unitId },
      include: {
        property: {
          include: {
            owners: { select: { ownerId: true } },
          },
        },
      },
    });

    if (!unit) {
      return sendError(res, 404, 'Unit not found', ErrorCodes.RES_UNIT_NOT_FOUND);
    }

    // Verify user has access to the property
    const access = ensurePropertyAccess(unit.property, req.user, { requireWrite: true });
    if (!access.allowed) {
      return sendError(res, access.status, access.reason, ErrorCodes.ACC_PROPERTY_ACCESS_DENIED);
    }

    // Check if owner is assigned to this unit
    const unitOwner = await prisma.unitOwner.findUnique({
      where: {
        unitId_ownerId: {
          unitId,
          ownerId,
        },
      },
    });

    if (!unitOwner) {
      return sendError(res, 404, 'Owner is not assigned to this unit', ErrorCodes.RES_NOT_FOUND);
    }

    // Delete unit owner relationship
    await prisma.unitOwner.delete({
      where: {
        unitId_ownerId: {
          unitId,
          ownerId,
        },
      },
    });

    res.json({
      success: true,
    });
  } catch (error) {
    console.error('Remove unit owner error:', error);
    return sendError(res, 500, 'Failed to remove owner from unit', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

export default router;
