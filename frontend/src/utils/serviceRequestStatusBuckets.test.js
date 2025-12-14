import { describe, it, expect } from 'vitest';

import { getTenantServiceRequestCounts } from './serviceRequestStatusBuckets.js';

describe('getTenantServiceRequestCounts', () => {
  it('returns zero counts for empty or invalid input', () => {
    expect(getTenantServiceRequestCounts()).toEqual({ pending: 0, approved: 0, completed: 0 });
    expect(getTenantServiceRequestCounts(null)).toEqual({ pending: 0, approved: 0, completed: 0 });
    expect(getTenantServiceRequestCounts({})).toEqual({ pending: 0, approved: 0, completed: 0 });
  });

  it('counts pending statuses including approval workflows', () => {
    const { pending, approved, completed } = getTenantServiceRequestCounts([
      { status: 'SUBMITTED' },
      { status: 'UNDER_REVIEW' },
      { status: 'PENDING_MANAGER_REVIEW' },
      { status: 'PENDING_OWNER_APPROVAL' },
      { status: 'APPROVED' },
      { status: 'APPROVED_BY_OWNER' },
      { status: 'CONVERTED_TO_JOB' },
      { status: 'COMPLETED' },
      { status: 'REJECTED' },
      null,
    ]);

    expect(pending).toBe(4);
    expect(approved).toBe(3);
    expect(completed).toBe(1);
  });
});
