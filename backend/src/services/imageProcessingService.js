// backend/src/services/imageProcessingService.js
import sharp from 'sharp';
import path from 'path';
import { randomUUID } from 'crypto';
import { logger } from '../utils/logger.js';

/**
 * Image size variants configuration
 */
export const IMAGE_VARIANTS = {
  THUMBNAIL: { width: 200, suffix: 'thumbnail' },
  MEDIUM: { width: 800, suffix: 'medium' },
  ORIGINAL: { suffix: 'original' },
};

/**
 * Generate a unique filename for an image variant
 * @param {string} originalname - Original file name
 * @param {string} suffix - Variant suffix (thumbnail, medium, original)
 * @param {string} format - Image format (jpg, webp)
 * @returns {string} - Generated filename
 */
export function generateVariantFilename(originalname, suffix, format = 'jpg') {
  const ext = path.extname(originalname || '');
  const base = path
    .basename(originalname || 'file', ext)
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .slice(0, 40) || 'file';
  const unique = randomUUID();
  return `${base}-${unique}-${suffix}.${format}`;
}

/**
 * Process an image buffer and generate multiple size variants
 * @param {Buffer} buffer - Image buffer
 * @param {string} originalname - Original filename
 * @returns {Promise<Array>} - Array of processed image variants with buffers
 */
export async function processImageVariants(buffer, originalname) {
  const variants = [];

  try {
    // Get original image metadata
    const metadata = await sharp(buffer).metadata();

    // Generate thumbnail (200px width) - JPEG
    const thumbnailBuffer = await sharp(buffer)
      .resize(IMAGE_VARIANTS.THUMBNAIL.width, null, {
        withoutEnlargement: true,
        fit: 'inside',
      })
      .jpeg({ quality: 80, progressive: true })
      .toBuffer();

    variants.push({
      buffer: thumbnailBuffer,
      filename: generateVariantFilename(originalname, IMAGE_VARIANTS.THUMBNAIL.suffix, 'jpg'),
      mimetype: 'image/jpeg',
      variant: 'thumbnail',
      format: 'jpg',
      width: IMAGE_VARIANTS.THUMBNAIL.width,
    });

    // Generate thumbnail (200px width) - WebP
    const thumbnailWebPBuffer = await sharp(buffer)
      .resize(IMAGE_VARIANTS.THUMBNAIL.width, null, {
        withoutEnlargement: true,
        fit: 'inside',
      })
      .webp({ quality: 80 })
      .toBuffer();

    variants.push({
      buffer: thumbnailWebPBuffer,
      filename: generateVariantFilename(originalname, IMAGE_VARIANTS.THUMBNAIL.suffix, 'webp'),
      mimetype: 'image/webp',
      variant: 'thumbnail',
      format: 'webp',
      width: IMAGE_VARIANTS.THUMBNAIL.width,
    });

    // Generate medium (800px width) - JPEG
    const mediumBuffer = await sharp(buffer)
      .resize(IMAGE_VARIANTS.MEDIUM.width, null, {
        withoutEnlargement: true,
        fit: 'inside',
      })
      .jpeg({ quality: 85, progressive: true })
      .toBuffer();

    variants.push({
      buffer: mediumBuffer,
      filename: generateVariantFilename(originalname, IMAGE_VARIANTS.MEDIUM.suffix, 'jpg'),
      mimetype: 'image/jpeg',
      variant: 'medium',
      format: 'jpg',
      width: IMAGE_VARIANTS.MEDIUM.width,
    });

    // Generate medium (800px width) - WebP
    const mediumWebPBuffer = await sharp(buffer)
      .resize(IMAGE_VARIANTS.MEDIUM.width, null, {
        withoutEnlargement: true,
        fit: 'inside',
      })
      .webp({ quality: 85 })
      .toBuffer();

    variants.push({
      buffer: mediumWebPBuffer,
      filename: generateVariantFilename(originalname, IMAGE_VARIANTS.MEDIUM.suffix, 'webp'),
      mimetype: 'image/webp',
      variant: 'medium',
      format: 'webp',
      width: IMAGE_VARIANTS.MEDIUM.width,
    });

    // Generate original size - JPEG (optimized)
    const originalBuffer = await sharp(buffer)
      .jpeg({ quality: 90, progressive: true })
      .toBuffer();

    variants.push({
      buffer: originalBuffer,
      filename: generateVariantFilename(originalname, IMAGE_VARIANTS.ORIGINAL.suffix, 'jpg'),
      mimetype: 'image/jpeg',
      variant: 'original',
      format: 'jpg',
      width: metadata.width,
    });

    // Generate original size - WebP
    const originalWebPBuffer = await sharp(buffer)
      .webp({ quality: 90 })
      .toBuffer();

    variants.push({
      buffer: originalWebPBuffer,
      filename: generateVariantFilename(originalname, IMAGE_VARIANTS.ORIGINAL.suffix, 'webp'),
      mimetype: 'image/webp',
      variant: 'original',
      format: 'webp',
      width: metadata.width,
    });

    console.log(`✅ Generated ${variants.length} image variants for ${originalname}`);
    return variants;
  } catch (error) {
    console.error('Error processing image variants:', error);
    throw new Error(`Failed to process image: ${error.message}`);
  }
}

/**
 * Process a single image variant
 * @param {Buffer} buffer - Image buffer
 * @param {Object} variantConfig - Variant configuration
 * @param {string} filename - Output filename
 * @returns {Promise<Object>} - Processed image variant
 */
export async function processSingleVariant(buffer, variantConfig, filename) {
  try {
    let processedBuffer;
    const format = path.extname(filename).slice(1); // Get format from filename

    if (variantConfig.width) {
      // Resize image
      let sharpInstance = sharp(buffer).resize(variantConfig.width, null, {
        withoutEnlargement: true,
        fit: 'inside',
      });

      // Apply format-specific compression
      if (format === 'webp') {
        processedBuffer = await sharpInstance.webp({ quality: variantConfig.quality || 85 }).toBuffer();
      } else {
        processedBuffer = await sharpInstance.jpeg({ quality: variantConfig.quality || 85, progressive: true }).toBuffer();
      }
    } else {
      // Original size, just optimize
      if (format === 'webp') {
        processedBuffer = await sharp(buffer).webp({ quality: variantConfig.quality || 90 }).toBuffer();
      } else {
        processedBuffer = await sharp(buffer).jpeg({ quality: variantConfig.quality || 90, progressive: true }).toBuffer();
      }
    }

    return {
      buffer: processedBuffer,
      filename,
      mimetype: format === 'webp' ? 'image/webp' : 'image/jpeg',
    };
  } catch (error) {
    console.error(`Error processing variant ${filename}:`, error);
    throw error;
  }
}

/**
 * Extract EXIF data from image buffer
 * @param {Buffer} buffer - Image buffer
 * @returns {Promise<Object|null>} - EXIF data or null if none exists
 */
export async function extractExifData(buffer) {
  try {
    const metadata = await sharp(buffer).metadata();

    // Extract relevant EXIF data
    const exifData = {
      format: metadata.format,
      width: metadata.width,
      height: metadata.height,
      space: metadata.space,
      channels: metadata.channels,
      depth: metadata.depth,
      density: metadata.density,
      hasAlpha: metadata.hasAlpha,
      orientation: metadata.orientation,
      // EXIF-specific fields
      exif: metadata.exif ? {} : null,
      icc: metadata.icc ? true : false,
    };

    // Check if image has EXIF data
    if (metadata.exif) {
      exifData.hasExif = true;
      // Note: Sharp doesn't parse EXIF into JSON automatically
      // The exif buffer would need a library like exif-parser to parse
      exifData.exifSize = metadata.exif.length;
    }

    return exifData;
  } catch (error) {
    logger.error('Error extracting EXIF data:', error);
    return null;
  }
}

/**
 * Process image with EXIF stripping option
 * @param {Buffer} buffer - Image buffer
 * @param {string} originalname - Original filename
 * @param {Object} options - Processing options
 * @param {boolean} options.stripExif - Whether to strip EXIF data (default: true)
 * @param {boolean} options.preserveExif - Whether to preserve and return EXIF data (default: false)
 * @returns {Promise<Object>} - Processed image with EXIF info
 */
export async function processImageWithExif(buffer, originalname, options = {}) {
  const {
    stripExif = true,
    preserveExif = false,
  } = options;

  try {
    // Extract EXIF data if preservation is requested
    let exifData = null;
    if (preserveExif || !stripExif) {
      exifData = await extractExifData(buffer);

      if (exifData && exifData.hasExif) {
        logger.info(`📸 EXIF data found in ${originalname}`, {
          width: exifData.width,
          height: exifData.height,
          orientation: exifData.orientation,
          exifSize: exifData.exifSize,
        });
      }
    }

    // Process variants with EXIF stripping
    const variants = await processImageVariants(buffer, originalname, stripExif);

    // Log EXIF stripping action
    if (stripExif && exifData && exifData.hasExif) {
      logger.info(`🔒 EXIF data stripped from ${originalname}`, {
        originalSize: buffer.length,
        preservedMetadata: preserveExif,
      });
    }

    return {
      variants,
      exifData: preserveExif ? exifData : null,
      exifStripped: stripExif,
    };
  } catch (error) {
    logger.error('Error processing image with EXIF handling:', error);
    throw error;
  }
}

/**
 * Process an image buffer and generate multiple size variants with EXIF handling
 * @param {Buffer} buffer - Image buffer
 * @param {string} originalname - Original filename
 * @param {boolean} stripExif - Whether to strip EXIF data (default: true)
 * @returns {Promise<Array>} - Array of processed image variants with buffers
 */
export async function processImageVariantsWithExif(buffer, originalname, stripExif = true) {
  const variants = [];

  try {
    // Get original image metadata
    const metadata = await sharp(buffer).metadata();

    // Common sharp options
    const sharpOptions = stripExif ? { withMetadata: false } : {};

    // Generate thumbnail (200px width) - JPEG
    const thumbnailBuffer = await sharp(buffer)
      .resize(IMAGE_VARIANTS.THUMBNAIL.width, null, {
        withoutEnlargement: true,
        fit: 'inside',
      })
      .withMetadata(stripExif ? undefined : {})
      .jpeg({ quality: 80, progressive: true })
      .toBuffer();

    variants.push({
      buffer: thumbnailBuffer,
      filename: generateVariantFilename(originalname, IMAGE_VARIANTS.THUMBNAIL.suffix, 'jpg'),
      mimetype: 'image/jpeg',
      variant: 'thumbnail',
      format: 'jpg',
      width: IMAGE_VARIANTS.THUMBNAIL.width,
    });

    // Generate thumbnail (200px width) - WebP
    const thumbnailWebPBuffer = await sharp(buffer)
      .resize(IMAGE_VARIANTS.THUMBNAIL.width, null, {
        withoutEnlargement: true,
        fit: 'inside',
      })
      .withMetadata(stripExif ? undefined : {})
      .webp({ quality: 80 })
      .toBuffer();

    variants.push({
      buffer: thumbnailWebPBuffer,
      filename: generateVariantFilename(originalname, IMAGE_VARIANTS.THUMBNAIL.suffix, 'webp'),
      mimetype: 'image/webp',
      variant: 'thumbnail',
      format: 'webp',
      width: IMAGE_VARIANTS.THUMBNAIL.width,
    });

    // Generate medium (800px width) - JPEG
    const mediumBuffer = await sharp(buffer)
      .resize(IMAGE_VARIANTS.MEDIUM.width, null, {
        withoutEnlargement: true,
        fit: 'inside',
      })
      .withMetadata(stripExif ? undefined : {})
      .jpeg({ quality: 85, progressive: true })
      .toBuffer();

    variants.push({
      buffer: mediumBuffer,
      filename: generateVariantFilename(originalname, IMAGE_VARIANTS.MEDIUM.suffix, 'jpg'),
      mimetype: 'image/jpeg',
      variant: 'medium',
      format: 'jpg',
      width: IMAGE_VARIANTS.MEDIUM.width,
    });

    // Generate medium (800px width) - WebP
    const mediumWebPBuffer = await sharp(buffer)
      .resize(IMAGE_VARIANTS.MEDIUM.width, null, {
        withoutEnlargement: true,
        fit: 'inside',
      })
      .withMetadata(stripExif ? undefined : {})
      .webp({ quality: 85 })
      .toBuffer();

    variants.push({
      buffer: mediumWebPBuffer,
      filename: generateVariantFilename(originalname, IMAGE_VARIANTS.MEDIUM.suffix, 'webp'),
      mimetype: 'image/webp',
      variant: 'medium',
      format: 'webp',
      width: IMAGE_VARIANTS.MEDIUM.width,
    });

    // Generate original size - JPEG (optimized)
    const originalBuffer = await sharp(buffer)
      .withMetadata(stripExif ? undefined : {})
      .jpeg({ quality: 90, progressive: true })
      .toBuffer();

    variants.push({
      buffer: originalBuffer,
      filename: generateVariantFilename(originalname, IMAGE_VARIANTS.ORIGINAL.suffix, 'jpg'),
      mimetype: 'image/jpeg',
      variant: 'original',
      format: 'jpg',
      width: metadata.width,
    });

    // Generate original size - WebP
    const originalWebPBuffer = await sharp(buffer)
      .withMetadata(stripExif ? undefined : {})
      .webp({ quality: 90 })
      .toBuffer();

    variants.push({
      buffer: originalWebPBuffer,
      filename: generateVariantFilename(originalname, IMAGE_VARIANTS.ORIGINAL.suffix, 'webp'),
      mimetype: 'image/webp',
      variant: 'original',
      format: 'webp',
      width: metadata.width,
    });

    console.log(`✅ Generated ${variants.length} image variants for ${originalname} (EXIF stripped: ${stripExif})`);
    return variants;
  } catch (error) {
    console.error('Error processing image variants:', error);
    throw new Error(`Failed to process image: ${error.message}`);
  }
}
