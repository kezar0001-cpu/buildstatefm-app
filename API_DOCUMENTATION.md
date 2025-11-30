# Buildstate FM API Documentation

**Base URL**: `http://localhost:3000/api` (development) or `https://api.buildstate.com.au/api` (production)

**Authentication**: All protected endpoints require a JWT token in the `Authorization` header:
```
Authorization: Bearer YOUR_JWT_TOKEN
```

---

## Authentication

### Register
```http
POST /auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123",
  "firstName": "John",
  "lastName": "Doe",
  "role": "PROPERTY_MANAGER" | "OWNER" | "TECHNICIAN" | "TENANT",
  "phone": "1234567890" (optional)
}
```

**Response**:
```json
{
  "token": "jwt-token-here",
  "user": {
    "id": "user-id",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "PROPERTY_MANAGER"
  }
}
```

### Login
```http
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

---

## Properties

### List Properties
```http
GET /properties
Authorization: Bearer TOKEN
```

**Role-Based Filtering**:
- **PROPERTY_MANAGER**: Returns properties they manage
- **OWNER**: Returns properties they own
- **TECHNICIAN/TENANT**: 403 Forbidden

**Response**:
```json
[
  {
    "id": "property-id",
    "name": "Marina Heights",
    "address": "123 Main St",
    "city": "Dubai",
    "state": "Dubai",
    "zipCode": "12345",
    "propertyType": "Residential",
    "status": "ACTIVE",
    "totalUnits": 10,
    "managerId": "manager-id",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
]
```

### Create Property
```http
POST /properties
Authorization: Bearer TOKEN
Content-Type: application/json

{
  "name": "Test Property",
  "address": "123 Main St",
  "city": "Test City",
  "state": "CA",
  "zipCode": "12345",
  "propertyType": "Residential",
  "yearBuilt": 2020 (optional),
  "totalArea": 5000 (optional),
  "description": "Description" (optional)
}
```

**Required Role**: PROPERTY_MANAGER  
**Requires**: Active subscription or valid trial

**Response**: 201 Created with property object

### Get Property by ID
```http
GET /properties/:id
Authorization: Bearer TOKEN
```

**Access Control**: User must have access to the property

### Update Property
```http
PATCH /properties/:id
Authorization: Bearer TOKEN
Content-Type: application/json

{
  "name": "Updated Name",
  "status": "INACTIVE"
}
```

**Required Role**: PROPERTY_MANAGER (must own property)

### Delete Property
```http
DELETE /properties/:id
Authorization: Bearer TOKEN
```

**Required Role**: PROPERTY_MANAGER (must own property)

---

## Jobs

### List Jobs
```http
GET /jobs?status=OPEN&propertyId=property-id
Authorization: Bearer TOKEN
```

**Query Parameters**:
- `status`: Filter by status (OPEN, ASSIGNED, IN_PROGRESS, COMPLETED, CANCELLED)
- `propertyId`: Filter by property
- `assignedToId`: Filter by assigned technician (managers/owners only)

**Role-Based Filtering**:
- **TECHNICIAN**: Only sees jobs assigned to them
- **PROPERTY_MANAGER**: Sees jobs for their properties
- **OWNER**: Sees jobs for properties they own

### Create Job
```http
POST /jobs
Authorization: Bearer TOKEN
Content-Type: application/json

{
  "title": "Fix HVAC",
  "description": "AC not working",
  "propertyId": "property-id",
  "unitId": "unit-id" (optional),
  "priority": "HIGH",
  "scheduledDate": "2024-12-01T10:00:00.000Z" (optional),
  "assignedToId": "technician-id" (optional),
  "estimatedCost": 500 (optional)
}
```

**Required Role**: PROPERTY_MANAGER  
**Requires**: Active subscription or valid trial

### Update Job
```http
PATCH /jobs/:id
Authorization: Bearer TOKEN
Content-Type: application/json

{
  "status": "IN_PROGRESS",
  "notes": "Started work on the issue",
  "actualCost": 450
}
```

**Required Roles**: PROPERTY_MANAGER or TECHNICIAN

**Technician Restrictions**:
- Can only update jobs assigned to them
- Can only update: `status`, `notes`, `actualCost`, `evidence`
- Cannot update: `title`, `description`, `priority`, `assignedToId`, `scheduledDate`

**Property Manager**:
- Can update any field
- Can only update jobs for their properties

---

## Inspections

### List Inspections
```http
GET /inspections
Authorization: Bearer TOKEN
```

**Role-Based Filtering**: Similar to jobs

### Create Inspection
```http
POST /inspections
Authorization: Bearer TOKEN
Content-Type: application/json

{
  "title": "Annual Inspection",
  "type": "ROUTINE",
  "scheduledDate": "2024-12-01T10:00:00.000Z",
  "propertyId": "property-id",
  "unitId": "unit-id" (optional),
  "assignedToId": "technician-id" (optional)
}
```

**Required Role**: PROPERTY_MANAGER  
**Requires**: Active subscription or valid trial

**Inspection Types**: ROUTINE, MOVE_IN, MOVE_OUT, EMERGENCY, COMPLIANCE

---

## Service Requests

### List Service Requests
```http
GET /service-requests?status=SUBMITTED&propertyId=property-id
Authorization: Bearer TOKEN
```

### Create Service Request
```http
POST /service-requests
Authorization: Bearer TOKEN
Content-Type: application/json

{
  "title": "Leaking Faucet",
  "description": "Kitchen faucet is leaking",
  "category": "PLUMBING",
  "priority": "MEDIUM",
  "propertyId": "property-id",
  "unitId": "unit-id" (optional)
}
```

**Categories**: PLUMBING, ELECTRICAL, HVAC, APPLIANCE, STRUCTURAL, PEST_CONTROL, LANDSCAPING, GENERAL, OTHER

**Priorities**: LOW, MEDIUM, HIGH, URGENT

### Update Service Request
```http
PATCH /service-requests/:id
Authorization: Bearer TOKEN
Content-Type: application/json

{
  "status": "APPROVED",
  "reviewNotes": "Approved for work"
}
```

**Statuses**: SUBMITTED, UNDER_REVIEW, APPROVED, CONVERTED_TO_JOB, REJECTED, COMPLETED

---

## Notifications

### List Notifications
```http
GET /notifications?isRead=false&limit=50
Authorization: Bearer TOKEN
```

**Query Parameters**:
- `isRead`: Filter by read status (true/false)
- `limit`: Number of notifications to return (default: 50)

**Response**:
```json
[
  {
    "id": "notification-id",
    "type": "JOB_ASSIGNED",
    "title": "New Job Assigned",
    "message": "You have been assigned to job: Fix HVAC",
    "isRead": false,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "entityType": "Job",
    "entityId": "job-id"
  }
]
```

### Get Unread Count
```http
GET /notifications/unread-count
Authorization: Bearer TOKEN
```

**Response**:
```json
{
  "count": 5
}
```

### Mark as Read
```http
PATCH /notifications/:id/read
Authorization: Bearer TOKEN
```

### Mark All as Read
```http
PATCH /notifications/mark-all-read
Authorization: Bearer TOKEN
```

**Response**:
```json
{
  "success": true,
  "message": "Marked 5 notifications as read",
  "count": 5
}
```

### Delete Notification
```http
DELETE /notifications/:id
Authorization: Bearer TOKEN
```

---

## Error Responses

All errors follow this format:

```json
{
  "success": false,
  "message": "Error description"
}
```

### Common Status Codes

- **200 OK**: Request successful
- **201 Created**: Resource created successfully
- **400 Bad Request**: Invalid input data
- **401 Unauthorized**: Missing or invalid authentication token
- **402 Payment Required**: Trial expired or subscription inactive
- **403 Forbidden**: Insufficient permissions for action
- **404 Not Found**: Resource not found
- **409 Conflict**: Resource already exists (e.g., duplicate email)
- **500 Internal Server Error**: Server error

---

## Subscription Status

### Trial Period
- New users get a **14-day free trial**
- Trial starts on registration
- `subscriptionStatus = 'TRIAL'`
- `trialEndDate` is set to 14 days from registration

### Subscription Enforcement

**Blocked Actions After Trial Expiration** (402 Payment Required):
- Creating properties
- Creating jobs
- Creating inspections

**Allowed Actions After Trial Expiration**:
- Viewing existing data (GET requests)
- Updating existing records
- Deleting records

### Check Subscription Status

The user object includes subscription information:

```json
{
  "id": "user-id",
  "email": "user@example.com",
  "subscriptionStatus": "TRIAL" | "ACTIVE" | "SUSPENDED" | "CANCELLED",
  "subscriptionPlan": "FREE_TRIAL" | "STARTER" | "PROFESSIONAL" | "ENTERPRISE",
  "trialEndDate": "2024-12-15T00:00:00.000Z"
}
```

---

## Rate Limiting

Currently no rate limiting is implemented. This will be added in a future update.

---

## Webhooks

### Stripe Webhook

```http
POST /billing/webhook
Content-Type: application/json
Stripe-Signature: signature-here

{
  "type": "customer.subscription.updated",
  "data": { ... }
}
```

**Note**: This endpoint uses raw body parsing and must come before other body parsers.

---

## Examples

### Complete Workflow: Property Manager Creates Job

```bash
# 1. Register
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "manager@test.com",
    "password": "password123",
    "firstName": "Test",
    "lastName": "Manager",
    "role": "PROPERTY_MANAGER"
  }'

# Save the token from response
TOKEN="your-jwt-token"

# 2. Create Property
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

# Save property ID from response
PROPERTY_ID="property-id"

# 3. Create Job
curl -X POST http://localhost:3000/api/jobs \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Fix HVAC",
    "description": "AC not working",
    "propertyId": "'$PROPERTY_ID'",
    "priority": "HIGH"
  }'
```

### Complete Workflow: Technician Updates Job

```bash
# 1. Login as technician
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "tech@test.com",
    "password": "password123"
  }'

TECH_TOKEN="technician-jwt-token"

# 2. List assigned jobs
curl -H "Authorization: Bearer $TECH_TOKEN" \
  http://localhost:3000/api/jobs

# 3. Start job
curl -X PATCH http://localhost:3000/api/jobs/JOB_ID \
  -H "Authorization: Bearer $TECH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "IN_PROGRESS",
    "notes": "Started work on the HVAC system"
  }'

# 4. Complete job
curl -X PATCH http://localhost:3000/api/jobs/JOB_ID \
  -H "Authorization: Bearer $TECH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "COMPLETED",
    "notes": "Replaced faulty compressor",
    "actualCost": 450
  }'
```

---

## Support

For issues or questions:
- Check error messages for specific guidance
- Verify authentication token is valid
- Ensure user has correct role for action
- Check subscription status for feature access
