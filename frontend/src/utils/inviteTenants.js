import apiClient from '../api/client.js';

function normalizeEmails(emails) {
  if (!Array.isArray(emails)) {
    if (typeof emails === 'string') {
      return [emails];
    }
    return [];
  }
  return emails;
}

export async function inviteTenantsToUnit({ emails, unitId }) {
  const normalized = normalizeEmails(emails)
    .map((email) => (typeof email === 'string' ? email.trim() : ''))
    .filter(Boolean);

  if (!normalized.length || !unitId) {
    return {
      total: normalized.length,
      successes: 0,
      failures: normalized.map((email) => ({ email, error: 'Missing unit id' })),
      emails: normalized,
    };
  }

  const results = await Promise.allSettled(
    normalized.map((email) =>
      apiClient.post('/invites', {
        email,
        role: 'TENANT',
        unitId,
      })
    )
  );

  const failures = [];
  let successes = 0;

  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      successes += 1;
    } else {
      const reason = result.reason;
      const message =
        reason?.response?.data?.message ||
        reason?.message ||
        'Failed to send invite';
      failures.push({ email: normalized[index], error: message });
    }
  });

  return {
    total: normalized.length,
    successes,
    failures,
    emails: normalized,
  };
}

export default inviteTenantsToUnit;
