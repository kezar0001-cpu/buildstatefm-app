# Phase 2 Roadmap - Workflow Completion

**Date**: December 2025  
**Status**: Ready for Implementation  
**Dependencies**: Phase 1 Complete ✅

---

## Goals and Rationale

**Primary Goal**: Complete and enhance core business workflows to ensure all user journeys are fully functional and intuitive.

**Rationale**: With Phase 1 security and data integrity fixes in place, Phase 2 focuses on completing the business logic workflows that are the core value proposition of the platform. This ensures users can complete their tasks end-to-end without friction.

**Focus Areas**:
1. Service Request Approval Workflow
2. Inspection Workflow Completion
3. Job Assignment and Tracking Improvements
4. Notification System Completion

---

## 2.1 Service Request Approval Workflow

### Current State Analysis

**Existing Implementation**:
- ✅ Service requests can be created by tenants
- ✅ Basic status transitions (SUBMITTED → UNDER_REVIEW → APPROVED/REJECTED)
- ✅ Owner budget estimation support
- ✅ Manager cost estimation support
- ✅ Approval/rejection workflow exists

**Gaps Identified**:
1. **Incomplete Status Transitions**: Missing proper validation of status transitions
2. **Owner Approval Workflow**: Owner approval/rejection may not be fully integrated
3. **Budget Approval Logic**: Budget approval workflow may be incomplete
4. **Notification Gaps**: Not all status changes trigger notifications
5. **UI/UX Issues**: Approval workflow may not be clear to users
6. **Access Control**: Some roles may have incorrect permissions

### Intended Behavior

**Complete Service Request Lifecycle**:
```
TENANT submits request
  ↓
MANAGER reviews (UNDER_REVIEW)
  ↓
MANAGER estimates cost (optional)
  ↓
OWNER reviews (PENDING_OWNER_APPROVAL)
  ↓
OWNER approves/rejects with budget (APPROVED_BY_OWNER / REJECTED_BY_OWNER)
  ↓
MANAGER converts to job (CONVERTED_TO_JOB) or completes directly
  ↓
JOB created and assigned
  ↓
COMPLETED
```

**Status Transitions**:
- `SUBMITTED` → `UNDER_REVIEW` (Manager)
- `UNDER_REVIEW` → `PENDING_OWNER_APPROVAL` (Manager, if owner approval required)
- `UNDER_REVIEW` → `APPROVED` (Manager, if no owner approval needed)
- `UNDER_REVIEW` → `REJECTED` (Manager)
- `PENDING_OWNER_APPROVAL` → `APPROVED_BY_OWNER` (Owner)
- `PENDING_OWNER_APPROVAL` → `REJECTED_BY_OWNER` (Owner)
- `APPROVED_BY_OWNER` → `CONVERTED_TO_JOB` (Manager)
- `APPROVED` → `CONVERTED_TO_JOB` (Manager)
- `CONVERTED_TO_JOB` → `COMPLETED` (Automatic when job completed)

### Implementation Tasks

#### Backend
1. **Status Transition Validation**
   - Add validation middleware to ensure only valid status transitions
   - Create status transition matrix
   - Add error handling for invalid transitions

2. **Owner Approval Integration**
   - Ensure owner approval workflow is fully functional
   - Add proper access control for owner approval/rejection
   - Validate owner has access to the property

3. **Budget Approval Logic**
   - Complete budget approval workflow
   - Ensure approved budget is properly stored
   - Validate budget amounts

4. **Notification Triggers**
   - Add notifications for all status changes
   - Notify tenant when request is reviewed
   - Notify owner when approval is needed
   - Notify manager when owner responds
   - Notify tenant when request is approved/rejected

5. **Access Control Review**
   - Verify role permissions for each status transition
   - Ensure tenants can only modify their own requests
   - Ensure owners can only approve/reject requests for their properties

#### Frontend
1. **Service Request Detail Page**
   - Show complete workflow status
   - Display approval/rejection history
   - Show budget information clearly
   - Add action buttons based on user role and current status

2. **Approval UI Components**
   - Create approval dialog for owners
   - Create rejection dialog with reason
   - Add budget input for owner approval
   - Show pending approvals clearly

3. **Status Indicators**
   - Visual status indicators (badges, progress bars)
   - Timeline view of status changes
   - Clear next steps for each role

4. **Notifications Integration**
   - Show notification badges
   - Link notifications to service requests
   - Update UI when notifications are received

### Dependencies
- Phase 1 subscription enforcement (complete)
- Notification system (Phase 2.4)
- Access control middleware (existing)

### Technical Risks
- **Breaking Changes**: Status transition validation may break existing workflows
  - **Mitigation**: Test thoroughly, provide migration path
- **Permission Issues**: Complex role-based permissions may cause confusion
  - **Mitigation**: Clear documentation, comprehensive testing

### Expected User Impact
- **Positive**: Clear workflow, better visibility, fewer errors
- **Potential Negative**: Some existing requests may need status updates

---

## 2.2 Inspection Workflow Completion

### Current State Analysis

**Existing Implementation**:
- ✅ Inspections can be created and scheduled
- ✅ Inspection templates support
- ✅ Room-based inspection structure
- ✅ Checklist items
- ✅ Photo attachments
- ✅ Signature capture
- ✅ Approval/rejection workflow exists
- ✅ Recurring inspections support

**Gaps Identified**:
1. **Status Transition Validation**: Missing validation for status transitions
2. **Workflow Steps**: Some workflow steps may be missing or incomplete
3. **Notification Gaps**: Not all workflow events trigger notifications
4. **Completion Flow**: Inspection completion may not properly trigger job creation
5. **Approval Workflow**: Approval/rejection workflow may be incomplete
6. **Reporting**: Inspection reports may not be generated correctly

### Intended Behavior

**Complete Inspection Lifecycle**:
```
SCHEDULED
  ↓
IN_PROGRESS (when technician starts)
  ↓
PENDING_APPROVAL (when completed)
  ↓
COMPLETED (when approved) or back to IN_PROGRESS (when rejected)
```

**Workflow Steps**:
1. **Scheduling**: Manager schedules inspection, assigns technician
2. **Reminders**: System sends reminders before scheduled date
3. **Conducting**: Technician conducts inspection, adds rooms, checklist items, photos, issues
4. **Completion**: Technician marks inspection as complete
5. **Review**: Manager reviews inspection
6. **Approval/Rejection**: Manager approves or rejects with reason
7. **Job Creation**: Approved inspections with issues create jobs automatically
8. **Reporting**: Generate inspection report

### Implementation Tasks

#### Backend
1. **Status Transition Validation**
   - Add validation for status transitions
   - Ensure only valid transitions are allowed
   - Add proper error messages

2. **Workflow Completion**
   - Ensure all workflow steps are properly implemented
   - Add missing workflow steps if needed
   - Validate workflow completion

3. **Automatic Job Creation**
   - Create jobs from inspection issues automatically
   - Link jobs to inspections
   - Set proper job priorities based on issue severity

4. **Notification Triggers**
   - Notify technician when inspection is scheduled
   - Notify manager when inspection is completed
   - Notify technician when inspection is rejected
   - Notify manager when inspection is overdue

5. **Report Generation**
   - Ensure inspection reports are generated correctly
   - Include all inspection data (rooms, checklist, issues, photos)
   - Generate PDF reports

#### Frontend
1. **Inspection Conduct Page**
   - Improve UI for conducting inspections
   - Better room navigation
   - Easier checklist item management
   - Photo upload improvements

2. **Status Management**
   - Clear status indicators
   - Proper action buttons based on status
   - Status transition confirmation dialogs

3. **Approval UI**
   - Approval/rejection dialogs
   - Rejection reason input
   - Approval confirmation

4. **Workflow Visualization**
   - Show inspection workflow progress
   - Display next steps
   - Timeline view

### Dependencies
- Phase 1 subscription enforcement (complete)
- Job creation API (existing)
- Notification system (Phase 2.4)
- Report generation (existing)

### Technical Risks
- **Data Integrity**: Status transitions must maintain data integrity
  - **Mitigation**: Comprehensive validation, testing
- **Performance**: Large inspections with many rooms/photos may be slow
  - **Mitigation**: Optimize queries, pagination

### Expected User Impact
- **Positive**: Smoother workflow, better visibility, fewer errors
- **Potential Negative**: Some existing inspections may need status updates

---

## 2.3 Job Assignment and Tracking Improvements

### Current State Analysis

**Existing Implementation**:
- ✅ Jobs can be created
- ✅ Jobs can be assigned to technicians
- ✅ Status tracking exists
- ✅ Comments support
- ✅ Cost tracking (estimated/actual)

**Gaps Identified**:
1. **Status Transition Validation**: Missing validation for status transitions
2. **Assignment Workflow**: Job assignment may not be optimal
3. **Status Updates**: Status updates may not trigger proper notifications
4. **Cost Tracking**: Cost tracking may be incomplete
5. **Completion Flow**: Job completion may not properly update related entities
6. **Bulk Operations**: Bulk assignment may be missing or incomplete

### Intended Behavior

**Complete Job Lifecycle**:
```
OPEN
  ↓
ASSIGNED (when assigned to technician)
  ↓
IN_PROGRESS (when technician starts)
  ↓
COMPLETED (when technician completes)
```

**Status Transitions**:
- `OPEN` → `ASSIGNED` (Manager assigns technician)
- `ASSIGNED` → `IN_PROGRESS` (Technician starts work)
- `IN_PROGRESS` → `COMPLETED` (Technician completes)
- Any status → `CANCELLED` (Manager cancels)

**Workflow Features**:
- Bulk assignment of jobs
- Automatic status updates based on actions
- Cost tracking and reporting
- Completion notifications
- Related entity updates (service requests, inspections)

### Implementation Tasks

#### Backend
1. **Status Transition Validation**
   - Add validation for status transitions
   - Ensure only valid transitions are allowed
   - Add proper error messages

2. **Assignment Improvements**
   - Improve job assignment logic
   - Add bulk assignment support
   - Validate technician availability
   - Add assignment history

3. **Status Update Logic**
   - Ensure status updates trigger proper notifications
   - Update related entities when job is completed
   - Add status change history

4. **Cost Tracking**
   - Complete cost tracking implementation
   - Add cost reporting
   - Validate cost entries

5. **Completion Flow**
   - Ensure job completion updates service requests
   - Update inspection status if job was created from inspection
   - Add completion confirmation

#### Frontend
1. **Job Assignment UI**
   - Improve job assignment interface
   - Add bulk assignment UI
   - Show technician availability
   - Assignment history view

2. **Status Management**
   - Clear status indicators
   - Proper action buttons based on status
   - Status transition confirmation dialogs

3. **Cost Tracking UI**
   - Better cost input forms
   - Cost comparison (estimated vs actual)
   - Cost reporting views

4. **Job Detail Page**
   - Complete job information display
   - Related entities (service request, inspection)
   - Timeline view
   - Comments section improvements

### Dependencies
- Phase 1 subscription enforcement (complete)
- Notification system (Phase 2.4)
- Service request workflow (Phase 2.1)
- Inspection workflow (Phase 2.2)

### Technical Risks
- **Data Consistency**: Status updates must maintain data consistency
  - **Mitigation**: Transaction management, validation
- **Performance**: Bulk operations may be slow
  - **Mitigation**: Optimize queries, batch processing

### Expected User Impact
- **Positive**: Better job management, clearer workflow, improved tracking
- **Potential Negative**: Some existing jobs may need status updates

---

## 2.4 Notification System Completion

### Current State Analysis

**Existing Implementation**:
- ✅ Notification model exists
- ✅ Basic notification creation
- ✅ WebSocket support for real-time notifications
- ✅ Notification bell component

**Gaps Identified**:
1. **Missing Notification Triggers**: Not all important events trigger notifications
2. **Notification Types**: Some notification types may be missing
3. **Notification Delivery**: Email notifications may not be fully implemented
4. **Notification Preferences**: User notification preferences may be missing
5. **Notification Grouping**: Notifications may not be properly grouped
6. **Notification Actions**: Notification actions may be incomplete

### Intended Behavior

**Notification Triggers**:
- Service request submitted (notify manager)
- Service request reviewed (notify tenant)
- Service request approved/rejected (notify tenant)
- Owner approval needed (notify owner)
- Owner approved/rejected (notify manager)
- Inspection scheduled (notify technician)
- Inspection completed (notify manager)
- Inspection approved/rejected (notify technician)
- Job assigned (notify technician)
- Job completed (notify manager)
- Job status updated (notify relevant parties)
- Subscription expiring (notify user)
- Payment due (notify user)

**Notification Types**:
- Real-time (WebSocket)
- Email (for important events)
- In-app (all events)

**Notification Features**:
- User preferences (what notifications to receive)
- Notification grouping
- Mark as read/unread
- Notification actions (link to related entity)
- Notification history

### Implementation Tasks

#### Backend
1. **Notification Service Enhancement**
   - Add all missing notification triggers
   - Create notification helper functions
   - Ensure notifications are created for all important events

2. **Email Notifications**
   - Complete email notification implementation
   - Add email templates
   - Configure email delivery
   - Add email preferences

3. **Notification Preferences**
   - Add user notification preferences model
   - Create API for managing preferences
   - Respect user preferences when sending notifications

4. **Notification Grouping**
   - Implement notification grouping logic
   - Group similar notifications
   - Add grouping UI support

5. **Notification Actions**
   - Add action links to notifications
   - Support notification actions (mark as read, dismiss, etc.)
   - Add action handlers

#### Frontend
1. **Notification Bell Enhancement**
   - Improve notification bell UI
   - Add notification grouping display
   - Add notification actions
   - Real-time updates

2. **Notification Preferences UI**
   - Create notification preferences page
   - Allow users to configure notification types
   - Save preferences

3. **Notification Center**
   - Create notification center page
   - Show all notifications
   - Filter and search notifications
   - Mark as read/unread

4. **Email Notification Templates**
   - Design email templates
   - Ensure emails are mobile-friendly
   - Include action links

### Dependencies
- Phase 1 subscription enforcement (complete)
- Service request workflow (Phase 2.1)
- Inspection workflow (Phase 2.2)
- Job assignment workflow (Phase 2.3)
- Email service (Resend) configured

### Technical Risks
- **Email Delivery**: Email delivery may fail
  - **Mitigation**: Retry logic, fallback to in-app notifications
- **Performance**: Too many notifications may impact performance
  - **Mitigation**: Batch processing, rate limiting
- **WebSocket Reliability**: WebSocket connections may drop
  - **Mitigation**: Reconnection logic, fallback polling

### Expected User Impact
- **Positive**: Better user engagement, timely updates, improved workflow
- **Potential Negative**: Users may receive too many notifications (mitigated by preferences)

---

## Implementation Priority

### Week 1: Service Request Workflow
1. Status transition validation
2. Owner approval integration
3. Budget approval logic
4. Notification triggers
5. Frontend UI improvements

### Week 2: Inspection Workflow
1. Status transition validation
2. Workflow completion
3. Automatic job creation
4. Notification triggers
5. Frontend UI improvements

### Week 3: Job Assignment Improvements
1. Status transition validation
2. Assignment improvements
3. Cost tracking
4. Completion flow
5. Frontend UI improvements

### Week 4: Notification System
1. Notification service enhancement
2. Email notifications
3. Notification preferences
4. Frontend UI improvements
5. Testing and refinement

---

## Testing Requirements

### Unit Tests
- Test status transition validation
- Test notification triggers
- Test workflow completion logic
- Test access control

### Integration Tests
- Test complete service request workflow
- Test complete inspection workflow
- Test job assignment and completion
- Test notification delivery

### E2E Tests
- Test service request approval workflow end-to-end
- Test inspection workflow end-to-end
- Test job assignment and completion end-to-end
- Test notification system end-to-end

---

## Success Metrics

1. **Service Request Workflow**
   - 100% of service requests follow proper workflow
   - All status transitions are validated
   - All notifications are sent

2. **Inspection Workflow**
   - 100% of inspections follow proper workflow
   - All status transitions are validated
   - Jobs are created automatically from issues

3. **Job Assignment**
   - 100% of jobs follow proper workflow
   - All status transitions are validated
   - Bulk assignment works correctly

4. **Notification System**
   - All important events trigger notifications
   - Email notifications are delivered
   - User preferences are respected

---

## Conclusion

Phase 2 focuses on completing and enhancing the core business workflows that drive user value. By ensuring all workflows are complete, validated, and properly integrated with notifications, we create a seamless user experience that enables users to complete their tasks efficiently.

**Next Steps**:
1. Review and approve Phase 2 roadmap
2. Begin implementation of service request workflow
3. Test thoroughly in staging
4. Deploy incrementally
5. Monitor and iterate

---

**Roadmap Created By**: AI Product Review Agent  
**Date**: December 2025  
**Status**: Ready for Implementation

