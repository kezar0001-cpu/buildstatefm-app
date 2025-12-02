# Database Index Recommendations

This document outlines recommended database indexes to optimize query performance, particularly for dashboard queries and common access patterns.

## Current State

The application uses Prisma ORM with PostgreSQL. Prisma automatically creates indexes for:
- Primary keys
- Foreign keys (in some cases)
- Unique constraints

## Recommended Indexes

### 1. UnitTenant Table

**Purpose**: Optimize tenant property lookups in dashboard queries

```sql
-- Composite index for tenant property lookups
CREATE INDEX idx_unit_tenant_tenant_active ON "UnitTenant"("tenantId", "isActive") WHERE "isActive" = true;

-- Index for unit lookups
CREATE INDEX idx_unit_tenant_unit ON "UnitTenant"("unitId");
```

**Impact**: 
- Significantly speeds up dashboard queries for TENANT role
- Reduces query time from O(n) to O(log n) for tenant property lookups

### 2. Job Table

**Purpose**: Optimize job counts and filtering by property and status

```sql
-- Composite index for property-based job queries
CREATE INDEX idx_job_property_status ON "Job"("propertyId", "status");

-- Index for assigned technician queries
CREATE INDEX idx_job_assigned_to ON "Job"("assignedToId") WHERE "assignedToId" IS NOT NULL;

-- Index for scheduled date queries (overdue jobs)
CREATE INDEX idx_job_scheduled_date ON "Job"("scheduledDate") WHERE "scheduledDate" IS NOT NULL;

-- Index for unit-based job queries
CREATE INDEX idx_job_unit ON "Job"("unitId") WHERE "unitId" IS NOT NULL;
```

**Impact**:
- Faster dashboard job counts by property and status
- Faster technician job queries
- Faster overdue job detection

### 3. Inspection Table

**Purpose**: Optimize inspection queries by property, status, and scheduled date

```sql
-- Composite index for property-based inspection queries
CREATE INDEX idx_inspection_property_status ON "Inspection"("propertyId", "status");

-- Index for scheduled date queries (upcoming/overdue inspections)
CREATE INDEX idx_inspection_scheduled_date ON "Inspection"("scheduledDate") WHERE "scheduledDate" IS NOT NULL;

-- Index for assigned technician queries
CREATE INDEX idx_inspection_assigned_to ON "Inspection"("assignedToId") WHERE "assignedToId" IS NOT NULL;

-- Index for unit-based inspection queries
CREATE INDEX idx_inspection_unit ON "Inspection"("unitId") WHERE "unitId" IS NOT NULL;
```

**Impact**:
- Faster dashboard inspection counts
- Faster upcoming/overdue inspection queries
- Faster technician inspection queries

### 4. ServiceRequest Table

**Purpose**: Optimize service request queries by property and status

```sql
-- Composite index for property-based service request queries
CREATE INDEX idx_service_request_property_status ON "ServiceRequest"("propertyId", "status");

-- Index for requester queries
CREATE INDEX idx_service_request_requested_by ON "ServiceRequest"("requestedById") WHERE "requestedById" IS NOT NULL;

-- Index for unit-based service request queries
CREATE INDEX idx_service_request_unit ON "ServiceRequest"("unitId") WHERE "unitId" IS NOT NULL;
```

**Impact**:
- Faster dashboard service request counts
- Faster tenant service request queries

### 5. Property Table

**Purpose**: Optimize property queries by manager and status

```sql
-- Index for manager-based property queries
CREATE INDEX idx_property_manager ON "Property"("managerId") WHERE "managerId" IS NOT NULL;

-- Index for status-based property queries
CREATE INDEX idx_property_status ON "Property"("status");
```

**Impact**:
- Faster dashboard property counts
- Faster property manager queries

### 6. Unit Table

**Purpose**: Optimize unit queries by property and status

```sql
-- Composite index for property-based unit queries
CREATE INDEX idx_unit_property_status ON "Unit"("propertyId", "status");
```

**Impact**:
- Faster dashboard unit counts
- Faster property unit listings

### 7. Notification Table

**Purpose**: Optimize notification queries by user

```sql
-- Index for user-based notification queries
CREATE INDEX idx_notification_user ON "Notification"("userId", "read") WHERE "read" = false;

-- Index for entity-based notification queries
CREATE INDEX idx_notification_entity ON "Notification"("entityType", "entityId");
```

**Impact**:
- Faster unread notification counts
- Faster notification queries by entity

## Implementation

### Option 1: Prisma Migration (Recommended)

Create a new migration file:

```bash
cd backend
npx prisma migrate dev --name add_performance_indexes
```

Then add the indexes to the migration SQL file, or use Prisma's `@@index` directive in the schema:

```prisma
model UnitTenant {
  // ... existing fields ...
  
  @@index([tenantId, isActive], name: "idx_unit_tenant_tenant_active", where: { isActive: true })
  @@index([unitId], name: "idx_unit_tenant_unit")
}

model Job {
  // ... existing fields ...
  
  @@index([propertyId, status], name: "idx_job_property_status")
  @@index([assignedToId], name: "idx_job_assigned_to", where: { assignedToId: { not: null } })
  @@index([scheduledDate], name: "idx_job_scheduled_date", where: { scheduledDate: { not: null } })
  @@index([unitId], name: "idx_job_unit", where: { unitId: { not: null } })
}

// ... similar for other models
```

### Option 2: Direct SQL Migration

Create a migration file in `backend/prisma/migrations/`:

```sql
-- Add indexes for performance optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_unit_tenant_tenant_active ON "UnitTenant"("tenantId", "isActive") WHERE "isActive" = true;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_unit_tenant_unit ON "UnitTenant"("unitId");

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_job_property_status ON "Job"("propertyId", "status");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_job_assigned_to ON "Job"("assignedToId") WHERE "assignedToId" IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_job_scheduled_date ON "Job"("scheduledDate") WHERE "scheduledDate" IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_job_unit ON "Job"("unitId") WHERE "unitId" IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inspection_property_status ON "Inspection"("propertyId", "status");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inspection_scheduled_date ON "Inspection"("scheduledDate") WHERE "scheduledDate" IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inspection_assigned_to ON "Inspection"("assignedToId") WHERE "assignedToId" IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inspection_unit ON "Inspection"("unitId") WHERE "unitId" IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_service_request_property_status ON "ServiceRequest"("propertyId", "status");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_service_request_requested_by ON "ServiceRequest"("requestedById") WHERE "requestedById" IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_service_request_unit ON "ServiceRequest"("unitId") WHERE "unitId" IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_property_manager ON "Property"("managerId") WHERE "managerId" IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_property_status ON "Property"("status");

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_unit_property_status ON "Unit"("propertyId", "status");

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notification_user ON "Notification"("userId", "read") WHERE "read" = false;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notification_entity ON "Notification"("entityType", "entityId");
```

**Note**: Use `CONCURRENTLY` to avoid locking the table during index creation in production.

## Expected Performance Improvements

### Dashboard Queries
- **Before**: 500-1000ms for complex role-based queries
- **After**: 50-200ms with proper indexes
- **Improvement**: 5-10x faster

### Tenant Property Lookups
- **Before**: Full table scan of UnitTenant
- **After**: Index scan with O(log n) complexity
- **Improvement**: 10-100x faster depending on data size

### Job/Inspection Filtering
- **Before**: Sequential scan with multiple WHERE conditions
- **After**: Index-based filtering
- **Improvement**: 5-20x faster

## Monitoring

After implementing indexes, monitor:

1. **Query Performance**: Use `EXPLAIN ANALYZE` to verify index usage
2. **Index Usage**: Query `pg_stat_user_indexes` to see index hit rates
3. **Storage Impact**: Indexes increase storage by ~10-20% typically
4. **Write Performance**: Slight impact on INSERT/UPDATE operations (usually negligible)

## Maintenance

- Indexes are automatically maintained by PostgreSQL
- Monitor index bloat with `pg_stat_user_indexes`
- Reindex if bloat exceeds 20-30%: `REINDEX INDEX index_name;`

## Notes

- Partial indexes (with WHERE clauses) are more efficient for filtered queries
- Composite indexes are most effective when queries match the leftmost columns
- Consider index maintenance overhead vs. query performance benefits
- Test indexes in staging before production deployment

