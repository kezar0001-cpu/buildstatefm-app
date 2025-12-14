import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import SignUp from '../pages/SignUp';
import { apiClient } from '../api/client';

vi.mock('../api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('../lib/auth', () => ({
  saveTokenFromUrl: vi.fn(),
  setCurrentUser: vi.fn(),
}));

describe('SignUp invite flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.removeItem('auth_token');
  });

  it('prefills invited email and hides Google/divider UI', async () => {
    apiClient.get.mockResolvedValueOnce({
      data: {
        success: true,
        invite: {
          email: 'tenant@example.com',
          role: 'TENANT',
          invitedBy: { firstName: 'Pat', lastName: 'Manager' },
          property: { id: 'prop-1', name: 'Test Property' },
          unit: { id: 'unit-1', unitNumber: '101', propertyId: 'prop-1' },
        },
      },
    });

    render(
      <MemoryRouter initialEntries={['/signup?invite=token-123']}>
        <Routes>
          <Route path="/signup" element={<SignUp />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith('/invites/token-123');
    });

    const emailInput = screen.getByLabelText(/email address/i);

    await waitFor(() => {
      expect(emailInput).toHaveValue('tenant@example.com');
    });

    expect(emailInput.disabled).toBe(true);
    expect(screen.getByText(/email from invitation/i)).toBeInTheDocument();

    expect(screen.queryByText(/continue with google/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/or sign up with email/i)).not.toBeInTheDocument();
  });
});
