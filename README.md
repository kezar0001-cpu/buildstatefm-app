# Buildstate FM - Facilities Management Platform

Buildstate FM is a **full-stack facilities management platform** with role-based access control, subscription management, and real-time collaboration features.

**Tech Stack**: React + Vite + Material-UI | Node.js + Express + Prisma | PostgreSQL

---

## 🎯 Features

### Core Functionality
- ✅ **Property Management** - Create, manage, and track properties and units
- ✅ **Job Management** - Assign and track maintenance jobs
- ✅ **Inspection System** - Schedule and complete property inspections
- ✅ **Service Requests** - Tenant-submitted maintenance requests
- ✅ **Notifications** - Real-time notifications for all users
- ✅ **Subscription Management** - 14-day trial + paid plans with Stripe

### Role-Based Dashboards
- ✅ **Property Manager** - Full property and job management
- ✅ **Technician** - View assigned jobs, update status, add notes
- ✅ **Owner** - Read-only view of properties, jobs, and inspections
- ✅ **Tenant** - Submit service requests, view unit details

### Security & Access Control
- ✅ **JWT Authentication** - Secure token-based auth
- ✅ **Role-Based Access Control (RBAC)** - Granular permissions
- ✅ **Subscription Enforcement** - Trial expiration and feature gating
- ✅ **Data Isolation** - Users only see their own data
- ✅ **Security Headers** - Helmet.js for CSP, XSS protection
- ✅ **Rate Limiting** - Prevent brute force and API abuse
- ✅ **Input Sanitization** - NoSQL injection protection

### User Experience
- ✅ **Profile Management** - Update profile, change password
- ✅ **Toast Notifications** - Success/error feedback
- ✅ **Confirmation Dialogs** - Prevent accidental deletions
- ✅ **Email Notifications** - Job assignments, reminders, updates

### Monitoring & Observability
- ✅ **Structured Logging** - Winston logger with file rotation
- ✅ **Health Check Endpoint** - Database and system metrics
- ✅ **Error Tracking** - Graceful error handling
- ✅ **Analytics** - Detailed performance metrics

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL database
- npm or yarn

**Windows Users:** See [backend/WINDOWS_SETUP.md](backend/WINDOWS_SETUP.md) for Windows-specific setup instructions and common pitfalls.

### Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your database URL and secrets

# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev

# Start development server
npm run dev
```

Backend runs on `http://localhost:3000`

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with API URL (http://localhost:3000 for local)

# Start development server
npm run dev
```

Frontend runs on `http://localhost:5173`

---

## 📁 Project Structure

```
agentfm-app/
├── backend/
│   ├── prisma/
│   │   └── schema.prisma          # Database schema (20+ models)
│   ├── src/
│   │   ├── config/
│   │   │   └── prismaClient.js    # Database client
│   │   ├── middleware/
│   │   │   └── auth.js            # Authentication & RBAC
│   │   ├── routes/                # API routes
│   │   │   ├── auth.js
│   │   │   ├── properties.js
│   │   │   ├── jobs.js
│   │   │   ├── inspections.js
│   │   │   ├── notifications.js
│   │   │   └── ...
│   │   ├── utils/
│   │   │   └── errorHandler.js    # Standardized errors
│   │   └── index.js               # Express app
│   └── .env.example               # Environment template
├── frontend/
│   ├── src/
│   │   ├── pages/                 # Page components
│   │   │   ├── DashboardPage.jsx
│   │   │   ├── TechnicianDashboard.jsx
│   │   │   ├── OwnerDashboard.jsx
│   │   │   ├── TenantDashboard.jsx
│   │   │   └── ...
│   │   ├── components/            # Reusable components
│   │   │   ├── NotificationBell.jsx
│   │   │   └── ...
│   │   ├── api/
│   │   │   └── client.js          # Axios client
│   │   └── App.jsx                # Routes
│   └── .env.example               # Environment template
└── API_DOCUMENTATION.md           # Complete API docs
```

---

## 🔐 Environment Variables

### Backend (.env)

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/agentfm

# Authentication
JWT_SECRET=your-secret-min-32-chars
SESSION_SECRET=your-session-secret

# URLs
FRONTEND_URL=http://localhost:5173
BACKEND_URL=http://localhost:3000

# Stripe (optional for local dev)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Google OAuth (optional)
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# Email (optional)
RESEND_API_KEY=re_...
```

### Frontend (.env)

```env
VITE_API_BASE_URL=http://localhost:3000
```

---

## 👥 User Roles

### Property Manager
- Create and manage properties
- Create jobs and inspections
- Assign technicians
- View all data for managed properties
- **Requires**: Active subscription for creating resources

### Technician
- View jobs assigned to them
- Update job status (IN_PROGRESS, COMPLETED)
- Add notes and actual costs
- **Cannot**: Create jobs or properties

### Owner
- View properties they own (read-only)
- View jobs and inspections for their properties
- **Cannot**: Create or modify anything

### Tenant
- View their unit details
- Submit service requests
- View maintenance schedule
- **Cannot**: Access other properties or jobs

---

## 🧪 Testing

### Manual Testing

```bash
# Register a property manager
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "manager@test.com",
    "password": "password123",
    "firstName": "Test",
    "lastName": "Manager",
    "role": "PROPERTY_MANAGER"
  }'

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "manager@test.com", "password": "password123"}'

# Use the token from response
TOKEN="your-jwt-token"

# Create a property
curl -X POST http://localhost:3000/api/properties \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Property",
    "address": "123 Main St",
    "city": "Test City",
    "state": "CA",
    "zipCode": "12345",
    "propertyType": "Residential"
  }'
```

See `API_DOCUMENTATION.md` for complete API examples.

---

## 📚 Documentation

- **API_DOCUMENTATION.md** - Complete API reference with examples
- **PHASE_1_FIXES_COMPLETE.md** - Infrastructure fixes summary
- **PHASE_2_COMPLETE.md** - RBAC implementation summary
- **PHASE_3_COMPLETE.md** - Role-specific portals summary
- **IMPLEMENTATION_COMPLETE.md** - Overall project summary

---

## 🚢 Deployment

### Production Environment

The application is deployed on:
- **Backend**: Render (https://api.buildstate.com.au)
- **Frontend**: Vercel (https://www.buildstate.com.au)

All environment variables are configured in the respective platforms.

### Deploy Updates

```bash
# Commit changes
git add .
git commit -m "Your commit message"

# Push to main
git push origin main
```

Vercel and Render will automatically deploy the changes.

---

## 🛠️ Troubleshooting

### "Failed to fetch" errors

1. **Backend not running**
   ```bash
   cd backend && npm run dev
   # Should see: ✅ Buildstate FM backend listening on port 3000
   ```

2. **Frontend can't reach backend**
   - Check `frontend/.env` has correct `VITE_API_BASE_URL`
   - Restart frontend dev server after changing .env

3. **CORS errors**
   - Verify `FRONTEND_URL` in backend `.env` matches frontend URL
   - Check browser console for specific CORS errors

### Database connection errors

```bash
# Check DATABASE_URL is correct
cd backend
npx prisma migrate status

# If migrations are pending
npx prisma migrate dev
```

### Authentication issues

- Verify `JWT_SECRET` is set (minimum 32 characters)
- Check token is being sent in Authorization header
- Token format: `Bearer YOUR_TOKEN`

---

## 🤝 Contributing

1. Create a feature branch
2. Make your changes
3. Test thoroughly
4. Commit with clear messages
5. Push and create a pull request

---

## 📄 License

Proprietary - All rights reserved

---

## 📞 Support

For issues or questions:
- Check documentation in `/docs` folder
- Review API documentation
- Check error messages for specific guidance

---

**Built with ❤️ using React, Node.js, and PostgreSQL**
