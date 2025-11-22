import multer from 'multer';
import multerS3 from 'multer-s3';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import {
  s3Client,
  bucketName,
  isUsingS3,
  generateS3Key,
  getContentType,
  deleteFromS3,
  extractS3KeyFromUrl,
} from './s3Service.js';

// Check if S3 is configured
const isCloudStorageConfigured = isUsingS3();

if (isCloudStorageConfigured) {
  console.log('✅ AWS S3 configured for persistent storage');
} else {
  console.warn('⚠️  AWS S3 not configured - using local filesystem (not recommended for production)');
  console.warn('   Set AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_S3_BUCKET_NAME to enable cloud storage');
}

// Local storage configuration (fallback for development)
const UPLOAD_DIR = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const DEFAULT_LOCAL_UPLOADS_PUBLIC_PATH = '/api/uploads';
const LEGACY_LOCAL_UPLOAD_PREFIXES = ['/uploads'];

function normalisePublicPath(pathValue) {
  const value = typeof pathValue === 'string' ? pathValue.trim() : '';
  if (!value) {
    return DEFAULT_LOCAL_UPLOADS_PUBLIC_PATH;
  }

  const withLeadingSlash = value.startsWith('/') ? value : `/${value}`;
  const collapsed = withLeadingSlash.replace(/\/+/g, '/');
  const withoutTrailingSlash = collapsed.replace(/\/+$/, '');
  return withoutTrailingSlash || DEFAULT_LOCAL_UPLOADS_PUBLIC_PATH;
}

export const LOCAL_UPLOADS_PUBLIC_PATH = normalisePublicPath(process.env.UPLOADS_PUBLIC_PATH);
const LOCAL_UPLOAD_PREFIXES = Array.from(new Set([
  DEFAULT_LOCAL_UPLOADS_PUBLIC_PATH,
  LOCAL_UPLOADS_PUBLIC_PATH,
  ...LEGACY_LOCAL_UPLOAD_PREFIXES,
]));

function sanitiseFilename(value) {
  if (!value) return null;
  return String(value).replace(/^\/+/, '');
}

export function isLocalUploadUrl(url) {
  if (typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed) return false;

  return LOCAL_UPLOAD_PREFIXES.some((prefix) =>
    trimmed === prefix || trimmed.startsWith(`${prefix}/`)
  );
}

export function extractLocalUploadFilename(url) {
  if (!isLocalUploadUrl(url)) return null;
  const trimmed = url.trim();

  for (const prefix of LOCAL_UPLOAD_PREFIXES) {
    if (trimmed === prefix) {
      return '';
    }

    const matchPrefix = `${prefix}/`;
    if (trimmed.startsWith(matchPrefix)) {
      return trimmed.slice(matchPrefix.length);
    }
  }

  return null;
}

const localDiskStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '');
    const base =
      path
        .basename(file.originalname || 'file', ext)
        .toLowerCase()
        .replace(/[^a-z0-9-_]+/g, '-')
        .slice(0, 40) || 'file';
    const unique = randomUUID();
    cb(null, `${base}-${unique}${ext}`);
  },
});

// S3 storage configuration for images
const s3ImageStorage = multerS3({
  s3: s3Client,
  bucket: bucketName,
  acl: 'public-read',
  contentType: multerS3.AUTO_CONTENT_TYPE,
  metadata: (_req, file, cb) => {
    cb(null, { originalName: file.originalname });
  },
  key: (_req, file, cb) => {
    const key = generateS3Key('properties', file.originalname, true);
    cb(null, key);
  },
});

// S3 storage configuration for documents
const s3DocumentStorage = multerS3({
  s3: s3Client,
  bucket: bucketName,
  acl: 'public-read',
  contentType: multerS3.AUTO_CONTENT_TYPE,
  metadata: (_req, file, cb) => {
    cb(null, { originalName: file.originalname });
  },
  key: (_req, file, cb) => {
    const key = generateS3Key('documents', file.originalname, true);
    cb(null, key);
  },
});

// Create multer upload instance based on configuration
export const createUploadMiddleware = (options = {}) => {
  const storage = isCloudStorageConfigured ? s3ImageStorage : localDiskStorage;

  const allowedMimeTypes = (options.allowedMimeTypes ?? [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
  ]).map((type) => type.toLowerCase());

  const allowedExtensions = options.allowedExtensions
    ? options.allowedExtensions.map((ext) => ext.toLowerCase())
    : null;

  return multer({
    storage: storage,
    limits: {
      fileSize: options.maxFileSize || 10 * 1024 * 1024, // 10MB default
      files: options.maxFiles || 50,
    },
    fileFilter: (_req, file, cb) => {
      const mimetype = file.mimetype?.toLowerCase();
      if (!mimetype || !allowedMimeTypes.includes(mimetype)) {
        return cb(
          new multer.MulterError(
            'LIMIT_UNEXPECTED_FILE',
            'Only image files (JPEG, PNG, GIF, WebP) are allowed'
          )
        );
      }

      if (allowedExtensions) {
        const extension = path.extname(file.originalname || '').toLowerCase();
        if (!extension || !allowedExtensions.includes(extension)) {
          return cb(
            new multer.MulterError(
              'LIMIT_UNEXPECTED_FILE',
              `Only files with extensions ${allowedExtensions.join(', ')} are allowed`
            )
          );
        }
      }

      cb(null, true);
    },
  });
};

// Create multer upload instance for documents (PDFs, Word docs, Excel, etc.)
export const createDocumentUploadMiddleware = (options = {}) => {
  const storage = isCloudStorageConfigured ? s3DocumentStorage : localDiskStorage;

  const allowedMimeTypes = (options.allowedMimeTypes ?? [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv',
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
  ]).map((type) => type.toLowerCase());

  return multer({
    storage: storage,
    limits: {
      fileSize: options.maxFileSize || 50 * 1024 * 1024, // 50MB default for documents
      files: options.maxFiles || 10,
    },
    fileFilter: (_req, file, cb) => {
      const mimetype = file.mimetype?.toLowerCase();
      if (!mimetype || !allowedMimeTypes.includes(mimetype)) {
        return cb(
          new multer.MulterError(
            'LIMIT_UNEXPECTED_FILE',
            'file'
          )
        );
      }

      cb(null, true);
    },
  });
};

/**
 * Extract the URL from an uploaded file
 * For S3: returns the location URL from multer-s3
 * For local: returns /api/uploads/filename
 *
 * This function detects the storage type from the file object properties,
 * not from configuration. This allows mixed storage scenarios where some
 * uploads use S3 and others use local disk storage.
 */
export const getUploadedFileUrl = (file) => {
  if (!file) {
    console.warn('[Upload] getUploadedFileUrl called with null/undefined file');
    return null;
  }

  // Check for S3 upload (multer-s3 sets file.location)
  if (file.location && typeof file.location === 'string' && file.location.startsWith('http')) {
    console.log(`[Upload] S3 URL from file.location: ${file.location.substring(0, 100)}...`);
    console.log(`[Upload] Full S3 file object:`, JSON.stringify({
      location: file.location,
      key: file.key,
      bucket: file.bucket,
      filename: file.filename,
      originalname: file.originalname,
      mimetype: file.mimetype,
    }, null, 2));
    return file.location;
  }

  // Check file.path for HTTP URLs (may be set by custom storage)
  if (file.path && typeof file.path === 'string' && file.path.startsWith('http')) {
    console.log(`[Upload] Cloud URL from file.path: ${file.path.substring(0, 100)}...`);
    return file.path;
  }

  // Check url property (must be HTTP URL)
  if (file.url && typeof file.url === 'string' && file.url.startsWith('http')) {
    console.log(`[Upload] Cloud URL from file.url: ${file.url.substring(0, 100)}...`);
    return file.url;
  }

  // If no cloud storage properties found, assume local file upload
  // Local uploads have file.filename set by multer disk storage
  if (file.filename) {
    const filename = sanitiseFilename(file.filename);
    if (!filename) {
      console.warn('[Upload] Local upload missing filename metadata:', file);
      return null;
    }

    const localUrl = `${LOCAL_UPLOADS_PUBLIC_PATH}/${filename}`.replace(/\/+/g, '/');
    console.log(`[Upload] Local file URL: ${localUrl}`);
    return localUrl;
  }

  // If we got here, the file object is missing expected properties
  console.error('[Upload] Could not extract URL from file object:', {
    hasLocation: !!file.location,
    hasPath: !!file.path,
    pathValue: file.path,
    pathType: typeof file.path,
    hasUrl: !!file.url,
    hasFilename: !!file.filename,
    filename: file.filename,
    fieldname: file.fieldname,
    keys: Object.keys(file),
  });
  return null;
};

/**
 * Extract URLs from multiple uploaded files
 */
export const getUploadedFileUrls = (files) => {
  if (!Array.isArray(files)) return [];
  return files.map(getUploadedFileUrl).filter(Boolean);
};

/**
 * Delete an image or document from S3 or local storage
 */
export const deleteImage = async (imageUrl) => {
  if (!imageUrl) return;

  try {
    // S3 URL - check if it's an S3 URL
    if (imageUrl.startsWith('http') && imageUrl.includes('.amazonaws.com')) {
      const s3Key = extractS3KeyFromUrl(imageUrl);
      if (s3Key) {
        await deleteFromS3(s3Key);
        console.log(`Deleted file from S3: ${s3Key}`);
      }
    }
    // CloudFront URL (if configured)
    else if (imageUrl.startsWith('http') && process.env.AWS_CLOUDFRONT_DOMAIN && imageUrl.includes(process.env.AWS_CLOUDFRONT_DOMAIN)) {
      const s3Key = extractS3KeyFromUrl(imageUrl);
      if (s3Key) {
        await deleteFromS3(s3Key);
        console.log(`Deleted file from S3 via CloudFront URL: ${s3Key}`);
      }
    }
    // Local file (support modern and legacy paths)
    else if (isLocalUploadUrl(imageUrl)) {
      const filename = extractLocalUploadFilename(imageUrl);
      if (filename) {
        const filePath = path.join(UPLOAD_DIR, filename);
        if (fs.existsSync(filePath)) {
          await fs.promises.unlink(filePath);
          console.log(`Deleted local file: ${filename}`);
        }
      }
    }
  } catch (error) {
    console.error('Error deleting image/document:', error);
    // Throw the error so caller can handle it appropriately
    throw error;
  }
};

export const isUsingCloudStorage = () => isCloudStorageConfigured;
