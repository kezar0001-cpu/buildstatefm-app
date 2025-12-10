# Admin Panel - Quick Reference Card

## 🔐 Access URLs

| Purpose | URL |
|---------|-----|
| First-time setup | `/admin/setup` |
| Admin login | `/admin/blog/login` |
| Blog admin | `/admin/blog` |
| Recovery access | `/admin/setup` → "Recover Admin Access" |

## 🔑 Credentials

**Login**: Your admin email and password  
**Recovery PIN**: Set in `.env` as `ADMIN_SETUP_PIN`

## 📊 API Endpoints

### Dashboard & Analytics
```
GET /api/admin/dashboard
GET /api/admin/analytics/users?period=30d
GET /api/admin/analytics/subscriptions
```

### User Management
```
GET /api/admin/users?page=1&limit=20&role=PROPERTY_MANAGER
GET /api/admin/users/:id
PATCH /api/admin/users/:id
```

### Blog Management
```
GET /api/blog/admin/posts
POST /api/blog/admin/posts
PUT /api/blog/admin/posts/:id
DELETE /api/blog/admin/posts/:id
```

### System
```
GET /api/admin/health
```

## 🛠️ Common Tasks

### Create First Admin
1. Go to `/admin/setup`
2. Fill form
3. Click "Create Admin Account"

### Login as Admin
1. Go to `/admin/blog/login`
2. Enter email + password
3. Auto-redirect to admin panel

### Recover Access
1. Go to `/admin/setup`
2. Click "Recover Admin Access"
3. Enter Recovery PIN
4. Create new admin account

### View User List
```javascript
const response = await apiClient.get('/admin/users', {
  params: {
    page: 1,
    limit: 20,
    role: 'PROPERTY_MANAGER',
    search: 'john@example.com'
  }
});
```

### Update User Subscription
```javascript
const response = await apiClient.patch(`/admin/users/${userId}`, {
  subscriptionStatus: 'ACTIVE',
  subscriptionPlan: 'PROFESSIONAL'
});
```

## 🚨 Troubleshooting

| Error | Solution |
|-------|----------|
| "Admin authentication required" | Log in at `/admin/blog/login` |
| "Access denied" | Verify ADMIN role in database |
| "Session expired" | Log in again |
| "Account inactive" | Use recovery PIN or update DB |

## 🔒 Security Notes

- ✅ All admin routes require authentication
- ✅ ADMIN role is verified on every request
- ✅ All actions are logged for audit
- ✅ Tokens expire after 15 minutes
- ✅ Refresh tokens last 7 days
- ⚠️ Never share Recovery PIN
- ⚠️ Use HTTPS in production
- ⚠️ Rotate JWT secrets regularly

## 📝 Environment Variables

```env
ADMIN_SETUP_PIN=your-secure-pin-here
JWT_SECRET=your-jwt-secret
JWT_REFRESH_SECRET=your-refresh-secret
```

## 📞 Need Help?

1. Check `ADMIN_ACCESS_GUIDE.md` for detailed docs
2. Review `ADMIN_IMPLEMENTATION_SUMMARY.md` for technical details
3. Check application logs
4. Contact development team

---

**Quick Tip**: Bookmark `/admin/blog/login` for easy access!
