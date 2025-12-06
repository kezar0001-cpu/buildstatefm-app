# Service Request Workflow Analysis and Implementation Report

## Step 1: Analysis Summary

### What Already Matches the Spec

1. **Database Schema** ✓
   - ServiceRequest model has all required fields (archivedAt, approvedAt, rejectedAt, etc.)
   - ARCHIVED status exists in enum
   - Proper indexes for efficient queries
   - Job relationship exists

2. **Creation Rules** ⚠️ PARTIAL
   - Owners and tenants can create ✓
   - Property managers CAN currently create - **NEEDS FIX** (spec says they should NOT)

3. **Approval Workflow** ✓
   - Manager approval/rejection endpoints exist
   - Status transitions are implemented
   - Notifications are sent

4. **Conversion to Job** ✓
   - Endpoint exists at `/:id/convert-to-job`
   - Creates job and updates service request status
   - Maintains reference relationship

5. **Auto-Archiving** ⚠️ PARTIAL
   - Cron job exists and runs hourly ✓
   - Approved requests: 24h ✓
   - Rejected requests: 24h - **NEEDS FIX** (spec requires 25h)

6. **Photo Uploads** ✓
   - PropertyPhotoUpload component exists
   - Uses same upload endpoint as properties
   - Supports mobile camera and gallery

7. **Role-Based Access** ✓
   - Backend has proper RBAC checks
   - Frontend respects role-based UI

### What Was Missing or Incorrect

1. **Property Manager Creation Restriction**
   - **Issue**: Line 339-340 in `backend/src/routes/serviceRequests.js` allows PMs to create
   - **Fix**: Remove PM creation capability, return 403 error

2. **Auto-Archiving Timing**
   - **Issue**: Rejected requests archive after 24h instead of 25h
   - **Fix**: Update `archiveServiceRequests()` to use 25h for rejected

3. **Archived View/Filter**
   - **Issue**: Frontend status filter doesn't include ARCHIVED option
   - **Fix**: Add ARCHIVED to status filter and ensure archived requests are excluded by default

4. **Status Naming Consistency**
   - **Issue**: Uses "SUBMITTED" but spec mentions "pending"
   - **Fix**: Ensure SUBMITTED is treated as pending state (already correct, just verify)

### Implementation Plan

1. ✅ Fix Property Manager creation restriction
2. ✅ Fix auto-archiving timing (25h for rejected)
3. ✅ Add archived filter/view to frontend
4. ✅ Validate all role-based access
5. ✅ Make archived requests read-only
6. ✅ Test complete workflow end-to-end

## Step 2: Implementation Summary

### Changes Made

1. **Property Manager Creation Restriction** ✅
   - Backend: Removed PM creation capability in `POST /service-requests`
   - Frontend: Hidden create button for PMs in `ServiceRequestsPage.jsx`
   - Returns 403 error with clear message

2. **Auto-Archiving Timing** ✅
   - Updated `archiveServiceRequests()` in `cronJobs.js`
   - Approved requests: 24 hours (unchanged)
   - Rejected requests: 25 hours (fixed from 24h)

3. **Archived Filter/View** ✅
   - Added ARCHIVED to status filter dropdown
   - Backend excludes archived by default unless explicitly requested
   - Archived requests are properly filtered in all views

4. **Read-Only Archived Requests** ✅
   - Backend: All action endpoints check for ARCHIVED status
   - Frontend: Detail modal hides action buttons for archived requests
   - Shows informational alert for archived status

5. **Role-Based Access Validation** ✅
   - Verified all endpoints have proper RBAC checks
   - Owners and tenants can create (PMs cannot)
   - PMs can review and manage
   - All roles see appropriate requests

## Step 3: Revalidation

### Complete Workflow Verified

1. **Creation Flow** ✅
   - Owner/Tenant creates → Status: SUBMITTED (pending)
   - PM cannot create → Returns 403 error
   - Photos upload correctly

2. **Approval Flow** ✅
   - PM reviews and approves/rejects
   - Owner approves/rejects when required
   - Status transitions validated

3. **Job Conversion** ✅
   - Approved requests can be converted to jobs
   - Maintains reference relationship
   - Archived requests cannot be converted

4. **Auto-Archiving** ✅
   - Approved: Archived after 24h
   - Rejected: Archived after 25h
   - Cron job runs hourly

5. **Archived View** ✅
   - Archived requests excluded from main list
   - Can be viewed via status filter
   - Read-only in detail modal

### Status Naming
- SUBMITTED status is correctly treated as "pending" state
- All status transitions validated via `statusTransitions.js`

