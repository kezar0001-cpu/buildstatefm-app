/**
 * Unified Upload Service
 * =====================
 *
 * A simplified, clean upload service that replaces the fragmented upload logic.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - AWS_ACCESS_KEY_ID: AWS access key
 * - AWS_SECRET_ACCESS_KEY: AWS secret key
 * - AWS_REGION: AWS region (e.g., 'ap-southeast-2')
 * - AWS_S3_BUCKET_NAME: S3 bucket name
 * - AWS_CLOUDFRONT_DOMAIN: (Optional) CloudFront domain for CDN URLs
 *
 * FILE KEY CONVENTION:
 * uploads/{entityType}/{entityId}/{uuid-v4}.{ext}
 *
 * URL GENERATION:
 * - If AWS_CLOUDFRONT_DOMAIN is set: https://{domain}/{key}
 * - Otherwise: https://{bucket}.s3.{region}.amazonaws.com/{key}
 */

import { S3Client, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import path from 'path';
import sharp from 'sharp';

// ============================================================================
// CONFIGURATION
// ============================================================================

const config = {
  aws: {
    region: process.env.AWS_REGION,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    bucketName: process.env.AWS_S3_BUCKET_NAME,
    cloudFrontDomain: process.env.AWS_CLOUDFRONT_DOMAIN,
  },
  limits: {
    image: {
      maxSize: 10 * 1024 * 1024, // 10MB
      allowedTypes: [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/webp',
        'image/gif',
        'image/heic',
        'image/heif',
      ],
    },
    document: {
      maxSize: 20 * 1024 * 1024, // 20MB
      allowedTypes: [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain',
        'text/csv',
        // Also allow images in documents
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/webp',
      ],
    },
  },
  compression: {
    maxWidth: 2000,
    maxHeight: 2000,
    quality: 85,
  },
};

// Check if S3 is configured
const isS3Configured = !!(
  config.aws.region &&
  config.aws.accessKeyId &&
  config.aws.secretAccessKey &&
  config.aws.bucketName
);

// Initialize S3 client
let s3Client = null;
if (isS3Configured) {
  s3Client = new S3Client({
    region: config.aws.region,
    credentials: {
      accessKeyId: config.aws.accessKeyId,
      secretAccessKey: config.aws.secretAccessKey,
    },
  });
  console.log('✅ [UnifiedUpload] S3 configured');
  console.log(`   Bucket: ${config.aws.bucketName}`);
  console.log(`   Region: ${config.aws.region}`);
  if (config.aws.cloudFrontDomain) {
    console.log(`   CloudFront: ${config.aws.cloudFrontDomain}`);
  }
} else {
  console.warn('⚠️  [UnifiedUpload] S3 not configured - uploads will fail');
}

// ============================================================================
// ERROR TYPES
// ============================================================================

export const UploadErrorTypes = {
  RATE_LIMITED: 'RATE_LIMITED',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UPLOAD_FAILED: 'UPLOAD_FAILED',
  STORAGE_ERROR: 'STORAGE_ERROR',
  NOT_CONFIGURED: 'NOT_CONFIGURED',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  INVALID_TYPE: 'INVALID_TYPE',
  NOT_FOUND: 'NOT_FOUND',
};

// ============================================================================
// ENTITY TYPES - Valid entity types for uploads
// ============================================================================

export const EntityTypes = {
  PROPERTY: 'property',
  UNIT: 'unit',
  INSPECTION: 'inspection',
  JOB: 'job',
  DOCUMENT: 'document',
  PROFILE: 'profile',
  SERVICE_REQUEST: 'service-request',
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get the file extension from a filename
 */
function getExtension(filename) {
  const ext = path.extname(filename || '').toLowerCase();
  return ext || '';
}

/**
 * Get content type from extension or provided mimetype
 */
function getContentType(filename, mimetype) {
  if (mimetype) return mimetype;

  const ext = getExtension(filename);
  const types = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.heic': 'image/heic',
    '.heif': 'image/heif',
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.txt': 'text/plain',
    '.csv': 'text/csv',
  };

  return types[ext] || 'application/octet-stream';
}

/**
 * Check if a mimetype is an image
 */
function isImageType(mimetype) {
  return mimetype?.startsWith('image/') || false;
}

/**
 * Generate S3 key for a file
 * Format: uploads/{entityType}/{entityId}/{uuid}.{ext}
 */
function generateKey(entityType, entityId, filename) {
  const uuid = randomUUID();
  const ext = getExtension(filename);
  return `uploads/${entityType}/${entityId}/${uuid}${ext}`;
}

/**
 * Get the public URL for an S3 key
 */
export function getPublicUrl(key) {
  if (config.aws.cloudFrontDomain) {
    return `https://${config.aws.cloudFrontDomain}/${key}`;
  }
  return `https://${config.aws.bucketName}.s3.${config.aws.region}.amazonaws.com/${key}`;
}

/**
 * Extract S3 key from a URL (CloudFront or S3)
 */
export function extractKeyFromUrl(url) {
  if (!url || typeof url !== 'string') return null;

  // CloudFront URL
  if (config.aws.cloudFrontDomain && url.includes(config.aws.cloudFrontDomain)) {
    const match = url.match(new RegExp(`https://${config.aws.cloudFrontDomain.replace(/\./g, '\\.')}/(.+?)(?:\\?|$)`));
    return match ? match[1] : null;
  }

  // Direct S3 URL
  const s3Match = url.match(/\.s3\.[^.]+\.amazonaws\.com\/(.+?)(?:\?|$)/);
  if (s3Match) return s3Match[1];

  // Bucket name in URL
  if (config.aws.bucketName && url.includes(`${config.aws.bucketName}.s3.`)) {
    const match = url.match(new RegExp(`${config.aws.bucketName}\\.s3\\.[^.]+\\.amazonaws\\.com/(.+?)(?:\\?|$)`));
    return match ? match[1] : null;
  }

  return null;
}

// ============================================================================
// IMAGE COMPRESSION
// ============================================================================

/**
 * Compress an image buffer if needed
 * @param {Buffer} buffer - Image buffer
 * @param {string} mimetype - Image mimetype
 * @returns {Promise<{buffer: Buffer, mimetype: string}>}
 */
async function compressImage(buffer, mimetype) {
  try {
    const image = sharp(buffer);
    const metadata = await image.metadata();

    // Skip if already small enough
    if (buffer.length < 500 * 1024) { // Less than 500KB
      return { buffer, mimetype };
    }

    let processed = image;

    // Resize if too large
    if (metadata.width > config.compression.maxWidth || metadata.height > config.compression.maxHeight) {
      processed = processed.resize(config.compression.maxWidth, config.compression.maxHeight, {
        fit: 'inside',
        withoutEnlargement: true,
      });
    }

    // Convert to JPEG for best compression (unless PNG with transparency)
    let outputMimetype = mimetype;
    let outputBuffer;

    if (mimetype === 'image/png' && metadata.hasAlpha) {
      outputBuffer = await processed.png({ quality: config.compression.quality }).toBuffer();
    } else if (mimetype === 'image/webp') {
      outputBuffer = await processed.webp({ quality: config.compression.quality }).toBuffer();
    } else {
      outputBuffer = await processed.jpeg({ quality: config.compression.quality }).toBuffer();
      outputMimetype = 'image/jpeg';
    }

    // Only use compressed if actually smaller
    if (outputBuffer.length < buffer.length) {
      return { buffer: outputBuffer, mimetype: outputMimetype };
    }

    return { buffer, mimetype };
  } catch (error) {
    console.warn('[UnifiedUpload] Compression failed, using original:', error.message);
    return { buffer, mimetype };
  }
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate a file for upload
 * @param {Object} file - File object with buffer, mimetype, originalname, size
 * @param {string} fileType - 'image' or 'document'
 * @returns {{valid: boolean, error?: string, errorType?: string}}
 */
export function validateFile(file, fileType = 'image') {
  const limits = fileType === 'document' ? config.limits.document : config.limits.image;

  if (!file || !file.buffer) {
    return { valid: false, error: 'No file provided', errorType: UploadErrorTypes.VALIDATION_ERROR };
  }

  if (file.size > limits.maxSize) {
    const maxMB = Math.round(limits.maxSize / 1024 / 1024);
    return {
      valid: false,
      error: `File too large. Maximum size is ${maxMB}MB`,
      errorType: UploadErrorTypes.FILE_TOO_LARGE,
    };
  }

  const mimetype = file.mimetype?.toLowerCase();
  if (!limits.allowedTypes.includes(mimetype)) {
    return {
      valid: false,
      error: `Invalid file type: ${mimetype}. Allowed types: ${limits.allowedTypes.join(', ')}`,
      errorType: UploadErrorTypes.INVALID_TYPE,
    };
  }

  return { valid: true };
}

// ============================================================================
// CORE UPLOAD FUNCTION
// ============================================================================

/**
 * Upload a single file to S3
 *
 * @param {Object} options
 * @param {Buffer} options.buffer - File buffer
 * @param {string} options.mimetype - File mimetype
 * @param {string} options.originalname - Original filename
 * @param {number} options.size - File size in bytes
 * @param {string} options.entityType - Entity type (property, unit, inspection, etc.)
 * @param {string} options.entityId - Entity ID
 * @param {string} [options.category] - Optional category (e.g., 'hero', 'gallery', 'lease')
 * @param {string} [options.uploaderId] - User ID of uploader
 * @param {boolean} [options.compress=true] - Whether to compress images
 *
 * @returns {Promise<{
 *   success: boolean,
 *   file?: {
 *     key: string,
 *     url: string,
 *     size: number,
 *     mimeType: string,
 *     originalName: string,
 *     entityType: string,
 *     entityId: string,
 *     category?: string
 *   },
 *   error?: string,
 *   errorType?: string
 * }>}
 */
export async function uploadFile({
  buffer,
  mimetype,
  originalname,
  size,
  entityType,
  entityId,
  category,
  uploaderId,
  compress = true,
}) {
  // Check S3 configuration
  if (!isS3Configured || !s3Client) {
    return {
      success: false,
      error: 'Storage not configured',
      errorType: UploadErrorTypes.NOT_CONFIGURED,
    };
  }

  // Validate entity type
  const validEntityTypes = Object.values(EntityTypes);
  if (!validEntityTypes.includes(entityType)) {
    return {
      success: false,
      error: `Invalid entityType. Must be one of: ${validEntityTypes.join(', ')}`,
      errorType: UploadErrorTypes.VALIDATION_ERROR,
    };
  }

  // Validate entity ID
  if (!entityId) {
    return {
      success: false,
      error: 'entityId is required',
      errorType: UploadErrorTypes.VALIDATION_ERROR,
    };
  }

  try {
    let finalBuffer = buffer;
    let finalMimetype = mimetype;
    let finalSize = size;
    let finalFilename = originalname;

    // Compress images if enabled
    if (compress && isImageType(mimetype)) {
      const compressed = await compressImage(buffer, mimetype);
      finalBuffer = compressed.buffer;
      finalMimetype = compressed.mimetype;
      finalSize = compressed.buffer.length;

      // Update filename extension if mimetype changed
      if (compressed.mimetype !== mimetype) {
        const newExt = compressed.mimetype === 'image/jpeg' ? '.jpg' :
                       compressed.mimetype === 'image/webp' ? '.webp' :
                       compressed.mimetype === 'image/png' ? '.png' : '';
        if (newExt) {
          finalFilename = originalname.replace(/\.[^.]+$/, newExt);
        }
      }
    }

    // Generate S3 key
    const key = generateKey(entityType, entityId, finalFilename);

    // Upload to S3
    const command = new PutObjectCommand({
      Bucket: config.aws.bucketName,
      Key: key,
      Body: finalBuffer,
      ContentType: getContentType(finalFilename, finalMimetype),
    });

    await s3Client.send(command);

    const url = getPublicUrl(key);

    console.log(`✅ [UnifiedUpload] Uploaded: ${entityType}/${entityId} -> ${key} (${Math.round(finalSize/1024)}KB)`);

    return {
      success: true,
      file: {
        key,
        url,
        size: finalSize,
        mimeType: finalMimetype,
        originalName: originalname,
        entityType,
        entityId,
        category: category || null,
      },
    };
  } catch (error) {
    console.error('[UnifiedUpload] Upload failed:', error);
    return {
      success: false,
      error: error.message || 'Upload failed',
      errorType: UploadErrorTypes.STORAGE_ERROR,
    };
  }
}

// ============================================================================
// DELETE FUNCTION
// ============================================================================

/**
 * Delete a file from S3
 *
 * @param {string} keyOrUrl - S3 key or full URL
 * @returns {Promise<{success: boolean, error?: string, errorType?: string}>}
 */
export async function deleteFile(keyOrUrl) {
  if (!isS3Configured || !s3Client) {
    return {
      success: false,
      error: 'Storage not configured',
      errorType: UploadErrorTypes.NOT_CONFIGURED,
    };
  }

  // Extract key if URL provided
  let key = keyOrUrl;
  if (keyOrUrl.startsWith('http')) {
    key = extractKeyFromUrl(keyOrUrl);
    if (!key) {
      return {
        success: false,
        error: 'Could not extract S3 key from URL',
        errorType: UploadErrorTypes.VALIDATION_ERROR,
      };
    }
  }

  try {
    const command = new DeleteObjectCommand({
      Bucket: config.aws.bucketName,
      Key: key,
    });

    await s3Client.send(command);

    console.log(`✅ [UnifiedUpload] Deleted: ${key}`);

    return { success: true };
  } catch (error) {
    console.error('[UnifiedUpload] Delete failed:', error);
    return {
      success: false,
      error: error.message || 'Delete failed',
      errorType: UploadErrorTypes.STORAGE_ERROR,
    };
  }
}

// ============================================================================
// CHECK FILE EXISTS
// ============================================================================

/**
 * Check if a file exists in S3
 *
 * @param {string} keyOrUrl - S3 key or full URL
 * @returns {Promise<boolean>}
 */
export async function fileExists(keyOrUrl) {
  if (!isS3Configured || !s3Client) {
    return false;
  }

  let key = keyOrUrl;
  if (keyOrUrl.startsWith('http')) {
    key = extractKeyFromUrl(keyOrUrl);
    if (!key) return false;
  }

  try {
    const command = new HeadObjectCommand({
      Bucket: config.aws.bucketName,
      Key: key,
    });
    await s3Client.send(command);
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  uploadFile,
  deleteFile,
  fileExists,
  validateFile,
  getPublicUrl,
  extractKeyFromUrl,
  isS3Configured: () => isS3Configured,
  EntityTypes,
  UploadErrorTypes,
};
