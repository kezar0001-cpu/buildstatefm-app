# Admin Access Guide - Buildstate FM

## Overview

This guide explains the secure admin authentication workflow and how to access the admin panel for managing users, analytics, subscriptions, and system data.

## Admin Authentication Flow

### 1. Initial Admin Setup

**First-time setup** (when no admin exists):

1. Navigate to `/admin/setup`
2. Fill in admin account details:
   - First Name, Last Name
   - Email (will be your admin login)
   - Password (minimum 8 characters)
   - Phone (optional)
3. Click "Create Admin Account"
4. You'll be automatically logged in and redirected to `/admin/blog`

### 2. Admin Login

**Regular admin login**:

1. Navigate to `/admin/blog/login`
2. Enter your admin email and password
3. System verifies:
   - Email and password match
   - User has `ADMIN` role
   - Account is active
4. On success, you receive:
   - JWT access token (stored in localStorage)
   - User data (cached in localStorage)
   - Redirect to admin panel

### 3. Admin Recovery

**If you're locked out** (admin exists but you can't access):

1. Navigate to `/admin/setup`
2. Click "Recover Admin Access"
3. Enter the **Recovery PIN** (from environment variable `ADMIN_SETUP_PIN`)
4. Create a new admin account
5. Both admin accounts will coexist

**Security Note**: The Recovery PIN should be:
- Set in `.env` as `ADMIN_SETUP_PIN`
- Kept secret and secure
- Changed regularly in production
- Never committed to version control

## Backend Security Implementation

### Dedicated Admin Middleware

Located at: `backend/src/middleware/adminAuth.js`

**Features**:
- Separate authentication logic from regular users
- Detailed error logging for troubleshooting
- Account status verification (active, not suspended)
- Request context enrichment
- Audit trail logging

**Usage**:
```javascript
import { requireAdmin, logAdminAction } from '../middleware/adminAuth.js';

// Protect admin-only route
router.get('/admin/users', requireAdmin, async (req, res) => {
  // req.user contains admin user data
  // req.isAdmin is true
});

// With action logging
router.post('/admin/users/:id', requireAdmin, logAdminAction('update_user'), async (req, res) => {
  // Action is logged for audit trail
});
```

### Token Management

**Access Token**:
- Expires after 15 minutes (configurable)
- Stored in `localStorage` as `auth_token`
- Sent in `Authorization: Bearer <token>` header

**Refresh Token**:
- Expires after 7 days
- Stored in HTTP-only cookie
- Used to get new access token without re-login

**Token Refresh Flow**:
1. Access token expires
2. Frontend calls `/api/auth/refresh` with refresh token
3. Backend issues new access token
4. Frontend updates localStorage
5. Request is retried with new token

## Admin Panel Routes

### Backend API Routes

All admin routes are prefixed with `/api/admin` and require admin authentication:

#### Dashboard & Analytics
- `GET /api/admin/dashboard` - Overview metrics
- `GET /api/admin/analytics/users` - User analytics
- `GET /api/admin/analytics/subscriptions` - Subscription metrics

#### User Management
- `GET /api/admin/users` - List all users (with pagination, filtering)
- `GET /api/admin/users/:id` - Get user details
- `PATCH /api/admin/users/:id` - Update user (subscription, status, etc.)

#### Blog Management
- `GET /api/blog/admin/posts` - All blog posts
- `POST /api/blog/admin/posts` - Create post
- `PUT /api/blog/admin/posts/:id` - Update post
- `DELETE /api/blog/admin/posts/:id` - Delete post
- `GET /api/blog/admin/automation/status` - Automation stats
- `POST /api/blog/admin/automation/generate` - Trigger post generation

#### System Health
- `GET /api/admin/health` - System health metrics

### Frontend Routes

- `/admin/setup` - Initial admin setup or recovery
- `/admin/blog/login` - Admin login page
- `/admin/blog` - Blog admin dashboard
- `/admin/blog/posts/:id` - Edit blog post
- `/admin/blog/categories/:id` - Edit category
- `/admin/blog/tags/:id` - Edit tag

## Best Practices for Admin Access

### 1. Secure Token Storage

**DO**:
- Store tokens in `localStorage` for admin panel access
- Clear tokens on logout
- Validate token on every protected route

**DON'T**:
- Share admin credentials
- Store passwords in plain text
- Log sensitive token data

### 2. Session Management

**Token Expiry Handling**:
```javascript
// Frontend should handle 401 errors
apiClient.interceptors.response.use(
  response => response,
  async error => {
    if (error.response?.status === 401) {
      // Try to refresh token
      const refreshed = await refreshToken();
      if (refreshed) {
        // Retry original request
        return apiClient(error.config);
      }
      // Redirect to login
      window.location.href = '/admin/blog/login';
    }
    return Promise.reject(error);
  }
);
```

### 3. Audit Logging

All admin actions are logged with:
- Admin user ID and email
- Action performed
- Timestamp
- IP address
- User agent
- Request path and method

**Example log**:
```
[Admin Action] {
  action: 'update_user',
  adminId: 'abc123',
  adminEmail: 'admin@buildstate.com.au',
  path: '/api/admin/users/xyz789',
  method: 'PATCH',
  timestamp: '2025-12-10T09:30:00.000Z',
  ip: '192.168.1.1'
}
```

### 4. Role Verification

Every admin route verifies:
1. Valid JWT token
2. User exists in database
3. User role is `ADMIN`
4. Account is active

**Middleware chain**:
```
Request → requireAdmin → logAdminAction → Route Handler
```

## Troubleshooting

### Issue: "Admin authentication required"

**Cause**: No token or invalid token

**Solution**:
1. Check if `auth_token` exists in localStorage
2. Try logging out and back in
3. Clear browser cache and cookies
4. Check browser console for errors

### Issue: "Access denied. Admin privileges required"

**Cause**: User exists but doesn't have ADMIN role

**Solution**:
1. Verify user role in database:
   ```sql
   SELECT id, email, role FROM "User" WHERE email = 'your@email.com';
   ```
2. If role is not ADMIN, update it:
   ```sql
   UPDATE "User" SET role = 'ADMIN' WHERE email = 'your@email.com';
   ```

### Issue: "Your admin session has expired"

**Cause**: Access token expired and refresh failed

**Solution**:
1. Log in again at `/admin/blog/login`
2. If refresh token also expired, you'll need to re-authenticate
3. Consider increasing token expiry in production

### Issue: "Admin account is inactive"

**Cause**: Account was deactivated

**Solution**:
1. Use recovery PIN to create new admin account
2. Or update database directly:
   ```sql
   UPDATE "User" SET "isActive" = true WHERE email = 'admin@email.com';
   ```

## Environment Variables

Required for admin functionality:

```env
# Admin Setup PIN (for recovery access)
ADMIN_SETUP_PIN=your-secure-pin-here

# JWT Secrets
JWT_SECRET=your-jwt-secret
JWT_REFRESH_SECRET=your-refresh-secret

# Token Expiry
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Frontend URL (for CORS)
FRONTEND_URL=https://your-frontend.com
```

## Security Recommendations

### Production Deployment

1. **Use strong Recovery PIN**:
   - Minimum 20 characters
   - Mix of letters, numbers, symbols
   - Store securely (password manager, secrets vault)

2. **Enable HTTPS**:
   - All admin routes must use HTTPS
   - Set `secure: true` for cookies in production

3. **Implement rate limiting**:
   - Already configured: 5 attempts per 15 minutes for login
   - Monitor for brute force attempts

4. **Regular security audits**:
   - Review admin action logs
   - Check for suspicious activity
   - Rotate JWT secrets periodically

5. **Multi-factor authentication** (Future enhancement):
   - Add 2FA for admin accounts
   - Use authenticator apps (Google Authenticator, Authy)

6. **IP whitelisting** (Optional):
   - Restrict admin access to specific IPs
   - Useful for corporate environments

## Future Enhancements

Planned improvements for admin access:

1. **Enhanced Analytics Dashboard**:
   - Real-time metrics
   - Custom date ranges
   - Export capabilities
   - Visualization charts

2. **Advanced User Management**:
   - Bulk operations
   - User impersonation (for support)
   - Activity timeline

3. **System Monitoring**:
   - Error tracking integration
   - Performance metrics
   - Database query analytics

4. **Automated Alerts**:
   - Email notifications for critical events
   - Slack/Discord integration
   - Custom alert rules

5. **Role-Based Access Control**:
   - Super Admin vs. Admin roles
   - Granular permissions
   - Feature flags

## Support

If you encounter issues not covered in this guide:

1. Check application logs in `/backend/logs`
2. Review browser console for frontend errors
3. Verify database connection and migrations
4. Contact development team with:
   - Error messages
   - Steps to reproduce
   - Browser and OS information
   - Relevant log excerpts

---

**Last Updated**: December 10, 2025
**Version**: 1.0.0
