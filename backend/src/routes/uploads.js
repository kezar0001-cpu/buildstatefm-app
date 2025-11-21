import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { sendError, ErrorCodes } from '../utils/errorHandler.js';
import {
  createUploadMiddleware,
  createDocumentUploadMiddleware,
  getUploadedFileUrl,
  getUploadedFileUrls,
  isUsingCloudStorage,
} from '../services/uploadService.js';

const router = express.Router();

// Bug Fix #6: Add rate limiting for uploads to prevent abuse
const uploadRateLimits = new Map();
const UPLOAD_RATE_LIMIT = 30; // Max 30 uploads per window
const UPLOAD_RATE_WINDOW = 60 * 1000; // 1 minute window

const checkUploadRateLimit = (userId) => {
  const now = Date.now();
  const userLimits = uploadRateLimits.get(userId) || { count: 0, windowStart: now };

  if (now - userLimits.windowStart > UPLOAD_RATE_WINDOW) {
    userLimits.count = 0;
    userLimits.windowStart = now;
  }

  userLimits.count++;
  uploadRateLimits.set(userId, userLimits);

  // Clean up old entries to prevent memory leak
  if (uploadRateLimits.size > 10000) {
    const threshold = now - UPLOAD_RATE_WINDOW;
    for (const [key, value] of uploadRateLimits.entries()) {
      if (value.windowStart < threshold) {
        uploadRateLimits.delete(key);
      }
    }
  }

  return userLimits.count <= UPLOAD_RATE_LIMIT;
};

const rateLimitUpload = (req, res, next) => {
  if (!req.user?.id) {
    return next();
  }

  if (!checkUploadRateLimit(req.user.id)) {
    return sendError(
      res,
      429,
      `Too many uploads. Maximum ${UPLOAD_RATE_LIMIT} uploads per minute.`,
      ErrorCodes.RATE_LIMIT_EXCEEDED
    );
  }

  next();
};

// Create upload middleware (uses Cloudinary if configured, local storage otherwise)
const upload = createUploadMiddleware();
const documentUpload = createDocumentUploadMiddleware();

/**
 * POST /uploads/single
 * FormData field name must be: "file"
 * Returns: { url: "/uploads/<filename>" }
 * Requires authentication
 */
router.post('/single', requireAuth, rateLimitUpload, upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return sendError(res, 400, 'No file uploaded', ErrorCodes.FILE_NO_FILE_UPLOADED);
    }

    const url = getUploadedFileUrl(req.file);
    const storageType = isUsingCloudStorage() ? 'Cloudinary' : 'local';
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
router.post('/multiple', requireAuth, rateLimitUpload, upload.array('files', 50), (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return sendError(res, 400, 'No files uploaded', ErrorCodes.FILE_NO_FILE_UPLOADED);
    }

    const urls = getUploadedFileUrls(req.files);
    const storageType = isUsingCloudStorage() ? 'Cloudinary' : 'local';
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
    const storageType = isUsingCloudStorage() ? 'Cloudinary' : 'local';
    console.log(`✅ Uploaded ${req.files.length} document(s) to ${storageType} by user ${req.user.id}`);
    res.status(201).json({ success: true, urls });
  } catch (error) {
    console.error('Document upload error:', error);
    return sendError(res, 500, 'Document upload failed', ErrorCodes.FILE_UPLOAD_FAILED);
  }
});

/** GET /uploads/ping -> { ok: true }  (sanity check) */
router.get('/ping', (_req, res) => res.json({ ok: true }));

export default router;