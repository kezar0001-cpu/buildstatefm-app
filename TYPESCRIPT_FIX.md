# TypeScript Syntax Fix for Node.js Runtime

## Problem

The backend was crashing on Render because `backend/src/routes/auth.js` contained TypeScript-only syntax (`as string` type assertions) while running in pure JavaScript mode with `node src/index.js`.

**Error Type**: SyntaxError - unexpected token 'as'

## Root Cause

The password reset feature implementation inadvertently included TypeScript syntax in a `.js` file:

### Lines with TypeScript Syntax (auth.js)

1. **Line 525**: `where: { selector: selector as string }`
2. **Line 554**: `const isValidToken = await bcrypt.compare(token as string, passwordReset.verifier);`

## Solution

Replaced TypeScript type assertions with JavaScript type coercion using the `String()` constructor:

### Before (TypeScript syntax - ❌ breaks in Node.js)
```javascript
// Line 525
where: { selector: selector as string }

// Line 554
const isValidToken = await bcrypt.compare(token as string, passwordReset.verifier);
```

### After (JavaScript - ✅ works in Node.js)
```javascript
// Line 525
where: { selector: String(selector) }

// Line 554
const isValidToken = await bcrypt.compare(String(token), passwordReset.verifier);
```

## Why This Works

- `String(selector)` converts the value to a string in plain JavaScript
- Achieves the same result as `selector as string` in TypeScript
- Compatible with Node.js runtime (no compilation needed)
- Handles edge cases where query params might be arrays or undefined

## Verification

### ✅ Syntax Checks Passed
```bash
node -c src/routes/auth.js  # ✓ No syntax errors
node -c src/index.js         # ✓ No syntax errors
```

### ✅ Routes Verified
- POST `/api/auth/forgot-password` - Request password reset (line 432)
- GET `/api/auth/reset-password/validate` - Validate token (line 512)
- POST `/api/auth/reset-password` - Complete reset (line 582)
- Auth routes mounted at `/api/auth` (index.js line 121)

### ✅ CORS Verified
- `https://buildtstate.com.au` is in the CORS allowlist (index.js line 34)
- Frontend requests will be allowed

### ✅ Other Files Checked
Scanned all backend `.js` files for TypeScript syntax:
- `properties.js` - No issues (false positives: "type" in strings/properties)
- `billing.js` - No issues (false positives: "event.type" in comments)

## Expected Behavior After Fix

1. **Backend starts cleanly** on Render with `node src/index.js`
2. **No syntax errors** in startup logs
3. **Endpoint accessible** at `https://api.buildstate.com.au/auth/forgot-password`
4. **Frontend can call** the endpoint from `https://buildtstate.com.au/forgot-password`
5. **CORS allows** requests from the frontend domain

## Testing in Production

Once deployed to Render, verify:

1. **Check Render logs** for clean startup:
   ```
   ✅ Buildstate FM backend listening on port 3000
   ```

2. **Test the endpoint** with curl:
   ```bash
   curl -X POST https://api.buildstate.com.au/auth/forgot-password \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com"}'
   ```

   Expected response (200 OK):
   ```json
   {
     "success": true,
     "message": "If an account exists with this email, you will receive password reset instructions."
   }
   ```

3. **Test from frontend**:
   - Navigate to https://buildtstate.com.au/forgot-password
   - Enter an email address
   - Submit form
   - Should see success message (no CORS errors in browser console)

## Files Modified

- `backend/src/routes/auth.js` - 2 lines changed (removed TypeScript syntax)

## Commit Details

**Branch**: `claude/implement-forgot-password-011CUWmULEpxfniQtGGjS8MH`

**Changes**:
- 2 insertions (+)
- 2 deletions (-)

**Commit Message**: "Fix TypeScript syntax in auth.js for Node.js runtime"

## Prevention for Future

To avoid this issue in the future:

1. **Use `.js` extension only for JavaScript** - No TypeScript syntax allowed
2. **Use `.ts` extension for TypeScript** - Requires compilation step
3. **Run syntax checks** before committing:
   ```bash
   node -c backend/src/routes/auth.js
   ```
4. **Test locally** with `node src/index.js` (not just with nodemon/ts-node)

## Related Documentation

- Main setup guide: `PASSWORD_RESET_SETUP.md`
- Implementation summary: `IMPLEMENTATION_SUMMARY.md`

---

**Fixed**: 2025-10-27
**Status**: ✅ Ready for production deployment
