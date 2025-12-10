/**
 * Unified Upload Routes (v2)
 * ==========================
 *
 * A clean, simplified upload API that replaces the complex legacy upload system.
 *
 * ENDPOINTS:
 * ----------
 * POST /api/v2/uploads        - Upload a single file
 * DELETE /api/v2/uploads/:key - Delete a file by key
 * GET /api/v2/uploads/health  - Health check
 *
 * RATE LIMITING:
 * -------------
 * - Default: 10 uploads per 30 seconds per user
 * - Configured via Redis using REDIS_URL env var
 * - When rate limited: Returns 429 with retryAfterSeconds
 *
 * RESPONSE FORMAT:
 * ---------------
 * Success:
 * {
 *   success: true,
 *   file: {
 *     key: "uploads/property/abc123/uuid.jpg",
 *     url: "https://cdn.example.com/uploads/property/abc123/uuid.jpg",
 *     size: 123456,
 *     mimeType: "image/jpeg",
 *     originalName: "photo.jpg",
 *     entityType: "property",
 *     entityId: "abc123",
 *     category: "gallery"
 *   }
 * }
 *
 * Error:
 * {
 *   success: false,
 *   error: "RATE_LIMITED" | "VALIDATION_ERROR" | "UPLOAD_FAILED" | "STORAGE_ERROR",
 *   message: "Human readable error message",
 *   retryAfterSeconds?: 30  // Only for RATE_LIMITED
 * }
 */

import express from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth.js';
import { createRedisRateLimiter } from '../middleware/redisRateLimiter.js';
import {
  uploadFile,
  deleteFile,
  validateFile,
  EntityTypes,
  UploadErrorTypes,
} from '../services/unifiedUploadService.js';

const router = express.Router();

// ============================================================================
// RATE LIMITING
// ============================================================================

/**
 * Upload rate limiter configuration
 * - 200 uploads per 60 seconds per user (generous for batch uploads)
 * - Falls back to memory-based limiting if Redis unavailable
 */
const uploadRateLimiter = createRedisRateLimiter({
  keyPrefix: 'v2_upload_rate_limit',
  points: 200,
  duration: 60,
  errorMessage: 'Too many uploads. Maximum 200 uploads per minute. Please wait a moment before uploading more files.',
});

// ============================================================================
// MULTER CONFIGURATION
// ============================================================================

/**
 * Memory storage - files are processed in memory
 * This allows us to compress images before uploading to S3
 */
const storage = multer.memoryStorage();

/**
 * File filter - validates file type before processing
 */
const fileFilter = (req, file, cb) => {
  const entityType = req.body.entityType || 'property';

  // Determine if this is a document or image upload
  const isDocument = entityType === 'document' || req.body.fileType === 'document';

  // Get allowed types
  const imageTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/heic',
    'image/heif',
  ];

  const documentTypes = [
    ...imageTypes,
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv',
  ];

  const allowedTypes = isDocument ? documentTypes : imageTypes;
  const mimetype = file.mimetype?.toLowerCase();

  if (allowedTypes.includes(mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type: ${mimetype}`), false);
  }
};

/**
 * Multer upload middleware
 * - Single file upload
 * - Max 20MB (covers both images and documents)
 */
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB max
    files: 1,
  },
});

// ============================================================================
// ERROR HANDLER
// ============================================================================

/**
 * Multer error handler middleware
 */
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: UploadErrorTypes.FILE_TOO_LARGE,
        message: 'File too large. Maximum size is 20MB.',
      });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        error: UploadErrorTypes.VALIDATION_ERROR,
        message: 'Only one file can be uploaded at a time.',
      });
    }
    return res.status(400).json({
      success: false,
      error: UploadErrorTypes.VALIDATION_ERROR,
      message: err.message,
    });
  }

  if (err) {
    return res.status(400).json({
      success: false,
      error: UploadErrorTypes.VALIDATION_ERROR,
      message: err.message,
    });
  }

  next();
};

// ============================================================================
// ROUTES
// ============================================================================

/**
 * POST /api/v2/uploads
 *
 * Upload a single file.
 *
 * Request:
 * - Content-Type: multipart/form-data
 * - Fields:
 *   - file: The file to upload (required)
 *   - entityType: property | unit | inspection | job | document | profile | service-request (required)
 *   - entityId: UUID of the entity (required)
 *   - category: Optional category string (e.g., 'hero', 'gallery', 'lease')
 *   - fileType: 'image' | 'document' (optional, defaults to 'image')
 *
 * Response (201 Created):
 * {
 *   success: true,
 *   file: {
 *     key: string,
 *     url: string,
 *     size: number,
 *     mimeType: string,
 *     originalName: string,
 *     entityType: string,
 *     entityId: string,
 *     category?: string
 *   }
 * }
 *
 * Error Response (4xx/5xx):
 * {
 *   success: false,
 *   error: "RATE_LIMITED" | "VALIDATION_ERROR" | "UPLOAD_FAILED" | "STORAGE_ERROR",
 *   message: string,
 *   retryAfterSeconds?: number
 * }
 */
router.post(
  '/',
  requireAuth,
  uploadRateLimiter,
  upload.single('file'),
  handleMulterError,
  async (req, res) => {
    try {
      // Check if file was uploaded
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: UploadErrorTypes.VALIDATION_ERROR,
          message: 'No file provided. Send file in "file" field.',
        });
      }

      // Get form fields
      const { entityType, entityId, category, fileType } = req.body;

      // Validate required fields
      if (!entityType) {
        return res.status(400).json({
          success: false,
          error: UploadErrorTypes.VALIDATION_ERROR,
          message: 'entityType is required',
        });
      }

      if (!entityId) {
        return res.status(400).json({
          success: false,
          error: UploadErrorTypes.VALIDATION_ERROR,
          message: 'entityId is required',
        });
      }

      // Validate entityType
      const validEntityTypes = Object.values(EntityTypes);
      if (!validEntityTypes.includes(entityType)) {
        return res.status(400).json({
          success: false,
          error: UploadErrorTypes.VALIDATION_ERROR,
          message: `Invalid entityType. Must be one of: ${validEntityTypes.join(', ')}`,
        });
      }

      // Validate file
      const isDocument = entityType === 'document' || fileType === 'document';
      const validation = validateFile(req.file, isDocument ? 'document' : 'image');

      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          error: validation.errorType,
          message: validation.error,
        });
      }

      // Upload file
      const result = await uploadFile({
        buffer: req.file.buffer,
        mimetype: req.file.mimetype,
        originalname: req.file.originalname,
        size: req.file.size,
        entityType,
        entityId,
        category,
        uploaderId: req.user?.id,
        compress: !isDocument, // Don't compress documents
      });

      if (!result.success) {
        const statusCode =
          result.errorType === UploadErrorTypes.VALIDATION_ERROR ? 400 :
          result.errorType === UploadErrorTypes.NOT_CONFIGURED ? 503 : 500;

        return res.status(statusCode).json({
          success: false,
          error: result.errorType,
          message: result.error,
        });
      }

      // Success response
      return res.status(201).json({
        success: true,
        file: result.file,
      });
    } catch (error) {
      console.error('[UploadV2] Unexpected error:', error);
      return res.status(500).json({
        success: false,
        error: UploadErrorTypes.UPLOAD_FAILED,
        message: 'An unexpected error occurred during upload',
      });
    }
  }
);

/**
 * DELETE /api/v2/uploads/:key(*)
 *
 * Delete a file by its S3 key.
 *
 * The key can be URL-encoded if it contains special characters.
 *
 * Response (200 OK):
 * {
 *   success: true
 * }
 *
 * Error Response (4xx/5xx):
 * {
 *   success: false,
 *   error: "VALIDATION_ERROR" | "STORAGE_ERROR",
 *   message: string
 * }
 */
router.delete('/*', requireAuth, async (req, res) => {
  try {
    // Get the key from the URL path (everything after /api/v2/uploads/)
    let key = req.params[0];

    if (!key) {
      return res.status(400).json({
        success: false,
        error: UploadErrorTypes.VALIDATION_ERROR,
        message: 'File key is required',
      });
    }

    // URL decode the key
    key = decodeURIComponent(key);

    // Delete the file
    const result = await deleteFile(key);

    if (!result.success) {
      const statusCode =
        result.errorType === UploadErrorTypes.VALIDATION_ERROR ? 400 :
        result.errorType === UploadErrorTypes.NOT_CONFIGURED ? 503 : 500;

      return res.status(statusCode).json({
        success: false,
        error: result.errorType,
        message: result.error,
      });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('[UploadV2] Delete error:', error);
    return res.status(500).json({
      success: false,
      error: UploadErrorTypes.STORAGE_ERROR,
      message: 'Failed to delete file',
    });
  }
});

/**
 * GET /api/v2/uploads/health
 *
 * Health check endpoint.
 *
 * Response:
 * {
 *   ok: true,
 *   storage: "s3" | "not_configured",
 *   timestamp: string
 * }
 */
router.get('/health', (req, res) => {
  const isS3Configured = !!(
    process.env.AWS_REGION &&
    process.env.AWS_ACCESS_KEY_ID &&
    process.env.AWS_SECRET_ACCESS_KEY &&
    process.env.AWS_S3_BUCKET_NAME
  );

  return res.json({
    ok: true,
    storage: isS3Configured ? 's3' : 'not_configured',
    timestamp: new Date().toISOString(),
  });
});

export default router;
