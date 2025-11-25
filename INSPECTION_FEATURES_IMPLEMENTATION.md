# Inspection System Features Implementation Guide

## Overview
This document describes the implementation of four major features for the inspection system:
1. Inspection Templates System
2. Recurring Inspection Scheduling
3. Inspection History and Comparison
4. Inspection Approval Workflow

## ✅ Completed: Backend Implementation

All backend functionality has been fully implemented and committed.

### Feature 1: Inspection Templates System

**Database Models:**
- `InspectionTemplate`: Main template model with name, description, type, and default/active flags
- `InspectionTemplateRoom`: Room configurations for templates
- `InspectionTemplateChecklistItem`: Checklist items per room

**API Endpoints:** `/api/inspection-templates`
- `GET /` - List all templates (with filtering by type, propertyId, isActive)
- `GET /:id` - Get single template with rooms and checklist items
- `POST /` - Create new template (Property Managers can create, only Admins can create defaults)
- `PATCH /:id` - Update template (name, description, isActive, rooms)
- `DELETE /:id` - Delete template (prevents deletion if in use)
- `POST /:id/duplicate` - Duplicate an existing template

**Features:**
- Default templates available to all properties
- Property-specific templates
- Template usage tracking (count of inspections using template)
- Automatic room and checklist item ordering
- Cascade deletion of rooms and checklist items

### Feature 2: Recurring Inspection Scheduling

**Database Model:**
- `RecurringInspection`: Stores recurring schedule configuration
  - Frequency: DAILY, WEEKLY, MONTHLY, QUARTERLY, YEARLY
  - Interval: Every N periods (e.g., every 2 weeks)
  - Day of month/week for specific scheduling
  - Start/end dates with optional end date
  - Links to templates for automatic room/checklist generation

**API Endpoints:** `/api/recurring-inspections`
- `GET /` - List all recurring inspections (filter by propertyId, unitId, isActive)
- `GET /:id` - Get single recurring inspection with full details
- `POST /` - Create new recurring schedule
- `PATCH /:id` - Update recurring schedule (recalculates next due date)
- `DELETE /:id` - Delete recurring schedule
- `GET /:id/preview` - Preview upcoming inspections for a schedule
- `POST /preview` - Preview inspections for proposed schedule (before creating)

**Cron Job Service:**
- Location: `backend/src/services/recurringInspectionService.js`
- Runs daily at 2:00 AM
- 7-day look-ahead window
- Auto-generates inspections from recurring schedules
- Copies template rooms and checklist items to new inspections
- Updates next due date after generation
- Deactivates schedules when end date is reached

**Features:**
- Flexible scheduling with multiple frequency options
- Template integration for consistent inspections
- Preview functionality before committing
- Automatic inspection generation
- Smart next due date calculation
- Prevents duplicate inspection creation

### Feature 3: Inspection History and Comparison

**API Endpoints:**
- `GET /api/inspections/history/unit/:unitId` - Get all completed inspections for a unit
  - Pagination support (limit, offset)
  - Includes rooms, checklist items, and issues
  - Sorted by completion date (most recent first)

- `GET /api/inspections/compare/:id1/:id2` - Compare two inspections side-by-side
  - Validates both inspections are for same unit
  - Returns detailed comparison with:
    - Full inspection data for both
    - Issue counts by severity
    - Summary of changes (new issues, resolved issues, total change)
    - Room and checklist status comparison

**Features:**
- Complete inspection history timeline
- Side-by-side comparison view
- Issue tracking across inspections
- Severity analysis
- New vs resolved issues identification

### Feature 4: Inspection Approval Workflow

**Database Fields Added to Inspection:**
- `rejectionReason`: Text explaining why inspection was rejected
- `rejectedById`: User who rejected the inspection
- `rejectedAt`: Timestamp of rejection
- `approvedById`: User who approved the inspection
- `approvedAt`: Timestamp of approval
- Status: `PENDING_APPROVAL` added to InspectionStatus enum

**API Endpoints:**
- `POST /api/inspections/:id/approve` - Approve a pending inspection
  - Only Property Managers can approve
  - Sets status to COMPLETED
  - Records approver and timestamp
  - Sends notification to technician

- `POST /api/inspections/:id/reject` - Reject a pending inspection
  - Only Property Managers can reject
  - Requires rejection reason
  - Optional technician re-assignment
  - Sets status back to IN_PROGRESS
  - Sends notification with rejection reason

**Modified Endpoint:**
- `POST /api/inspections/:id/complete` - Complete inspection
  - Technicians → Sets status to PENDING_APPROVAL
  - Property Managers → Sets status directly to COMPLETED (auto-approved)
  - Auto-creates jobs for high-priority findings (if enabled)

**Notification System:**
- `notifyInspectionApproved()` - Sends email and in-app notification to technician
- `notifyInspectionRejected()` - Sends email and in-app notification with rejection reason
- Notifications include inspection details and link to view

**Features:**
- Role-based completion workflow
- Quality control layer for inspections
- Rejection with detailed feedback
- Re-assignment capability
- Complete audit trail
- Real-time and email notifications

## 📋 Remaining: Frontend Implementation

The following frontend components need to be created to utilize the backend APIs:

### Feature 1 Frontend: Template Management UI

**Components to Create:**

1. **`InspectionTemplateBuilder.jsx`** - Template creation/editing interface
   - Form for template name, description, type
   - Dynamic room addition/removal
   - Checklist item management per room
   - Room type selection (BEDROOM, BATHROOM, etc.)
   - Drag-and-drop for room/item ordering
   - Save/update template functionality

2. **`InspectionTemplateLibrary.jsx`** - Template browsing and selection
   - Grid/list view of available templates
   - Filter by type, property, default status
   - Template preview with rooms and checklists
   - Duplicate template action
   - Delete template (with usage warning)
   - Usage statistics display

3. **Modify `InspectionForm.jsx`** - Add template selection
   - Template dropdown/selector
   - Auto-populate rooms and checklist from template
   - Option to modify after template selection
   - Show template info (name, description)

**API Integration Points:**
- Fetch templates: `GET /api/inspection-templates`
- Create template: `POST /api/inspection-templates`
- Update template: `PATCH /api/inspection-templates/:id`
- Delete template: `DELETE /api/inspection-templates/:id`
- Duplicate: `POST /api/inspection-templates/:id/duplicate`

### Feature 2 Frontend: Recurring Inspections UI

**Components to Create:**

1. **`RecurringInspectionForm.jsx`** - Create/edit recurring schedule
   - Frequency selector (Daily, Weekly, Monthly, Quarterly, Yearly)
   - Interval input (every N periods)
   - Day of week selector (for weekly)
   - Day of month selector (for monthly)
   - Start/end date pickers
   - Property and unit selection
   - Technician assignment
   - Template selection
   - Preview button

2. **`RecurringInspectionsList.jsx`** - View and manage recurring schedules
   - List of active recurring schedules
   - Filter by property, unit
   - Show next due date prominently
   - Edit/delete actions
   - Activate/deactivate toggle
   - Count of generated inspections

3. **`RecurringInspectionPreview.jsx`** - Preview upcoming inspections
   - Calendar view or timeline
   - List of next 5-10 scheduled dates
   - Before and after comparison when editing
   - Confirm to create/update

4. **Add to Property/Unit Detail Pages**
   - "Recurring Inspections" section
   - Quick add recurring inspection button
   - List of active schedules for property/unit

**API Integration Points:**
- Fetch schedules: `GET /api/recurring-inspections`
- Create schedule: `POST /api/recurring-inspections`
- Update schedule: `PATCH /api/recurring-inspections/:id`
- Delete schedule: `DELETE /api/recurring-inspections/:id`
- Preview: `POST /api/recurring-inspections/preview`
- Get preview: `GET /api/recurring-inspections/:id/preview`

### Feature 3 Frontend: History and Comparison UI

**Components to Create:**

1. **`InspectionHistoryTimeline.jsx`** - Add to `InspectionDetailPage.jsx`
   - Timeline view of past inspections for the unit
   - Vertical timeline with date, type, technician
   - Issue count badges
   - Click to view full inspection
   - "Compare" button on each history item
   - Pagination for long histories

2. **`InspectionComparisonView.jsx`** - Side-by-side comparison
   - Split-screen layout
   - Inspection details on each side
   - Highlighted differences
   - Room-by-room comparison
   - Checklist status comparison (PASSED/FAILED changes)
   - Issue comparison with color coding:
     - Green: New issues resolved
     - Red: New issues introduced
     - Yellow: Persistent issues
   - Severity trend visualization
   - Summary statistics at top

3. **Modify `InspectionDetailPage.jsx`**
   - Add "Previous Inspections" section
   - Add "Compare" button to select another inspection
   - Show comparison modal/page

**API Integration Points:**
- Fetch history: `GET /api/inspections/history/unit/:unitId`
- Compare inspections: `GET /api/inspections/compare/:id1/:id2`

### Feature 4 Frontend: Approval Workflow UI

**Components to Create:**

1. **`InspectionApprovalCard.jsx`** - Approval interface for managers
   - Prominent "Pending Approval" badge
   - Inspection details summary
   - Approve button (green)
   - Reject button (red)
   - Shows technician who completed it
   - Shows completion date
   - Quick view of findings and issues

2. **`InspectionRejectionDialog.jsx`** - Rejection reason input
   - Modal dialog
   - Required text area for rejection reason
   - Optional technician re-assignment dropdown
   - Cancel and Confirm buttons
   - Warning about notification being sent

3. **Modify `InspectionDetailPage.jsx`**
   - Show approval status badge (PENDING_APPROVAL)
   - Display approve/reject buttons (for Property Managers only)
   - Show rejection reason if rejected
   - Show approval/rejection metadata (who, when)
   - Display re-assignment info if applicable

4. **Modify `InspectionsPage.jsx`**
   - Add filter for "Pending Approval" status
   - Add "Pending Approval" count badge
   - Highlight pending approval inspections
   - Bulk approve action (optional)

5. **Add to Dashboard**
   - "Pending Approvals" widget
   - Count of pending inspections
   - Quick link to filtered view

**API Integration Points:**
- Approve: `POST /api/inspections/:id/approve`
- Reject: `POST /api/inspections/:id/reject`
- Fetch pending: `GET /api/inspections?status=PENDING_APPROVAL`

## Database Migration

**Migration File:** `backend/prisma/migrations/20251125000000_add_inspection_templates_recurring_and_approval_workflow/migration.sql`

**To apply the migration:**
```bash
cd backend
npm run prisma:migrate:deploy
```

Or in development:
```bash
cd backend
npx prisma migrate dev
```

**To generate Prisma client:**
```bash
cd backend
npm run prisma:generate
```

## Testing the Backend APIs

### Test Template Creation:
```bash
curl -X POST http://localhost:3000/api/inspection-templates \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "Standard Move-In Template",
    "description": "Complete move-in inspection template",
    "type": "MOVE_IN",
    "rooms": [
      {
        "name": "Living Room",
        "roomType": "LIVING_ROOM",
        "checklistItems": [
          {"description": "Walls and paint condition"},
          {"description": "Flooring condition"},
          {"description": "Windows and locks"}
        ]
      }
    ]
  }'
```

### Test Recurring Inspection:
```bash
curl -X POST http://localhost:3000/api/recurring-inspections \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "title": "Monthly Routine Inspection",
    "type": "ROUTINE",
    "propertyId": "PROPERTY_ID",
    "unitId": "UNIT_ID",
    "assignedToId": "TECHNICIAN_ID",
    "frequency": "MONTHLY",
    "interval": 1,
    "dayOfMonth": 1,
    "startDate": "2025-01-01T00:00:00Z",
    "templateId": "TEMPLATE_ID"
  }'
```

### Test Inspection History:
```bash
curl http://localhost:3000/api/inspections/history/unit/UNIT_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Test Comparison:
```bash
curl http://localhost:3000/api/inspections/compare/INSPECTION_ID_1/INSPECTION_ID_2 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Test Approval:
```bash
curl -X POST http://localhost:3000/api/inspections/INSPECTION_ID/approve \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Test Rejection:
```bash
curl -X POST http://localhost:3000/api/inspections/INSPECTION_ID/reject \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "rejectionReason": "Photos are unclear, please retake",
    "reassignToId": "NEW_TECHNICIAN_ID"
  }'
```

## Architecture Notes

### Status Flow with Approval Workflow
```
SCHEDULED → IN_PROGRESS → PENDING_APPROVAL → COMPLETED
                ↓              ↓ (if rejected)
            CANCELLED      IN_PROGRESS (with rejection reason)
```

### Template Application Flow
1. User selects template when creating inspection
2. Template rooms copied to InspectionRoom
3. Template checklist items copied to InspectionChecklistItem
4. User can modify after template application
5. Template tracks usage count

### Recurring Inspection Flow
1. Property Manager creates recurring schedule
2. Cron job runs daily at 2 AM
3. Service checks for due inspections (7-day look-ahead)
4. New Inspection created with SCHEDULED status
5. If template linked, rooms and checklists copied
6. Next due date calculated and updated
7. Schedule deactivated if end date reached

### Notification Flow
1. Technician completes inspection → Status: PENDING_APPROVAL
2. Property Manager receives in-app + email notification
3. Manager approves → Technician receives approval notification
4. Manager rejects → Technician receives rejection notification with reason
5. If re-assigned → New technician receives assignment notification

## Environment Variables

No new environment variables required. Uses existing:
- `DATABASE_URL` - PostgreSQL connection
- `FRONTEND_URL` - For notification links (default: http://localhost:5173)

## Next Steps

1. **Apply Database Migration** - Run the migration to update the database schema
2. **Test Backend APIs** - Use curl or Postman to verify all endpoints work
3. **Implement Frontend Components** - Build the UI components listed above
4. **Update Navigation** - Add menu items for Templates and Recurring Inspections
5. **Add Notification Types** - Ensure NotificationType enum includes INSPECTION_APPROVED and INSPECTION_REJECTED
6. **Create Email Templates** - Add email templates for approval/rejection notifications
7. **Update Documentation** - Document the new features for end users

## Support

For questions or issues with the implementation:
- Check API responses for error details
- Review server logs for debugging
- Verify database schema was properly migrated
- Ensure user roles have correct permissions

---

**Implementation Status:** ✅ Backend Complete | 🔄 Frontend Pending

**Committed:** Yes - Branch: `claude/inspection-templates-system-016ma8eVcpNkPbqf4djxr369`

**Pull Request:** https://github.com/kezar0001-cpu/buildstatefm-app/pull/new/claude/inspection-templates-system-016ma8eVcpNkPbqf4djxr369
