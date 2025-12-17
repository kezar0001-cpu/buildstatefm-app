// backend/src/routes/properties.js
import { Router } from 'express';
import { z } from 'zod';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { randomUUID } from 'crypto';
import axios from 'axios';
import prisma from '../config/prismaClient.js';
import { redisGet, redisSet } from '../config/redisClient.js';
import { requireAuth, requireRole, requireActiveSubscription, requireUsage, isSubscriptionActive } from '../middleware/auth.js';
import { canCreateProperty, getPropertyLimit, getLimitReachedMessage } from '../utils/subscriptionLimits.js';
import { getPropertyCount } from '../utils/usageTracking.js';
import unitsRouter from './units.js';
import { cacheMiddleware, invalidate, invalidatePattern } from '../utils/cache.js';
import { sendError, ErrorCodes } from '../utils/errorHandler.js';
import {
  createUploadMiddleware,
  createDocumentUploadMiddleware,
  getUploadedFileUrl,
  isLocalUploadUrl,
  extractLocalUploadFilename,
  LOCAL_UPLOADS_PUBLIC_PATH,
  isUsingCloudStorage,
  deleteImage,
} from '../services/uploadService.js';
import { exportPropertiesToCSV, setCSVHeaders } from '../utils/exportUtils.js';

const router = Router();

const UPLOAD_DIR = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Use Redis-backed rate limiting for property uploads (replaces in-memory Map-based rate limiting)
import { propertyUploadRateLimiter } from '../middleware/redisRateLimiter.js';
const rateLimitUpload = propertyUploadRateLimiter;

const propertyImageUpload = createUploadMiddleware({
  maxFileSize: 10 * 1024 * 1024,
  maxFiles: 1,
  allowedExtensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
});

const imageUploadMiddleware = propertyImageUpload.single('image');

const isMultipartRequest = (req) => {
  const header = req?.headers?.['content-type'];
  if (!header) return false;
  const [type] = header.split(';', 1);
  return type?.trim().toLowerCase() === 'multipart/form-data';
};

const maybeHandleImageUpload = (req, res, next) => {
  if (isMultipartRequest(req)) {
    return imageUploadMiddleware(req, res, next);
  }
  return next();
};

const propertyImagesListSelection = {
  select: {
    id: true,
    propertyId: true,
    imageUrl: true,
    caption: true,
    isPrimary: true,
    displayOrder: true,
    uploadedById: true,
    createdAt: true,
    updatedAt: true,
  },
  orderBy: [
    { displayOrder: 'asc' },
    { createdAt: 'asc' },
  ],
  take: 10,
};

const propertyListSelect = {
  id: true,
  name: true,
  address: true,
  city: true,
  state: true,
  zipCode: true,
  country: true,
  propertyType: true,
  status: true,
  description: true,
  imageUrl: true,
  totalUnits: true,
  totalArea: true,
  yearBuilt: true,
  managerId: true,
  archivedAt: true,
  createdAt: true,
  updatedAt: true,
  propertyImages: propertyImagesListSelection,
  // Note: units are NOT loaded here for performance reasons
  // Loading all units just to calculate occupancy stats is inefficient
  // Occupancy stats require full unit data, so they're only calculated
  // in detail views where we load the full property with units
  _count: {
    select: {
      units: true,
      jobs: true,
      inspections: true,
    },
  },
};

// All property routes require authentication
router.use(requireAuth);

// DIAGNOSTIC ENDPOINT - Must come BEFORE any /:id routes to avoid conflicts
// GET /image-diagnostic/:id - Debug endpoint to see raw image data
router.get('/image-diagnostic/:id', async (req, res) => {
  try {
    const property = await prisma.property.findUnique({
      where: { id: req.params.id },
      include: {
        propertyImages: {
          orderBy: [
            { displayOrder: 'asc' },
            { createdAt: 'asc' },
          ]
        }
      }
    });

    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }

    const publicProp = toPublicProperty(property);

    const diagnosticInfo = {
      propertyId: property.id,
      propertyName: property.name,
      database: {
        imageUrl: property.imageUrl,
        propertyImagesCount: property.propertyImages?.length || 0,
        propertyImages: property.propertyImages || [],
      },
      normalized: {
        imagesCount: normalizePropertyImages(property).length,
        images: normalizePropertyImages(property),
      },
      publicResponse: {
        imageUrl: publicProp.imageUrl,
        imagesCount: publicProp.images?.length || 0,
        images: publicProp.images || [],
      },
    };

    res.json(diagnosticInfo);
  } catch (error) {
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});

// PATCH /:id/archive - Archive a property (Property Manager only, requires active subscription)
router.patch('/:id/archive', requireRole('PROPERTY_MANAGER'), requireActiveSubscription, async (req, res) => {
  try {
    const property = await prisma.property.findUnique({
      where: { id: req.params.id },
      include: {
        owners: { select: { ownerId: true } },
      },
    });

    const access = ensurePropertyAccess(property, req.user, { requireWrite: true });
    if (!access.allowed) {
      const errorCode = access.status === 404 ? ErrorCodes.RES_PROPERTY_NOT_FOUND : ErrorCodes.ACC_PROPERTY_ACCESS_DENIED;
      return sendError(res, access.status, access.reason, errorCode);
    }

    const updated = await prisma.property.update({
      where: { id: property.id },
      data: { archivedAt: new Date() },
    });

    const cacheUserIds = collectPropertyCacheUserIds(property, req.user.id);
    await invalidatePropertyCaches(cacheUserIds);

    res.json({ success: true, property: toPublicProperty({ ...property, ...updated }) });
  } catch (error) {
    console.error('Archive property error:', error);
    return sendError(res, 500, 'Failed to archive property', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

// PATCH /:id/unarchive - Unarchive a property (Property Manager only, requires active subscription)
router.patch('/:id/unarchive', requireRole('PROPERTY_MANAGER'), requireActiveSubscription, async (req, res) => {
  try {
    const property = await prisma.property.findUnique({
      where: { id: req.params.id },
      include: {
        owners: { select: { ownerId: true } },
      },
    });

    const access = ensurePropertyAccess(property, req.user, { requireWrite: true });
    if (!access.allowed) {
      const errorCode = access.status === 404 ? ErrorCodes.RES_PROPERTY_NOT_FOUND : ErrorCodes.ACC_PROPERTY_ACCESS_DENIED;
      return sendError(res, access.status, access.reason, errorCode);
    }

    const updated = await prisma.property.update({
      where: { id: property.id },
      data: { archivedAt: null },
    });

    const cacheUserIds = collectPropertyCacheUserIds(property, req.user.id);
    await invalidatePropertyCaches(cacheUserIds);

    res.json({ success: true, property: toPublicProperty({ ...property, ...updated }) });
  } catch (error) {
    console.error('Unarchive property error:', error);
    return sendError(res, 500, 'Failed to unarchive property', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

// Nested units routes
router.use('/:propertyId/units', unitsRouter);

// Nested property image routes (defined later)
const propertyImagesRouter = Router({ mergeParams: true });
router.use('/:id/images', propertyImagesRouter);

// Nested property document routes (defined later)
const propertyDocumentsRouter = Router({ mergeParams: true });
router.use('/:id/documents', propertyDocumentsRouter);

// Nested property note routes (defined later)
const propertyNotesRouter = Router({ mergeParams: true });
router.use('/:id/notes', propertyNotesRouter);

// ---------------------------------------------------------------------------
// Zod helpers
// ---------------------------------------------------------------------------
const trimToNull = (value) => {
  if (value === undefined || value === null) return value;
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
};

const requiredString = (message) =>
  z.preprocess((value) => (typeof value === 'string' ? value.trim() : value), z.string().min(1, message));

const optionalString = () =>
  z.preprocess((value) => trimToNull(value), z.string().min(1).nullable().optional());

const preprocessImageValue = (value) => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }
  if (value === undefined || value === null) {
    return null;
  }
  return value;
};

// Bug Fix: Add maximum URL length to prevent database bloat and performance issues
const MAX_IMAGE_URL_LENGTH = 2048; // Standard max URL length

const isValidImageLocation = (value) => {
  if (typeof value !== 'string') return false;
  if (!value.trim()) return false;
  // Bug Fix: Validate URL length to prevent malicious extremely long URLs
  if (value.length > MAX_IMAGE_URL_LENGTH) return false;

  // Bug Fix #8: Prevent XSS via javascript:, data:text/html, and other malicious URL schemes
  // Only allow safe protocols: http(s) for external URLs, /uploads/ for local files
  const lowerValue = value.toLowerCase().trim();

  // Block javascript:, vbscript:, file:, and other dangerous protocols
  const dangerousProtocols = ['javascript:', 'vbscript:', 'file:', 'about:', 'blob:'];
  if (dangerousProtocols.some(protocol => lowerValue.startsWith(protocol))) {
    return false;
  }

  // Only allow data: URLs for images (not HTML/scripts)
  if (lowerValue.startsWith('data:')) {
    // Must be an image MIME type
    if (!lowerValue.startsWith('data:image/')) {
      return false;
    }
    return true;
  }

  // Allow HTTPS/HTTP URLs
  if (/^https?:\/\//i.test(value)) return true;

  // Allow relative uploads served by the backend
  if (isLocalUploadUrl(value)) return true;

  return false;
};

const requiredImageLocation = () =>
  z
    .preprocess(preprocessImageValue, z.union([z.string(), z.null()]))
    .refine((value) => typeof value === 'string' && isValidImageLocation(value), {
      message: 'Image URL is required',
    })
    .transform((value) => value);

const optionalImageLocation = () =>
  z
    .preprocess(preprocessImageValue, z.union([z.string(), z.null()]))
    .refine((value) => value === null || isValidImageLocation(value), {
      message: 'Must be a valid URL or upload path',
    })
    .transform((value) => (value === null ? null : value))
    .optional();

const booleanLike = () =>
  z.preprocess((value) => {
    if (typeof value === 'string') {
      const normalised = value.trim().toLowerCase();
      if (['true', '1', 'yes', 'on'].includes(normalised)) return true;
      if (['false', '0', 'no', 'off'].includes(normalised)) return false;
    }
    return value;
  }, z.boolean({ invalid_type_error: 'Must be true or false' }));

const requiredUrl = (message) =>
  z.preprocess(
    (value) => (typeof value === 'string' ? value.trim() : value),
    z.string().url({ message: message || 'Must be a valid URL' })
  );

const optionalInt = (opts = {}) =>
  z
    .preprocess((value) => {
      if (value === undefined || value === null || value === '') return null;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? Math.trunc(parsed) : value;
    }, z.number({ invalid_type_error: 'Must be a number' }).int())
    .nullable()
    .optional()
    .refine((value) => (value == null ? true : value >= (opts.min ?? Number.MIN_SAFE_INTEGER)), {
      message: opts.minMessage || 'Value is too small',
    })
    .refine((value) => (value == null ? true : value <= (opts.max ?? Number.MAX_SAFE_INTEGER)), {
      message: opts.maxMessage || 'Value is too large',
    });

const optionalFloat = () =>
  z
    .preprocess((value) => {
      if (value === undefined || value === null || value === '') return null;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : value;
    }, z.number({ invalid_type_error: 'Must be a number' }))
    .nullable()
    .optional();

const extractImageUrlFromInput = (input) => {
  if (typeof input === 'string') {
    const trimmed = input.trim();
    return trimmed.length ? trimmed : null;
  }

  if (input && typeof input === 'object') {
    const candidates = [input.imageUrl, input.url];
    for (const candidate of candidates) {
      if (typeof candidate === 'string') {
        const trimmed = candidate.trim();
        if (trimmed.length) {
          return trimmed;
        }
      }
    }
  }

  return null;
};

const normaliseSubmittedPropertyImages = (input) => {
  if (!Array.isArray(input) || !input.length) {
    return [];
  }

  const rejectedImages = [];
  const collected = input
    .map((item, index) => {
      if (typeof item === 'string') {
        const trimmed = item.trim();
        if (!trimmed) {
          rejectedImages.push({ index, reason: 'empty string', item: '(empty)' });
          return null;
        }
        if (!isValidImageLocation(trimmed)) {
          rejectedImages.push({
            index,
            reason: 'invalid URL format',
            url: trimmed.substring(0, 100),
            urlLength: trimmed.length,
          });
          return null;
        }
        return {
          imageUrl: trimmed,
          caption: null,
          captionProvided: false,
          isPrimary: undefined,
        };
      }

      if (!item || typeof item !== 'object') {
        rejectedImages.push({ index, reason: 'not an object', type: typeof item });
        return null;
      }

      const imageUrl = extractImageUrlFromInput(item);
      if (!imageUrl) {
        rejectedImages.push({
          index,
          reason: 'no imageUrl found',
          hasImageUrl: !!item.imageUrl,
          hasUrl: !!item.url,
        });
        return null;
      }

      if (!isValidImageLocation(imageUrl)) {
        rejectedImages.push({
          index,
          reason: 'failed isValidImageLocation check',
          url: imageUrl.substring(0, 100),
          urlLength: imageUrl.length,
          startsWithHttp: imageUrl.toLowerCase().startsWith('http'),
          localUploadDetected: isLocalUploadUrl(imageUrl),
          localUploadBasePath: LOCAL_UPLOADS_PUBLIC_PATH,
        });
        return null;
      }

      const altTextRaw = typeof item.altText === 'string' ? item.altText : undefined;
      const captionRaw = typeof item.caption === 'string' ? item.caption : undefined;
      const providedCaption = altTextRaw !== undefined ? altTextRaw : captionRaw;
      const trimmedCaption = typeof providedCaption === 'string' ? providedCaption.trim() : '';

      return {
        imageUrl,
        caption: trimmedCaption ? trimmedCaption : null,
        captionProvided: providedCaption !== undefined,
        isPrimary: item.isPrimary === true ? true : item.isPrimary === false ? false : undefined,
      };
    })
    .filter(Boolean);

  // Log rejected images if any
  if (rejectedImages.length > 0 && process.env.NODE_ENV !== 'test') {
    console.warn('\n⚠️  [Normalization] Some images were rejected during validation:');
    rejectedImages.forEach((rejected) => {
      console.warn(`  - Image ${rejected.index}: ${rejected.reason}`, rejected);
    });
  }

  if (!collected.length) {
    return [];
  }

  const explicitPrimaryIndex = collected.findIndex((image) => image.isPrimary === true);
  const primaryIndex = explicitPrimaryIndex >= 0 ? explicitPrimaryIndex : 0;

  return collected.map((image, index) => ({
    imageUrl: image.imageUrl,
    caption: image.caption,
    captionProvided: image.captionProvided,
    isPrimary: index === primaryIndex,
  }));
};

const STATUS_VALUES = ['ACTIVE', 'INACTIVE', 'UNDER_MAINTENANCE'];

// Bug Fix: Only order by displayOrder to avoid schema compatibility issues
// Some databases may not have createdAt column if migrations weren't fully applied
const propertyImagesIncludeConfig = {
  orderBy: { displayOrder: 'asc' },
};

const PROPERTY_IMAGES_CHECK_TTL_MS = 30 * 1000;

let propertyImagesFeatureCache = null;
let propertyImagesFeatureLastCheck = 0;
let propertyImagesFeatureLogged = false;

const logPropertyImagesUnavailable = () => {
  if (!propertyImagesFeatureLogged && process.env.NODE_ENV !== 'test') {
    console.warn(
      'Property images table not found. Falling back to legacy property.imageUrl field.'
    );
    propertyImagesFeatureLogged = true;
  }
};

const isPropertyImagesMissingError = (error) => {
  if (!error) return false;
  if (error.code === 'P2021') return true;
  if (error.code === 'P2010' && error.meta?.modelName === 'PropertyImage') return true;
  const message = typeof error.message === 'string' ? error.message.toLowerCase() : '';
  return message.includes('propertyimage');
};

const shouldRecheckPropertyImagesSupport = () => {
  if (propertyImagesFeatureCache === null) {
    return true;
  }

  if (propertyImagesFeatureCache === true) {
    return false;
  }

  const age = Date.now() - propertyImagesFeatureLastCheck;
  return age >= PROPERTY_IMAGES_CHECK_TTL_MS;
};

const markPropertyImagesSupported = () => {
  propertyImagesFeatureCache = true;
  propertyImagesFeatureLastCheck = Date.now();
};

const markPropertyImagesUnsupported = () => {
  if (propertyImagesFeatureCache !== false) {
    logPropertyImagesUnavailable();
  }
  propertyImagesFeatureCache = false;
  propertyImagesFeatureLastCheck = Date.now();
};

const propertyImagesFeatureAvailable = async () => {
  if (!shouldRecheckPropertyImagesSupport()) {
    return propertyImagesFeatureCache === true;
  }

  try {
    await prisma.propertyImage.findFirst({ select: { id: true } });
    markPropertyImagesSupported();
    return true;
  } catch (error) {
    if (isPropertyImagesMissingError(error)) {
      markPropertyImagesUnsupported();
      return false;
    }

    console.warn('Failed to verify property images support:', error.message);
    propertyImagesFeatureLastCheck = Date.now();
    throw error;
  }
};

const withPropertyImagesSupport = async (operation) => {
  const includeImages = await propertyImagesFeatureAvailable();

  try {
    return await operation(includeImages);
  } catch (error) {
    if (includeImages && isPropertyImagesMissingError(error)) {
      markPropertyImagesUnsupported();
      return operation(false);
    }
    throw error;
  }
};

const buildPropertyListSelect = (includeImages) => {
  if (includeImages) return propertyListSelect;
  const { propertyImages: _omit, ...rest } = propertyListSelect;
  return rest;
};

const buildPropertyImagesInclude = (includeImages) =>
  includeImages ? { propertyImages: propertyImagesIncludeConfig } : {};

const buildPropertyDetailInclude = (includeImages) => ({
  // Bug Fix: Add pagination to units to prevent loading thousands of units at once
  units: {
    orderBy: { unitNumber: 'asc' },
    take: 100, // Limit to first 100 units for performance
  },
  manager: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      subscriptionStatus: true,
      trialEndDate: true,
    },
  },
  owners: {
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
  },
  _count: {
    select: {
      units: true, // Include total count for pagination UI
    },
  },
  ...buildPropertyImagesInclude(includeImages),
});

const propertyImageInputObjectSchema = z.object({
  url: optionalImageLocation(),
  imageUrl: optionalImageLocation(),
  caption: optionalString(),
  altText: optionalString(),
  isPrimary: booleanLike().optional(),
});

const propertyImageInputSchema = z.union([z.string(), propertyImageInputObjectSchema]);

// Bug Fix: Add proper validation for amenities structure to prevent data corruption
const amenitiesSchema = z
  .object({
    utilities: z
      .object({
        water: z.boolean().optional(),
        gas: z.boolean().optional(),
        electricity: z.boolean().optional(),
        internet: z.boolean().optional(),
        trash: z.boolean().optional(),
        sewer: z.boolean().optional(),
        cable: z.boolean().optional(),
      })
      .optional()
      .nullable(),
    features: z
      .object({
        pool: z.boolean().optional(),
        gym: z.boolean().optional(),
        laundry: z.boolean().optional(),
        elevator: z.boolean().optional(),
        doorman: z.boolean().optional(),
        storage: z.boolean().optional(),
        balcony: z.boolean().optional(),
        patio: z.boolean().optional(),
        yard: z.boolean().optional(),
        fireplace: z.boolean().optional(),
        airConditioning: z.boolean().optional(),
        heating: z.boolean().optional(),
        dishwasher: z.boolean().optional(),
        microwave: z.boolean().optional(),
        refrigerator: z.boolean().optional(),
        washerDryer: z.boolean().optional(),
      })
      .optional()
      .nullable(),
    security: z
      .object({
        gated: z.boolean().optional(),
        cameras: z.boolean().optional(),
        alarm: z.boolean().optional(),
        accessControl: z.boolean().optional(),
        securityGuard: z.boolean().optional(),
        intercom: z.boolean().optional(),
      })
      .optional()
      .nullable(),
    accessibility: z
      .object({
        wheelchairAccessible: z.boolean().optional(),
        accessibleElevator: z.boolean().optional(),
        ramps: z.boolean().optional(),
        wideHallways: z.boolean().optional(),
        accessibleBathroom: z.boolean().optional(),
        accessibleParking: z.boolean().optional(),
      })
      .optional()
      .nullable(),
    parking: z
      .object({
        available: z.boolean().optional(),
        type: z.enum(['NONE', 'STREET', 'DRIVEWAY', 'GARAGE', 'COVERED', 'UNCOVERED']).optional().nullable(),
        spaces: z.number().int().min(0).optional().nullable(),
        covered: z.boolean().optional(),
      })
      .optional()
      .nullable(),
    pets: z
      .object({
        allowed: z.boolean().optional(),
        catsAllowed: z.boolean().optional(),
        dogsAllowed: z.boolean().optional(),
        deposit: z.number().min(0).optional().nullable(),
        weightLimit: z.number().int().min(0).optional().nullable(),
        restrictions: z.string().optional().nullable(),
      })
      .optional()
      .nullable(),
  })
  .optional()
  .nullable();

const basePropertySchema = z.object({
  name: requiredString('Property name is required'),
  address: requiredString('Address is required'),
  city: requiredString('City is required'),
  state: optionalString(),
  zipCode: optionalString(),
  postcode: optionalString(),
  country: requiredString('Country is required'),
  propertyType: optionalString(),
  type: optionalString(),
  status: z
    .preprocess((value) => (typeof value === 'string' ? value.trim().toUpperCase() : value), z.enum(STATUS_VALUES))
    .default('ACTIVE'),
  yearBuilt: optionalInt({
    min: 1800,
    minMessage: 'Year must be 1800 or later',
    max: new Date().getFullYear(),
    maxMessage: `Year cannot be later than ${new Date().getFullYear()}`,
  }),
  totalUnits: optionalInt({ min: 0, minMessage: 'Total units cannot be negative' }).default(0),
  totalArea: optionalInt({ min: 0, minMessage: 'Total area cannot be negative' }),
  description: optionalString(),
  imageUrl: optionalImageLocation(),
  managerId: optionalString(),

  // Enhanced property details
  lotSize: optionalFloat(),
  buildingSize: optionalFloat(),
  numberOfFloors: optionalInt({ min: 1, minMessage: 'Number of floors must be at least 1' }),
  constructionType: optionalString(),
  heatingSystem: optionalString(),
  coolingSystem: optionalString(),
  amenities: amenitiesSchema,

  // Financial information
  purchasePrice: optionalFloat(),
  purchaseDate: z.union([z.string(), z.date()]).optional().nullable().transform((val) => {
    if (!val) return null;
    if (val instanceof Date) return val;
    const date = new Date(val);
    return isNaN(date.getTime()) ? null : date;
  }),
  currentMarketValue: optionalFloat(),
  annualPropertyTax: optionalFloat(),
  annualInsurance: optionalFloat(),
  monthlyHOA: optionalFloat(),

  // Legacy aliases – accepted but converted internally
  coverImage: optionalString(),
  images: z.array(propertyImageInputSchema).optional(),
});

const withAliasValidation = (schema, { requireCoreFields = true } = {}) =>
  schema.superRefine((data, ctx) => {
    if (requireCoreFields && !data.propertyType && !data.type) {
      ctx.addIssue({
        path: ['propertyType'],
        code: z.ZodIssueCode.custom,
        message: 'Property type is required',
      });
    }
  });

const propertySchema = withAliasValidation(basePropertySchema);
const propertyUpdateSchema = withAliasValidation(basePropertySchema.partial(), { requireCoreFields: false });

const unitSchema = z.object({
  unitNumber: requiredString('Unit number is required'),
  address: optionalString(),
  bedrooms: optionalInt({ min: 0, minMessage: 'Bedrooms cannot be negative' }),
  bathrooms: optionalFloat(),
  area: optionalInt({ min: 0, minMessage: 'Area cannot be negative' }),
  rentAmount: optionalFloat(),
  status: optionalString(),
});

const propertyImageCreateSchema = z
  .object({
    imageUrl: requiredImageLocation(),
    caption: optionalString(),
    altText: optionalString(),
    isPrimary: booleanLike().optional(),
    category: z.enum(['EXTERIOR', 'INTERIOR', 'KITCHEN', 'BATHROOM', 'BEDROOM', 'OTHER']).optional(),
  })
  .transform((data) => ({
    imageUrl: data.imageUrl,
    caption: data.caption !== undefined ? data.caption : data.altText ?? null,
    isPrimary: data.isPrimary,
    category: data.category
  }));

const normalizePropertyImages = (property) => {
  if (!property) return [];

  // If new propertyImages relation exists and is poppeduated, use it
  if (Array.isArray(property.propertyImages) && property.propertyImages.length > 0) {
    return property.propertyImages.map((img, index) => ({
      ...img,
      // Ensure displayOrder is set for older records
      displayOrder: img.displayOrder ?? index,
    }));
  }

  // Fallback to legacy imageUrl if available
  if (property.imageUrl) {
    return [
      {
        id: `legacy-${property.id}`,
        imageUrl: property.imageUrl,
        isPrimary: true,
        displayOrder: 0,
        createdAt: property.createdAt || new Date().toISOString(),
      },
    ];
  }

  return [];
};

const collectPropertyCacheUserIds = (property, modifierUserId) => {
  const userIds = new Set();
  if (modifierUserId) userIds.add(modifierUserId);
  if (property.managerId) userIds.add(property.managerId);
  property.owners?.forEach((po) => userIds.add(po.ownerId));
  return Array.from(userIds);
};

const invalidatePropertyCaches = async (userIds) => {
  // Always invalidate the admin cache
  await invalidatePattern('properties:list:admin*');

  // Invalidate specific user caches
  for (const userId of userIds) {
    await invalidatePattern(`properties:list:${userId}*`);
  }
};

const captionFromGetter = (item) => {
  return item.caption || item.altText;
};

const mapPropertyImages = (images, primaryIndex, uploadedById, propertyId) => {
  return images.map((entry, index) => {
    const caption = entry.captionProvided
      ? entry.caption
      : (entry.caption ?? captionFromGetter ?? null);

    return {
      propertyId,
      imageUrl: entry.imageUrl,
      caption: caption ?? null,
      isPrimary: index === primaryIndex,
      displayOrder: index,
      uploadedById,
    };
  });
};

const resolvePrimaryImageUrl = (images = []) => {
  if (!Array.isArray(images) || images.length === 0) {
    return null;
  }

  const [bestMatch] = images
    .filter((image) => {
      if (!image) return false;
      if (typeof image.imageUrl !== 'string') return false;
      return image.imageUrl.trim().length > 0;
    })
    .sort((a, b) => {
      const aPrimary = Boolean(a.isPrimary);
      const bPrimary = Boolean(b.isPrimary);
      if (aPrimary !== bPrimary) {
        return aPrimary ? -1 : 1;
      }

      const orderDiff = (a.displayOrder ?? 0) - (b.displayOrder ?? 0);
      if (orderDiff !== 0) return orderDiff;

      const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return aDate - bDate;
    });

  return bestMatch?.imageUrl?.trim() || null;
};

const syncPropertyCoverImage = async (tx, propertyId) => {
  const images = await tx.propertyImage.findMany({
    where: { propertyId },
    select: { imageUrl: true, isPrimary: true, displayOrder: true, createdAt: true },
  });

  const nextImageUrl = resolvePrimaryImageUrl(images);

  await tx.property.update({
    where: { id: propertyId },
    data: { imageUrl: nextImageUrl },
  });

  return nextImageUrl;
};

const calculateOccupancyStats = (property) => {
  if (!property || !Array.isArray(property.units)) {
    return null;
  }

  // Use a single reduce operation instead of 3 separate filter calls for better performance
  const stats = property.units.reduce((acc, unit) => {
    if (unit.status === 'OCCUPIED') {
      acc.occupied++;
    } else if (unit.status === 'VACANT') {
      acc.vacant++;
    } else if (unit.status === 'MAINTENANCE') {
      acc.maintenance++;
    }
    return acc;
  }, { occupied: 0, vacant: 0, maintenance: 0 });

  // Bug Fix: Use actual units array length for consistency, not the potentially stale totalUnits field
  // This ensures accuracy when units are added/removed but totalUnits hasn't been updated
  const totalUnits = property.units.length;
  const occupancyRate = totalUnits > 0 ? ((stats.occupied / totalUnits) * 100) : 0;

  return {
    occupied: stats.occupied,
    vacant: stats.vacant,
    maintenance: stats.maintenance,
    total: totalUnits,
    occupancyRate: parseFloat(occupancyRate.toFixed(1)),
  };
};

// Bug Fix: Calculate occupancy stats using database aggregation for accuracy with large properties
// This ensures correct stats even for properties with >100 units (where units array is paginated)
// Bug Fix: Wrap in transaction to prevent inconsistent data if units are modified concurrently
const calculateOccupancyStatsFromDB = async (propertyId) => {
  try {
    // Bug Fix: Use READ COMMITTED transaction to get consistent snapshot of unit data
    const result = await prisma.$transaction(async (tx) => {
      const [stats, totalCount] = await Promise.all([
        tx.unit.groupBy({
          by: ['status'],
          where: { propertyId },
          _count: { id: true },
        }),
        tx.unit.count({ where: { propertyId } }),
      ]);

      return { stats, totalCount };
    }, {
      isolationLevel: 'ReadCommitted', // Sufficient for read-only operation
      maxWait: 2000, // Shorter wait for read-only transaction
      timeout: 5000, // Faster timeout for stats calculation
    });

    const statsByStatus = result.stats.reduce((acc, item) => {
      acc[item.status] = item._count.id;
      return acc;
    }, {});

    const occupied = statsByStatus.OCCUPIED || 0;
    const vacant = statsByStatus.VACANT || 0;
    const maintenance = statsByStatus.MAINTENANCE || 0;
    const total = result.totalCount;
    const occupancyRate = total > 0 ? ((occupied / total) * 100) : 0;

    return {
      occupied,
      vacant,
      maintenance,
      total,
      occupancyRate: parseFloat(occupancyRate.toFixed(1)),
    };
  } catch (error) {
    console.error('Failed to calculate occupancy stats:', error);
    return null;
  }
};

const toPublicProperty = (property) => {
  if (!property) return property;

  const { propertyImages, units, ...rest } = property;

  // Bug Fix: Prefer pre-calculated occupancyStats if available (from DB aggregation)
  // Fall back to calculating from units array only if not provided
  const occupancyStats = property.occupancyStats || calculateOccupancyStats(property);

  return {
    ...rest,
    postcode: property.postcode ?? property.zipCode ?? null,
    type: property.type ?? property.propertyType ?? null,
    coverImage: property.coverImage ?? property.imageUrl ?? null,
    images: normalizePropertyImages(property),
    ...(occupancyStats && { occupancyStats }),
  };
};

const ensurePropertyAccess = (property, user, options = {}) => {
  const { requireWrite = false } = options;

  if (!property) return { allowed: false, reason: 'Property not found', status: 404 };

  // Admins have full access
  if (user.role === 'ADMIN') {
    return { allowed: true, canWrite: true };
  }

  // Property managers who manage the property have full access
  if (user.role === 'PROPERTY_MANAGER' && property.managerId === user.id) {
    return { allowed: true, canWrite: true };
  }

  // Owners who own the property have read-only access
  if (user.role === 'OWNER' && property.owners?.some(o => o.ownerId === user.id)) {
    if (requireWrite) {
      return { allowed: false, reason: 'Owners have read-only access', status: 403 };
    }
    return { allowed: true, canWrite: false };
  }

  return { allowed: false, reason: 'Forbidden', status: 403 };
};

const subscriptionIsActiveForManager = (manager) => {
  if (!manager) return false;
  return isSubscriptionActive(manager);
};

const propertyManagerSubscriptionWhere = (now) => ({
  OR: [
    { manager: { subscriptionStatus: 'ACTIVE' } },
    { manager: { subscriptionStatus: 'TRIAL', trialEndDate: { gt: now } } },
  ],
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
// GET / - List properties (PROPERTY_MANAGER sees their properties, OWNER sees owned properties)
// Bug Fix: Reduced cache TTL from 5 minutes to 1 minute for better data freshness
router.get('/', cacheMiddleware({ ttl: 60 }), async (req, res) => {
  try {
    let where = {};

    const now = new Date();
    const shouldGateByManagerSubscription = !['PROPERTY_MANAGER', 'ADMIN'].includes(req.user.role);

    const includeArchived = String(req.query.includeArchived || '').toLowerCase() === 'true';

    // Role-scoped property list
    if (req.user.role === 'ADMIN') {
      where = {};
    } else if (req.user.role === 'PROPERTY_MANAGER') {
      where = { managerId: req.user.id };
    } else if (req.user.role === 'OWNER') {
      where = {
        owners: {
          some: {
            ownerId: req.user.id,
          },
        },
      };
    } else if (req.user.role === 'TENANT') {
      where = {
        units: {
          some: {
            tenants: {
              some: {
                tenantId: req.user.id,
                isActive: true,
              },
            },
          },
        },
      };
    } else if (req.user.role === 'TECHNICIAN') {
      // Allow technicians to see properties where they have jobs OR inspections
      where = {
        OR: [
          {
            jobs: {
              some: {
                assignedToId: req.user.id,
                archivedAt: null,
              },
            },
          },
          {
            inspections: {
              some: {
                inspectorId: req.user.id,
              },
            },
          },
        ],
      };
    } else {
      return sendError(res, 403, 'Access denied', ErrorCodes.ACC_ACCESS_DENIED);
    }

    if (shouldGateByManagerSubscription) {
      where = {
        AND: [
          where,
          propertyManagerSubscriptionWhere(now),
        ],
      };
    }

    if (!includeArchived) {
      where = {
        AND: [
          where,
          {
            OR: [
              { archivedAt: null },
              // Bug Fix: Treat invalid dates as null for archivedAt
              // This handles cases where archivedAt might be set to '0000-00-00' or similar in older DBs
              { archivedAt: { gt: new Date('2100-01-01') } },
            ]
          }
        ]
      };
    }

    return withPropertyImagesSupport(async (includeImages) => {
      const properties = await prisma.property.findMany({
        where,
        select: buildPropertyListSelect(includeImages),
        orderBy: { updatedAt: 'desc' },
      });

      const results = properties.map(toPublicProperty);
      return res.json(results);
    });
  } catch (error) {
    console.error('List properties error:', error);
    return sendError(res, 500, 'Failed to list properties', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

// GET /:id - Get property detail
router.get('/:id', async (req, res) => {
  try {
    return withPropertyImagesSupport(async (includeImages) => {
      const property = await prisma.property.findUnique({
        where: { id: req.params.id },
        include: buildPropertyDetailInclude(includeImages),
      });

      const access = ensurePropertyAccess(property, req.user);
      // Bug Fix: Allow Technicians and Tenants to view property details if they have valid access
      // For Technicians: If they have a job or inspection at this property
      // For Tenants: If they have a lease at this unit
      if (!access.allowed && req.user.role !== 'PROPERTY_MANAGER' && req.user.role !== 'ADMIN') {
        let hasAccess = false;

        if (req.user.role === 'TECHNICIAN') {
          // Check for jobs or inspections
          const [jobCount, inspectionCount] = await Promise.all([
            prisma.job.count({
              where: { propertyId: req.params.id, assignedToId: req.user.id, archivedAt: null }
            }),
            prisma.inspection.count({
              where: { propertyId: req.params.id, inspectorId: req.user.id }
            })
          ]);
          if (jobCount > 0 || inspectionCount > 0) hasAccess = true;

        } else if (req.user.role === 'TENANT') {
          const tenantUnit = await prisma.unitTenant.findFirst({
            where: {
              tenantId: req.user.id,
              isActive: true,
              unit: { propertyId: req.params.id }
            }
          });
          if (tenantUnit) hasAccess = true;
        }

        if (!hasAccess) {
          const errorCode = access.status === 404 ? ErrorCodes.RES_PROPERTY_NOT_FOUND : ErrorCodes.ACC_PROPERTY_ACCESS_DENIED;
          return sendError(res, access.status, access.reason, errorCode);
        }
      } else if (!access.allowed) {
        // Standard check failed and not a special role exception
        const errorCode = access.status === 404 ? ErrorCodes.RES_PROPERTY_NOT_FOUND : ErrorCodes.ACC_PROPERTY_ACCESS_DENIED;
        return sendError(res, access.status, access.reason, errorCode);
      }

      // Check subscription status for non-admins/non-managers
      // ... (Rest of logic)
      if (req.user.role !== 'ADMIN' && req.user.role !== 'PROPERTY_MANAGER') {
        const manager = property.manager;
        if (manager && !subscriptionIsActiveForManager(manager)) {
          return sendError(res, 403, 'Property subscription is inactive', ErrorCodes.SUB_EXPIRED);
        }
      }

      // Calculate occupancy stats manually
      // Bug Fix: Use aggregated stats from DB for accuracy, instead of calculating from possibly truncated 'units' array
      let occupancyStats = await calculateOccupancyStatsFromDB(property.id);

      // If DB calc failed, fall back to calculating from the loaded unit array (capped at 100)
      if (!occupancyStats) {
        occupancyStats = calculateOccupancyStats(property);
      }

      const response = {
        ...toPublicProperty(property),
        occupancyStats
      };

      res.json(response);
    });
  } catch (error) {
    console.error('Get property error:', error);
    return sendError(res, 500, 'Failed to get property', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

// POST / - Create property (Property Manager only)
router.post('/', requireRole('PROPERTY_MANAGER'), requireActiveSubscription, requireUsage('properties'), maybeHandleImageUpload, async (req, res) => {
  try {
    const propertyData = propertySchema.parse(req.body);

    const newProperty = await prisma.property.create({
      data: {
        ...propertyData,
        managerId: req.user.id,
      },
      include: {
        propertyImages: true,
      }
    });

    // Handle initial image upload if provided
    if (req.file) {
      const publicUrl = getUploadedFileUrl(req.file);

      // Use the new PropertyImage table if available
      await withPropertyImagesSupport(async (includeImages) => {
        if (includeImages) {
          await prisma.propertyImage.create({
            data: {
              propertyId: newProperty.id,
              imageUrl: publicUrl,
              isPrimary: true,
              displayOrder: 0,
              uploadedById: req.user.id,
              caption: 'Cover Image',
            }
          });
        }

        // Also update legacy field for backward compatibility
        await prisma.property.update({
          where: { id: newProperty.id },
          data: { imageUrl: publicUrl }
        });
      });

      newProperty.imageUrl = publicUrl;
    }

    // Invalidate caches
    await invalidatePattern('properties:list:admin*');
    await invalidatePattern(`properties:list:${req.user.id}*`);
    await invalidatePattern(`dashboard:stats:${req.user.id}*`);

    res.status(201).json(toPublicProperty(newProperty));
  } catch (error) {
    // Clean up uploaded file if DB create fails
    if (req.file) {
      // implement delete if needed, usually managed by cron or simply ignored
    }

    if (error instanceof z.ZodError) {
      return sendError(res, 400, 'Validation failed', ErrorCodes.VAL_VALIDATION_FAILED, error.errors);
    }
    console.error('Create property error:', error);
    return sendError(res, 500, 'Failed to create property', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

// PATCH /:id - Update property
router.patch('/:id', requireRole('PROPERTY_MANAGER', 'ADMIN'), requireActiveSubscription, maybeHandleImageUpload, async (req, res) => {
  try {
    const property = await prisma.property.findUnique({
      where: { id: req.params.id },
      include: { owners: true }
    });

    const access = ensurePropertyAccess(property, req.user, { requireWrite: true });
    if (!access.allowed) {
      return sendError(res, access.status, access.reason, ErrorCodes.ACC_PROPERTY_ACCESS_DENIED);
    }

    const updateData = propertyUpdateSchema.parse(req.body);

    // Handle image upload
    if (req.file) {
      const publicUrl = getUploadedFileUrl(req.file);
      updateData.imageUrl = publicUrl;

      // Update PropertyImage as well if we're setting the main image
      await withPropertyImagesSupport(async (includeImages) => {
        if (includeImages) {
          // Unset current primary
          await prisma.propertyImage.updateMany({
            where: { propertyId: property.id, isPrimary: true },
            data: { isPrimary: false }
          });

          // Create new primary
          await prisma.propertyImage.create({
            data: {
              propertyId: property.id,
              imageUrl: publicUrl,
              isPrimary: true,
              displayOrder: 0,
              uploadedById: req.user.id,
              caption: 'Updated Cover Image'
            }
          });
        }
      });
    }

    const updatedProperty = await prisma.property.update({
      where: { id: req.params.id },
      data: updateData,
    });

    // Invalidate caches
    const cacheUserIds = collectPropertyCacheUserIds(property, req.user.id);
    await invalidatePropertyCaches(cacheUserIds);

    res.json(toPublicProperty(updatedProperty));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendError(res, 400, 'Validation failed', ErrorCodes.VAL_VALIDATION_FAILED, error.errors);
    }
    console.error('Update property error:', error);
    return sendError(res, 500, 'Failed to update property', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

// DELETE /:id - Delete property
router.delete('/:id', requireRole('PROPERTY_MANAGER', 'ADMIN'), requireActiveSubscription, async (req, res) => {
  try {
    const property = await prisma.property.findUnique({
      where: { id: req.params.id },
      include: { owners: true }
    });

    const access = ensurePropertyAccess(property, req.user, { requireWrite: true });
    if (!access.allowed) {
      return sendError(res, access.status, access.reason, ErrorCodes.ACC_PROPERTY_ACCESS_DENIED);
    }

    // Check if property can be deleted (no active leases, etc - simplified for now)

    await prisma.property.delete({
      where: { id: req.params.id }
    });

    const cacheUserIds = collectPropertyCacheUserIds(property, req.user.id);
    await invalidatePropertyCaches(cacheUserIds);
    await invalidatePattern(`dashboard:stats:${req.user.id}*`);

    res.json({ success: true, message: 'Property deleted successfully' });
  } catch (error) {
    console.error('Delete property error:', error);
    return sendError(res, 500, 'Failed to delete property', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

export default router;
