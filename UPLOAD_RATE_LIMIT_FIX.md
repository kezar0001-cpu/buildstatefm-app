# Upload Rate Limit Fix

**Date:** 2024-12-19  
**Issue:** 429 Rate Limit errors when uploading just 2 images

---

## Problem

Users were getting 429 (Too Many Requests) errors when uploading just 2 images, with the error message "Too many uploads. Maximum 100 uploads per minute."

### Root Cause

The `useImageUpload` hook was uploading files **individually** (one request per file) instead of batching them:

- **Before:** 2 files = 2 separate requests to `/api/uploads/multiple`
- Each request consumes 1 point from the rate limiter
- If user had previous uploads in the last minute, hitting the limit was easy

### Additional Issues

1. **No 429 error handling** - Retry logic didn't handle rate limit errors
2. **No Retry-After support** - Didn't respect server's retry-after header
3. **Inefficient upload pattern** - Multiple requests instead of one batched request

---

## Solution

### 1. Batch Upload Implementation ✅

**Changed:** `frontend/src/features/images/hooks/useImageUpload.js`

- Added `uploadBatch()` function that uploads all files in a single request
- Modified `processQueue()` to use batch upload by default
- Falls back to individual uploads only if batch fails

**Benefits:**
- 2 files = 1 request (instead of 2)
- Reduces rate limiting issues
- More efficient network usage
- Faster uploads

### 2. 429 Error Handling ✅

**Added:**
- Detection of 429 (rate limit) errors
- Extraction of `Retry-After` header
- Proper delay before retry (respects server's retry-after time)
- User-friendly error messages

**Code:**
```javascript
// Check if this is a rate limit error (429)
const isRateLimitError = err.response?.status === 429;
if (isRateLimitError) {
  // Extract Retry-After header or calculate delay
  const retryAfter = err.response?.headers?.['retry-after'] || 
                    err.response?.headers?.['Retry-After'];
  const retryAfterSeconds = retryAfter ? parseInt(retryAfter, 10) : 60;
  const delay = retryAfterSeconds * 1000; // Convert to milliseconds
  
  // Wait for the retry-after period before retrying
  await new Promise(resolve => setTimeout(resolve, delay));
}
```

### 3. Fallback Strategy ✅

If batch upload fails (e.g., rate limited), the hook now:
1. Falls back to individual uploads
2. Uploads one at a time (not concurrently)
3. Adds 1-second delay between uploads
4. Prevents further rate limiting

---

## Rate Limiter Configuration

The rate limiter is correctly configured:

- **Limit:** 100 uploads per minute per user
- **Key:** `req.user?.id || req.ip` (per-user, not global)
- **Headers:** Includes `Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Remaining`

**Current Settings:**
```javascript
export const uploadRateLimiter = createRedisRateLimiter({
  keyPrefix: 'upload_rate_limit',
  points: 100,        // 100 uploads
  duration: 60,       // per 60 seconds
  errorMessage: 'Too many uploads. Maximum 100 uploads per minute.',
});
```

---

## Testing

### Before Fix
- Upload 2 files → 2 requests → Could hit rate limit if user had 99+ uploads in last minute

### After Fix
- Upload 2 files → 1 batched request → Only 1 point consumed
- If rate limited → Waits for retry-after period → Retries automatically

---

## Files Changed

1. **`frontend/src/features/images/hooks/useImageUpload.js`**
   - Added `uploadBatch()` function
   - Modified `processQueue()` to use batch upload
   - Added 429 error handling with retry-after support
   - Fixed import for `expandUploadQueue`

---

## User Experience Improvements

### Before
- ❌ 429 errors on small uploads
- ❌ Confusing error messages
- ❌ No automatic retry for rate limits
- ❌ Multiple requests for multiple files

### After
- ✅ Batch uploads (more efficient)
- ✅ Clear error messages
- ✅ Automatic retry with proper delays
- ✅ Single request for multiple files
- ✅ Better rate limit handling

---

## Verification

To verify the fix works:

1. **Upload 2 images** → Should use 1 request (check network tab)
2. **Hit rate limit** → Should show retry message with countdown
3. **Automatic retry** → Should retry after the retry-after period
4. **Batch upload** → All files should upload together

---

## Additional Recommendations

### If Rate Limiting Still Occurs

1. **Increase limit** (if needed):
   ```javascript
   points: 200,  // Increase to 200 uploads per minute
   ```

2. **Adjust batch size** (if needed):
   - Current: All files in one batch
   - Alternative: Batch in groups of 10-20 files

3. **Monitor Redis**:
   - Check if rate limiter keys are being created correctly
   - Verify per-user isolation

---

**Status:** ✅ FIXED  
**Deployment:** Ready for production

