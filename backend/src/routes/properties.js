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
import { requireAuth, requireRole, requireActiveSubscription, requireUsage } from '../middleware/auth.js';
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
    totalArea: optionalFloat(),
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
    category: data.category ?? 'OTHER',
  }));

const determineNewImagePrimaryFlag = (requestedIsPrimary, { hasExistingImages, hasExistingPrimary } = {}) => {
  if (requestedIsPrimary === true) {
    return true;
  }

  if (!hasExistingImages) {
    return true;
  }

  if (!hasExistingPrimary) {
    return true;
  }

  return false;
};

const propertyImageUpdateSchema = z
  .object({
    caption: optionalString(),
    altText: optionalString(),
    isPrimary: booleanLike().optional(),
    category: z.enum(['EXTERIOR', 'INTERIOR', 'KITCHEN', 'BATHROOM', 'BEDROOM', 'OTHER']).optional(),
  })
  .refine((data) => data.caption !== undefined || data.altText !== undefined || data.isPrimary !== undefined || data.category !== undefined, {
    message: 'No updates provided',
  })
  .transform((data) => ({
    caption:
      data.caption !== undefined
        ? data.caption
        : data.altText !== undefined
          ? data.altText
          : undefined,
    isPrimary: data.isPrimary,
    category: data.category,
  }));

const propertyImageReorderSchema = z.object({
  orderedImageIds: z.array(z.string().min(1)).min(1, 'At least one image id is required'),
});

const propertyNoteCreateSchema = z.object({
  content: z
    .string({ required_error: 'Note content is required' })
    .trim()
    .min(1, 'Note content is required')
    .max(2000, 'Note content is too long'),
});

const propertyNoteUpdateSchema = z.object({
  content: z
    .string({ required_error: 'Note content is required' })
    .trim()
    .min(1, 'Note content is required')
    .max(2000, 'Note content is too long'),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
// Helper to invalidate property-related caches
const toArray = (value) => {
  if (Array.isArray(value)) {
    return value;
  }
  if (value == null) {
    return [];
  }
  return [value];
};

const collectPropertyCacheUserIds = (property, currentUserId) => {
  const uniqueIds = new Set();

  toArray(currentUserId).forEach((id) => {
    if (id) uniqueIds.add(id);
  });

  if (property) {
    if (property.managerId) {
      uniqueIds.add(property.managerId);
    }

    if (Array.isArray(property.owners)) {
      property.owners.forEach((ownerRecord) => {
        const ownerId = ownerRecord?.ownerId || ownerRecord?.owner?.id;
        if (ownerId) {
          uniqueIds.add(ownerId);
        }
      });
    }
  }

  return Array.from(uniqueIds);
};

const invalidatePropertyCaches = async (userIdentifiers, helpers = {}) => {
  const userIds = toArray(userIdentifiers).filter(Boolean);
  if (!userIds.length) return;

  const { invalidateFn = invalidate, invalidatePatternFn = invalidatePattern } = helpers;

  const tasks = userIds.map((userId) => {
    const propertyPattern = `cache:/api/properties*user:${userId}`;
    const cacheKeys = [
      `cache:/api/properties:user:${userId}`,
      `cache:/api/dashboard/summary:user:${userId}`,
    ];

    return Promise.all([
      invalidatePatternFn(propertyPattern),
      ...cacheKeys.map((key) => invalidateFn(key)),
    ]);
  });

  await Promise.all(tasks);
};

// Bug Fix: Deep merge amenities to prevent data loss during partial updates
// When updating amenities, merge new values with existing ones instead of replacing
// Bug Fix: Keep false values to allow users to explicitly disable/uncheck amenities
// Bug Fix: Add safeguards against DoS attacks via deeply nested objects
const deepMergeAmenities = (existing, updates) => {
  if (!existing && !updates) return null;
  if (!existing) return updates;
  if (!updates) return existing;

  // Bug Fix: Validate updates structure to prevent DoS attacks
  // Only allow expected categories at depth 1, and primitive values at depth 2
  const allowedCategories = ['utilities', 'features', 'security', 'accessibility', 'parking', 'pets'];

  // Check if updates object has unexpected structure
  if (typeof updates !== 'object' || Array.isArray(updates)) {
    console.warn('Invalid amenities update structure, rejecting merge');
    return existing;
  }

  // Deep merge each amenities category
  const merged = { ...existing };

  for (const category of allowedCategories) {
    if (updates[category] !== undefined) {
      // Bug Fix: If updates[category] is explicitly null, remove the entire category
      if (updates[category] === null) {
        merged[category] = null;
      } else if (typeof updates[category] === 'object' && !Array.isArray(updates[category])) {
        // Bug Fix: Validate that category only contains primitive values (no deep nesting)
        const categoryValues = updates[category];
        const hasInvalidNesting = Object.values(categoryValues).some(
          value => value !== null && typeof value === 'object'
        );

        if (hasInvalidNesting) {
          console.warn(`Invalid nesting detected in amenities.${category}, skipping category`);
          continue;
        }

        // Merge individual fields, keeping false values (they explicitly disable features)
        merged[category] = {
          ...(existing[category] || {}),
          ...categoryValues,
        };

        // If category is now empty, set to null
        if (Object.keys(merged[category]).length === 0) {
          merged[category] = null;
        }
      }
    }
  }

  return merged;
};

const applyLegacyAliases = (input = {}) => {
  const data = { ...input };
  if (!data.zipCode && data.postcode) {
    data.zipCode = data.postcode;
  }
  if (!data.propertyType && data.type) {
    data.propertyType = data.type;
  }
  if (Array.isArray(data.imageMetadata)) {
    data.images = data.imageMetadata;
    delete data.imageMetadata;
  }
  if (!data.imageUrl && (data.coverImage || data.images?.length)) {
    const candidates = [data.coverImage, ...(Array.isArray(data.images) ? data.images : [])];
    const firstUrl = candidates
      .map((value) => extractImageUrlFromInput(value))
      .find((value) => value && isValidImageLocation(value));
    if (firstUrl) {
      data.imageUrl = firstUrl;
    }
  }

  return data;
};

const normalizePropertyImages = (property) => {
  if (!property) return [];

  const records = Array.isArray(property.propertyImages) ? property.propertyImages : [];

  if (!records.length) {
    if (property.imageUrl) {
      return [
        {
          id: `${property.id}:primary`,
          propertyId: property.id,
          imageUrl: property.imageUrl,
          caption: null,
          isPrimary: true,
          displayOrder: 0,
          uploadedById: property.managerId ?? null,
          createdAt: property.createdAt ?? null,
          updatedAt: property.updatedAt ?? null,
        },
      ];
    }

    return [];
  }

  return records
    .slice()
    .sort((a, b) => {
      const orderDiff = (a.displayOrder ?? 0) - (b.displayOrder ?? 0);
      if (orderDiff !== 0) return orderDiff;
      const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return aDate - bDate;
    })
    .map((image) => ({
      id: image.id,
      propertyId: image.propertyId,
      imageUrl: image.imageUrl,
      caption: image.caption ?? null,
      isPrimary: Boolean(image.isPrimary),
      displayOrder: image.displayOrder ?? 0,
      uploadedById: image.uploadedById ?? null,
      createdAt: image.createdAt ?? null,
      updatedAt: image.updatedAt ?? null,
    }));
};

const normalizeImageRecordValue = (value) => (typeof value === 'string' ? value.trim() : '');

const determinePrimaryImageIndex = (imageUrls = [], preferredPrimaryUrl) => {
  const urls = Array.isArray(imageUrls) ? imageUrls : [];
  const preferred = normalizeImageRecordValue(preferredPrimaryUrl);

  if (preferred) {
    const matchIndex = urls.findIndex((url) => normalizeImageRecordValue(url) === preferred);
    if (matchIndex !== -1) {
      return matchIndex;
    }
  }

  return urls.length > 0 ? 0 : -1;
};

const sanitiseImageRecordEntry = (entry) => {
  if (!entry) return null;

  if (typeof entry === 'string') {
    const url = normalizeImageRecordValue(entry);
    if (!url) return null;
    return { imageUrl: url, caption: null, captionProvided: false };
  }

  if (typeof entry === 'object') {
    const url = normalizeImageRecordValue(entry.imageUrl ?? entry.url ?? '');
    if (!url) return null;
    const caption = typeof entry.caption === 'string' ? entry.caption : null;
    const captionProvided = entry.captionProvided === true || entry.captionProvided === false
      ? entry.captionProvided
      : caption != null;

    return {
      imageUrl: url,
      caption,
      captionProvided,
      isPrimary: entry.isPrimary === true,
    };
  }

  return null;
};

const applyPreferredPrimaryImageSelection = (images, preferredPrimaryUrl) => {
  const entries = Array.isArray(images) ? images.slice() : [];
  if (!entries.length) {
    return entries;
  }

  const preferred = normalizeImageRecordValue(preferredPrimaryUrl);
  let targetIndex = preferred
    ? entries.findIndex((image) => normalizeImageRecordValue(image?.imageUrl) === preferred)
    : -1;

  if (targetIndex === -1) {
    targetIndex = entries.findIndex((image) => image?.isPrimary === true);
  }

  if (targetIndex === -1) {
    targetIndex = 0;
  }

  return entries.map((image, index) => ({
    ...image,
    isPrimary: index === targetIndex,
  }));
};

const buildPropertyImageRecords = ({
  propertyId,
  imageUrls = [],
  images = undefined,
  preferredPrimaryUrl,
  getCaption,
  uploadedById,
}) => {
  const rawEntries = Array.isArray(images) ? images : imageUrls;
  const normalisedEntries = Array.isArray(rawEntries)
    ? rawEntries.map(sanitiseImageRecordEntry).filter(Boolean)
    : [];

  if (!normalisedEntries.length) {
    return [];
  }

  const urlsForSelection = normalisedEntries.map((entry) => entry.imageUrl);
  const primaryIndex = determinePrimaryImageIndex(urlsForSelection, preferredPrimaryUrl);

  const captions = typeof getCaption === 'function'
    ? new Map(
        normalisedEntries.map((entry, index) => [
          entry.imageUrl,
          getCaption(entry.imageUrl, index),
        ]),
      )
    : null;

  return normalisedEntries.map((entry, index) => {
    const captionFromGetter = captions?.get(entry.imageUrl);
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

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
// GET / - List properties (PROPERTY_MANAGER sees their properties, OWNER sees owned properties)
// Bug Fix: Reduced cache TTL from 5 minutes to 1 minute for better data freshness
router.get('/', cacheMiddleware({ ttl: 60 }), async (req, res) => {
  try {
    let where = {};

    // Property managers see properties they manage
    if (req.user.role === 'PROPERTY_MANAGER') {
      where = { managerId: req.user.id };
    }

    // Owners see properties they own
    if (req.user.role === 'OWNER') {
      where = {
        owners: {
          some: {
            ownerId: req.user.id,
          },
        },
      };
    }

    // Technicians and tenants should not access this route
    if (req.user.role === 'TECHNICIAN' || req.user.role === 'TENANT') {
      return sendError(
        res,
        403,
        'Access denied. This endpoint is for property managers and owners only.',
        ErrorCodes.ACC_ACCESS_DENIED
      );
    }

    // Parse pagination parameters
    // Bug Fix: Properly handle NaN from parseInt to prevent database query failures
    const MAX_OFFSET = 10000; // Reasonable limit to prevent abuse
    const parsedLimit = parseInt(req.query.limit);
    const limit = Math.min(Math.max(Number.isNaN(parsedLimit) ? 50 : parsedLimit, 1), 100);
    const parsedOffset = parseInt(req.query.offset);
    const offset = Math.min(Math.max(Number.isNaN(parsedOffset) ? 0 : parsedOffset, 0), MAX_OFFSET);

    // Parse search and filter parameters (Bug Fix #1: Server-side search)
    // Bug Fix: Validate search string length to prevent performance issues
    const searchInput = req.query.search?.trim() || '';
    const rawSearch = searchInput.length <= 200 ? searchInput : searchInput.substring(0, 200);
    const status = req.query.status?.trim().toUpperCase() || '';

    // Bug Fix: Log warning when search string is truncated so admins are aware
    if (searchInput.length > 200) {
      console.warn(`[Properties API] Search string truncated from ${searchInput.length} to 200 characters. Original: "${searchInput.substring(0, 50)}..."`);
    }

    // Bug Fix: Remove unnecessary regex escaping
    // Prisma's 'contains' mode uses SQL LIKE/ILIKE, not regex, so escaping breaks searches
    // For example, searching "Smith & Co." would fail with escaping
    const search = rawSearch;

    // Add search filter
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { address: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Add status filter
    if (status && status !== 'ALL' && STATUS_VALUES.includes(status)) {
      where.status = status;
    }

    // Bug Fix: Streamlined pagination - always use limit+1 pattern, count only when needed
    const { items: properties, total, hasMoreItems } = await withPropertyImagesSupport(async (includeImages) => {
      const select = buildPropertyListSelect(includeImages);

      // Bug Fix: Only count total when explicitly requested via query param
      // This reduces database load for most list requests
      const shouldCount = req.query.includeTotal === 'true' || offset === 0;

      const [items, count] = await Promise.all([
        prisma.property.findMany({
          where,
          select,
          orderBy: { createdAt: 'desc' },
          skip: offset,
          take: limit + 1, // Fetch one extra to determine hasMore efficiently
        }),
        shouldCount ? prisma.property.count({ where }) : Promise.resolve(null),
      ]);

      // Bug Fix: More efficient hasMore detection using limit+1 pattern
      const hasMoreItems = items.length > limit;
      const finalItems = hasMoreItems ? items.slice(0, limit) : items;

      return { items: finalItems, total: count, hasMoreItems };
    });

    // Calculate page number and hasMore
    const page = Math.floor(offset / limit) + 1;
    // Bug Fix: Prefer hasMoreItems flag over total-based calculation for efficiency
    const hasMore = hasMoreItems;

    // Return paginated response
    res.json({
      items: properties.map(toPublicProperty),
      total: total ?? offset + properties.length, // Provide estimate if total not calculated
      page,
      hasMore,
    });
  } catch (error) {
    console.error('Get properties error:', {
      message: error?.message,
      code: error?.code,
      meta: error?.meta,
      stack: error?.stack,
    });
    return sendError(res, 500, 'Failed to fetch properties', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

// POST / - Create property (PROPERTY_MANAGER only, requires active subscription)
router.post(
  '/',
  requireRole('PROPERTY_MANAGER'),
  requireActiveSubscription,
  requireUsage('properties', async (userId) => await getPropertyCount(userId)),
  async (req, res) => {
  try {
    const parsed = applyLegacyAliases(propertySchema.parse(req.body ?? {}));
    // Remove legacy alias fields (they've been converted to standard fields)
    // Keep the converted fields: zipCode, propertyType, imageUrl
    const {
      managerId: managerIdInput,
      postcode,
      type,
      coverImage,
      imageMetadata,
      images: legacyImages,
      ...data
    } = parsed;

    // Property managers can only create properties for themselves
    const managerId = req.user.id;
    // Usage limit check is handled by requireUsage middleware

    const rawImages = legacyImages;

    // Enhanced logging for debugging image upload issues
    if (process.env.NODE_ENV !== 'test') {
      console.log('[PropertyCreate] Image debugging:');
      console.log('  - Raw images received:', rawImages ? `${rawImages.length} images` : 'none');
      if (rawImages && rawImages.length > 0) {
        console.log('  - First image sample:', JSON.stringify(rawImages[0]).substring(0, 200));
      }
    }

    let initialImages = normaliseSubmittedPropertyImages(rawImages);
    const preferredPrimaryUrl = data.imageUrl ?? initialImages.find((img) => img.isPrimary)?.imageUrl ?? initialImages[0]?.imageUrl ?? null;
    initialImages = applyPreferredPrimaryImageSelection(initialImages, preferredPrimaryUrl);

    // Enhanced logging after normalization
    if (process.env.NODE_ENV !== 'test') {
      console.log('  - Normalized images:', `${initialImages.length} images`);
      if (initialImages.length > 0) {
        console.log('  - Images to be saved:', initialImages.map((img, i) => ({
          index: i,
          url: img.imageUrl.substring(0, 80) + '...',
          isPrimary: img.isPrimary,
        })));
      }
    }

    const primaryImageCandidate = initialImages.find((image) => image.isPrimary) || initialImages[0] || null;
    const coverImageUrl = data.imageUrl ?? primaryImageCandidate?.imageUrl ?? null;

    // Ensure converted fields are included in the data
    const propertyData = {
      ...data,
      managerId,
      // Include converted fields if they exist
      ...(parsed.zipCode && { zipCode: parsed.zipCode }),
      ...(parsed.propertyType && { propertyType: parsed.propertyType }),
      ...(coverImageUrl ? { imageUrl: coverImageUrl } : {}),
    };

    const { property, propertyWithImages } = await withPropertyImagesSupport(async (includeImages) => {
      const createdProperty = await prisma.$transaction(async (tx) => {
        const newProperty = await tx.property.create({
          data: propertyData,
        });

        if (includeImages && initialImages.length) {
          const records = buildPropertyImageRecords({
            propertyId: newProperty.id,
            images: initialImages,
            preferredPrimaryUrl: coverImageUrl,
            uploadedById: req.user.id,
          });

          if (records.length) {
            // Debug logging before save
            if (process.env.NODE_ENV !== 'test') {
              console.log('\n[Step 3] Saving images to database:');
              console.log(`  - Records to save: ${records.length}`);
              console.log(`  - Record details:`, records.map((r, i) => ({
                index: i,
                url: r.imageUrl.substring(0, 80) + '...',
                isPrimary: r.isPrimary,
                displayOrder: r.displayOrder,
              })));
            }

            // Bug Fix #11: Use createMany for efficient batch insert
            await tx.propertyImage.createMany({ data: records });

            // Enhanced logging after save
            if (process.env.NODE_ENV !== 'test') {
              console.log(`  - ✅ Saved ${records.length} PropertyImage records to database`);
            }

            // Bug Fix #12: Ensure property.imageUrl is synced after creating images
            // This guarantees the cover image is always set correctly
            await syncPropertyCoverImage(tx, newProperty.id);
          }
        } else if (!includeImages) {
          console.warn('  - ⚠️  PropertyImage table not available, falling back to single imageUrl');
        } else if (!initialImages.length) {
          if (process.env.NODE_ENV !== 'test') {
            console.log('  - No images to save (empty array)');
          }
        }

        return newProperty;
      }, {
        isolationLevel: 'Serializable',
        maxWait: 5000,
        timeout: 30000, // Bug Fix: Increase timeout to handle large image uploads (50+ images)
      });

      if (!includeImages) {
        return { property: createdProperty, propertyWithImages: null };
      }

      const withImages = await prisma.property.findUnique({
        where: { id: createdProperty.id },
        include: buildPropertyImagesInclude(true),
      });

      // Enhanced logging for final result
      if (process.env.NODE_ENV !== 'test') {
        console.log(`  - Property created with ${withImages?.propertyImages?.length || 0} images in response`);
      }

      return { property: createdProperty, propertyWithImages: withImages };
    });

    // Invalidate property and dashboard caches for all affected users
    const cacheUserIds = collectPropertyCacheUserIds(propertyWithImages ?? property, req.user.id);
    await invalidatePropertyCaches(cacheUserIds);

    const responsePayload = propertyWithImages ? toPublicProperty(propertyWithImages) : toPublicProperty(property);

    // Debug logging for response
    if (process.env.NODE_ENV !== 'test') {
      console.log('\n[Step 5] Final response:');
      console.log(`  - Property ID: ${responsePayload?.id}`);
      console.log(`  - Property Name: ${responsePayload?.name}`);
      console.log(`  - Images in response: ${responsePayload?.images?.length || 0}`);
      console.log(`  - Cover image URL: ${responsePayload?.imageUrl ? responsePayload.imageUrl.substring(0, 80) + '...' : 'none'}`);
      if (responsePayload?.images && responsePayload.images.length > 0) {
        console.log(`  - Response images:`, responsePayload.images.map((img, i) => ({
          index: i,
          id: img.id,
          url: img.imageUrl.substring(0, 80) + '...',
          isPrimary: img.isPrimary,
          displayOrder: img.displayOrder,
        })));
      } else {
        console.log('  - ⚠️  WARNING: No images in response! This might indicate a problem.');
      }
      console.log('========== End Image Processing Debug ==========\n');
    }

    res.status(201).json({ success: true, property: responsePayload });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendError(res, 400, 'Validation error', ErrorCodes.VAL_VALIDATION_ERROR, error.flatten());
    }

    console.error('Create property error:', {
      message: error?.message,
      code: error?.code,
      meta: error?.meta,
    });
    return sendError(res, 500, 'Failed to create property', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

// GET /:id - Get property by ID (with access check)
// Bug Fix: Add caching to reduce database load on frequently accessed property details
router.get('/:id', cacheMiddleware({ ttl: 60 }), async (req, res) => {
  try {
    const property = await withPropertyImagesSupport((includeImages) =>
      prisma.property.findUnique({
        where: { id: req.params.id },
        include: buildPropertyDetailInclude(includeImages),
      })
    );

    const access = ensurePropertyAccess(property, req.user);
    if (!access.allowed) {
      const errorCode = access.status === 404 ? ErrorCodes.RES_PROPERTY_NOT_FOUND : ErrorCodes.ACC_PROPERTY_ACCESS_DENIED;
      return sendError(res, access.status, access.reason, errorCode);
    }

    // Bug Fix: Use DB-based occupancy calculation for accurate stats on large properties
    // This ensures properties with >100 units get correct occupancy data
    const occupancyStats = await calculateOccupancyStatsFromDB(property.id);
    const propertyWithStats = occupancyStats ? { ...property, occupancyStats } : property;

    // Enhanced logging for debugging image display issues
    if (process.env.NODE_ENV !== 'test') {
      console.log(`\n[PropertyDetail] GET /${req.params.id}:`);
      console.log(`  - Property Name: ${property.name}`);
      console.log(`  - PropertyImage records in DB: ${property.propertyImages?.length || 0}`);
      console.log(`  - property.imageUrl: ${property.imageUrl || 'not set'}`);
      if (property.propertyImages && property.propertyImages.length > 0) {
        console.log(`  - DB image sample:`, property.propertyImages.slice(0, 2).map((img, i) => ({
          index: i,
          id: img.id,
          url: img.imageUrl ? img.imageUrl.substring(0, 80) + '...' : 'no-url',
          isPrimary: img.isPrimary,
        })));
      }
    }

    const responsePayload = toPublicProperty(propertyWithStats);

    // Enhanced logging for response
    if (process.env.NODE_ENV !== 'test') {
      console.log(`  - Images in response: ${responsePayload.images?.length || 0}`);
      if (responsePayload.images && responsePayload.images.length > 0) {
        console.log(`  - Response image samples:`, responsePayload.images.slice(0, 2).map((img, i) => ({
          index: i,
          id: img.id,
          url: img.imageUrl ? img.imageUrl.substring(0, 80) + '...' : 'no-url',
          isPrimary: img.isPrimary,
        })));
      } else {
        console.log('  - ⚠️  WARNING: No images in response!');
      }
      console.log('');
    }

    res.json({ success: true, property: responsePayload });
  } catch (error) {
    console.error('Get property error:', {
      message: error?.message,
      code: error?.code,
      meta: error?.meta,
    });
    return sendError(res, 500, 'Failed to fetch property', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

// PATCH /:id - Update property (PROPERTY_MANAGER only, must be property manager, requires active subscription)
router.patch('/:id', requireRole('PROPERTY_MANAGER'), requireActiveSubscription, async (req, res) => {
  try {
    const property = await prisma.property.findUnique({
      where: { id: req.params.id },
      include: {
        owners: {
          select: { ownerId: true },
        },
      },
    });
    const access = ensurePropertyAccess(property, req.user, { requireWrite: true });
    if (!access.allowed) {
      const errorCode = access.status === 404 ? ErrorCodes.RES_PROPERTY_NOT_FOUND : ErrorCodes.ACC_PROPERTY_ACCESS_DENIED;
      return sendError(res, access.status, access.reason, errorCode);
    }

    const parsed = applyLegacyAliases(propertyUpdateSchema.parse(req.body ?? {}));
    // Remove legacy alias fields (they've been converted to standard fields)
    // Keep the converted fields: zipCode, propertyType, imageUrl
    const {
      managerId: managerIdInput,
      postcode,
      type,
      coverImage,
      imageMetadata,
      images: legacyImages,
      amenities: amenitiesUpdate,
      ...data
    } = parsed;

    // Property manager can only update their own properties (already checked by ensurePropertyAccess)
    const managerId = property.managerId;

    const rawImages = legacyImages;

    let imageUpdates = rawImages === undefined ? undefined : normaliseSubmittedPropertyImages(rawImages);

    // Deep merge amenities to preserve existing data during partial updates
    const mergedAmenities = amenitiesUpdate !== undefined
      ? deepMergeAmenities(property.amenities, amenitiesUpdate)
      : undefined;

    // Ensure converted fields are included in the data
    const updateData = {
      ...data,
      managerId,
      // Include converted fields if they exist
      ...(parsed.zipCode !== undefined && { zipCode: parsed.zipCode }),
      ...(parsed.propertyType !== undefined && { propertyType: parsed.propertyType }),
      ...(parsed.imageUrl !== undefined && { imageUrl: parsed.imageUrl }),
      // Include merged amenities if amenities were updated
      ...(mergedAmenities !== undefined && { amenities: mergedAmenities }),
    };

    if (imageUpdates !== undefined) {
      const preferredPrimaryUrl = parsed.imageUrl !== undefined
        ? parsed.imageUrl
        : property.imageUrl ?? null;

      imageUpdates = applyPreferredPrimaryImageSelection(imageUpdates, preferredPrimaryUrl);

      if (imageUpdates.length > 0) {
        if (parsed.imageUrl === undefined) {
          const primaryImage = imageUpdates.find((image) => image.isPrimary) || imageUpdates[0];
          updateData.imageUrl = primaryImage?.imageUrl ?? null;
        }
      } else if (parsed.imageUrl === undefined) {
        updateData.imageUrl = null;
      }
    }

    const { property: updatedProperty, propertyWithImages } = await withPropertyImagesSupport(async (includeImages) => {
      // Bug Fix: Use Serializable isolation to prevent race conditions
      // Note: Serializable isolation detects concurrent modifications and rolls back conflicting transactions
      // This is more robust than explicit row locking and works across all database operations
      const result = await prisma.$transaction(async (tx) => {
        // Verify property exists before updating (transaction will rollback if concurrent modification detected)
        await tx.property.findUnique({
          where: { id: property.id },
          select: { id: true }, // Minimal select for performance
        });

        const updatedRecord = await tx.property.update({
          where: { id: property.id },
          data: updateData,
        });

        if (includeImages && imageUpdates !== undefined) {
          // Bug Fix #13: Enhanced logging for debugging image save issues
          if (process.env.NODE_ENV !== 'test') {
            console.log(`[PropertyImages] Updating images for property ${property.id}:`, {
              imageCount: imageUpdates.length,
              imageUrls: imageUpdates.map(img => img.imageUrl.substring(0, 50)),
            });
          }

          // Bug Fix: Use efficient update strategy instead of delete-recreate
          // This prevents data loss and reduces database load
          const existingImages = await tx.propertyImage.findMany({
            where: { propertyId: property.id },
            select: { id: true, imageUrl: true, caption: true, displayOrder: true },
            orderBy: [
              { displayOrder: 'asc' },
              { createdAt: 'asc' },
            ],
          });

          // Create maps for efficient lookup
          const existingByUrl = new Map();
          const existingById = new Map();
          existingImages.forEach(img => {
            existingByUrl.set(img.imageUrl, img);
            existingById.set(img.id, img);
          });

          const updatedUrls = new Set(imageUpdates.map(img => img.imageUrl));

          // Step 1: Delete images that are no longer in the update list
          const imagesToDelete = existingImages
            .filter(img => !updatedUrls.has(img.imageUrl))
            .map(img => img.id);

          if (imagesToDelete.length > 0) {
            if (process.env.NODE_ENV !== 'test') {
              console.log(`[PropertyImages] Deleting ${imagesToDelete.length} removed images`);
            }
            await tx.propertyImage.deleteMany({
              where: { id: { in: imagesToDelete } },
            });
          }

          // Step 2: Update or create images
          // Bug Fix #14: Use batch operations for better performance
          const imagesToUpdate = [];
          const imagesToCreate = [];

          for (let index = 0; index < imageUpdates.length; index++) {
            const imageUpdate = imageUpdates[index];
            const existing = existingByUrl.get(imageUpdate.imageUrl);

            const imageData = {
              imageUrl: imageUpdate.imageUrl,
              caption: imageUpdate.captionProvided
                ? (imageUpdate.caption ?? null)
                : (existing?.caption ?? imageUpdate.caption ?? null),
              isPrimary: imageUpdate.isPrimary,
              displayOrder: index,
              uploadedById: req.user.id,
            };

            if (existing) {
              imagesToUpdate.push({ id: existing.id, data: imageData });
            } else {
              imagesToCreate.push({
                ...imageData,
                propertyId: property.id,
              });
            }
          }

          // Execute updates in parallel for better performance
          const updatePromises = imagesToUpdate.map(({ id, data }) =>
            tx.propertyImage.update({ where: { id }, data })
          );

          // Create new images in batch
          let createPromise = Promise.resolve();
          if (imagesToCreate.length > 0) {
            if (process.env.NODE_ENV !== 'test') {
              console.log(`[PropertyImages] Creating ${imagesToCreate.length} new images`);
            }
            createPromise = tx.propertyImage.createMany({ data: imagesToCreate });
          }

          await Promise.all([...updatePromises, createPromise]);

          // Bug Fix #12: Always sync property.imageUrl after image updates
          // This ensures the cover image is always correct
          await syncPropertyCoverImage(tx, property.id);
        }

        return updatedRecord;
      }, {
        isolationLevel: 'Serializable', // Prevent race conditions in concurrent updates
        maxWait: 5000, // Maximum time to wait for transaction to start
        timeout: 30000, // Bug Fix: Increase timeout for operations with many images
      });

      if (!includeImages) {
        return { property: result, propertyWithImages: null };
      }

      const withImages = await prisma.property.findUnique({
        where: { id: property.id },
        include: {
          owners: {
            select: { ownerId: true },
          },
          ...buildPropertyImagesInclude(true),
        },
      });

      return { property: result, propertyWithImages: withImages };
    });

    // Invalidate property and dashboard caches for all affected users
    const propertyForCache = propertyWithImages ?? { ...updatedProperty, owners: property.owners };
    const cacheUserIds = collectPropertyCacheUserIds(propertyForCache, req.user.id);
    await invalidatePropertyCaches(cacheUserIds);

    const propertyForResponse = propertyWithImages ?? { ...updatedProperty, owners: property.owners };
    res.json({ success: true, property: toPublicProperty(propertyForResponse) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendError(res, 400, 'Validation error', ErrorCodes.VAL_VALIDATION_ERROR, error.flatten());
    }

    console.error('Update property error:', {
      message: error?.message,
      code: error?.code,
      meta: error?.meta,
    });
    return sendError(res, 500, 'Failed to update property', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

// DELETE /:id - Delete property (PROPERTY_MANAGER only, must be property manager, requires active subscription)
router.delete('/:id', requireRole('PROPERTY_MANAGER'), requireActiveSubscription, async (req, res) => {
  try {
    const property = await prisma.property.findUnique({
      where: { id: req.params.id },
      include: {
        owners: {
          select: { ownerId: true },
        },
        _count: {
          select: {
            units: true,
            jobs: true,
            inspections: true,
          },
        },
      },
    });
    const access = ensurePropertyAccess(property, req.user, { requireWrite: true });
    if (!access.allowed) {
      const errorCode = access.status === 404 ? ErrorCodes.RES_PROPERTY_NOT_FOUND : ErrorCodes.ACC_PROPERTY_ACCESS_DENIED;
      return sendError(res, access.status, access.reason, errorCode);
    }

    // Bug Fix: Comprehensive validation before deletion - check units, jobs, inspections, and active tenants
    const unitCount = property._count?.units || 0;
    const jobCount = property._count?.jobs || 0;
    const inspectionCount = property._count?.inspections || 0;

    // Bug Fix: Check for active tenants across all units in the property
    const activeTenantCount = await prisma.unitTenant.count({
      where: {
        unit: {
          propertyId: req.params.id,
        },
        isActive: true,
      },
    });

    const issues = [];
    if (unitCount > 0) issues.push(`${unitCount} unit(s)`);
    if (jobCount > 0) issues.push(`${jobCount} active job(s)`);
    if (inspectionCount > 0) issues.push(`${inspectionCount} inspection(s)`);
    if (activeTenantCount > 0) issues.push(`${activeTenantCount} active tenant(s)`);

    if (issues.length > 0) {
      return sendError(
        res,
        409,
        `Cannot delete property with ${issues.join(', ')}. Please remove all related data before deleting the property.`,
        ErrorCodes.VAL_VALIDATION_ERROR,
        { unitCount, jobCount, inspectionCount, activeTenantCount }
      );
    }

    // Bug Fix: Wrap deletion and cache invalidation in try-catch for better error handling
    try {
      await prisma.property.delete({ where: { id: property.id } });

      // Invalidate property and dashboard caches for all affected users
      // Don't fail the request if cache invalidation fails - log it instead
      const cacheUserIds = collectPropertyCacheUserIds(property, req.user.id);
      try {
        await invalidatePropertyCaches(cacheUserIds);
      } catch (cacheError) {
        console.error('Cache invalidation failed after property deletion:', cacheError);
        // Don't throw - deletion was successful, cache will expire naturally
      }

      res.json({ success: true, message: 'Property deleted successfully' });
    } catch (deleteError) {
      // If deletion fails, property still exists - this is an error state
      throw deleteError;
    }
  } catch (error) {
    console.error('Delete property error:', {
      message: error?.message,
      code: error?.code,
      meta: error?.meta,
    });
    return sendError(res, 500, 'Failed to delete property', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

// ---------------------------------------------------------------------------
// Property image routes
// ---------------------------------------------------------------------------

propertyImagesRouter.use(async (req, res, next) => {
  try {
    const available = await propertyImagesFeatureAvailable();
    if (!available) {
      return sendError(
        res,
        503,
        'Property image management is not available. Please run the latest database migrations.',
        ErrorCodes.EXT_SERVICE_UNAVAILABLE
      );
    }
    return next();
  } catch (error) {
    console.error('Property image availability check failed:', error);
    return sendError(res, 500, 'Failed to process request', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

propertyImagesRouter.get('/', async (req, res) => {
  const propertyId = req.params.id;

  try {
    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      include: {
        owners: { select: { ownerId: true } },
      },
    });

    const access = ensurePropertyAccess(property, req.user);
    if (!access.allowed) {
      const errorCode = access.status === 404 ? ErrorCodes.RES_PROPERTY_NOT_FOUND : ErrorCodes.ACC_PROPERTY_ACCESS_DENIED;
      return sendError(res, access.status, access.reason, errorCode);
    }

    // Bug Fix #7: Add pagination support for properties with many images
    // Prevents loading hundreds of images at once, improving performance
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 50));
    const skip = (page - 1) * limit;

    const [images, totalCount] = await Promise.all([
      prisma.propertyImage.findMany({
        where: { propertyId },
        orderBy: [
          { displayOrder: 'asc' },
          { createdAt: 'asc' },
        ],
        skip,
        take: limit,
      }),
      prisma.propertyImage.count({
        where: { propertyId },
      }),
    ]);

    res.json({
      success: true,
      images: normalizePropertyImages({ ...property, propertyImages: images }),
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasMore: skip + images.length < totalCount,
      },
    });
  } catch (error) {
    console.error('Get property images error:', error);
    return sendError(res, 500, 'Failed to fetch property images', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

propertyImagesRouter.post('/', requireRole('PROPERTY_MANAGER'), rateLimitUpload, maybeHandleImageUpload, async (req, res) => {
  const propertyId = req.params.id;

  const cleanupUploadedFile = async () => {
    if (!req.file || isUsingCloudStorage()) {
      return;
    }

    const filePath = req.file.path;
    if (!filePath) {
      return;
    }

    try {
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
      }
    } catch (cleanupError) {
      console.error('Failed to remove uploaded file after error:', cleanupError);
    }
  };

  try {
    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      include: {
        owners: { select: { ownerId: true } },
      },
    });

    const access = ensurePropertyAccess(property, req.user, { requireWrite: true });
    if (!access.allowed) {
      await cleanupUploadedFile();
      const errorCode = access.status === 404 ? ErrorCodes.RES_PROPERTY_NOT_FOUND : ErrorCodes.ACC_PROPERTY_ACCESS_DENIED;
      return sendError(res, access.status, access.reason, errorCode);
    }

    const body = { ...(req.body ?? {}) };
    if (req.file) {
      const derivedUrl = getUploadedFileUrl(req.file);
      if (derivedUrl) {
        body.imageUrl = derivedUrl;
      }
    }

    const parsed = propertyImageCreateSchema.parse(body);

    // Bug Fix: Move displayOrder calculation inside transaction to prevent race conditions
    // Concurrent requests can no longer create duplicate displayOrders
    const createdImage = await prisma.$transaction(async (tx) => {
      // Fetch inside transaction for atomic operation
      const [existingImages, existingPrimary] = await Promise.all([
        tx.propertyImage.findMany({
          where: { propertyId },
          select: { id: true, displayOrder: true },
          orderBy: { displayOrder: 'desc' },
          take: 1,
        }),
        tx.propertyImage.findFirst({
          where: { propertyId, isPrimary: true },
          select: { id: true },
        }),
      ]);

      const nextDisplayOrder = existingImages.length ? (existingImages[0].displayOrder ?? 0) + 1 : 0;
      const shouldBePrimary = determineNewImagePrimaryFlag(parsed.isPrimary, {
        hasExistingImages: existingImages.length > 0,
        hasExistingPrimary: Boolean(existingPrimary),
      });

      const image = await tx.propertyImage.create({
        data: {
          propertyId,
          imageUrl: parsed.imageUrl,
          caption: parsed.caption ?? null,
          category: parsed.category ?? 'OTHER',
          isPrimary: shouldBePrimary,
          displayOrder: nextDisplayOrder,
          uploadedById: req.user.id,
        },
      });

      if (shouldBePrimary) {
        await tx.propertyImage.updateMany({
          where: {
            propertyId,
            NOT: { id: image.id },
          },
          data: { isPrimary: false },
        });
      }

      await syncPropertyCoverImage(tx, propertyId);

      return image;
    }, {
      isolationLevel: 'Serializable',
      maxWait: 5000,
      timeout: 30000, // Bug Fix: Increase timeout for image operations
    });

    const cacheUserIds = collectPropertyCacheUserIds(property, req.user.id);
    await invalidatePropertyCaches(cacheUserIds);

    res.status(201).json({ success: true, image: normalizePropertyImages({ ...property, propertyImages: [createdImage] })[0] });
  } catch (error) {
    await cleanupUploadedFile();

    if (error instanceof z.ZodError) {
      return sendError(res, 400, 'Validation error', ErrorCodes.VAL_VALIDATION_ERROR, error.flatten());
    }

    // Bug Fix #9: Don't leak internal error details to client
    // Log full error server-side but return generic message to user
    console.error('Create property image error:', error);
    const userMessage = process.env.NODE_ENV === 'production'
      ? 'Failed to add property image. Please try again.'
      : `Failed to add property image: ${error.message}`;
    return sendError(res, 500, userMessage, ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

propertyImagesRouter.patch('/:imageId', requireRole('PROPERTY_MANAGER'), requireActiveSubscription, async (req, res) => {
  const propertyId = req.params.id;
  const imageId = req.params.imageId;

  try {
    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      include: {
        owners: { select: { ownerId: true } },
      },
    });

    const access = ensurePropertyAccess(property, req.user, { requireWrite: true });
    if (!access.allowed) {
      const errorCode = access.status === 404 ? ErrorCodes.RES_PROPERTY_NOT_FOUND : ErrorCodes.ACC_PROPERTY_ACCESS_DENIED;
      return sendError(res, access.status, access.reason, errorCode);
    }

    const parsed = propertyImageUpdateSchema.parse(req.body ?? {});

    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.propertyImage.findUnique({ where: { id: imageId } });
      if (!existing || existing.propertyId !== propertyId) {
        return null;
      }

      const updateData = {};
      if (parsed.caption !== undefined) updateData.caption = parsed.caption ?? null;
      if (parsed.isPrimary !== undefined) updateData.isPrimary = parsed.isPrimary;
      if (parsed.category !== undefined) updateData.category = parsed.category;

      const result = await tx.propertyImage.update({
        where: { id: imageId },
        data: updateData,
      });

      if (parsed.isPrimary) {
        await tx.propertyImage.updateMany({
          where: {
            propertyId,
            NOT: { id: imageId },
          },
          data: { isPrimary: false },
        });
      }

      await syncPropertyCoverImage(tx, propertyId);

      return result;
    }, {
      isolationLevel: 'Serializable',
      maxWait: 5000,
      timeout: 30000, // Bug Fix: Increase timeout for image operations
    });

    if (!updated) {
      return sendError(res, 404, 'Property image not found', ErrorCodes.RES_PROPERTY_NOT_FOUND);
    }

    const cacheUserIds = collectPropertyCacheUserIds(property, req.user.id);
    await invalidatePropertyCaches(cacheUserIds);

    res.json({ success: true, image: normalizePropertyImages({ ...property, propertyImages: [updated] })[0] });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendError(res, 400, 'Validation error', ErrorCodes.VAL_VALIDATION_ERROR, error.flatten());
    }

    // Bug Fix #9: Don't leak internal error details to client
    console.error('Update property image error:', error);
    const userMessage = process.env.NODE_ENV === 'production'
      ? 'Failed to update property image. Please try again.'
      : `Failed to update property image: ${error.message}`;
    return sendError(res, 500, userMessage, ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

propertyImagesRouter.delete('/:imageId', requireRole('PROPERTY_MANAGER'), requireActiveSubscription, async (req, res) => {
  const propertyId = req.params.id;
  const imageId = req.params.imageId;

  try {
    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      include: {
        owners: { select: { ownerId: true } },
      },
    });

    const access = ensurePropertyAccess(property, req.user, { requireWrite: true });
    if (!access.allowed) {
      const errorCode = access.status === 404 ? ErrorCodes.RES_PROPERTY_NOT_FOUND : ErrorCodes.ACC_PROPERTY_ACCESS_DENIED;
      return sendError(res, access.status, access.reason, errorCode);
    }

    // Fetch the image first to check if it exists and get the imageUrl
    const existing = await prisma.propertyImage.findUnique({ where: { id: imageId } });
    if (!existing || existing.propertyId !== propertyId) {
      return sendError(res, 404, 'Property image not found', ErrorCodes.RES_PROPERTY_NOT_FOUND);
    }

    // Clean up physical file from disk or cloud storage BEFORE deleting DB record
    // This prevents orphaned files if the file deletion fails
    if (existing.imageUrl) {
      try {
        // Use deleteImage for S3, Cloudinary (legacy), and local files
        if (existing.imageUrl.startsWith('http') && existing.imageUrl.includes('cloudinary.com')) {
          await deleteImage(existing.imageUrl);
        } else if (isLocalUploadUrl(existing.imageUrl)) {
          const filename = extractLocalUploadFilename(existing.imageUrl);
          if (filename) {
            const filePath = path.join(UPLOAD_DIR, filename);
            if (fs.existsSync(filePath)) {
              await fs.promises.unlink(filePath);
              console.log('✅ Deleted image file:', filePath);
            }
          }
        }
      } catch (fileDeleteError) {
        console.error('Failed to delete image file, keeping database record:', fileDeleteError);
        const userMessage = process.env.NODE_ENV === 'production'
          ? 'Failed to delete image file. Please try again later.'
          : `Failed to delete image file: ${fileDeleteError.message}`;
        return sendError(res, 500, userMessage, ErrorCodes.ERR_INTERNAL_SERVER);
      }
    }

    // Only delete the database record after successful file deletion
    await prisma.$transaction(async (tx) => {
      await tx.propertyImage.delete({ where: { id: imageId } });

      if (existing.isPrimary) {
        const nextPrimary = await tx.propertyImage.findFirst({
          where: { propertyId },
          orderBy: [
            { displayOrder: 'asc' },
            { createdAt: 'asc' },
          ],
        });

        if (nextPrimary) {
          await tx.propertyImage.update({
            where: { id: nextPrimary.id },
            data: { isPrimary: true },
          });
        }
      }

      await syncPropertyCoverImage(tx, propertyId);
    }, {
      isolationLevel: 'Serializable',
      maxWait: 5000,
      timeout: 30000, // Bug Fix: Increase timeout for image operations
    });

    const cacheUserIds = collectPropertyCacheUserIds(property, req.user.id);
    await invalidatePropertyCaches(cacheUserIds);

    res.json({ success: true });
  } catch (error) {
    // Bug Fix #9: Don't leak internal error details to client
    console.error('Delete property image error:', error);
    const userMessage = process.env.NODE_ENV === 'production'
      ? 'Failed to delete property image. Please try again.'
      : `Failed to delete property image: ${error.message}`;
    return sendError(res, 500, userMessage, ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

propertyImagesRouter.post('/reorder', requireRole('PROPERTY_MANAGER'), async (req, res) => {
  const propertyId = req.params.id;

  try {
    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      include: {
        owners: { select: { ownerId: true } },
      },
    });

    const access = ensurePropertyAccess(property, req.user, { requireWrite: true });
    if (!access.allowed) {
      const errorCode = access.status === 404 ? ErrorCodes.RES_PROPERTY_NOT_FOUND : ErrorCodes.ACC_PROPERTY_ACCESS_DENIED;
      return sendError(res, access.status, access.reason, errorCode);
    }

    const parsed = propertyImageReorderSchema.parse(req.body ?? {});

    const existingImages = await prisma.propertyImage.findMany({
      where: { propertyId },
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

    await prisma.$transaction(async (tx) => {
      // Bug Fix: Use sequential updates instead of Promise.all for better transaction handling
      // This prevents database lock contention and ensures consistent ordering
      for (let index = 0; index < providedIds.length; index++) {
        await tx.propertyImage.update({
          where: { id: providedIds[index] },
          data: { displayOrder: index },
        });
      }

      // Sync cover image within the same transaction
      await syncPropertyCoverImage(tx, propertyId);
    }, {
      isolationLevel: 'Serializable',
      maxWait: 5000,
      timeout: 30000, // Bug Fix: Increase timeout for image reorder operations
    });

    const cacheUserIds = collectPropertyCacheUserIds(property, req.user.id);
    await invalidatePropertyCaches(cacheUserIds);

    res.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendError(res, 400, 'Validation error', ErrorCodes.VAL_VALIDATION_ERROR, error.flatten());
    }

    // Bug Fix #9: Don't leak internal error details to client
    console.error('Reorder property images error:', error);
    const userMessage = process.env.NODE_ENV === 'production'
      ? 'Failed to reorder property images. Please try again.'
      : `Failed to reorder property images: ${error.message}`;
    return sendError(res, 500, userMessage, ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

// GET /:id/activity - Get recent activity for a property
router.get('/:id/activity', async (req, res) => {
  try {
    const property = await prisma.property.findUnique({ 
      where: { id: req.params.id },
      include: {
        owners: {
          select: { ownerId: true },
        },
      },
    });
    const access = ensurePropertyAccess(property, req.user);
    if (!access.allowed) {
      const errorCode = access.status === 404 ? ErrorCodes.RES_PROPERTY_NOT_FOUND : ErrorCodes.ACC_PROPERTY_ACCESS_DENIED;
      return sendError(res, access.status, access.reason, errorCode);
    }

    // Bug Fix: Handle NaN from parseInt properly
    const parsedActivityLimit = parseInt(req.query.limit);
    const limit = Math.min(Number.isNaN(parsedActivityLimit) ? 20 : parsedActivityLimit, 50);
    // Bug Fix: Include user ID in cache key to prevent cache collision between users
    // Even users with the same role may have different access permissions
    // This prevents potential data leaks if access permissions change
    const cacheKey = `property:${req.params.id}:activity:${limit}:user:${req.user.id}`;

    const cached = await redisGet(cacheKey);
    if (cached) {
      try {
        const parsed = typeof cached === 'string' ? JSON.parse(cached) : cached;
        if (parsed?.activities) {
          return res.json(parsed);
        }
      } catch (error) {
        if (process.env.NODE_ENV !== 'test') {
          console.warn('[PropertyActivity] Failed to parse cached payload:', error.message);
        }
      }
    }

    // Query the PropertyActivity view using raw SQL since it's a database view
    // Note: Using parameterized query to prevent SQL injection
    const rows = await prisma.$queryRaw`
      SELECT *
      FROM "PropertyActivity"
      WHERE "propertyId" = ${req.params.id}
      ORDER BY "date" DESC
      LIMIT ${limit}
    `;

    const activities = rows.map((row) => {
      switch (row.type) {
        case 'job':
          return {
            type: 'job',
            id: row.id,
            title: row.title,
            description: row.assigned_first_name
              ? `Assigned to ${row.assigned_first_name} ${row.assigned_last_name}`
              : 'Job update',
            status: row.status,
            priority: row.priority,
            date: row.date,
          };
        case 'inspection':
          return {
            type: 'inspection',
            id: row.id,
            title: row.title,
            description: row.status ? `Inspection ${row.status.toLowerCase()}` : 'Inspection update',
            status: row.status,
            date: row.date,
          };
        case 'service_request':
          return {
            type: 'service_request',
            id: row.id,
            title: row.title,
            description: row.requested_first_name
              ? `Requested by ${row.requested_first_name} ${row.requested_last_name}`
              : 'Service request update',
            status: row.status,
            priority: row.priority,
            date: row.date,
          };
        case 'unit':
          return {
            type: 'unit',
            id: row.id,
            title: row.unit_number ? `Unit ${row.unit_number}` : 'Unit update',
            description: `Status: ${row.status}`,
            status: row.status,
            date: row.date,
          };
        default:
          return null;
      }
    }).filter(Boolean);

    const payload = { success: true, activities };

    await redisSet(cacheKey, payload, 300);

    res.json(payload);
  } catch (error) {
    console.error('Get property activity error:', error);
    return sendError(res, 500, 'Failed to fetch property activity', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

// ---------------------------------------------------------------------------
// Property document routes
// ---------------------------------------------------------------------------

// Zod schemas for property documents
const propertyDocumentCreateSchema = z.object({
  fileName: z.string().min(1, 'File name is required'),
  fileUrl: z.string().url('Invalid file URL'),
  fileSize: z.number().int().positive('File size must be positive'),
  mimeType: z.string().min(1, 'MIME type is required'),
  category: z.enum(['LEASE_AGREEMENT', 'INSURANCE', 'PERMIT', 'INSPECTION_REPORT', 'MAINTENANCE_RECORD', 'FINANCIAL', 'LEGAL', 'PHOTOS', 'OTHER']),
  description: optionalString(),
  accessLevel: z.enum(['PUBLIC', 'TENANT', 'OWNER', 'PROPERTY_MANAGER']),
  unitId: z.string().optional().nullable(), // Optional unit assignment
});

// Multer middleware for document uploads - uses S3 when configured
const documentUpload = createDocumentUploadMiddleware();

const extractCloudinaryFields = (file) => {
  if (!file) return {};

  const secureUrl = file.secure_url || file.path || file.url;
  const isCloudinary = typeof secureUrl === 'string' && secureUrl.includes('cloudinary.com');

  if (!isCloudinary) return {};

  return {
    cloudinarySecureUrl: secureUrl,
    cloudinaryPublicId: file.public_id || file.filename || null,
    cloudinaryResourceType: file.resource_type || null,
    cloudinaryFormat: file.format || null,
  };
};

/**
 * Get unit IDs where the user is an active tenant within a property
 * @param {string} userId - User ID
 * @param {string} propertyId - Property ID
 * @returns {Promise<string[]>} Array of unit IDs
 */
const getUserTenantUnitIds = async (userId, propertyId) => {
  const tenantUnits = await prisma.unitTenant.findMany({
    where: {
      tenantId: userId,
      isActive: true,
      unit: {
        propertyId,
      },
    },
    select: {
      unitId: true,
    },
  });
  return tenantUnits.map((ut) => ut.unitId);
};

/**
 * Get unit IDs where the user is an owner within a property
 * @param {string} userId - User ID
 * @param {string} propertyId - Property ID
 * @returns {Promise<string[]>} Array of unit IDs
 */
const getUserOwnedUnitIds = async (userId, propertyId) => {
  const ownedUnits = await prisma.unitOwner.findMany({
    where: {
      ownerId: userId,
      unit: {
        propertyId,
      },
      // Only include current ownerships (endDate is null or in the future)
      OR: [
        { endDate: null },
        { endDate: { gte: new Date() } },
      ],
    },
    select: {
      unitId: true,
    },
  });
  return ownedUnits.map((uo) => uo.unitId);
};

/**
 * Check if user owns the entire property (not just specific units)
 * @param {string} userId - User ID
 * @param {string} propertyId - Property ID
 * @returns {Promise<boolean>}
 */
const checkUserOwnsProperty = async (userId, propertyId) => {
  const propertyOwnership = await prisma.propertyOwner.findFirst({
    where: {
      ownerId: userId,
      propertyId,
      OR: [
        { endDate: null },
        { endDate: { gte: new Date() } },
      ],
    },
  });
  return !!propertyOwnership;
};

/**
 * Check if a user has access to a specific document based on their role and relationship to the property/unit
 * @param {Object} document - Document object with unitId, accessLevel, propertyId
 * @param {Object} user - User object with id and role
 * @param {string} propertyId - Property ID
 * @returns {Promise<boolean>}
 */
const checkDocumentAccess = async (document, user, propertyId) => {
  // Property managers who manage this property have full access
  if (user.role === 'PROPERTY_MANAGER') {
    // Verify they actually manage this property (already checked by ensurePropertyAccess)
    return true;
  }

  const { unitId, accessLevel } = document;

  // Check access based on role and document access level
  if (user.role === 'TENANT') {
    // Tenants can only access PUBLIC or TENANT level documents
    if (!['PUBLIC', 'TENANT'].includes(accessLevel)) {
      return false;
    }

    // If document is property-level (no unitId), tenant can access it
    if (!unitId) {
      return true;
    }

    // If document is unit-specific, check if tenant leases that unit
    const tenantUnitIds = await getUserTenantUnitIds(user.id, propertyId);
    return tenantUnitIds.includes(unitId);
  }

  if (user.role === 'OWNER') {
    // Owners can only access PUBLIC or OWNER level documents
    if (!['PUBLIC', 'OWNER'].includes(accessLevel)) {
      return false;
    }

    // If document is property-level (no unitId), check if they own the property
    if (!unitId) {
      const ownsProperty = await checkUserOwnsProperty(user.id, propertyId);
      return ownsProperty;
    }

    // If document is unit-specific, check if they own that specific unit
    const ownedUnitIds = await getUserOwnedUnitIds(user.id, propertyId);
    return ownedUnitIds.includes(unitId);
  }

  // For other roles, only allow PUBLIC documents
  return accessLevel === 'PUBLIC';
};

/**
 * Build query filters for documents based on user's role and relationships
 * This is used for efficient database-level filtering in list queries
 * @param {Object} user - User object with id and role
 * @param {string} propertyId - Property ID
 * @returns {Promise<Object>} Prisma where clause filters
 */
const buildDocumentAccessFilters = async (user, propertyId) => {
  // Property managers get full access
  if (user.role === 'PROPERTY_MANAGER') {
    return {}; // No additional filters
  }

  if (user.role === 'TENANT') {
    // Get units where this user is an active tenant
    const tenantUnitIds = await getUserTenantUnitIds(user.id, propertyId);

    return {
      AND: [
        // Only PUBLIC or TENANT access level
        { accessLevel: { in: ['PUBLIC', 'TENANT'] } },
        // Either property-level (unitId null) or assigned to user's units
        {
          OR: [
            { unitId: null },
            { unitId: { in: tenantUnitIds } },
          ],
        },
      ],
    };
  }

  if (user.role === 'OWNER') {
    // Get units owned by this user
    const ownedUnitIds = await getUserOwnedUnitIds(user.id, propertyId);
    const ownsProperty = await checkUserOwnsProperty(user.id, propertyId);

    // Build OR conditions based on ownership
    const orConditions = [];

    // If they own the property, they can see property-level documents
    if (ownsProperty) {
      orConditions.push({ unitId: null });
    }

    // They can see documents for units they own
    if (ownedUnitIds.length > 0) {
      orConditions.push({ unitId: { in: ownedUnitIds } });
    }

    // If no ownership found, return impossible condition
    if (orConditions.length === 0) {
      return { id: 'impossible-match' }; // No documents will match
    }

    return {
      AND: [
        // Only PUBLIC or OWNER access level
        { accessLevel: { in: ['PUBLIC', 'OWNER'] } },
        // Match their ownership
        { OR: orConditions },
      ],
    };
  }

  // For other roles, only PUBLIC documents
  return { accessLevel: 'PUBLIC' };
};

const getAllowedDocumentLevels = (role) => {
  switch (role) {
    case 'PROPERTY_MANAGER':
      return null; // Full access
    case 'OWNER':
      return ['PUBLIC', 'OWNER'];
    case 'TENANT':
      return ['PUBLIC', 'TENANT'];
    default:
      return ['PUBLIC'];
  }
};

const filterDocumentsForUser = (documents, user) => {
  const allowedLevels = getAllowedDocumentLevels(user.role);
  if (!allowedLevels) return documents;

  return documents.filter((doc) => allowedLevels.includes(doc.accessLevel));
};

const resolveDocumentUrl = (fileUrl, req) => {
  if (!fileUrl) return null;
  const trimmed = fileUrl.trim();

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  const normalised = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  const host = `${req.protocol}://${req.get('host')}`;
  return `${host}${normalised}`;
};

const buildCloudinaryDownloadUrl = (cloudUrl, fileName) => {
  if (!cloudUrl || !cloudUrl.includes('cloudinary.com')) return cloudUrl;

  const sanitisedName = (fileName || 'document').replace(/[^a-zA-Z0-9._-]/g, '_');

  if (cloudUrl.includes('/upload/fl_attachment')) return cloudUrl;

  return cloudUrl.replace(/\/upload\//, `/upload/fl_attachment:${encodeURIComponent(sanitisedName)}/`);
};

const extractCloudinaryPublicIdFromUrl = (url) => {
  if (typeof url !== 'string' || !url.includes('cloudinary.com')) return null;

  const match = url.match(/\/upload\/(?:v\d+\/)?([^?#]+)/);
  if (!match?.[1]) return null;

  return match[1];
};

const buildCloudinaryPreviewUrl = (document, secureUrl) => {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const hasCloudinary = (secureUrl && secureUrl.includes('cloudinary.com')) || document.cloudinaryPublicId;
  if (!cloudName || !hasCloudinary) return null;

  const isRawResource = document.cloudinaryResourceType === 'raw' || document.mimeType?.includes('pdf');
  if (!isRawResource) return null;

  const candidatePublicId = document.cloudinaryPublicId || extractCloudinaryPublicIdFromUrl(secureUrl);
  if (!candidatePublicId) return null;

  const publicId = candidatePublicId.replace(/^\/+/, '');
  const hasExtension = /\.[^/.]+$/.test(publicId);
  const inferredFormat = document.cloudinaryFormat || document.mimeType?.split('/')?.[1] || null;
  const publicIdWithExtension = hasExtension
    ? publicId
    : inferredFormat
      ? `${publicId}.${inferredFormat}`
      : publicId;

  return `https://res.cloudinary.com/${cloudName}/raw/upload/${publicIdWithExtension}`;
};

const buildDocumentPreviewData = (document, req) => {
  if (!document) return { previewUrl: null };

  const resolvedFileUrl = resolveDocumentUrl(document.fileUrl, req);

  return {
    previewUrl: resolvedFileUrl,
  };
};

const sanitiseLocalDocumentPath = (value) => {
  if (!value) return null;
  const normalised = path.normalize(value).replace(/^\.+/, '').replace(/^\/+/, '');
  if (normalised.includes('..')) return null;
  return normalised;
};

const withDocumentActionUrls = (document, req) => {
  if (!document) return document;
  const baseDocumentPath = `${req.baseUrl}/${document.id}`.replace(/\/+$/, '');
  const previewData = buildDocumentPreviewData(document, req);

  return {
    ...document,
    ...previewData,
    // Override previewUrl to use backend API endpoint instead of direct Cloudinary URL
    // This ensures authentication is maintained throughout the request chain
    previewUrl: `${baseDocumentPath}/preview`,
    downloadUrl: `${baseDocumentPath}/download`,
  };
};

// GET /properties/:id/documents - List all documents for a property
propertyDocumentsRouter.get('/', async (req, res) => {
  const propertyId = req.params.id;
  const { unitId } = req.query; // Optional query parameter for filtering by unit

  try {
    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      include: {
        owners: { select: { ownerId: true } },
      },
    });

    const access = ensurePropertyAccess(property, req.user);
    if (!access.allowed) {
      const errorCode = access.status === 404 ? ErrorCodes.RES_PROPERTY_NOT_FOUND : ErrorCodes.ACC_PROPERTY_ACCESS_DENIED;
      return sendError(res, access.status, access.reason, errorCode);
    }

    // Build relationship-based access filters
    // This checks user's actual relationships with properties/units, not just their role
    const accessFilters = await buildDocumentAccessFilters(req.user, propertyId);
    const where = {
      propertyId,
      ...accessFilters,
    };

    // Filter by unit if specified (this is an explicit user filter, separate from access control)
    if (unitId !== undefined) {
      // null or specific unitId
      where.unitId = unitId === 'null' || unitId === '' ? null : unitId;
    }

    const documents = await prisma.propertyDocument.findMany({
      where,
      include: {
        uploader: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        unit: {
          select: {
            id: true,
            unitNumber: true,
          },
        },
      },
      orderBy: { uploadedAt: 'desc' },
    });

    const documentsWithUrls = documents.map((doc) =>
      withDocumentActionUrls(doc, req)
    );

    res.json({
      success: true,
      documents: documentsWithUrls,
    });
  } catch (error) {
    console.error('Get property documents error:', error);
    return sendError(res, 500, 'Failed to fetch property documents', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

// GET /properties/:id/documents/:documentId - Get a single document
propertyDocumentsRouter.get('/:documentId', async (req, res) => {
  const propertyId = req.params.id;
  const documentId = req.params.documentId;

  try {
    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      include: {
        owners: { select: { ownerId: true } },
      },
    });

    const access = ensurePropertyAccess(property, req.user);
    if (!access.allowed) {
      const errorCode = access.status === 404 ? ErrorCodes.RES_PROPERTY_NOT_FOUND : ErrorCodes.ACC_PROPERTY_ACCESS_DENIED;
      return sendError(res, access.status, access.reason, errorCode);
    }

    const document = await prisma.propertyDocument.findFirst({
      where: {
        id: documentId,
        propertyId,
      },
      include: {
        uploader: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    if (!document) {
      return sendError(res, 404, 'Document not found', ErrorCodes.RES_PROPERTY_NOT_FOUND);
    }

    // Check relationship-based access control
    const hasAccess = await checkDocumentAccess(document, req.user, propertyId);
    if (!hasAccess) {
      return sendError(res, 403, 'Access denied for this document', ErrorCodes.ACC_ACCESS_DENIED);
    }

    const documentWithActions = withDocumentActionUrls(document, req);

    res.json({
      success: true,
      document: documentWithActions,
    });
  } catch (error) {
    console.error('Get property document error:', error);
    return sendError(res, 500, 'Failed to fetch property document', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

// GET /properties/:id/documents/:documentId/preview - Redirect to preview URL
propertyDocumentsRouter.get('/:documentId/preview', async (req, res) => {
  const propertyId = req.params.id;
  const documentId = req.params.documentId;

  try {
    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      include: {
        owners: { select: { ownerId: true } },
      },
    });

    const access = ensurePropertyAccess(property, req.user);
    if (!access.allowed) {
      const errorCode = access.status === 404 ? ErrorCodes.RES_PROPERTY_NOT_FOUND : ErrorCodes.ACC_PROPERTY_ACCESS_DENIED;
      return sendError(res, access.status, access.reason, errorCode);
    }

    const document = await prisma.propertyDocument.findFirst({
      where: {
        id: documentId,
        propertyId,
      },
    });

    if (!document) {
      return sendError(res, 404, 'Document not found', ErrorCodes.RES_PROPERTY_NOT_FOUND);
    }

    // Check relationship-based access control
    const hasAccess = await checkDocumentAccess(document, req.user, propertyId);
    if (!hasAccess) {
      return sendError(res, 403, 'Access denied for this document', ErrorCodes.ACC_ACCESS_DENIED);
    }

    const previewData = buildDocumentPreviewData(document, req);
    if (!previewData.previewUrl) {
      return sendError(res, 500, 'Document URL unavailable', ErrorCodes.FILE_UPLOAD_FAILED);
    }

    // Stream content from Cloudinary instead of redirecting to avoid token loss
    try {
      const response = await axios.get(previewData.previewUrl, {
        responseType: 'stream',
        timeout: 30000, // 30 second timeout
      });

      // Set appropriate headers
      res.setHeader('Cache-Control', 'public, max-age=300');
      res.setHeader('Content-Type', document.mimeType || response.headers['content-type'] || 'application/pdf');

      // Set Content-Disposition for inline viewing
      const fileName = document.fileName || 'document';
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(fileName)}"`);

      // Stream the response
      response.data.pipe(res);
    } catch (streamError) {
      console.error('Failed to stream document from Cloudinary:', streamError);
      return sendError(res, 500, 'Failed to fetch document', ErrorCodes.ERR_INTERNAL_SERVER);
    }
  } catch (error) {
    console.error('Preview property document error:', error);
    return sendError(res, 500, 'Failed to preview document', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

// GET /properties/:id/documents/:documentId/download - Force download
propertyDocumentsRouter.get('/:documentId/download', async (req, res) => {
  const propertyId = req.params.id;
  const documentId = req.params.documentId;

  try {
    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      include: {
        owners: { select: { ownerId: true } },
      },
    });

    const access = ensurePropertyAccess(property, req.user);
    if (!access.allowed) {
      const errorCode = access.status === 404 ? ErrorCodes.RES_PROPERTY_NOT_FOUND : ErrorCodes.ACC_PROPERTY_ACCESS_DENIED;
      return sendError(res, access.status, access.reason, errorCode);
    }

    const document = await prisma.propertyDocument.findFirst({
      where: {
        id: documentId,
        propertyId,
      },
    });

    if (!document) {
      return sendError(res, 404, 'Document not found', ErrorCodes.RES_PROPERTY_NOT_FOUND);
    }

    // Check relationship-based access control
    const hasAccess = await checkDocumentAccess(document, req.user, propertyId);
    if (!hasAccess) {
      return sendError(res, 403, 'Access denied for this document', ErrorCodes.ACC_ACCESS_DENIED);
    }

    const resolvedUrl = resolveDocumentUrl(document.fileUrl, req);
    if (!resolvedUrl) {
      return sendError(res, 500, 'Document URL unavailable', ErrorCodes.FILE_UPLOAD_FAILED);
    }

    // Local uploads - stream the file with proper headers
    if (isLocalUploadUrl(document.fileUrl)) {
      const extractedFilename = extractLocalUploadFilename(document.fileUrl);
      const safeRelativePath = sanitiseLocalDocumentPath(extractedFilename);
      if (!safeRelativePath) {
        return sendError(res, 400, 'Invalid document path', ErrorCodes.FILE_INVALID_TYPE);
      }

      const filePath = path.join(UPLOAD_DIR, safeRelativePath);
      if (!fs.existsSync(filePath)) {
        return sendError(res, 404, 'Document not found on server', ErrorCodes.RES_PROPERTY_NOT_FOUND);
      }

      const downloadName = document.fileName || path.basename(filePath);
      res.setHeader('Content-Type', document.mimeType || 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(downloadName)}"`);
      return res.download(filePath, downloadName);
    }

    // Cloudinary or external URLs - stream content instead of redirecting to avoid token loss
    const downloadUrl = buildCloudinaryDownloadUrl(resolvedUrl, document.fileName);

    try {
      const response = await axios.get(downloadUrl, {
        responseType: 'stream',
        timeout: 30000, // 30 second timeout
      });

      // Set appropriate headers
      res.setHeader('Cache-Control', 'private, max-age=300');
      res.setHeader('Content-Type', document.mimeType || response.headers['content-type'] || 'application/octet-stream');

      // Set Content-Disposition for download
      const downloadName = document.fileName || 'document';
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(downloadName)}"`);

      // Stream the response
      response.data.pipe(res);
    } catch (streamError) {
      console.error('Failed to stream document from Cloudinary:', streamError);
      return sendError(res, 500, 'Failed to fetch document', ErrorCodes.ERR_INTERNAL_SERVER);
    }
  } catch (error) {
    console.error('Download property document error:', error);
    return sendError(res, 500, 'Failed to download document', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

// POST /properties/:id/documents - Create document record(s) from already-uploaded file(s)
// New pattern: Files are uploaded separately via /upload/documents, then metadata is saved here
propertyDocumentsRouter.post('/', requireRole('PROPERTY_MANAGER'), async (req, res) => {
  const propertyId = req.params.id;

  try {
    // Support both single document and array of documents
    const documents = Array.isArray(req.body) ? req.body : [req.body];

    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      include: {
        owners: { select: { ownerId: true } },
        units: { select: { id: true, unitNumber: true } }, // Include units for validation
      },
    });

    const access = ensurePropertyAccess(property, req.user, { requireWrite: true });
    if (!access.allowed) {
      const errorCode = access.status === 404 ? ErrorCodes.RES_PROPERTY_NOT_FOUND : ErrorCodes.ACC_PROPERTY_ACCESS_DENIED;
      return sendError(res, access.status, access.reason, errorCode);
    }

    // Validate all documents
    const parsedDocuments = documents.map(doc => propertyDocumentCreateSchema.parse(doc));

    // Validate unit IDs if provided
    const unitIds = property.units.map(u => u.id);
    for (const doc of parsedDocuments) {
      if (doc.unitId && !unitIds.includes(doc.unitId)) {
        return sendError(res, 400, `Invalid unitId: ${doc.unitId}. Unit does not belong to this property.`, ErrorCodes.VAL_VALIDATION_ERROR);
      }
    }

    // Create all documents in a transaction
    const createdDocuments = await prisma.$transaction(
      parsedDocuments.map(parsed =>
        prisma.propertyDocument.create({
          data: {
            propertyId,
            unitId: parsed.unitId || null,
            fileName: parsed.fileName,
            fileUrl: parsed.fileUrl,
            fileSize: parsed.fileSize,
            mimeType: parsed.mimeType,
            category: parsed.category,
            description: parsed.description || null,
            accessLevel: parsed.accessLevel,
            uploaderId: req.user.id,
          },
          include: {
            uploader: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
            unit: {
              select: {
                id: true,
                unitNumber: true,
              },
            },
          },
        })
      )
    );

    const documentsWithActions = createdDocuments.map(doc => withDocumentActionUrls(doc, req));

    const cacheUserIds = collectPropertyCacheUserIds(property, req.user.id);
    await invalidatePropertyCaches(cacheUserIds);

    res.status(201).json({
      success: true,
      documents: documentsWithActions,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendError(res, 400, 'Validation error', ErrorCodes.VAL_VALIDATION_ERROR, error.flatten());
    }

    console.error('Create property document error:', error);
    const userMessage = process.env.NODE_ENV === 'production'
      ? 'Failed to create document records. Please try again.'
      : `Failed to create document records: ${error.message}`;
    return sendError(res, 500, userMessage, ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

// DELETE /properties/:id/documents/:documentId - Delete a document
propertyDocumentsRouter.delete('/:documentId', requireRole('PROPERTY_MANAGER'), requireActiveSubscription, async (req, res) => {
  const propertyId = req.params.id;
  const documentId = req.params.documentId;

  try {
    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      include: {
        owners: { select: { ownerId: true } },
      },
    });

    const access = ensurePropertyAccess(property, req.user, { requireWrite: true });
    if (!access.allowed) {
      const errorCode = access.status === 404 ? ErrorCodes.RES_PROPERTY_NOT_FOUND : ErrorCodes.ACC_PROPERTY_ACCESS_DENIED;
      return sendError(res, access.status, access.reason, errorCode);
    }

    const document = await prisma.propertyDocument.findFirst({
      where: {
        id: documentId,
        propertyId,
      },
    });

    if (!document) {
      return sendError(res, 404, 'Document not found', ErrorCodes.RES_PROPERTY_NOT_FOUND);
    }

    // Clean up physical file from disk or Cloudinary BEFORE deleting DB record
    // This prevents orphaned files if the file deletion fails
    if (document.fileUrl) {
      try {
        await deleteImage(document.fileUrl);
      } catch (fileDeleteError) {
        console.error('Failed to delete file, keeping database record:', fileDeleteError);
        const userMessage = process.env.NODE_ENV === 'production'
          ? 'Failed to delete document file. Please try again later.'
          : `Failed to delete document file: ${fileDeleteError.message}`;
        return sendError(res, 500, userMessage, ErrorCodes.ERR_INTERNAL_SERVER);
      }
    }

    // Only delete the database record after successful file deletion
    // Wrap in transaction to prevent race conditions where file is deleted but DB record remains
    await prisma.$transaction(async (tx) => {
      await tx.propertyDocument.delete({
        where: { id: documentId },
      });
    }, {
      isolationLevel: 'Serializable',
      maxWait: 5000,
      timeout: 30000,
    });

    const cacheUserIds = collectPropertyCacheUserIds(property, req.user.id);
    await invalidatePropertyCaches(cacheUserIds);

    res.json({ success: true });
  } catch (error) {
    console.error('Delete property document error:', error);
    const userMessage = process.env.NODE_ENV === 'production'
      ? 'Failed to delete document. Please try again.'
      : `Failed to delete document: ${error.message}`;
    return sendError(res, 500, userMessage, ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

// Property Notes helpers
const propertyNoteInclude = {
  author: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      role: true,
    },
  },
};

const buildPropertyNoteResponse = (note) => {
  if (!note) return note;

  const authorName = [note.author?.firstName, note.author?.lastName]
    .filter(Boolean)
    .join(' ')
    .trim();

  return {
    id: note.id,
    propertyId: note.propertyId,
    authorId: note.authorId,
    content: note.content,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    author: note.author
      ? {
          id: note.author.id,
          name: authorName || note.author.email || 'Unknown User',
          role: note.author.role || 'UNKNOWN',
        }
      : null,
  };
};

// GET /properties/:id/notes - List all notes for a property
// Only property managers and owners can view notes (not tenants)
propertyNotesRouter.get('/', requireRole('PROPERTY_MANAGER', 'OWNER'), async (req, res) => {
  const propertyId = req.params.id;

  try {
    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      include: {
        owners: { select: { ownerId: true } },
      },
    });

    const access = ensurePropertyAccess(property, req.user);
    if (!access.allowed) {
      const errorCode = access.status === 404 ? ErrorCodes.RES_PROPERTY_NOT_FOUND : ErrorCodes.ACC_PROPERTY_ACCESS_DENIED;
      return sendError(res, access.status, access.reason, errorCode);
    }

    // Check if PropertyNote model exists (migration might not have run)
    if (!prisma.propertyNote) {
      console.error('PropertyNote model not found - database migration may not have been run');
      return sendError(res, 503, 'Notes feature is temporarily unavailable', ErrorCodes.ERR_INTERNAL_SERVER);
    }

    const notes = await prisma.propertyNote.findMany({
      where: { propertyId },
      include: propertyNoteInclude,
      orderBy: { createdAt: 'desc' },
    });

    const formattedNotes = notes.map(buildPropertyNoteResponse);

    res.json({
      success: true,
      data: formattedNotes,
      notes: formattedNotes,
    });
  } catch (error) {
    console.error('Get property notes error:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      code: error.code,
      stack: error.stack
    });

    // Provide more helpful error message if it's a Prisma error
    if (error.code === 'P2021') {
      return sendError(res, 503, 'Notes feature is not yet available. Please contact support.', ErrorCodes.ERR_INTERNAL_SERVER);
    }

    return sendError(res, 500, 'Failed to fetch property notes', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

// POST /properties/:id/notes - Create a new note
// Any property manager can add notes (doesn't have to be the assigned manager)
propertyNotesRouter.post('/', requireRole('PROPERTY_MANAGER'), async (req, res) => {
  const propertyId = req.params.id;

  try {
    const { content } = propertyNoteCreateSchema.parse(req.body);

    // Verify the property exists (but don't require write access for notes)
    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      include: {
        owners: { select: { ownerId: true } },
      },
    });

    if (!property) {
      return sendError(res, 404, 'Property not found', ErrorCodes.RES_PROPERTY_NOT_FOUND);
    }

    // Check if PropertyNote model exists (migration might not have run)
    if (!prisma.propertyNote) {
      console.error('PropertyNote model not found - database migration may not have been run');
      return sendError(res, 503, 'Notes feature is temporarily unavailable', ErrorCodes.ERR_INTERNAL_SERVER);
    }

    const note = await prisma.propertyNote.create({
      data: {
        propertyId,
        authorId: req.user.id,
        content,
      },
      include: propertyNoteInclude,
    });

    const cacheUserIds = collectPropertyCacheUserIds(property, req.user.id);
    await invalidatePropertyCaches(cacheUserIds);

    const formattedNote = buildPropertyNoteResponse(note);

    res.status(201).json({
      success: true,
      data: formattedNote,
      note: formattedNote,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendError(res, 400, 'Validation error', ErrorCodes.VAL_VALIDATION_ERROR, error.flatten());
    }

    console.error('Create property note error:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      code: error.code,
    });

    // Provide more helpful error message if it's a Prisma error
    if (error.code === 'P2021') {
      return sendError(res, 503, 'Notes feature is not yet available. Please contact support.', ErrorCodes.ERR_INTERNAL_SERVER);
    }

    return sendError(res, 500, 'Failed to create property note', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

// PATCH /properties/:id/notes/:noteId - Update an existing note
propertyNotesRouter.patch('/:noteId', requireRole('PROPERTY_MANAGER'), requireActiveSubscription, async (req, res) => {
  const { id: propertyId, noteId } = req.params;

  try {
    const { content } = propertyNoteUpdateSchema.parse(req.body);

    // Verify property exists
    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      include: {
        owners: { select: { ownerId: true } },
      },
    });

    if (!property) {
      return sendError(res, 404, 'Property not found', ErrorCodes.RES_PROPERTY_NOT_FOUND);
    }

    const existingNote = await prisma.propertyNote.findUnique({
      where: { id: noteId },
      include: propertyNoteInclude,
    });

    if (!existingNote || existingNote.propertyId !== propertyId) {
      return sendError(res, 404, 'Note not found', ErrorCodes.RES_NOT_FOUND);
    }

    // Only the note author can edit it
    if (existingNote.authorId !== req.user.id) {
      return sendError(res, 403, 'You can only edit your own notes', ErrorCodes.ACC_ACCESS_DENIED);
    }

    const updatedNote = await prisma.propertyNote.update({
      where: { id: noteId },
      data: { content },
      include: propertyNoteInclude,
    });

    const cacheUserIds = collectPropertyCacheUserIds(property, req.user.id);
    await invalidatePropertyCaches(cacheUserIds);

    const formattedNote = buildPropertyNoteResponse(updatedNote);

    res.json({
      success: true,
      data: formattedNote,
      note: formattedNote,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendError(res, 400, 'Validation error', ErrorCodes.VAL_VALIDATION_ERROR, error.flatten());
    }

    console.error('Update property note error:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      code: error.code,
    });

    // Provide more helpful error message if it's a Prisma error
    if (error.code === 'P2021') {
      return sendError(res, 503, 'Notes feature is not yet available. Please contact support.', ErrorCodes.ERR_INTERNAL_SERVER);
    }

    return sendError(res, 500, 'Failed to update property note', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

// DELETE /properties/:id/notes/:noteId - Remove a note
propertyNotesRouter.delete('/:noteId', requireRole('PROPERTY_MANAGER'), requireActiveSubscription, async (req, res) => {
  const { id: propertyId, noteId } = req.params;

  try {
    // Verify property exists
    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      include: {
        owners: { select: { ownerId: true } },
      },
    });

    if (!property) {
      return sendError(res, 404, 'Property not found', ErrorCodes.RES_PROPERTY_NOT_FOUND);
    }

    const existingNote = await prisma.propertyNote.findUnique({
      where: { id: noteId },
    });

    if (!existingNote || existingNote.propertyId !== propertyId) {
      return sendError(res, 404, 'Note not found', ErrorCodes.RES_NOT_FOUND);
    }

    // Only the note author can delete it
    if (existingNote.authorId !== req.user.id) {
      return sendError(res, 403, 'You can only delete your own notes', ErrorCodes.ACC_ACCESS_DENIED);
    }

    await prisma.propertyNote.delete({
      where: { id: noteId },
    });

    const cacheUserIds = collectPropertyCacheUserIds(property, req.user.id);
    await invalidatePropertyCaches(cacheUserIds);

    res.json({ success: true });
  } catch (error) {
    console.error('Delete property note error:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      code: error.code,
    });

    // Provide more helpful error message if it's a Prisma error
    if (error.code === 'P2021') {
      return sendError(res, 503, 'Notes feature is not yet available. Please contact support.', ErrorCodes.ERR_INTERNAL_SERVER);
    }

    const userMessage = process.env.NODE_ENV === 'production'
      ? 'Failed to delete note. Please try again.'
      : `Failed to delete note: ${error.message}`;
    return sendError(res, 500, userMessage, ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

// POST /properties/:id/owners - Assign existing owner to property
router.post('/:id/owners', requireRole('PROPERTY_MANAGER'), async (req, res) => {
  const propertyId = req.params.id;
  const assignOwnerSchema = z.object({
    ownerId: z.string(),
    ownershipPercentage: z.number().min(0).max(100).optional(),
  });

  try {
    const { ownerId, ownershipPercentage } = assignOwnerSchema.parse(req.body);

    // Verify property exists and user has access
    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      include: {
        owners: { select: { ownerId: true } },
      },
    });

    const access = ensurePropertyAccess(property, req.user, { requireWrite: true });
    if (!access.allowed) {
      const errorCode = access.status === 404 ? ErrorCodes.RES_PROPERTY_NOT_FOUND : ErrorCodes.ACC_PROPERTY_ACCESS_DENIED;
      return sendError(res, access.status, access.reason, errorCode);
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

    // Check if owner is already assigned to this property
    const existingOwner = await prisma.propertyOwner.findUnique({
      where: {
        propertyId_ownerId: {
          propertyId,
          ownerId,
        },
      },
    });

    if (existingOwner) {
      return sendError(res, 400, 'Owner is already assigned to this property', ErrorCodes.RES_ALREADY_EXISTS);
    }

    // Create property owner relationship
    const propertyOwner = await prisma.propertyOwner.create({
      data: {
        propertyId,
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

    // Invalidate caches
    const cacheUserIds = collectPropertyCacheUserIds(property, req.user.id);
    await invalidatePropertyCaches([...cacheUserIds, ownerId]);

    res.status(201).json({
      success: true,
      propertyOwner,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendError(res, 400, 'Validation error', ErrorCodes.VAL_VALIDATION_ERROR, error.flatten());
    }

    console.error('Assign property owner error:', error);
    return sendError(res, 500, 'Failed to assign owner to property', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

// DELETE /properties/:id/owners/:ownerId - Remove owner from property
router.delete('/:id/owners/:ownerId', requireRole('PROPERTY_MANAGER'), async (req, res) => {
  const { id: propertyId, ownerId } = req.params;

  try {
    // Verify property exists and user has access
    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      include: {
        owners: { select: { ownerId: true } },
      },
    });

    const access = ensurePropertyAccess(property, req.user, { requireWrite: true });
    if (!access.allowed) {
      const errorCode = access.status === 404 ? ErrorCodes.RES_PROPERTY_NOT_FOUND : ErrorCodes.ACC_PROPERTY_ACCESS_DENIED;
      return sendError(res, access.status, access.reason, errorCode);
    }

    // Check if owner is assigned to this property
    const propertyOwner = await prisma.propertyOwner.findUnique({
      where: {
        propertyId_ownerId: {
          propertyId,
          ownerId,
        },
      },
    });

    if (!propertyOwner) {
      return sendError(res, 404, 'Owner is not assigned to this property', ErrorCodes.RES_NOT_FOUND);
    }

    // Delete property owner relationship
    await prisma.propertyOwner.delete({
      where: {
        propertyId_ownerId: {
          propertyId,
          ownerId,
        },
      },
    });

    // Invalidate caches
    const cacheUserIds = collectPropertyCacheUserIds(property, req.user.id);
    await invalidatePropertyCaches([...cacheUserIds, ownerId]);

    res.json({
      success: true,
    });
  } catch (error) {
    console.error('Remove property owner error:', error);
    return sendError(res, 500, 'Failed to remove owner from property', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

router._test = {
  propertySchema,
  propertyUpdateSchema,
  unitSchema,
  propertyImageCreateSchema,
  propertyImageUpdateSchema,
  propertyImageReorderSchema,
  applyLegacyAliases,
  toPublicProperty,
  normalizePropertyImages,
  resolvePrimaryImageUrl,
  applyPreferredPrimaryImageSelection,
  determineNewImagePrimaryFlag,
  extractImageUrlFromInput,
  normaliseSubmittedPropertyImages,
  buildPropertyImageRecords,
  STATUS_VALUES,
  invalidatePropertyCaches,
  propertyListSelect,
  collectPropertyCacheUserIds,
  propertyImagesRouter,
  propertyDocumentsRouter,
  propertyNotesRouter,
  maybeHandleImageUpload,
  isMultipartRequest,
  propertyNoteCreateSchema,
  propertyNoteUpdateSchema,
};

export default router;
