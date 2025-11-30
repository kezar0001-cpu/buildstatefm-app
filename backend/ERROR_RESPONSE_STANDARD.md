# Standardized Error Response Format

## Overview

All API endpoints in the Buildstate FM backend now return errors in a consistent, structured format. This standardization simplifies frontend error handling and provides clear error codes for programmatic error handling.

## Standard Error Response Format

```typescript
{
  success: false,
  message: string,        // User-friendly error message
  code?: string,          // Machine-readable error code (optional)
  errors?: Array<any>     // Additional error details, e.g., validation errors (optional)
}
```

### Fields

- **success** (boolean): Always `false` for error responses
- **message** (string): Human-readable error message suitable for display to users
- **code** (string, optional): Machine-readable error code for programmatic handling
- **errors** (array/object, optional): Additional error details, particularly useful for validation errors

## Error Code Categories

### Authentication Errors (AUTH_*)
- `AUTH_NO_TOKEN` - No authentication token provided
- `AUTH_INVALID_TOKEN` - Token is invalid or malformed
- `AUTH_TOKEN_EXPIRED` - Token has expired
- `AUTH_UNAUTHORIZED` - General authentication failure
- `AUTH_INVALID_CREDENTIALS` - Invalid email or password
- `AUTH_EMAIL_NOT_VERIFIED` - Email address not verified
- `AUTH_ACCOUNT_INACTIVE` - User account is inactive
- `AUTH_INSUFFICIENT_PERMISSIONS` - User lacks required permissions

### Access Control Errors (ACC_*)
- `ACC_ACCESS_DENIED` - General access denied
- `ACC_PROPERTY_ACCESS_DENIED` - No access to specific property
- `ACC_UNIT_ACCESS_DENIED` - No access to specific unit
- `ACC_ROLE_REQUIRED` - Required role not met

### Subscription Errors (SUB_*)
- `SUB_TRIAL_EXPIRED` - Trial period has expired
- `SUB_SUBSCRIPTION_REQUIRED` - Active subscription required
- `SUB_MANAGER_SUBSCRIPTION_REQUIRED` - Property manager subscription required
- `SUB_SUBSCRIPTION_INACTIVE` - Subscription is inactive
- `SUB_SUBSCRIPTION_CANCELLED` - Subscription has been cancelled
- `SUB_PLAN_NOT_FOUND` - Subscription plan not found

### Validation Errors (VAL_*)
- `VAL_VALIDATION_ERROR` - General validation error (check `errors` field)
- `VAL_INVALID_REQUEST` - Invalid request format
- `VAL_MISSING_FIELD` - Required field is missing
- `VAL_INVALID_FORMAT` - Field format is invalid
- `VAL_INVALID_EMAIL` - Email format is invalid
- `VAL_INVALID_PASSWORD` - Password format is invalid
- `VAL_PASSWORD_WEAK` - Password doesn't meet strength requirements
- `VAL_INVALID_ID` - Invalid ID format
- `VAL_INVALID_DATE` - Invalid date format

### Resource Errors (RES_*)
- `RES_NOT_FOUND` - Generic resource not found
- `RES_ALREADY_EXISTS` - Resource already exists
- `RES_USER_NOT_FOUND` - User not found
- `RES_PROPERTY_NOT_FOUND` - Property not found
- `RES_UNIT_NOT_FOUND` - Unit not found
- `RES_TENANT_NOT_FOUND` - Tenant not found
- `RES_REPORT_NOT_FOUND` - Report not found
- `RES_SERVICE_REQUEST_NOT_FOUND` - Service request not found
- `RES_JOB_NOT_FOUND` - Job not found
- `RES_INVITE_NOT_FOUND` - Invite not found
- `RES_MAINTENANCE_NOT_FOUND` - Maintenance record not found
- `RES_INSPECTION_NOT_FOUND` - Inspection not found

### Database Errors (DB_*)
- `DB_OPERATION_FAILED` - Database operation failed
- `DB_UNIQUE_CONSTRAINT` - Unique constraint violation
- `DB_FOREIGN_KEY_CONSTRAINT` - Foreign key constraint violation
- `DB_RELATION_VIOLATION` - Cannot delete due to existing relationships
- `DB_RECORD_NOT_FOUND` - Database record not found

### File Upload Errors (FILE_*)
- `FILE_NO_FILE_UPLOADED` - No file was uploaded
- `FILE_INVALID_TYPE` - Invalid file type
- `FILE_TOO_LARGE` - File exceeds size limit
- `FILE_UPLOAD_FAILED` - File upload failed
- `FILE_DELETE_FAILED` - File deletion failed

### External Service Errors (EXT_*)
- `EXT_STRIPE_ERROR` - Stripe API error
- `EXT_STRIPE_NOT_CONFIGURED` - Stripe is not configured
- `EXT_EMAIL_SEND_FAILED` - Email sending failed
- `EXT_SERVICE_UNAVAILABLE` - External service unavailable

### Business Logic Errors (BIZ_*)
- `BIZ_INVITE_EXPIRED` - Invite has expired
- `BIZ_INVITE_ALREADY_ACCEPTED` - Invite already accepted
- `BIZ_EMAIL_ALREADY_REGISTERED` - Email already registered
- `BIZ_CANNOT_DELETE_SELF` - Cannot delete own account
- `BIZ_INVALID_STATUS_TRANSITION` - Invalid status transition
- `BIZ_OPERATION_NOT_ALLOWED` - Operation not allowed in current state

### General Errors (ERR_*)
- `ERR_INTERNAL_SERVER` - Internal server error
- `ERR_BAD_REQUEST` - Bad request
- `ERR_CONFLICT` - Conflict with existing resource
- `ERR_UNKNOWN` - Unknown error

## HTTP Status Codes

The following HTTP status codes are used:

- **200** - Success (not an error)
- **201** - Created (not an error)
- **400** - Bad Request (validation errors, malformed requests)
- **401** - Unauthorized (authentication required or failed)
- **403** - Forbidden (authenticated but not authorized)
- **404** - Not Found (resource doesn't exist)
- **409** - Conflict (unique constraint violations)
- **500** - Internal Server Error (unexpected errors)
- **503** - Service Unavailable (external service not available)

## Example Error Responses

### 1. Authentication Error
```json
{
  "success": false,
  "message": "No token provided",
  "code": "AUTH_NO_TOKEN"
}
```

### 2. Validation Error with Details
```json
{
  "success": false,
  "message": "Validation error",
  "code": "VAL_VALIDATION_ERROR",
  "errors": [
    {
      "path": ["email"],
      "message": "Invalid email format"
    },
    {
      "path": ["password"],
      "message": "Password must be at least 8 characters"
    }
  ]
}
```

### 3. Resource Not Found
```json
{
  "success": false,
  "message": "Property not found",
  "code": "RES_PROPERTY_NOT_FOUND"
}
```

### 4. Subscription Required
```json
{
  "success": false,
  "message": "Your trial period has expired. Please upgrade your plan to continue.",
  "code": "SUB_TRIAL_EXPIRED"
}
```

### 5. Password Validation with Requirements
```json
{
  "success": false,
  "message": "Password must contain at least one uppercase letter",
  "code": "VAL_PASSWORD_WEAK",
  "errors": {
    "length": true,
    "lowercase": true,
    "uppercase": false,
    "number": true,
    "special": true
  }
}
```

### 6. Access Denied
```json
{
  "success": false,
  "message": "Access denied to this property",
  "code": "ACC_PROPERTY_ACCESS_DENIED"
}
```

## Frontend Error Handling Guidelines

### Basic Error Handling

```typescript
try {
  const response = await api.post('/endpoint', data);
  // Handle success
} catch (error) {
  const { message, code, errors } = error.response.data;

  // Display user-friendly message
  showToast(message);

  // Handle specific error codes
  switch (code) {
    case 'AUTH_TOKEN_EXPIRED':
      // Redirect to login
      redirectToLogin();
      break;
    case 'SUB_TRIAL_EXPIRED':
      // Show upgrade modal
      showUpgradeModal();
      break;
    case 'VAL_VALIDATION_ERROR':
      // Show validation errors on form fields
      displayValidationErrors(errors);
      break;
    default:
      // Handle generic error
      showGenericError(message);
  }
}
```

### Validation Error Handling

```typescript
if (code === 'VAL_VALIDATION_ERROR' && errors) {
  errors.forEach(error => {
    const field = error.path?.[0];
    if (field) {
      setFieldError(field, error.message);
    }
  });
}
```

### Subscription Error Handling

```typescript
const SUBSCRIPTION_ERROR_CODES = [
  'SUB_TRIAL_EXPIRED',
  'SUB_SUBSCRIPTION_REQUIRED',
  'SUB_MANAGER_SUBSCRIPTION_REQUIRED'
];

if (SUBSCRIPTION_ERROR_CODES.includes(code)) {
  showUpgradePrompt(message);
}
```

## Migration Notes

### Old Format → New Format

**Before:**
```json
{ "error": "No token" }
```

**After:**
```json
{
  "success": false,
  "message": "No token provided",
  "code": "AUTH_NO_TOKEN"
}
```

**Before:**
```json
{
  "error": "Invalid request",
  "details": [...]
}
```

**After:**
```json
{
  "success": false,
  "message": "Validation error",
  "code": "VAL_VALIDATION_ERROR",
  "errors": [...]
}
```

**Before:**
```json
{
  "success": false,
  "message": "...",
  "code": "TRIAL_EXPIRED"
}
```

**After:**
```json
{
  "success": false,
  "message": "...",
  "code": "SUB_TRIAL_EXPIRED"
}
```

## Implementation Details

### Backend Usage

Import the error handler and error codes:

```javascript
import { sendError, ErrorCodes } from '../utils/errorHandler.js';
```

Send standardized errors:

```javascript
// Simple error
return sendError(res, 404, 'Property not found', ErrorCodes.RES_PROPERTY_NOT_FOUND);

// Error with validation details
return sendError(
  res,
  400,
  'Validation error',
  ErrorCodes.VAL_VALIDATION_ERROR,
  error.errors
);
```

### Async Handler

Use `asyncHandler` to automatically catch and format errors:

```javascript
import { asyncHandler } from '../utils/errorHandler.js';

router.get('/endpoint', asyncHandler(async (req, res) => {
  // Your code here
  // Thrown errors will be automatically caught and formatted
}));
```

## Testing Error Responses

All error responses can be tested by checking:

1. HTTP status code is appropriate
2. Response body contains `success: false`
3. Response body contains a user-friendly `message`
4. Response body contains an appropriate `code`
5. Validation errors include `errors` array with details

## Files Updated

The following files were updated to use the standardized error format:

### Core Utilities
- `/backend/src/utils/errorHandler.js` - Enhanced with error codes support
- `/backend/src/utils/errorCodes.js` - New file with all error code constants

### Middleware
- `/backend/src/middleware/auth.js` - All auth errors standardized
- `/backend/src/middleware/validate.js` - Validation errors standardized

### Route Files
- `/backend/src/routes/auth.js` - 35 error responses
- `/backend/src/routes/billing.js` - 22 error responses
- `/backend/src/routes/properties.js` - 11 error responses
- `/backend/src/routes/uploads.js` - 4 error responses
- `/backend/src/routes/serviceRequests.js` - 36 error responses
- `/backend/src/routes/jobs.js` - 31 error responses
- `/backend/src/routes/units.js` - 6 error responses
- `/backend/src/routes/inspections.js` - 34 error responses
- `/backend/src/routes/tenants.js` - 5 error responses
- `/backend/src/routes/reports.js` - 10 error responses
- `/backend/src/routes/newReports.js` - 4 error responses
- `/backend/src/routes/maintenance.js` - 10 error responses
- `/backend/src/routes/recommendations.js` - 10 error responses
- `/backend/src/routes/invites.js` - 10 error responses
- `/backend/src/routes/users.js` - 7 error responses
- `/backend/src/routes/subscriptions.js` - 3 error responses
- `/backend/src/routes/plans.js` - 11 error responses
- `/backend/src/routes/notifications.js` - 4 error responses
- `/backend/src/routes/dashboard.js` - Uses asyncHandler
- `/backend/src/routes/search.js` - Uses asyncHandler

**Total**: ~250+ error responses standardized across 22 files

## Benefits

1. **Consistency** - All errors follow the same structure
2. **Type Safety** - Error codes are defined as constants
3. **Better UX** - Frontend can provide specific handling for different error types
4. **Easier Debugging** - Error codes make it easy to identify error sources
5. **Maintainability** - Centralized error handling reduces code duplication
6. **Documentation** - Clear error codes serve as documentation
7. **Testing** - Predictable error format simplifies testing

## Support

For questions or issues with error handling, please refer to:
- `/backend/src/utils/errorHandler.js` - Error handling implementation
- `/backend/src/utils/errorCodes.js` - Error code definitions
- This document - Standard format and usage guidelines
