/**
 * Image Optimization Utility
 * 
 * Optimizes images before upload to reduce storage costs and improve load times.
 * 
 * Manual Setup Required:
 * - Install sharp: npm install sharp
 * - For production, ensure sharp binaries are available (may require platform-specific builds)
 * - Configure MAX_IMAGE_WIDTH, MAX_IMAGE_HEIGHT, IMAGE_QUALITY in environment variables
 */

import sharp from 'sharp';
import { Readable } from 'stream';

// Configuration from environment variables
const MAX_IMAGE_WIDTH = parseInt(process.env.MAX_IMAGE_WIDTH || '1920', 10);
const MAX_IMAGE_HEIGHT = parseInt(process.env.MAX_IMAGE_HEIGHT || '1080', 10);
const IMAGE_QUALITY = parseInt(process.env.IMAGE_QUALITY || '85', 10); // JPEG quality (1-100)
const WEBP_QUALITY = parseInt(process.env.WEBP_QUALITY || '80', 10); // WebP quality (1-100)
const ENABLE_WEBP = process.env.ENABLE_WEBP !== 'false'; // Default: true

/**
 * Optimize an image buffer
 * @param {Buffer} imageBuffer - Original image buffer
 * @param {object} options - Optimization options
 * @returns {Promise<Buffer>} Optimized image buffer
 */
export async function optimizeImage(imageBuffer, options = {}) {
  const {
    maxWidth = MAX_IMAGE_WIDTH,
    maxHeight = MAX_IMAGE_HEIGHT,
    quality = IMAGE_QUALITY,
    format = 'auto', // 'auto', 'jpeg', 'png', 'webp'
    fit = 'inside', // 'cover', 'contain', 'fill', 'inside', 'outside'
  } = options;

  try {
    let sharpInstance = sharp(imageBuffer);

    // Get image metadata
    const metadata = await sharpInstance.metadata();
    const { width, height, format: originalFormat } = metadata;

    // Determine output format
    let outputFormat = format;
    if (format === 'auto') {
      // Convert to WebP if enabled and original is JPEG/PNG
      if (ENABLE_WEBP && (originalFormat === 'jpeg' || originalFormat === 'png')) {
        outputFormat = 'webp';
      } else {
        // Keep original format
        outputFormat = originalFormat || 'jpeg';
      }
    }

    // Resize if needed
    const needsResize = width > maxWidth || height > maxHeight;
    if (needsResize) {
      sharpInstance = sharpInstance.resize(maxWidth, maxHeight, {
        fit,
        withoutEnlargement: true, // Don't enlarge smaller images
      });
    }

    // Apply format-specific optimizations
    switch (outputFormat) {
      case 'webp':
        sharpInstance = sharpInstance.webp({
          quality: WEBP_QUALITY,
          effort: 4, // Compression effort (0-6, higher = slower but better compression)
        });
        break;
      case 'jpeg':
      case 'jpg':
        sharpInstance = sharpInstance.jpeg({
          quality,
          progressive: true, // Progressive JPEG for better perceived performance
          mozjpeg: true, // Use mozjpeg for better compression
        });
        break;
      case 'png':
        sharpInstance = sharpInstance.png({
          quality,
          compressionLevel: 9, // Maximum compression
          adaptiveFiltering: true,
        });
        break;
      default:
        // Keep original format with quality settings if supported
        if (originalFormat === 'jpeg' || originalFormat === 'jpg') {
          sharpInstance = sharpInstance.jpeg({ quality, progressive: true });
        }
    }

    // Convert to buffer
    const optimizedBuffer = await sharpInstance.toBuffer();

    return {
      buffer: optimizedBuffer,
      format: outputFormat,
      originalSize: imageBuffer.length,
      optimizedSize: optimizedBuffer.length,
      compressionRatio: ((1 - optimizedBuffer.length / imageBuffer.length) * 100).toFixed(2),
      metadata: {
        width: needsResize ? Math.min(width, maxWidth) : width,
        height: needsResize ? Math.min(height, maxHeight) : height,
      },
    };
  } catch (error) {
    console.error('Image optimization error:', error);
    // Return original buffer if optimization fails
    return {
      buffer: imageBuffer,
      format: 'original',
      originalSize: imageBuffer.length,
      optimizedSize: imageBuffer.length,
      compressionRatio: 0,
      error: error.message,
    };
  }
}

/**
 * Optimize image from file stream
 * @param {Stream|Buffer} input - File stream or buffer
 * @param {object} options - Optimization options
 * @returns {Promise<Buffer>} Optimized image buffer
 */
export async function optimizeImageFromStream(input, options = {}) {
  let buffer;
  
  if (Buffer.isBuffer(input)) {
    buffer = input;
  } else if (input instanceof Readable) {
    // Convert stream to buffer
    const chunks = [];
    for await (const chunk of input) {
      chunks.push(chunk);
    }
    buffer = Buffer.concat(chunks);
  } else {
    throw new Error('Input must be a Buffer or Stream');
  }

  return optimizeImage(buffer, options);
}

/**
 * Check if a file is an image
 * @param {string} mimeType - MIME type
 * @returns {boolean} True if image
 */
export function isImage(mimeType) {
  return mimeType && mimeType.startsWith('image/');
}

/**
 * Get recommended optimization settings for an image type
 * @param {string} mimeType - MIME type
 * @returns {object} Optimization settings
 */
export function getOptimizationSettings(mimeType) {
  if (!isImage(mimeType)) {
    return null;
  }

  const settings = {
    maxWidth: MAX_IMAGE_WIDTH,
    maxHeight: MAX_IMAGE_HEIGHT,
    quality: IMAGE_QUALITY,
  };

  // Adjust settings based on image type
  if (mimeType === 'image/png') {
    settings.format = ENABLE_WEBP ? 'webp' : 'png';
  } else if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
    settings.format = ENABLE_WEBP ? 'webp' : 'jpeg';
  } else if (mimeType === 'image/webp') {
    settings.format = 'webp';
  } else {
    settings.format = 'auto';
  }

  return settings;
}

export default {
  optimizeImage,
  optimizeImageFromStream,
  isImage,
  getOptimizationSettings,
};

