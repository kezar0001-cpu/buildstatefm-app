// backend/src/services/cloudFrontImageService.js
/**
 * CloudFront Image Service
 *
 * Provides utilities for on-demand image resizing via CloudFront query parameters.
 * This service works with CloudFront Functions or Lambda@Edge to enable dynamic
 * image transformations without pre-generating all variants.
 *
 * Setup Requirements:
 * 1. Configure AWS_CLOUDFRONT_DOMAIN environment variable
 * 2. Set up CloudFront Function or Lambda@Edge to handle image transformation
 * 3. CloudFront should be configured to forward query parameters to origin
 *
 * CloudFront Function Example (viewer-request):
 *
 * function handler(event) {
 *   var request = event.request;
 *   var uri = request.uri;
 *   var querystring = request.querystring;
 *
 *   // Parse query parameters
 *   var width = querystring.w ? querystring.w.value : null;
 *   var height = querystring.h ? querystring.h.value : null;
 *   var format = querystring.f ? querystring.f.value : null;
 *   var quality = querystring.q ? querystring.q.value : null;
 *
 *   // Construct transformed image path
 *   if (width || height || format || quality) {
 *     var transformedPath = uri + '?';
 *     if (width) transformedPath += 'w=' + width + '&';
 *     if (height) transformedPath += 'h=' + height + '&';
 *     if (format) transformedPath += 'f=' + format + '&';
 *     if (quality) transformedPath += 'q=' + quality;
 *     request.uri = transformedPath;
 *   }
 *
 *   return request;
 * }
 */

const cloudFrontDomain = process.env.AWS_CLOUDFRONT_DOMAIN;
const isCloudFrontEnabled = !!cloudFrontDomain;

if (isCloudFrontEnabled) {
  console.log(`✅ CloudFront image optimization enabled: ${cloudFrontDomain}`);
} else {
  console.log('ℹ️  CloudFront not configured. Set AWS_CLOUDFRONT_DOMAIN to enable on-demand image resizing.');
}

/**
 * Image transformation parameters
 * @typedef {Object} ImageTransformParams
 * @property {number} [width] - Target width in pixels
 * @property {number} [height] - Target height in pixels
 * @property {string} [format] - Target format (jpg, webp, png)
 * @property {number} [quality] - Image quality (1-100)
 * @property {string} [fit] - Resize fit mode (cover, contain, fill, inside, outside)
 */

/**
 * Generate a CloudFront URL with image transformation query parameters
 * @param {string} s3Key - S3 object key
 * @param {ImageTransformParams} params - Transformation parameters
 * @returns {string} CloudFront URL with query parameters
 */
export function getCloudFrontImageUrl(s3Key, params = {}) {
  if (!isCloudFrontEnabled) {
    throw new Error('CloudFront is not configured. Set AWS_CLOUDFRONT_DOMAIN environment variable.');
  }

  const baseUrl = `https://${cloudFrontDomain}/${s3Key}`;
  const queryParams = [];

  if (params.width) {
    queryParams.push(`w=${encodeURIComponent(params.width)}`);
  }

  if (params.height) {
    queryParams.push(`h=${encodeURIComponent(params.height)}`);
  }

  if (params.format) {
    queryParams.push(`f=${encodeURIComponent(params.format)}`);
  }

  if (params.quality) {
    queryParams.push(`q=${encodeURIComponent(params.quality)}`);
  }

  if (params.fit) {
    queryParams.push(`fit=${encodeURIComponent(params.fit)}`);
  }

  if (queryParams.length === 0) {
    return baseUrl;
  }

  return `${baseUrl}?${queryParams.join('&')}`;
}

/**
 * Generate multiple CloudFront URLs for responsive image variants
 * @param {string} s3Key - S3 object key
 * @param {string} [format='jpg'] - Image format
 * @returns {Object} Object with thumbnail, medium, and original URLs
 */
export function getResponsiveCloudFrontUrls(s3Key, format = 'jpg') {
  if (!isCloudFrontEnabled) {
    throw new Error('CloudFront is not configured. Set AWS_CLOUDFRONT_DOMAIN environment variable.');
  }

  return {
    thumbnail: getCloudFrontImageUrl(s3Key, { width: 200, format, quality: 80 }),
    medium: getCloudFrontImageUrl(s3Key, { width: 800, format, quality: 85 }),
    original: getCloudFrontImageUrl(s3Key, { format, quality: 90 }),
  };
}

/**
 * Build srcset string for CloudFront responsive images
 * @param {string} s3Key - S3 object key
 * @param {string} [format='jpg'] - Image format
 * @returns {string} srcset string
 */
export function buildCloudFrontSrcSet(s3Key, format = 'jpg') {
  const urls = getResponsiveCloudFrontUrls(s3Key, format);
  return `${urls.thumbnail} 200w, ${urls.medium} 800w, ${urls.original} 1920w`;
}

/**
 * Check if CloudFront is enabled
 * @returns {boolean}
 */
export function isCloudFrontConfigured() {
  return isCloudFrontEnabled;
}

/**
 * Get CloudFront domain
 * @returns {string|null}
 */
export function getCloudFrontDomain() {
  return cloudFrontDomain || null;
}

/**
 * Predefined image size presets
 */
export const IMAGE_PRESETS = {
  THUMBNAIL: { width: 200, quality: 80 },
  SMALL: { width: 400, quality: 80 },
  MEDIUM: { width: 800, quality: 85 },
  LARGE: { width: 1200, quality: 85 },
  XLARGE: { width: 1920, quality: 90 },
  HERO: { width: 2560, quality: 90 },
};

/**
 * Generate CloudFront URL using a preset
 * @param {string} s3Key - S3 object key
 * @param {string} presetName - Preset name (THUMBNAIL, SMALL, MEDIUM, etc.)
 * @param {string} [format] - Image format (jpg, webp, png)
 * @returns {string} CloudFront URL
 */
export function getCloudFrontUrlWithPreset(s3Key, presetName, format) {
  const preset = IMAGE_PRESETS[presetName];
  if (!preset) {
    throw new Error(`Invalid preset: ${presetName}. Available presets: ${Object.keys(IMAGE_PRESETS).join(', ')}`);
  }

  return getCloudFrontImageUrl(s3Key, { ...preset, format });
}

export default {
  getCloudFrontImageUrl,
  getResponsiveCloudFrontUrls,
  buildCloudFrontSrcSet,
  isCloudFrontConfigured,
  getCloudFrontDomain,
  getCloudFrontUrlWithPreset,
  IMAGE_PRESETS,
};
