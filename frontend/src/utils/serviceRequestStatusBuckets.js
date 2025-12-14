export function getTenantServiceRequestCounts(serviceRequests) {
  const list = Array.isArray(serviceRequests) ? serviceRequests : [];

  let pending = 0;
  let approved = 0;
  let completed = 0;

  for (const request of list) {
    const status = request?.status;

    if (
      status === 'SUBMITTED' ||
      status === 'UNDER_REVIEW' ||
      status === 'PENDING_MANAGER_REVIEW' ||
      status === 'PENDING_OWNER_APPROVAL'
    ) {
      pending += 1;
      continue;
    }

    if (status === 'APPROVED' || status === 'APPROVED_BY_OWNER' || status === 'CONVERTED_TO_JOB') {
      approved += 1;
      continue;
    }

    if (status === 'COMPLETED') {
      completed += 1;
    }
  }

  return {
    pending,
    approved,
    completed,
  };
}
