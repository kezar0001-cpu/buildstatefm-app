import { S3Client, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import path from 'path';
import fs from 'fs/promises';

// Configure S3 client
const isS3Configured = !!(
  process.env.AWS_REGION &&
  process.env.AWS_ACCESS_KEY_ID &&
  process.env.AWS_SECRET_ACCESS_KEY &&
  process.env.AWS_S3_BUCKET_NAME
);

let s3Client = null;
let bucketName = null;
let cloudFrontDomain = null;

if (isS3Configured) {
  s3Client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });
  bucketName = process.env.AWS_S3_BUCKET_NAME;
  cloudFrontDomain = process.env.AWS_CLOUDFRONT_DOMAIN; // Optional: for CDN
  console.log('✅ AWS S3 configured for persistent storage');
  console.log(`   Bucket: ${bucketName}`);
  console.log(`   Region: ${process.env.AWS_REGION}`);
  if (cloudFrontDomain) {
    console.log(`   CloudFront: ${cloudFrontDomain}`);
  }
} else {
  console.warn('⚠️  AWS S3 not configured - using local filesystem (not recommended for production)');
  console.warn('   Set AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_S3_BUCKET_NAME to enable cloud storage');
}

/**
 * Generate a sanitized filename with UUID
 */
export function generateS3Key(folder, originalFilename, includeExtension = true) {
  const ext = path.extname(originalFilename || '');
  const base = path
    .basename(originalFilename || 'file', ext)
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .slice(0, 40) || 'file';
  const unique = randomUUID();

  if (includeExtension && ext) {
    return `${folder}/${base}-${unique}${ext}`;
  }
  return `${folder}/${base}-${unique}`;
}

/**
 * Get content type from file extension and mimetype
 */
export function getContentType(filename, mimetype) {
  if (mimetype) {
    return mimetype;
  }

  const ext = path.extname(filename).toLowerCase();
  const contentTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.txt': 'text/plain',
    '.csv': 'text/csv',
  };

  return contentTypes[ext] || 'application/octet-stream';
}

/**
 * Get S3 URL for a key
 * @param {string} key - S3 key
 * @returns {string} Public URL
 */
function getS3Url(key) {
  if (cloudFrontDomain) {
    return `https://${cloudFrontDomain}/${key}`;
  }
  return `https://${bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
}

/**
 * Upload a file to S3
 * @param {string} folder - S3 folder/prefix (e.g., 'properties', 'documents', 'blog')
 * @param {Buffer|Stream} fileContent - File content
 * @param {string} originalFilename - Original filename
 * @param {string} mimetype - File mimetype
 * @param {object} options - Additional options (contentDisposition, metadata, etc.)
 * @returns {Promise<{url: string, key: string}>}
 */
export async function uploadToS3(folder, fileContent, originalFilename, mimetype, options = {}) {
  try {
    const key = generateS3Key(folder, originalFilename, true);
    const contentType = getContentType(originalFilename, mimetype);

    const params = {
      Bucket: bucketName,
      Key: key,
      Body: fileContent,
      ContentType: contentType,
      ...(options.contentDisposition && { ContentDisposition: options.contentDisposition }),
      ...(options.metadata && { Metadata: options.metadata })
    };

    const command = new PutObjectCommand(params);
    await s3Client.send(command);

    const url = getS3Url(key);
    return { url, key };
  } catch (error) {
    console.error('Error uploading to S3:', error);
    throw error;
  }
}

/**
 * Upload a file from disk to S3
 * @param {string} folder - S3 folder/prefix
 * @param {string} filePath - Local file path
 * @param {string} originalFilename - Original filename
 * @param {string} mimetype - File mimetype
 * @returns {Promise<{url: string, key: string}>}
 */
export async function uploadFileToS3(folder, filePath, originalFilename, mimetype) {
  const fileContent = await fs.readFile(filePath);
  return uploadToS3(folder, fileContent, originalFilename, mimetype);
}

/**
 * Delete a file from S3
 * @param {string} key - S3 key (path within bucket)
 * @returns {Promise<void>}
 */
export async function deleteFromS3(key) {
  if (!isS3Configured) {
    console.warn('S3 not configured, skipping delete');
    return;
  }

  try {
    const command = new DeleteObjectCommand({
      Bucket: bucketName,
      Key: key,
    });
    await s3Client.send(command);
    console.log(`✅ Deleted from S3: ${key}`);
  } catch (error) {
    console.error('Error deleting from S3:', error);
    throw error;
  }
}

/**
 * Extract S3 key from URL
 * Handles both CloudFront and direct S3 URLs
 * @param {string} url - The S3 or CloudFront URL
 * @returns {string|null} - The S3 key or null if not an S3 URL
 */
export function extractS3KeyFromUrl(url) {
  if (!url || typeof url !== 'string') {
    return null;
  }

  // CloudFront URL: https://d123456.cloudfront.net/folder/file.jpg
  if (cloudFrontDomain && url.includes(cloudFrontDomain)) {
    const match = url.match(new RegExp(`https://${cloudFrontDomain.replace('.', '\\.')}/(.+?)(?:\\?|$)`));
    return match ? match[1] : null;
  }

  // Direct S3 URL: https://bucket-name.s3.region.amazonaws.com/folder/file.jpg
  // Or: https://s3.region.amazonaws.com/bucket-name/folder/file.jpg
  const s3Match = url.match(/\.s3\.[^.]+\.amazonaws\.com\/(.+?)(?:\?|$)/);
  if (s3Match && s3Match[1]) {
    return s3Match[1];
  }

  // Check if it matches the configured bucket name
  if (bucketName && url.includes(`${bucketName}.s3.`)) {
    const match = url.match(new RegExp(`${bucketName}\\.s3\\.[^.]+\\.amazonaws\\.com/(.+?)(?:\\?|$)`));
    return match ? match[1] : null;
  }

  return null;
}

/**
 * Check if a file exists in S3
 * @param {string} key - S3 key
 * @returns {Promise<boolean>}
 */
export async function fileExistsInS3(key) {
  if (!isS3Configured) {
    return false;
  }

  try {
    const command = new HeadObjectCommand({
      Bucket: bucketName,
      Key: key,
    });
    await s3Client.send(command);
    return true;
  } catch (error) {
    if (error.name === 'NotFound') {
      return false;
    }
    throw error;
  }
}

/**
 * Check if S3 is configured
 * @returns {boolean}
 */
export function isUsingS3() {
  return isS3Configured;
}

export { s3Client, bucketName };