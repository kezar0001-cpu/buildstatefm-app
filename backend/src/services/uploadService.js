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

// Cloudinary storage configuration
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

/**
 * Extract the URL from an uploaded file
 * For Cloudinary: returns the secure_url
 * For local: returns /uploads/filename
 */
export const getUploadedFileUrl = (file) => {
  if (!file) {
    console.warn('[Upload] getUploadedFileUrl called with null/undefined file');
    return null;
  }

  // Cloudinary file - check multiple properties for robustness
  // multer-storage-cloudinary can set these properties:
  // - file.path (should be secure_url)
  // - file.url or file.secure_url (from Cloudinary response)
  if (isCloudinaryConfigured) {
    // First try file.path (standard multer-storage-cloudinary)
    if (file.path && typeof file.path === 'string' && file.path.startsWith('http')) {
      console.log(`[Upload] Cloudinary URL from file.path: ${file.path.substring(0, 100)}...`);
      return file.path;
    }

    // Fallback to secure_url if available
    if (file.secure_url && typeof file.secure_url === 'string') {
      console.log(`[Upload] Cloudinary URL from file.secure_url: ${file.secure_url.substring(0, 100)}...`);
      return file.secure_url;
    }

    // Fallback to url if available
    if (file.url && typeof file.url === 'string' && file.url.startsWith('http')) {
      console.log(`[Upload] Cloudinary URL from file.url: ${file.url.substring(0, 100)}...`);
      return file.url;
    }

    // If we got here with Cloudinary configured, something is wrong
    console.error('[Upload] Cloudinary is configured but no URL found in file object:', {
      hasPath: !!file.path,
      pathValue: file.path,
      hasSecureUrl: !!file.secure_url,
      hasUrl: !!file.url,
      filename: file.filename,
      fieldname: file.fieldname,
    });
    return null;
  }

  // Local file
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

  console.warn('[Upload] Could not extract URL from file object:', {
    hasPath: !!file.path,
    hasFilename: !!file.filename,
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
 * Delete an image from Cloudinary or local storage
 */
export const deleteImage = async (imageUrl) => {
  if (!imageUrl) return;

  try {
    // Cloudinary URL
    if (imageUrl.startsWith('http') && imageUrl.includes('cloudinary.com')) {
      // Extract public_id from Cloudinary URL
      const matches = imageUrl.match(/\/agentfm\/properties\/([^/.]+)/);
      if (matches && matches[1]) {
        const publicId = `agentfm/properties/${matches[1]}`;
        await cloudinary.uploader.destroy(publicId);
        console.log(`Deleted image from Cloudinary: ${publicId}`);
      }
    }
    // Local file (support modern and legacy paths)
    else if (isLocalUploadUrl(imageUrl)) {
      const filename = extractLocalUploadFilename(imageUrl);
      if (filename) {
        const filePath = path.join(UPLOAD_DIR, filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log(`Deleted local file: ${filename}`);
        }
      }
    }
  } catch (error) {
    console.error('Error deleting image:', error);
    // Don't throw - deletion failure shouldn't break the application
  }
};

export const isUsingCloudStorage = () => isCloudinaryConfigured;

export { cloudinary };
