# Manual Setup Required for Phase 5 Complete

This document lists all manual setup steps that cannot be automated through code changes alone.

## ⚠️ Critical: These steps MUST be completed before deployment

---

## 1. CSRF Protection Configuration

### Environment Variables Required:
```bash
# CSRF Cookie Security (Production)
CSRF_COOKIE_SECURE=true          # Set to 'true' in production (requires HTTPS)
CSRF_COOKIE_SAMESITE=strict      # Options: 'strict', 'lax', 'none' (default: 'strict')
```

### When to Complete:
- **Before production deployment**
- **After setting up HTTPS/SSL certificates**

### What Will Break If Not Done:
- CSRF protection may not work correctly in production
- Cookies may not be set properly over HTTPS
- Security vulnerability if CSRF_COOKIE_SECURE is false in production

### Instructions:
1. Add `CSRF_COOKIE_SECURE=true` to your production environment variables
2. Ensure your production domain has valid SSL certificates
3. Test CSRF token generation and validation after deployment

---

## 2. Content Security Policy (CSP) Configuration

### Environment Variables Required:
```bash
# CSP Reporting (Optional, for testing)
CSP_REPORT_ONLY=true             # Set to 'true' to test CSP without blocking (default: false)
```

### When to Complete:
- **Before production deployment**
- **After testing all third-party integrations (Stripe, OAuth, etc.)**

### What Will Break If Not Done:
- Third-party scripts (Stripe, Google OAuth) may be blocked
- Inline styles from MUI may be blocked
- Image loading from external sources may fail

### Instructions:
1. Deploy with `CSP_REPORT_ONLY=true` initially to test
2. Monitor CSP violation reports
3. Adjust CSP directives in `backend/server.js` if needed
4. Set `CSP_REPORT_ONLY=false` for production enforcement

### Third-Party Services That Need CSP Allowlist:
- **Stripe**: Already configured (`https://js.stripe.com`, `https://checkout.stripe.com`, `https://api.stripe.com`)
- **Google OAuth**: Already configured (connectSrc includes `https:`)
- **AWS S3/CloudFront**: Already configured (imgSrc includes `https:`)

---

## 3. Image Optimization - Sharp Library Installation

### Manual Steps Required:
```bash
# Install sharp library
npm install sharp

# For production, ensure platform-specific binaries are available
# Sharp may require native compilation on some platforms
```

### When to Complete:
- **Before deploying image upload features**
- **During initial setup or when updating dependencies**

### What Will Break If Not Done:
- Image optimization will fail silently (original images will be uploaded)
- No error will be thrown, but images won't be optimized
- Storage costs will be higher due to unoptimized images

### Instructions:
1. Run `npm install sharp` in the backend directory
2. For production deployments on platforms like Render/Railway:
   - Ensure buildpacks support native dependencies
   - Sharp binaries are automatically downloaded for the platform
3. Test image upload to verify optimization is working

### Environment Variables (Optional):
```bash
MAX_IMAGE_WIDTH=1920             # Maximum image width (default: 1920)
MAX_IMAGE_HEIGHT=1080            # Maximum image height (default: 1080)
IMAGE_QUALITY=85                 # JPEG quality 1-100 (default: 85)
WEBP_QUALITY=80                  # WebP quality 1-100 (default: 80)
ENABLE_WEBP=true                 # Enable WebP conversion (default: true)
```

---

## 4. Database Query Timeout Configuration

### Manual Steps Required:
- **Review and adjust timeout values** in `backend/src/utils/prismaTimeout.js`
- **Monitor query performance** in production
- **Set appropriate timeouts** based on your database performance

### When to Complete:
- **After initial deployment**
- **When monitoring shows slow queries**

### What Will Break If Not Done:
- Long-running queries may hang indefinitely
- Database connections may be exhausted
- Application may become unresponsive

### Instructions:
1. Monitor database query performance in production
2. Adjust timeout values in `prismaTimeout.js` based on:
   - Average query execution time
   - Database server capabilities
   - Network latency
3. Default timeout is 30 seconds (30000ms) - adjust as needed

---

## 5. Subscription Enforcement Audit

### Manual Steps Required:
- **Review all API routes** listed in `backend/src/utils/subscriptionAudit.js`
- **Add subscription middleware** to routes that are missing it
- **Test subscription enforcement** for each protected route

### When to Complete:
- **Before production deployment**
- **After adding new routes**

### What Will Break If Not Done:
- Users with expired trials may access premium features
- Subscription revenue may be lost
- Feature access control may be inconsistent

### Instructions:
1. Review `backend/src/utils/subscriptionAudit.js` for the list of routes
2. Check each route file to ensure it has:
   - `requireActiveSubscription` for property manager routes
   - `requirePropertyManagerSubscription` for property-specific routes
3. Test with expired trial accounts to verify enforcement
4. Update the audit file as you add new routes

### Example Route Check:
```javascript
// ✅ Correct - Has subscription check
router.post('/properties', requireAuth, requireActiveSubscription, createProperty);

// ❌ Missing - No subscription check
router.post('/properties', requireAuth, createProperty);
```

---

## 6. Rate Limit Headers Verification

### Manual Steps Required:
- **Test rate limiting** in production
- **Verify headers are returned** in API responses
- **Monitor rate limit usage** by clients

### When to Complete:
- **After deployment**
- **During load testing**

### What Will Break If Not Done:
- Clients won't know their rate limit status
- May lead to unexpected 429 errors
- Poor developer experience for API consumers

### Instructions:
1. Make API requests and check response headers for:
   - `X-RateLimit-Limit`
   - `X-RateLimit-Remaining`
   - `X-RateLimit-Reset`
2. Verify headers are present in all API responses
3. Test rate limit enforcement by exceeding limits

---

## 7. Session Configuration (Already Configured)

### Current Configuration:
- Session regeneration on login is implemented
- Session middleware is configured in `backend/server.js`

### Verification Required:
- **Test login flow** to ensure sessions are regenerated
- **Verify session cookies** are set correctly

### When to Complete:
- **After deployment**
- **During security testing**

---

## 8. Frontend CSRF Token Integration

### Manual Steps Required:
- **Test CSRF token retrieval** on frontend
- **Verify tokens are included** in state-changing requests
- **Test error handling** when CSRF token is invalid

### When to Complete:
- **After backend CSRF is deployed**
- **Before user testing**

### What Will Break If Not Done:
- POST/PUT/PATCH/DELETE requests will fail with 403 errors
- Users won't be able to create/update/delete data
- Application will be non-functional for state-changing operations

### Instructions:
1. Open browser DevTools → Network tab
2. Make a POST request (e.g., create a property)
3. Verify request includes `X-XSRF-TOKEN` header
4. Verify cookie `XSRF-TOKEN` is set
5. Test with invalid token to verify error handling

---

## 9. Environment Variables Summary

### Required for Production:
```bash
# CSRF
CSRF_COOKIE_SECURE=true
CSRF_COOKIE_SAMESITE=strict

# CSP (Optional)
CSP_REPORT_ONLY=false

# Image Optimization (Optional)
MAX_IMAGE_WIDTH=1920
MAX_IMAGE_HEIGHT=1080
IMAGE_QUALITY=85
WEBP_QUALITY=80
ENABLE_WEBP=true
```

### When to Set:
- **Before production deployment**
- **In your hosting platform's environment variable settings**
- **In your CI/CD pipeline configuration**

---

## 10. Testing Checklist

### Before Production Deployment:
- [ ] CSRF tokens are generated and validated correctly
- [ ] CSP headers don't block required resources
- [ ] Image optimization works (check file sizes before/after)
- [ ] Subscription checks are enforced on all protected routes
- [ ] Dashboard queries are optimized (check query count in logs)
- [ ] Rate limit headers are present in responses
- [ ] Session regeneration works on login
- [ ] All environment variables are set correctly

### Post-Deployment Monitoring:
- [ ] Monitor CSP violation reports
- [ ] Check image upload sizes (should be reduced)
- [ ] Monitor database query performance
- [ ] Verify subscription enforcement is working
- [ ] Check rate limit header responses
- [ ] Monitor CSRF token errors (should be minimal)

---

## Support

If you encounter issues with any of these manual setup steps:
1. Check the error logs for specific error messages
2. Review the implementation files for configuration options
3. Test in a staging environment before production
4. Consult the documentation for each service (Stripe, AWS, etc.)

---

## Notes

- All code changes are complete and ready for deployment
- Manual steps are required for configuration and verification
- Test thoroughly in staging before production deployment
- Monitor logs and metrics after deployment to ensure everything works correctly

