# Role-Based Access Control (RBAC) System

## Overview

Buildstate FM now implements a comprehensive role-based access control system with 5 distinct user roles, each with specific permissions and workflows.

## User Roles

### 1. 🔑 ADMIN
**Full system access and control**

**Capabilities:**
- Access to all accounts and properties
- Create/edit/delete any resource
- Manage all user roles
- Override any permission
- System-wide configuration
- View all analytics and reports

**Use Cases:**
- Buildstate FM platform administrators
- System maintenance
- Support escalations

---

### 2. 🏢 PROPERTY_MANAGER
**Manages properties and assigns access**

**Capabilities:**
- Manage their assigned properties
- Create and manage units
- Create TECHNICIAN profiles
- Create OWNER profiles and assign properties
- Assign jobs to technicians
- View all property-related data
- Manage tenants
- Configure property settings

**Restrictions:**
- Can only access properties assigned to them
- Cannot modify other property managers' data
- Cannot access admin functions

**Profile Fields:**
- `managedProperties`: Array of property IDs they manage
- `permissions`: Custom permission flags

**Use Cases:**
- Property management companies
- Building managers
- Facility managers

---

### 3. 🏠 OWNER
**Simplified view of owned properties**

**Capabilities:**
- View-only access to assigned properties
- See property details and analytics
- View maintenance history
- Access reports and dashboards
- View tenant information (limited)

**Restrictions:**
- Cannot edit properties
- Cannot create jobs or assign technicians
- Cannot manage tenants directly
- Must be assigned by a property manager

**Profile Fields:**
- `ownedProperties`: Array of property IDs they own
- `assignedBy`: Property Manager who created their account
- `viewOnlyAccess`: Typically true for owners

**Use Cases:**
- Property owners
- Investors
- Stakeholders requiring oversight

---

### 4. 🔧 TECHNICIAN
**Job-focused workflow for on-site work**

**Capabilities:**
- View assigned jobs
- Check in/out of job sites
- Complete safety forms (toolbox talks, PPE checklists)
- Upload work photos and documentation
- Record work performed and materials used
- Mark jobs as complete
- View property details (limited to assigned properties)

**Restrictions:**
- Can only see jobs assigned to them
- Property access controlled by property manager
- Cannot create jobs
- Cannot manage properties

**Profile Fields:**
- `certifications`: Array of certifications
- `specialties`: Areas of expertise (plumbing, electrical, etc.)
- `licenseNumber`: Professional license number
- `emergencyContact`: Emergency contact information
- `canAccessAllProperties`: Boolean for all-property access
- `propertyAccess`: Array of specific property IDs
- `currentCheckIn`: Current job check-in data

**Use Cases:**
- Maintenance technicians
- Contractors
- Service providers
- Field workers

---

### 5. 🏘️ TENANT
**Residential user with unit access**

**Capabilities:**
- Request maintenance
- View maintenance history
- Access property documents
- Receive announcements
- View unit details
- Communicate with property management
- Rate completed service requests

**Restrictions:**
- Can only access their assigned unit(s)
- Cannot view other tenants' data
- Cannot access property-wide settings

**Profile Fields:**
- `phone`: Contact number
- `preferredChannel`: EMAIL, SMS, APP
- `language`: Preferred language
- `accessibilityNeeds`: Special requirements
- `petNote`: Pet information
- `entryPermission`: Permission for unit entry

**Use Cases:**
- Apartment tenants
- Residents
- Occupants

---

## API Protection

### Middleware Usage

```javascript
import { 
  requireRole, 
  requireAdmin, 
  requirePropertyManager,
  requireTechnician,
  requirePropertyAccess,
  requireUnitAccess 
} from '../middleware/roleAuth.js';

// Admin-only route
router.get('/admin/users', requireAdmin, getAllUsers);

// Property Manager or Admin
router.post('/properties', requirePropertyManager, createProperty);

// Technician-only
router.get('/jobs/assigned', requireTechnician, getMyJobs);

// Multiple roles allowed
router.get('/properties/:id', 
  requireRole('ADMIN', 'PROPERTY_MANAGER', 'OWNER'), 
  getProperty
);

// Property-level access control
router.put('/properties/:id', 
  requirePropertyAccess, 
  updateProperty
);

// Unit-level access control (for tenants)
router.get('/units/:id', 
  requireUnitAccess(prisma), 
  getUnit
);
```

### Role Hierarchy

```
ADMIN
  └── Full access to everything
  
PROPERTY_MANAGER
  └── Access to managed properties
      ├── Can create TECHNICIAN
      ├── Can create OWNER
      └── Can assign properties to others
      
OWNER
  └── View-only access to owned properties
  
TECHNICIAN
  └── Access to assigned jobs
      └── Limited property access
      
TENANT
  └── Access to their unit(s) only
```

## Common Workflows

### Creating a Property Manager
```javascript
import { assignRole, grantPropertyManagerAccess } from './utils/roleManager.js';

// 1. Create user with PROPERTY_MANAGER role
const pm = await assignRole(prisma, userId, 'PROPERTY_MANAGER', {
  permissions: {
    canCreateJobs: true,
    canEditProperties: true,
    canManageTenants: true,
    canAssignTechnicians: true
  }
});

// 2. Grant access to specific properties
await grantPropertyManagerAccess(prisma, pm.id, [
  'property-1-id',
  'property-2-id'
]);
```

### Property Manager Creates an Owner
```javascript
import { createOwnerForProperties } from './utils/roleManager.js';

const owner = await createOwnerForProperties(
  prisma,
  propertyManagerId,  // Who's creating the owner
  {
    email: 'owner@example.com',
    name: 'John Owner',
    phone: '+1234567890',
    orgId: 'org-id'
  },
  ['property-1-id', 'property-2-id']  // Properties to assign
);
```

### Property Manager Creates a Technician
```javascript
import { createTechnician, grantTechnicianAccess } from './utils/roleManager.js';

// 1. Create technician
const tech = await createTechnician(prisma, 
  {
    email: 'tech@example.com',
    name: 'Mike Technician',
    phone: '+1234567890',
    orgId: 'org-id'
  },
  {
    certifications: ['Electrical License', 'Plumbing License'],
    specialties: ['HVAC', 'Electrical', 'Plumbing'],
    licenseNumber: 'LIC-12345'
  }
);

// 2. Grant access to properties
await grantTechnicianAccess(prisma, tech.id, ['property-1-id']);
// Or grant access to all properties
await grantTechnicianAccess(prisma, tech.id, [], true);
```

### Assigning a Job to a Technician
```javascript
const job = await prisma.job.create({
  data: {
    title: 'Fix leaking faucet',
    description: 'Kitchen faucet is leaking',
    propertyId: 'property-id',
    unitId: 'unit-id',
    assignedToId: technicianId,
    createdById: propertyManagerId,
    status: 'ASSIGNED',
    priority: 'MEDIUM',
    scheduledStart: new Date('2025-10-15T09:00:00'),
    scheduledEnd: new Date('2025-10-15T11:00:00')
  }
});
```

## Permission Checking

```javascript
import { hasPermission } from './utils/roleManager.js';

// Check if user can perform action
if (hasPermission(req.user, 'canCreateJobs')) {
  // Allow job creation
}

// Get accessible properties for user
import { getAccessibleProperties } from './utils/roleManager.js';
const properties = await getAccessibleProperties(prisma, userId);
```

## Frontend Integration

### Role-Based Routing
```javascript
// Detect role and redirect to appropriate dashboard
const getDashboardRoute = (userRole) => {
  switch (userRole) {
    case 'ADMIN':
      return '/admin/dashboard';
    case 'PROPERTY_MANAGER':
      return '/dashboard';
    case 'OWNER':
      return '/owner/dashboard';
    case 'TECHNICIAN':
      return '/technician/dashboard';
    case 'TENANT':
      return '/tenant/dashboard';
    default:
      return '/';
  }
};
```

### Role-Based UI Components
```javascript
// Show/hide features based on role
{user.role === 'PROPERTY_MANAGER' && (
  <button onClick={createTechnician}>
    Create Technician
  </button>
)}

{['ADMIN', 'PROPERTY_MANAGER'].includes(user.role) && (
  <AdminPanel />
)}
```

## Security Best Practices

1. **Always authenticate first** - Check `req.user` exists
2. **Check role authorization** - Use `requireRole()` middleware
3. **Verify resource access** - Use `requirePropertyAccess()` for property-level checks
4. **Log access attempts** - Track who accessed what
5. **Use principle of least privilege** - Give minimum necessary permissions
6. **Regular audits** - Review role assignments periodically

## Database Queries by Role

### Admin - All properties
```javascript
const properties = await prisma.property.findMany({
  where: { orgId: user.orgId }
});
```

### Property Manager - Managed properties only
```javascript
const properties = await prisma.property.findMany({
  where: { 
    id: { in: user.propertyManagerProfile.managedProperties }
  }
});
```

### Owner - Owned properties only
```javascript
const properties = await prisma.property.findMany({
  where: { 
    id: { in: user.ownerProfile.ownedProperties }
  }
});
```

### Technician - Accessible properties
```javascript
const properties = await prisma.property.findMany({
  where: user.technicianProfile.canAccessAllProperties 
    ? { orgId: user.orgId }
    : { id: { in: user.technicianProfile.propertyAccess } }
});
```

### Tenant - Properties with their units
```javascript
const links = await prisma.tenantUnitLink.findMany({
  where: { userId: user.id, active: true },
  include: { unit: { include: { property: true } } }
});
const properties = links.map(link => link.unit.property);
```

## Testing

```bash
# Test role creation
npm run test:roles

# Test permissions
npm run test:permissions

# Test access control
npm run test:access
```

## Troubleshooting

### User can't access a property
1. Check their role profile has the property ID
2. Verify property exists and is active
3. Check organization matches

### Permission denied errors
1. Verify user is logged in
2. Check user role is correct
3. Ensure role profile exists
4. Verify route has correct middleware

### Profile not found
```javascript
// Ensure profile exists
import { ensureRoleProfile } from '../middleware/roleAuth.js';
app.use(ensureRoleProfile(prisma));
```
