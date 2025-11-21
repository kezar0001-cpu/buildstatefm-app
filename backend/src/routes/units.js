import { Router } from 'express';
import { z } from 'zod';
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import prisma from '../config/prismaClient.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { asyncHandler, sendError, ErrorCodes } from '../utils/errorHandler.js';

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

// Multer configuration for image uploads
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.]/g, '-');
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniqueSuffix}-${sanitizedName}`);
  },
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

const maybeHandleImageUpload = (req, res, next) => {
  const contentType = req.headers['content-type'] || '';
  if (contentType.includes('multipart/form-data')) {
    return upload.single('image')(req, res, next);
  }
  next();
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
  unitImages: {
    orderBy: { displayOrder: 'asc' },
  },
  tenants: tenantListArgs,
  owners: ownerListArgs,
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
    .preprocess((value) => (value === '' || value == null ? null : Number(value)), z.number().nullable())
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
    owner: owner.owner
      ? {
          id: owner.owner.id,
          firstName: owner.owner.firstName,
          lastName: owner.owner.lastName,
          email: owner.owner.email,
          phone: owner.owner.phone,
        }
      : null,
  };
};

const toPublicUnit = (unit) => {
  if (!unit) return unit;

  const { property, tenants, owners, unitImages, ...rest } = unit;

  return {
    ...rest,
    floor: unit.floor ?? null,
    bedrooms: unit.bedrooms ?? null,
    bathrooms: unit.bathrooms ?? null,
    area: unit.area ?? null,
    rentAmount: unit.rentAmount ?? null,
    description: unit.description ?? null,
    imageUrl: unit.imageUrl ?? null,
    images: normalizeUnitImages({ ...unit, unitImages }),
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
    owners: Array.isArray(owners) ? owners.map(toPublicOwner) : [],
  };
};

const ensurePropertyAccess = async (propertyId, user, { requireWrite = false } = {}) => {
  if (!propertyId) {
    return { allowed: false, status: 400, reason: 'Property ID is required' };
  }

  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    include: { owners: { select: { ownerId: true } } },
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
        default:
          return sendError(res, 403, 'Access denied to units', ErrorCodes.ACC_ACCESS_DENIED);
      }
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
      // Always include unitImages so Edit Unit form can display existing images
      unitImages: {
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

    res.json({ unit: toPublicUnit(access.unit) });
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
          area: data.area ?? null,
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

    res.status(201).json({ unit: toPublicUnit(unit) });
  })
);

router.patch(
  '/:unitId',
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
          ...(data.area !== undefined && { area: data.area ?? null }),
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

    res.json({ unit: toPublicUnit(unit) });
  })
);

router.delete(
  '/:unitId',
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

// =============================================================================
// Unit Images Endpoints
// =============================================================================

// GET /units/:id/images - Get all images for a unit
unitImagesRouter.get('/', async (req, res) => {
  const unitId = req.params.id;

  try {
    const unit = await prisma.unit.findUnique({
      where: { id: unitId },
      include: { property: { include: { owners: { select: { ownerId: true } } } } },
    });

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
    if (req.file?.path) {
      try {
        await fs.promises.unlink(req.file.path);
      } catch (cleanupError) {
        console.error('Failed to remove uploaded file after error:', cleanupError);
      }
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
    if (req.file?.filename) {
      body.imageUrl = `/uploads/${req.file.filename}`;
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
unitImagesRouter.patch('/:imageId', requireRole('PROPERTY_MANAGER'), async (req, res) => {
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
unitImagesRouter.delete('/:imageId', requireRole('PROPERTY_MANAGER'), async (req, res) => {
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

    // Fetch the unit with property ownership info for access control
    const unit = await prisma.unit.findUnique({
      where: { id: unitId },
      include: {
        property: {
          include: {
            owners: {
              select: { ownerId: true },
            },
          },
        },
      },
    });

    if (!unit) {
      return sendError(res, 404, 'Unit not found', ErrorCodes.RES_UNIT_NOT_FOUND);
    }

    // Check access (managers and property owners can access)
    const isManager = req.user.role === 'PROPERTY_MANAGER';
    const isOwner = unit.property?.owners?.some(o => o.ownerId === req.user.id);
    const hasAccess = isManager || isOwner;

    if (!hasAccess) {
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
