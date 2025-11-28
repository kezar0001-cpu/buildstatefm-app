# Responsive Images & Redis Rate Limiting

This document describes the new CDN optimization with responsive image serving and Redis-backed rate limiting features.

## Table of Contents

1. [Responsive Images](#responsive-images)
2. [Redis Rate Limiting](#redis-rate-limiting)
3. [CloudFront Integration](#cloudfront-integration)
4. [API Reference](#api-reference)
5. [Configuration](#configuration)

---

## Responsive Images

### Overview

The application now supports automatic generation of multiple image size variants and formats when uploading images. This improves performance by serving appropriately-sized images to different devices and browsers.

### Features

- **Three Size Variants**: Thumbnail (200px), Medium (800px), and Original
- **Two Formats**: JPEG (for broad compatibility) and WebP (for modern browsers)
- **Automatic Processing**: Images are automatically processed on upload using Sharp.js
- **Storage**: All variants are stored in S3 (or local storage) with organized naming conventions

### Image Processing Service

Located in: `backend/src/services/imageProcessingService.js`

**Generated Variants:**

1. `thumbnail-jpg` (200px width, JPEG, 80% quality)
2. `thumbnail-webp` (200px width, WebP, 80% quality)
3. `medium-jpg` (800px width, JPEG, 85% quality)
4. `medium-webp` (800px width, WebP, 85% quality)
5. `original-jpg` (original size, JPEG, 90% quality)
6. `original-webp` (original size, WebP, 90% quality)

### Upload API

#### POST `/api/uploads/responsive-image`

Upload a single image and automatically generate responsive variants.

**Request:**
```bash
curl -X POST http://localhost:5000/api/uploads/responsive-image \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "image=@/path/to/image.jpg" \
  -F "folder=properties"
```

**Response:**
```json
{
  "success": true,
  "variants": {
    "thumbnail-jpg": "https://bucket.s3.region.amazonaws.com/properties/image-uuid-thumbnail.jpg",
    "thumbnail-webp": "https://bucket.s3.region.amazonaws.com/properties/image-uuid-thumbnail.webp",
    "medium-jpg": "https://bucket.s3.region.amazonaws.com/properties/image-uuid-medium.jpg",
    "medium-webp": "https://bucket.s3.region.amazonaws.com/properties/image-uuid-medium.webp",
    "original-jpg": "https://bucket.s3.region.amazonaws.com/properties/image-uuid-original.jpg",
    "original-webp": "https://bucket.s3.region.amazonaws.com/properties/image-uuid-original.webp"
  },
  "primaryUrl": "https://bucket.s3.region.amazonaws.com/properties/image-uuid-original.jpg",
  "srcSet": {
    "jpg": "...url... 200w, ...url... 800w, ...url... 1920w",
    "webp": "...url... 200w, ...url... 800w, ...url... 1920w"
  }
}
```

### Frontend Integration (ImageCard.jsx)

The `ImageCard` component now supports responsive images with the HTML `<picture>` element:

**Usage:**
```jsx
<ImageCard
  image={{
    id: '123',
    variants: {
      'thumbnail-jpg': 'url',
      'thumbnail-webp': 'url',
      'medium-jpg': 'url',
      'medium-webp': 'url',
      'original-jpg': 'url',
      'original-webp': 'url'
    },
    status: 'complete'
  }}
  onDelete={handleDelete}
  onSetCover={handleSetCover}
/>
```

**How it works:**

1. If `variants` are provided, the component uses a `<picture>` element
2. WebP sources are provided first (modern browsers will use these)
3. JPEG sources are provided as fallback
4. The browser automatically selects the appropriate size based on viewport
5. If no variants are available, falls back to the standard `LazyImage` component

---

## Redis Rate Limiting

### Overview

Rate limiting has been migrated from in-memory Map-based storage to Redis-backed rate limiting using the `rate-limiter-flexible` library. This ensures rate limits are:

- **Distributed**: Work across multiple server instances
- **Persistent**: Survive server restarts
- **Accurate**: Use Redis INCR and EXPIRE commands for precise sliding window algorithm

### Middleware

Located in: `backend/src/middleware/redisRateLimiter.js`

**Pre-configured Rate Limiters:**

1. **uploadRateLimiter**: 30 uploads per minute
2. **propertyUploadRateLimiter**: 20 uploads per minute
3. **apiRateLimiter**: 100 requests per minute
4. **strictRateLimiter**: 10 requests per minute

### Usage

**In routes:**

```javascript
import { uploadRateLimiter } from '../middleware/redisRateLimiter.js';

router.post('/upload', requireAuth, uploadRateLimiter, (req, res) => {
  // Your upload handler
});
```

**Custom rate limiter:**

```javascript
import { createRedisRateLimiter } from '../middleware/redisRateLimiter.js';

const customRateLimiter = createRedisRateLimiter({
  keyPrefix: 'custom_rate_limit',
  points: 50,           // Max 50 requests
  duration: 60,         // Per 60 seconds
  errorMessage: 'Too many requests. Please slow down.',
  keyGenerator: (req) => req.user?.id || req.ip,
});

router.post('/api/custom', customRateLimiter, (req, res) => {
  // Your handler
});
```

### Fallback Behavior

If Redis is unavailable, the rate limiter automatically falls back to in-memory rate limiting, ensuring your application continues to function.

### Migration

The following files have been updated to use Redis rate limiting:

- ✅ `backend/src/routes/uploads.js` (lines 15-42 replaced)
- ✅ `backend/src/routes/properties.js` (lines 33-85 replaced)

---

## CloudFront Integration

### Overview

CloudFront integration provides on-demand image resizing using query parameters. This allows you to request any image size without pre-generating all variants.

### Configuration

Set the CloudFront domain in your environment:

```bash
AWS_CLOUDFRONT_DOMAIN=your-cloudfront-domain.cloudfront.net
```

### CloudFront Function Setup

To enable on-demand resizing, deploy this CloudFront Function to your distribution's viewer-request event:

```javascript
function handler(event) {
  var request = event.request;
  var uri = request.uri;
  var querystring = request.querystring;

  // Parse query parameters
  var width = querystring.w ? querystring.w.value : null;
  var height = querystring.h ? querystring.h.value : null;
  var format = querystring.f ? querystring.f.value : null;
  var quality = querystring.q ? querystring.q.value : null;
  var fit = querystring.fit ? querystring.fit.value : null;

  // Forward transformation parameters to Lambda@Edge or origin
  if (width || height || format || quality || fit) {
    // Your image transformation logic here
    // This could invoke a Lambda@Edge function or forward to an image processing service
  }

  return request;
}
```

### API Endpoints

#### POST `/api/uploads/cloudfront-url`

Generate a CloudFront URL with image transformation parameters.

**Request:**
```json
{
  "s3Key": "properties/image-uuid-original.jpg",
  "width": 800,
  "height": 600,
  "format": "webp",
  "quality": 85,
  "fit": "cover"
}
```

**Response:**
```json
{
  "success": true,
  "url": "https://your-cloudfront-domain.cloudfront.net/properties/image-uuid-original.jpg?w=800&h=600&f=webp&q=85&fit=cover"
}
```

#### POST `/api/uploads/cloudfront-responsive-urls`

Generate responsive CloudFront URLs for an image.

**Request:**
```json
{
  "s3Key": "properties/image-uuid-original.jpg",
  "format": "webp"
}
```

**Response:**
```json
{
  "success": true,
  "urls": {
    "thumbnail": "https://.../image.jpg?w=200&f=webp&q=80",
    "medium": "https://.../image.jpg?w=800&f=webp&q=85",
    "original": "https://.../image.jpg?f=webp&q=90"
  },
  "srcSet": "...url... 200w, ...url... 800w, ...url... 1920w"
}
```

### Service Methods

Located in: `backend/src/services/cloudFrontImageService.js`

```javascript
import {
  getCloudFrontImageUrl,
  getResponsiveCloudFrontUrls,
  buildCloudFrontSrcSet,
  IMAGE_PRESETS,
  getCloudFrontUrlWithPreset
} from './services/cloudFrontImageService.js';

// Generate a custom URL
const url = getCloudFrontImageUrl('properties/image.jpg', {
  width: 800,
  format: 'webp',
  quality: 85
});

// Generate responsive URLs
const urls = getResponsiveCloudFrontUrls('properties/image.jpg', 'webp');

// Use a preset
const thumbnailUrl = getCloudFrontUrlWithPreset('properties/image.jpg', 'THUMBNAIL', 'webp');
```

**Available Presets:**
- `THUMBNAIL`: 200px, 80% quality
- `SMALL`: 400px, 80% quality
- `MEDIUM`: 800px, 85% quality
- `LARGE`: 1200px, 85% quality
- `XLARGE`: 1920px, 90% quality
- `HERO`: 2560px, 90% quality

---

## API Reference

### Responsive Image Upload

**Endpoint:** `POST /api/uploads/responsive-image`

**Authentication:** Required

**Request:**
- Content-Type: `multipart/form-data`
- Field name: `image`
- Optional: `folder` (default: 'properties')

**Rate Limit:** 30 uploads per minute

**Response:**
```typescript
{
  success: boolean;
  variants: {
    'thumbnail-jpg': string;
    'thumbnail-webp': string;
    'medium-jpg': string;
    'medium-webp': string;
    'original-jpg': string;
    'original-webp': string;
  };
  primaryUrl: string;
  srcSet: {
    jpg: string;
    webp: string;
  };
}
```

### CloudFront URL Generation

**Endpoint:** `POST /api/uploads/cloudfront-url`

**Authentication:** Required

**Request Body:**
```typescript
{
  s3Key: string;          // Required
  width?: number;         // Optional
  height?: number;        // Optional
  format?: string;        // Optional (jpg, webp, png)
  quality?: number;       // Optional (1-100)
  fit?: string;          // Optional (cover, contain, fill, inside, outside)
}
```

**Response:**
```typescript
{
  success: boolean;
  url: string;
}
```

---

## Configuration

### Environment Variables

Add these to your `.env` file:

```bash
# Required for S3 storage
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key-id
AWS_SECRET_ACCESS_KEY=your-secret-access-key
AWS_S3_BUCKET_NAME=your-bucket-name

# Optional: CloudFront CDN
AWS_CLOUDFRONT_DOMAIN=your-cloudfront-domain.cloudfront.net

# Required for Redis rate limiting
REDIS_URL=redis://localhost:6379
# Or use REDIS_DISABLED=true for development without Redis
```

### Dependencies

The following packages have been added:

```json
{
  "sharp": "^latest",
  "rate-limiter-flexible": "^latest"
}
```

Existing packages used:
- `redis`: Already installed
- `multer`: Already installed
- `@aws-sdk/client-s3`: Already installed

---

## Testing

### Test Responsive Image Upload

```bash
# Upload an image
curl -X POST http://localhost:5000/api/uploads/responsive-image \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "image=@test-image.jpg"

# Verify all 6 variants were generated and uploaded
# Check S3 bucket for:
# - test-image-uuid-thumbnail.jpg
# - test-image-uuid-thumbnail.webp
# - test-image-uuid-medium.jpg
# - test-image-uuid-medium.webp
# - test-image-uuid-original.jpg
# - test-image-uuid-original.webp
```

### Test Rate Limiting

```bash
# Make 31 rapid requests to test rate limit (limit is 30/min)
for i in {1..31}; do
  curl -X POST http://localhost:5000/api/uploads/single \
    -H "Authorization: Bearer YOUR_TOKEN" \
    -F "file=@test.txt"
  echo "Request $i"
done

# The 31st request should return:
# {
#   "success": false,
#   "error": "Too many uploads. Maximum 30 uploads per minute.",
#   "code": "RATE_LIMIT_EXCEEDED"
# }
```

### Test CloudFront URL Generation

```bash
# Generate CloudFront URL
curl -X POST http://localhost:5000/api/uploads/cloudfront-url \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "s3Key": "properties/test-image.jpg",
    "width": 800,
    "format": "webp",
    "quality": 85
  }'
```

---

## Performance Benefits

### Before (Single Image)

- 1 file uploaded (e.g., 5MB original)
- All devices download the same 5MB image
- No format optimization

### After (Responsive Images)

- 6 files uploaded (total: ~6-8MB for all variants)
- Mobile devices download 200px thumbnail (~30KB)
- Tablets download 800px medium (~200KB)
- Desktops download original (~5MB)
- WebP format reduces size by ~25-35% for supporting browsers

**Result:** ~90% bandwidth savings for mobile users!

---

## Troubleshooting

### Images not processing

- Check that Sharp.js is installed: `npm list sharp`
- Verify sufficient memory for image processing
- Check logs for Sharp-related errors

### Rate limiting not working

- Verify Redis is running: `redis-cli ping`
- Check REDIS_URL environment variable
- View logs for Redis connection status

### CloudFront URLs not working

- Verify AWS_CLOUDFRONT_DOMAIN is set
- Ensure CloudFront distribution is configured
- Check that query parameters are being forwarded

---

## Additional Resources

- [Sharp.js Documentation](https://sharp.pixelplumbing.com/)
- [rate-limiter-flexible Documentation](https://github.com/animir/node-rate-limiter-flexible)
- [CloudFront Functions Guide](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/cloudfront-functions.html)
- [WebP Image Format](https://developers.google.com/speed/webp)
