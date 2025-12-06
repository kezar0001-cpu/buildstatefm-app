import express from 'express';
import multer from 'multer';
import { requireAuth, requireActiveSubscription } from '../middleware/auth.js';
import { sendError, ErrorCodes } from '../utils/errorHandler.js';
import { optimizeImage, isImage, getOptimizationSettings } from '../utils/imageOptimization.js';
import {
  createUploadMiddleware,
  createDocumentUploadMiddleware,
  getUploadedFileUrl,
  getUploadedFileUrls,
  isUsingCloudStorage,
} from '../services/uploadService.js';
import { uploadResponsiveImage, getPrimaryImageUrl, buildSrcSet } from '../services/responsiveImageService.js';
import { uploadRateLimiter } from '../middleware/redisRateLimiter.js';
import {
  getCloudFrontImageUrl,
  getResponsiveCloudFrontUrls,
  buildCloudFrontSrcSet,
  isCloudFrontConfigured,
} from '../services/cloudFrontImageService.js';

const router = express.Router();

// Use Redis-backed rate limiting (replaces in-memory Map-based rate limiting)
const rateLimitUpload = uploadRateLimiter;

// Create upload middleware (uses S3 if configured, local storage otherwise)
const upload = createUploadMiddleware();
const documentUpload = createDocumentUploadMiddleware();

// Create specific upload middleware for inspection photos
// Restricted to: image/jpeg, image/png, image/webp; max 10MB
const inspectionPhotoUpload = createUploadMiddleware({
  allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  maxFileSize: 10 * 1024 * 1024, // 10MB
  maxFiles: 20,
});

/**
 * POST /uploads/single
 * FormData field name must be: "file"
 * Returns: { url: "/uploads/<filename>" }
 * Requires authentication
 */
router.post('/single', requireAuth, requireActiveSubscription, rateLimitUpload, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return sendError(res, 400, 'No file uploaded', ErrorCodes.FILE_NO_FILE_UPLOADED);
    }

    // Optimize image if it's an image file
    if (isImage(req.file.mimetype)) {
      try {
        const settings = getOptimizationSettings(req.file.mimetype);
        if (settings) {
          const optimized = await optimizeImage(req.file.buffer, settings);
          if (optimized.buffer && !optimized.error) {
            req.file.buffer = optimized.buffer;
            req.file.size = optimized.buffer.length;
            if (optimized.format && optimized.format !== 'original') {
              const ext = optimized.format === 'webp' ? '.webp' : 
                         optimized.format === 'jpeg' ? '.jpg' : 
                         optimized.format === 'png' ? '.png' : '';
              if (ext) {
                req.file.originalname = req.file.originalname.replace(/\.[^.]+$/, ext);
              }
            }
          }
        }
      } catch (optError) {
        console.warn('Image optimization failed, using original:', optError.message);
      }
    }

    const url = getUploadedFileUrl(req.file);
    const storageType = isUsingCloudStorage() ? 'AWS S3' : 'local';
    console.log(`✅ Uploaded to ${storageType} by user ${req.user.id}: ${req.file.originalname} -> ${url}`);
    res.status(201).json({ success: true, url });
  } catch (error) {
    console.error('Upload error:', error);
    return sendError(res, 500, 'Upload failed', ErrorCodes.FILE_UPLOAD_FAILED);
  }
});

/**
 * POST /uploads/multiple
 * FormData field name must be: "files"
 * Returns: { urls: ["/uploads/<filename1>", "/uploads/<filename2>"] }
 * Requires authentication
 */
router.post('/multiple', requireAuth, requireActiveSubscription, rateLimitUpload, upload.array('files', 50), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return sendError(res, 400, 'No files uploaded', ErrorCodes.FILE_NO_FILE_UPLOADED);
    }

    // Optimize images before upload
    for (const file of req.files) {
      if (isImage(file.mimetype)) {
        try {
          const settings = getOptimizationSettings(file.mimetype);
          if (settings) {
            const optimized = await optimizeImage(file.buffer, settings);
            if (optimized.buffer && !optimized.error) {
              file.buffer = optimized.buffer;
              file.size = optimized.buffer.length;
              if (optimized.format && optimized.format !== 'original') {
                const ext = optimized.format === 'webp' ? '.webp' : 
                           optimized.format === 'jpeg' ? '.jpg' : 
                           optimized.format === 'png' ? '.png' : '';
                if (ext) {
                  file.originalname = file.originalname.replace(/\.[^.]+$/, ext);
                }
              }
            }
          }
        } catch (optError) {
          console.warn(`Image optimization failed for ${file.originalname}:`, optError.message);
        }
      }
    }

    const urls = getUploadedFileUrls(req.files);
    const storageType = isUsingCloudStorage() ? 'AWS S3' : 'local';
    console.log(`✅ Uploaded ${req.files.length} files to ${storageType} by user ${req.user.id}`);
    res.status(201).json({ success: true, urls });
  } catch (error) {
    console.error('Multiple upload error:', error);
    return sendError(res, 500, 'Upload failed', ErrorCodes.FILE_UPLOAD_FAILED);
  }
});

/**
 * POST /uploads/documents
 * FormData field name must be: "files"
 * Returns: { urls: ["/uploads/<filename1>", "/uploads/<filename2>"] }
 * Supports: PDF, Word, Excel, Text, Images (up to 50MB each)
 * Requires authentication
 */
router.post('/documents', requireAuth, rateLimitUpload, documentUpload.array('files', 20), (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return sendError(res, 400, 'No files uploaded', ErrorCodes.FILE_NO_FILE_UPLOADED);
    }

    const urls = getUploadedFileUrls(req.files);
    const storageType = isUsingCloudStorage() ? 'AWS S3' : 'local';
    console.log(`✅ Uploaded ${req.files.length} document(s) to ${storageType} by user ${req.user.id}`);
    res.status(201).json({ success: true, urls });
  } catch (error) {
    console.error('Document upload error:', error);
    return sendError(res, 500, 'Document upload failed', ErrorCodes.FILE_UPLOAD_FAILED);
  }
});

/**
 * POST /uploads/inspection-photos
 * FormData field name must be: "photos"
 * Returns: { urls: ["/uploads/<filename1>", "/uploads/<filename2>"] }
 * Supports: JPEG, PNG, WebP (up to 10MB each, max 20 files)
 * Requires authentication
 */
router.post('/inspection-photos', requireAuth, rateLimitUpload, inspectionPhotoUpload.array('photos', 20), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return sendError(res, 400, 'No photos uploaded', ErrorCodes.FILE_NO_FILE_UPLOADED);
    }

    // Optimize inspection photos before upload
    for (const file of req.files) {
      if (isImage(file.mimetype)) {
        try {
          const settings = getOptimizationSettings(file.mimetype);
          if (settings) {
            const optimized = await optimizeImage(file.buffer, settings);
            if (optimized.buffer && !optimized.error) {
              file.buffer = optimized.buffer;
              file.size = optimized.buffer.length;
              if (optimized.format && optimized.format !== 'original') {
                const ext = optimized.format === 'webp' ? '.webp' : 
                           optimized.format === 'jpeg' ? '.jpg' : 
                           optimized.format === 'png' ? '.png' : '';
                if (ext) {
                  file.originalname = file.originalname.replace(/\.[^.]+$/, ext);
                }
              }
            }
          }
        } catch (optError) {
          console.warn(`Image optimization failed for ${file.originalname}:`, optError.message);
        }
      }
    }

    const urls = getUploadedFileUrls(req.files);
    const storageType = isUsingCloudStorage() ? 'AWS S3' : 'local';
    console.log(`✅ Uploaded ${req.files.length} inspection photo(s) to ${storageType} by user ${req.user.id}`);
    res.status(201).json({ success: true, urls });
  } catch (error) {
    console.error('Inspection photo upload error:', error);
    return sendError(res, 500, 'Inspection photo upload failed', ErrorCodes.FILE_UPLOAD_FAILED);
  }
});

/**
 * POST /uploads/responsive-image
 * FormData field name must be: "image"
 * Returns: {
 *   success: true,
 *   variants: {
 *     'thumbnail-jpg': 'url',
 *     'thumbnail-webp': 'url',
 *     'medium-jpg': 'url',
 *     'medium-webp': 'url',
 *     'original-jpg': 'url',
 *     'original-webp': 'url'
 *   },
 *   primaryUrl: 'url',
 *   srcSet: {
 *     jpg: 'srcset string',
 *     webp: 'srcset string'
 *   }
 * }
 * Processes images into multiple size variants (thumbnail, medium, original) and formats (JPEG, WebP)
 * Requires authentication
 */
const memoryStorage = multer.memoryStorage();
const responsiveImageUpload = multer({
  storage: memoryStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedMimeTypes.includes(file.mimetype?.toLowerCase())) {
      cb(null, true);
    } else {
      cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'Only image files are allowed'));
    }
  },
});

router.post('/responsive-image', requireAuth, rateLimitUpload, responsiveImageUpload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return sendError(res, 400, 'No image uploaded', ErrorCodes.FILE_NO_FILE_UPLOADED);
    }

    const { buffer, originalname } = req.file;
    const folder = req.body.folder || 'properties';

    // Process and upload responsive image variants
    const variants = await uploadResponsiveImage(buffer, originalname, folder);

    // Build response with all variant URLs and helper metadata
    const response = {
      success: true,
      variants,
      primaryUrl: getPrimaryImageUrl(variants),
      srcSet: {
        jpg: buildSrcSet(variants, 'jpg'),
        webp: buildSrcSet(variants, 'webp'),
      },
    };

    const storageType = isUsingCloudStorage() ? 'AWS S3' : 'local';
    console.log(`✅ Uploaded responsive image to ${storageType} by user ${req.user.id}: ${originalname}`);
    console.log(`   Generated ${Object.keys(variants).length} variants`);

    res.status(201).json(response);
  } catch (error) {
    console.error('Responsive image upload error:', error);
    return sendError(res, 500, 'Responsive image upload failed', ErrorCodes.FILE_UPLOAD_FAILED);
  }
});

/**
 * POST /uploads/cloudfront-url
 * Generate CloudFront URL with image transformation query parameters
 * Body: {
 *   s3Key: 'properties/image.jpg',
 *   width: 800,
 *   height: 600,
 *   format: 'webp',
 *   quality: 85,
 *   fit: 'cover'
 * }
 * Returns: { url: 'https://cloudfront.net/properties/image.jpg?w=800&h=600&f=webp&q=85&fit=cover' }
 */
router.post('/cloudfront-url', requireAuth, (req, res) => {
  try {
    if (!isCloudFrontConfigured()) {
      return sendError(res, 400, 'CloudFront is not configured', ErrorCodes.CONFIGURATION_ERROR);
    }

    const { s3Key, width, height, format, quality, fit } = req.body;

    if (!s3Key) {
      return sendError(res, 400, 's3Key is required', ErrorCodes.VALIDATION_ERROR);
    }

    const url = getCloudFrontImageUrl(s3Key, { width, height, format, quality, fit });

    res.json({ success: true, url });
  } catch (error) {
    console.error('CloudFront URL generation error:', error);
    return sendError(res, 500, 'Failed to generate CloudFront URL', ErrorCodes.INTERNAL_SERVER_ERROR);
  }
});

/**
 * POST /uploads/cloudfront-responsive-urls
 * Generate responsive CloudFront URLs for an image
 * Body: {
 *   s3Key: 'properties/image.jpg',
 *   format: 'webp'
 * }
 * Returns: {
 *   thumbnail: 'url',
 *   medium: 'url',
 *   original: 'url',
 *   srcSet: 'srcset string'
 * }
 */
router.post('/cloudfront-responsive-urls', requireAuth, (req, res) => {
  try {
    if (!isCloudFrontConfigured()) {
      return sendError(res, 400, 'CloudFront is not configured', ErrorCodes.CONFIGURATION_ERROR);
    }

    const { s3Key, format = 'jpg' } = req.body;

    if (!s3Key) {
      return sendError(res, 400, 's3Key is required', ErrorCodes.VALIDATION_ERROR);
    }

    const urls = getResponsiveCloudFrontUrls(s3Key, format);
    const srcSet = buildCloudFrontSrcSet(s3Key, format);

    res.json({
      success: true,
      urls,
      srcSet,
    });
  } catch (error) {
    console.error('CloudFront responsive URLs generation error:', error);
    return sendError(res, 500, 'Failed to generate CloudFront URLs', ErrorCodes.INTERNAL_SERVER_ERROR);
  }
});

/** GET /uploads/ping -> { ok: true }  (sanity check) */
router.get('/ping', (_req, res) => res.json({ ok: true }));

export default router;