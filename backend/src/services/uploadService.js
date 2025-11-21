import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';

// Configure Cloudinary if environment variables are set
const isCloudinaryConfigured = !!(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

if (isCloudinaryConfigured) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  console.log('✅ Cloudinary configured for persistent image storage');
} else {
  console.warn('⚠️  Cloudinary not configured - using local filesystem (not recommended for production)');
  console.warn('   Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET to enable cloud storage');
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

// Cloudinary storage configuration for images
const cloudinaryStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'agentfm/properties',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    transformation: [
      {
        width: 2000,
        height: 2000,
        crop: 'limit',
        quality: 'auto:good',
        fetch_format: 'auto',
      }
    ],
    // Use original filename with UUID for uniqueness
    public_id: (_req, file) => {
      const base = path
        .basename(file.originalname || 'file', path.extname(file.originalname || ''))
        .toLowerCase()
        .replace(/[^a-z0-9-_]+/g, '-')
        .slice(0, 40) || 'file';
      const unique = randomUUID();
      return `${base}-${unique}`;
    },
  },
});

// Cloudinary storage configuration for documents
const cloudinaryDocumentStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'agentfm/documents',
    allowed_formats: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt', 'csv', 'jpg', 'jpeg', 'png', 'gif', 'webp'],
    resource_type: 'raw', // Store as raw files (PDFs, DOCX, etc.) - CRITICAL for correct URL format
    access_mode: 'public', // CRITICAL: Make files publicly accessible (default is authenticated for raw files)
    // Use original filename with UUID for uniqueness - MUST include extension for raw files
    public_id: (_req, file) => {
      const ext = path.extname(file.originalname || '');
      const nameWithoutExt = path.basename(file.originalname || 'document', ext);
      const sanitizedName = nameWithoutExt
        .replace(/[\/\\.\x00]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9-_]+/g, '-')
        .slice(0, 40) || 'document';
      const unique = randomUUID();
      // For raw files, include the extension in the public_id
      return `${sanitizedName}-${unique}${ext}`;
    },
  },
});

// Create multer upload instance based on configuration
export const createUploadMiddleware = (options = {}) => {
  const storage = isCloudinaryConfigured ? cloudinaryStorage : localDiskStorage;

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
  const storage = isCloudinaryConfigured ? cloudinaryDocumentStorage : localDiskStorage;

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
 * For Cloudinary: returns the secure_url
 * For local: returns /api/uploads/filename
 *
 * This function detects the storage type from the file object properties,
 * not from configuration. This allows mixed storage scenarios where some
 * uploads use Cloudinary and others use local disk storage.
 */
export const getUploadedFileUrl = (file) => {
  if (!file) {
    console.warn('[Upload] getUploadedFileUrl called with null/undefined file');
    return null;
  }

  // Try to detect Cloudinary upload by checking for HTTP URLs in file properties
  // Cloudinary uploads will have file.path, file.url, or file.secure_url as HTTP URLs

  // Check file.path (standard multer-storage-cloudinary)
  if (file.path && typeof file.path === 'string' && file.path.startsWith('http')) {
    console.log(`[Upload] Cloudinary URL from file.path: ${file.path.substring(0, 100)}...`);
    console.log(`[Upload] Full Cloudinary file object:`, JSON.stringify({
      path: file.path,
      filename: file.filename,
      originalname: file.originalname,
      mimetype: file.mimetype,
      resource_type: file.resource_type,
      format: file.format,
    }, null, 2));
    return file.path;
  }

  // Check secure_url property
  if (file.secure_url && typeof file.secure_url === 'string') {
    console.log(`[Upload] Cloudinary URL from file.secure_url: ${file.secure_url.substring(0, 100)}...`);
    return file.secure_url;
  }

  // Check url property (must be HTTP URL)
  if (file.url && typeof file.url === 'string' && file.url.startsWith('http')) {
    console.log(`[Upload] Cloudinary URL from file.url: ${file.url.substring(0, 100)}...`);
    return file.url;
  }

  // If no Cloudinary properties found, assume local file upload
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
    hasPath: !!file.path,
    pathValue: file.path,
    pathType: typeof file.path,
    hasSecureUrl: !!file.secure_url,
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
 * Delete an image or document from Cloudinary or local storage
 */
export const deleteImage = async (imageUrl) => {
  if (!imageUrl) return;

  try {
    // Cloudinary URL
    if (imageUrl.startsWith('http') && imageUrl.includes('cloudinary.com')) {
      // Extract public_id from Cloudinary URL - handle both properties and documents folders
      // For images: capture without extension (agentfm/properties/filename-uuid)
      const propertiesMatch = imageUrl.match(/\/agentfm\/properties\/([^/.]+)/);
      // For documents (raw files): capture WITH extension (agentfm/documents/filename-uuid.pdf)
      const documentsMatch = imageUrl.match(/\/agentfm\/documents\/([^/]+?)(?:\?|$)/);

      if (propertiesMatch && propertiesMatch[1]) {
        const publicId = `agentfm/properties/${propertiesMatch[1]}`;
        await cloudinary.uploader.destroy(publicId);
        console.log(`Deleted image from Cloudinary: ${publicId}`);
      } else if (documentsMatch && documentsMatch[1]) {
        const publicId = `agentfm/documents/${documentsMatch[1]}`;
        // For documents (non-image files), need to specify resource_type
        await cloudinary.uploader.destroy(publicId, { resource_type: 'raw' });
        console.log(`Deleted document from Cloudinary: ${publicId}`);
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

export const isUsingCloudStorage = () => isCloudinaryConfigured;

export { cloudinary };
