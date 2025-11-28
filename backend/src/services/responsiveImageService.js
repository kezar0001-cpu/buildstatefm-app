// backend/src/services/responsiveImageService.js
import path from 'path';
import fs from 'fs/promises';
import { processImageVariants } from './imageProcessingService.js';
import { uploadToS3, isUsingS3 } from './s3Service.js';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads');
const LOCAL_UPLOADS_PUBLIC_PATH = process.env.UPLOADS_PUBLIC_PATH || '/api/uploads';

/**
 * Upload image variants to S3
 * @param {Array} variants - Array of image variants with buffers
 * @param {string} folder - S3 folder prefix
 * @returns {Promise<Object>} - Object mapping variant keys to URLs
 */
async function uploadVariantsToS3(variants, folder = 'properties') {
  const urls = {};

  for (const variant of variants) {
    try {
      const { url, key } = await uploadToS3(
        folder,
        variant.buffer,
        variant.filename,
        variant.mimetype
      );

      // Store URL with composite key: variant-format (e.g., thumbnail-jpg, medium-webp)
      const urlKey = `${variant.variant}-${variant.format}`;
      urls[urlKey] = url;

      console.log(`✅ Uploaded ${urlKey}: ${url}`);
    } catch (error) {
      console.error(`❌ Failed to upload ${variant.variant}-${variant.format}:`, error);
      throw error;
    }
  }

  return urls;
}

/**
 * Save image variants to local disk
 * @param {Array} variants - Array of image variants with buffers
 * @returns {Promise<Object>} - Object mapping variant keys to local URLs
 */
async function saveVariantsLocally(variants) {
  const urls = {};

  // Ensure upload directory exists
  await fs.mkdir(UPLOAD_DIR, { recursive: true });

  for (const variant of variants) {
    try {
      const filePath = path.join(UPLOAD_DIR, variant.filename);
      await fs.writeFile(filePath, variant.buffer);

      // Store URL with composite key: variant-format (e.g., thumbnail-jpg, medium-webp)
      const urlKey = `${variant.variant}-${variant.format}`;
      urls[urlKey] = `${LOCAL_UPLOADS_PUBLIC_PATH}/${variant.filename}`;

      console.log(`✅ Saved ${urlKey}: ${variant.filename}`);
    } catch (error) {
      console.error(`❌ Failed to save ${variant.variant}-${variant.format}:`, error);
      throw error;
    }
  }

  return urls;
}

/**
 * Process and upload a responsive image with multiple size variants and formats
 * @param {Buffer} buffer - Original image buffer
 * @param {string} originalname - Original filename
 * @param {string} folder - S3 folder or storage prefix (default: 'properties')
 * @returns {Promise<Object>} - Object containing URLs for all variants
 *
 * Returns object format:
 * {
 *   'thumbnail-jpg': 'https://...',
 *   'thumbnail-webp': 'https://...',
 *   'medium-jpg': 'https://...',
 *   'medium-webp': 'https://...',
 *   'original-jpg': 'https://...',
 *   'original-webp': 'https://...'
 * }
 */
export async function uploadResponsiveImage(buffer, originalname, folder = 'properties') {
  try {
    // Step 1: Process image into variants
    console.log(`🔄 Processing image variants for: ${originalname}`);
    const variants = await processImageVariants(buffer, originalname);

    // Step 2: Upload variants to S3 or local storage
    let urls;
    if (isUsingS3()) {
      console.log('📤 Uploading variants to S3...');
      urls = await uploadVariantsToS3(variants, folder);
    } else {
      console.log('💾 Saving variants locally...');
      urls = await saveVariantsLocally(variants);
    }

    console.log(`✅ Successfully processed and uploaded ${Object.keys(urls).length} image variants`);
    return urls;
  } catch (error) {
    console.error('Error in uploadResponsiveImage:', error);
    throw new Error(`Failed to upload responsive image: ${error.message}`);
  }
}

/**
 * Get the primary URL for an image (returns original JPEG by default)
 * @param {Object} variantUrls - Object containing all variant URLs
 * @returns {string} - Primary image URL
 */
export function getPrimaryImageUrl(variantUrls) {
  return variantUrls['original-jpg'] || variantUrls['medium-jpg'] || variantUrls['thumbnail-jpg'] || Object.values(variantUrls)[0];
}

/**
 * Build a srcset string for responsive images
 * @param {Object} variantUrls - Object containing all variant URLs
 * @param {string} format - Image format ('jpg' or 'webp')
 * @returns {string} - srcset string for use in HTML
 */
export function buildSrcSet(variantUrls, format = 'jpg') {
  const srcsetParts = [];

  if (variantUrls[`thumbnail-${format}`]) {
    srcsetParts.push(`${variantUrls[`thumbnail-${format}`]} 200w`);
  }
  if (variantUrls[`medium-${format}`]) {
    srcsetParts.push(`${variantUrls[`medium-${format}`]} 800w`);
  }
  if (variantUrls[`original-${format}`]) {
    srcsetParts.push(`${variantUrls[`original-${format}`]} 1920w`);
  }

  return srcsetParts.join(', ');
}

/**
 * Delete all variants of a responsive image
 * @param {Object} variantUrls - Object containing all variant URLs to delete
 */
export async function deleteResponsiveImage(variantUrls) {
  const { deleteImage } = await import('./uploadService.js');

  const deletePromises = Object.values(variantUrls).map(async (url) => {
    try {
      await deleteImage(url);
    } catch (error) {
      console.error(`Failed to delete variant ${url}:`, error);
    }
  });

  await Promise.allSettled(deletePromises);
}
