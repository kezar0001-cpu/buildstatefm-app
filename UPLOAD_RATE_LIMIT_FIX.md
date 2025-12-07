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

### 2. Enhanced 429 Error Handling ✅

**Added:**
- Detection of 429 (rate limit) errors in both batch and individual uploads
- Extraction of `Retry-After` header with proper parsing (handles both seconds and timestamps)
- Proper delay before retry (respects server's retry-after time + 2 second buffer)
- Automatic retry for batch uploads (waits and retries once before falling back)
- Prevents immediate fallback to individual uploads when rate-limited
- User-friendly error messages with countdown

**Batch Upload 429 Handling:**
```javascript
// If batch gets 429, wait for Retry-After and retry batch once
// Only falls back to individual uploads if retry also fails
const retryAfter = err.response?.headers?.['retry-after'] || 
                  err.response?.headers?.['Retry-After'];
let retryAfterSeconds = 60;
if (retryAfter) {
  const retryAfterNum = parseInt(retryAfter, 10);
  if (retryAfterNum > 1000000000) { // Unix timestamp
    retryAfterSeconds = Math.max(1, Math.ceil((retryAfterNum * 1000 - Date.now()) / 1000));
  } else {
    retryAfterSeconds = retryAfterNum;
  }
}
retryAfterSeconds = Math.max(5, retryAfterSeconds); // Minimum 5 seconds
await new Promise(resolve => setTimeout(resolve, retryAfterSeconds * 1000));
```

**Individual Upload 429 Handling:**
```javascript
// Waits for Retry-After + 2 second buffer to ensure window has reset
await new Promise(resolve => setTimeout(resolve, (retryAfterSeconds + 2) * 1000));
```

### 3. Smart Fallback Strategy ✅

If batch upload fails, the hook now:
1. **For 429 errors:** Waits for Retry-After, retries batch once, only falls back if retry also fails
2. **For other errors:** Falls back to individual uploads
3. **Individual uploads:** Upload one at a time with 2-second delays
4. **Rate-limited images:** Not included in fallback (handled by their own retry logic)
5. Prevents cascading rate limit errors

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
   - Added `uploadBatch()` function with 429 handling
   - Modified `processQueue()` to use batch upload with smart fallback
   - Enhanced 429 error handling in both batch and individual uploads
   - Improved Retry-After parsing (handles seconds and timestamps)
   - Added 2-second buffer to retry delays to ensure rate limit window has reset
   - Prevents fallback to individual uploads for rate-limited images
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
2. **Hit rate limit** → Should show retry message with countdown, wait for Retry-After period
3. **Automatic retry** → Should retry batch once, then fall back only if needed
4. **Batch upload** → All files should upload together in single request
5. **Rate limit recovery** → Should wait full Retry-After period + buffer before retrying
6. **No cascading errors** → Rate-limited images don't trigger immediate fallback

### Expected Behavior When Rate Limited:

1. Batch upload gets 429 → Shows "Rate limit exceeded. Retrying in Xs..."
2. Waits for Retry-After period (e.g., 60 seconds)
3. Retries batch upload once
4. If retry succeeds → Uploads complete
5. If retry also fails → Marks as error, user can manually retry later

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

