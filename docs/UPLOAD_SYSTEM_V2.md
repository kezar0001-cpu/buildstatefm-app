# Upload System V2 - Documentation & Verification

## Overview

This document describes the new unified upload system (v2) that replaces the previous fragmented upload logic. The new system provides:

1. **Simple, predictable API** - Single endpoint for all uploads
2. **Proper rate limiting** - 10 uploads per 30 seconds with graceful handling
3. **Clean frontend hook** - `useUploader` with max 2 concurrent uploads
4. **Consistent error handling** - Structured error responses

## Environment Variables

The upload system requires these environment variables:

```bash
# AWS S3 Configuration (Required)
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=ap-southeast-2
AWS_S3_BUCKET_NAME=your-bucket-name

# CloudFront (Optional - for CDN)
AWS_CLOUDFRONT_DOMAIN=d123456.cloudfront.net

# Redis (Required for rate limiting)
REDIS_URL=redis://localhost:6379

# API URLs
API_URL=https://api.buildstate.com.au
```

## Backend API

### Endpoint: `POST /api/v2/uploads`

Upload a single file.

**Request:**
```
Content-Type: multipart/form-data

Fields:
- file: (required) The file to upload
- entityType: (required) property | unit | inspection | job | document | profile | service-request
- entityId: (required) UUID of the entity
- category: (optional) Category string (e.g., 'hero', 'gallery', 'lease')
- fileType: (optional) 'image' | 'document' (defaults to 'image')
```

**Success Response (201):**
```json
{
  "success": true,
  "file": {
    "key": "uploads/property/abc123/uuid.jpg",
    "url": "https://cdn.example.com/uploads/property/abc123/uuid.jpg",
    "size": 123456,
    "mimeType": "image/jpeg",
    "originalName": "photo.jpg",
    "entityType": "property",
    "entityId": "abc123",
    "category": "gallery"
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "RATE_LIMITED",
  "message": "Too many uploads. Please wait before uploading more files.",
  "retryAfterSeconds": 30
}
```

**Error Types:**
- `RATE_LIMITED` - Rate limit exceeded (429)
- `VALIDATION_ERROR` - Invalid input (400)
- `UPLOAD_FAILED` - Upload processing failed (500)
- `STORAGE_ERROR` - S3/storage error (500)
- `FILE_TOO_LARGE` - File exceeds size limit (400)
- `INVALID_TYPE` - Invalid file type (400)

### Endpoint: `DELETE /api/v2/uploads/:key`

Delete a file by its S3 key.

**Response (200):**
```json
{
  "success": true
}
```

### Endpoint: `GET /api/v2/uploads/health`

Health check endpoint.

**Response:**
```json
{
  "ok": true,
  "storage": "s3",
  "timestamp": "2025-12-07T10:00:00.000Z"
}
```

## Frontend Usage

### Basic Usage with useUploader

```jsx
import { useUploader, FileStatus } from '@/features/uploads';

function MyComponent({ propertyId }) {
  const {
    files,
    isUploading,
    isPaused,
    pauseReason,
    addFiles,
    removeFile,
    retryFile,
    getCompletedFiles,
  } = useUploader({
    entityType: 'property',
    entityId: propertyId,
    category: 'gallery',
    onSuccess: (file) => {
      console.log('Uploaded:', file.url);
    },
    onError: (file, error) => {
      console.error('Failed:', error);
    },
  });

  const handleFileSelect = (e) => {
    addFiles(e.target.files);
  };

  return (
    <div>
      <input type="file" multiple onChange={handleFileSelect} />

      {isPaused && <p>{pauseReason}</p>}

      {files.map((file) => (
        <div key={file.id}>
          <span>{file.name}</span>
          <span>{file.status}</span>
          {file.status === FileStatus.ERROR && (
            <button onClick={() => retryFile(file.id)}>Retry</button>
          )}
        </div>
      ))}
    </div>
  );
}
```

### Using Components

```jsx
import {
  useUploader,
  UploadDropzone,
  UploadProgress,
  PropertyImageManagerV2,
} from '@/features/uploads';

// Simple dropzone + progress
function SimpleUploader({ entityType, entityId }) {
  const uploader = useUploader({ entityType, entityId });

  return (
    <>
      <UploadDropzone onFilesSelected={uploader.addFiles} />
      <UploadProgress
        files={uploader.files}
        isPaused={uploader.isPaused}
        pauseReason={uploader.pauseReason}
        onRemove={uploader.removeFile}
        onRetry={uploader.retryFile}
      />
    </>
  );
}

// Full property image manager
function PropertyImages({ propertyId, images, coverUrl, onChange }) {
  return (
    <PropertyImageManagerV2
      propertyId={propertyId}
      images={images}
      coverImageUrl={coverUrl}
      onChange={onChange}
    />
  );
}
```

## Rate Limiting Behavior

### Backend Configuration
- **Limit:** 10 uploads per 30 seconds per user
- **Key:** User ID (for authenticated requests)
- **Response:** 429 with `Retry-After` header

### Frontend Handling
1. When 429 received, uploads are **paused** globally
2. `pauseReason` displays countdown message
3. After retry delay, uploads automatically **resume**
4. Paused files stay in queue with `pending` status

## File Processing

### Images
- **Max Size:** 10MB
- **Allowed Types:** JPEG, PNG, WebP, GIF, HEIC
- **Compression:** Images > 1MB are compressed to ~85% quality
- **Resize:** Images > 2000px are resized

### Documents
- **Max Size:** 20MB
- **Allowed Types:** PDF, Word, Excel, Text, CSV, Images

## S3 Key Structure

Files are stored with this key pattern:
```
uploads/{entityType}/{entityId}/{uuid}.{ext}
```

Example:
```
uploads/property/clm123abc/550e8400-e29b-41d4-a716-446655440000.jpg
```

## Migration Guide

### From Old System to V2

**Old system:**
```jsx
// Old way - uses /api/uploads/multiple
import { useImageUpload } from '@/features/images/hooks';

const { uploadFiles, images } = useImageUpload({
  endpoint: '/api/uploads/multiple',
  compressImages: true,
});
```

**New system:**
```jsx
// New way - uses /api/v2/uploads
import { useUploader } from '@/features/uploads';

const { addFiles, files } = useUploader({
  entityType: 'property',
  entityId: propertyId,
});
```

### Gradual Migration

Both systems can run simultaneously:
- Legacy: `/api/uploads/*` endpoints
- New: `/api/v2/uploads` endpoint

Components can be migrated incrementally:
- `PropertyImageManager` - Old system
- `PropertyImageManagerV2` - New system

---

## Verification Checklist

### Backend Verification

1. **Health Check**
   - [ ] Visit `GET /api/v2/uploads/health`
   - [ ] Should return `{ ok: true, storage: "s3" }`

2. **Single File Upload**
   - [ ] POST to `/api/v2/uploads` with image
   - [ ] Response has `success: true` and `file.url`
   - [ ] File accessible at returned URL

3. **Rate Limiting**
   - [ ] Upload > 10 files rapidly
   - [ ] 11th upload returns 429
   - [ ] Response includes `retryAfterSeconds`
   - [ ] `Retry-After` header is set

4. **File Validation**
   - [ ] Reject files > 20MB
   - [ ] Reject invalid MIME types
   - [ ] Return proper error messages

5. **File Deletion**
   - [ ] DELETE `/api/v2/uploads/{key}`
   - [ ] File removed from S3
   - [ ] Returns `{ success: true }`

### Frontend Verification

1. **Basic Upload**
   - [ ] Open property page
   - [ ] Select 2 images
   - [ ] Both upload successfully
   - [ ] URLs appear in gallery

2. **Rate Limit Handling**
   - [ ] Select 15+ images quickly
   - [ ] After 10, uploads pause
   - [ ] "Rate limited" message appears
   - [ ] After 30 seconds, uploads resume
   - [ ] All files eventually complete

3. **Error Handling**
   - [ ] Upload invalid file type
   - [ ] Error message shown
   - [ ] Retry button works

4. **Delete**
   - [ ] Click delete on uploaded image
   - [ ] Confirm dialog appears
   - [ ] Image removed from gallery
   - [ ] File deleted from S3

5. **Set Cover**
   - [ ] Click star on an image
   - [ ] Image marked as cover
   - [ ] Cover badge appears

### Integration Verification

1. **Property Create/Edit**
   - [ ] Add images to new property
   - [ ] Save property
   - [ ] Images persist after reload

2. **Inspection Photos**
   - [ ] Upload photos to inspection
   - [ ] Photos saved with inspection

3. **Document Upload**
   - [ ] Upload PDF document
   - [ ] Document accessible

---

## Troubleshooting

### "Storage not configured"
- Check AWS environment variables are set
- Verify AWS credentials are valid

### "Rate limit exceeded" immediately
- Check Redis connection
- Clear rate limit key: `redis-cli DEL v2_upload_rate_limit:user:YOUR_USER_ID`

### "CORS error"
- Add frontend origin to `CORS_ORIGINS`
- Check API_URL matches backend URL

### Images not appearing
- Check CloudFront domain is correct
- Verify S3 bucket permissions
- Check image URL in browser
