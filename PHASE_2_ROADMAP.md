# Phase 2 Roadmap - Workflow Completion & Notification System

**Date**: January 2025  
**Status**: Ready for Implementation  
**Dependencies**: Phase 1 Complete

---

## Goals and Rationale

**Primary Goal**: Complete workflow integrations and enhance notification system to ensure all critical events trigger appropriate notifications.

**Rationale**: While core workflows are functionally complete, notification integration is incomplete. Phase 2 focuses on:
1. Integrating inspection notifications into workflow
2. Enhancing notification system completeness
3. Improving job assignment workflow UX
4. Adding notification preferences

---

## Feature List and Improvements

### 2.1 Inspection Notification Integration (Critical)

**Current State**: 
- Inspection notification functions exist (`notifyInspectionReminder`, `notifyInspectionCompleted`, `notifyInspectionApproved`, `notifyInspectionRejected`)
- Notifications are NOT being called in inspection controller
- Technicians don't receive notifications when inspections are assigned
- Managers don't receive notifications when inspections are completed

**Intended Behavior**:
- When inspection is created with `assignedToId`, notify assigned technician
- When inspection status changes to `COMPLETED`, notify property manager
- When inspection is approved, notify technician
- When inspection is rejected, notify technician with reason
- When inspection is scheduled, send reminder notifications

**Implementation**:
- Add notification calls to `inspectionController.js`:
  - `createInspection`: Notify technician if assigned
  - `completeInspection`: Notify manager
  - `approveInspection`: Notify technician
  - `rejectInspection`: Notify technician
- Add notification for inspection assignment in `updateInspection`
- Integrate with existing cron job for inspection reminders

**Files to Modify**:
- `backend/src/controllers/inspectionController.js`
- `backend/src/routes/inspections.js` (if needed)

### 2.2 Notification System Enhancements (High Priority)

**Current State**:
- Basic notification system exists
- Job notifications are integrated
- Service request notifications are integrated
- Inspection notifications are NOT integrated
- No notification preferences system

**Intended Behavior**:
- All critical events trigger notifications
- Users can configure notification preferences
- Email notifications work for all notification types
- Real-time WebSocket notifications work

**Implementation**:
- Complete inspection notification integration (2.1)
- Add notification for inspection scheduling
- Verify all notification types have email templates
- Add notification preferences model (future enhancement)

**Files to Modify**:
- `backend/src/controllers/inspectionController.js`
- `backend/src/utils/notificationService.js` (if new functions needed)
- `backend/src/utils/emailTemplates.js` (if templates missing)

### 2.3 Job Assignment Workflow Improvements (High Priority)

**Current State**:
- Job assignment works
- Bulk assignment exists
- Notifications are sent
- UI could be improved

**Intended Behavior**:
- Better bulk assignment UI
- Assignment history tracking
- Assignment conflict detection
- Technician availability checking

**Implementation**:
- Enhance bulk assignment UI with better feedback
- Add assignment history to job model (optional)
- Add conflict detection (overlapping scheduled dates)
- Add technician availability checking (future enhancement)

**Files to Modify**:
- `frontend/src/pages/JobsPage.jsx` (UI improvements)
- `backend/src/routes/jobs.js` (conflict detection)

### 2.4 Notification Preferences (Medium Priority)

**Current State**:
- No user notification preferences
- All notifications are sent to all users
- No way to opt-out of specific notification types

**Intended Behavior**:
- Users can configure which notifications they receive
- Email notification preferences
- In-app notification preferences
- Per-notification-type preferences

**Implementation**:
- Add `NotificationPreference` model to schema
- Create preferences API endpoints
- Add preferences UI in user profile
- Update notification service to check preferences

**Files to Create/Modify**:
- `backend/prisma/schema.prisma` (add model)
- `backend/src/routes/notifications.js` (add preferences endpoints)
- `frontend/src/pages/ProfilePage.jsx` (add preferences UI)
- `backend/src/utils/notificationService.js` (check preferences)

---

## Dependencies and Preconditions

1. **Phase 1 Complete**: Subscription enforcement must be complete
2. **Database Access**: Must have access to production/staging database
3. **Email Service**: Resend must be configured for email notifications
4. **WebSocket**: WebSocket server must be running for real-time notifications
5. **Testing Environment**: Staging environment for testing

---

## Technical Risks

1. **Notification Spam**: Too many notifications may annoy users
   - **Mitigation**: Implement notification preferences, batch notifications
2. **Email Delivery**: Email notifications may fail
   - **Mitigation**: Log errors, don't fail main operation if notification fails
3. **Performance**: Notification creation may slow down operations
   - **Mitigation**: Send notifications asynchronously, use queues (future)
4. **WebSocket Reliability**: Real-time notifications may not work for all users
   - **Mitigation**: Fallback to polling, graceful degradation

---

## Expected User Impact

**Positive**:
- Technicians receive timely notifications about assigned inspections
- Managers receive notifications when inspections are completed
- Better workflow coordination
- Improved user engagement
- Reduced missed deadlines

**Potential Negative**:
- Users may receive more notifications (can be managed with preferences)
- Some users may find notifications intrusive (can be disabled)

---

## Implementation Priority

### Week 1: Inspection Notification Integration
1. Add notification calls to inspection controller
2. Test notification delivery
3. Verify email templates
4. Test WebSocket notifications

### Week 2: Notification System Enhancements
1. Add missing notification triggers
2. Verify all notification types work
3. Add notification preferences model (if time permits)
4. Test end-to-end notification flow

### Week 3: Job Assignment Improvements
1. Enhance bulk assignment UI
2. Add conflict detection
3. Test assignment workflow
4. Document improvements

### Week 4: Notification Preferences (If Time Permits)
1. Add preferences model
2. Create preferences API
3. Add preferences UI
4. Test preferences system

---

## Testing Requirements

### Unit Tests
- Test notification service functions
- Test notification preference checking
- Test email template rendering

### Integration Tests
- Test inspection notification triggers
- Test job notification triggers
- Test service request notification triggers
- Test notification delivery (in-app, email, WebSocket)

### E2E Tests
- Test complete inspection workflow with notifications
- Test job assignment workflow with notifications
- Test notification preferences

---

## Success Criteria

1. ✅ All inspection events trigger appropriate notifications
2. ✅ Technicians receive notifications when inspections are assigned
3. ✅ Managers receive notifications when inspections are completed
4. ✅ All notification types have working email templates
5. ✅ WebSocket notifications work for real-time updates
6. ✅ Notification preferences system is designed (implementation can be Phase 3)

---

## Documentation Updates Required

1. **API Documentation**: Update with notification triggers
2. **User Guide**: Document notification system
3. **Developer Guide**: Document notification service usage
4. **Notification Types**: Document all notification types and when they're sent

---

**Phase 2 Status**: Ready for Implementation  
**Next Steps**: Begin inspection notification integration
