import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import SignUp from '../pages/SignUp.jsx';
import { apiClient } from '../api/client';

vi.mock('../api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock('../lib/auth', () => ({
  saveTokenFromUrl: vi.fn(),
  setCurrentUser: vi.fn(),
}));

describe('SignUp invite flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('prefills email from invite and hides Google sign-up button', async () => {
    apiClient.get.mockResolvedValue({
      data: {
        success: true,
        invite: {
          email: 'tenant@example.com',
          role: 'TENANT',
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

    const emailInput = screen.getByLabelText(/Email Address/i);

    await waitFor(() => {
      expect(emailInput).toHaveValue('tenant@example.com');
    });

    expect(screen.queryByRole('button', { name: /Continue with Google/i })).not.toBeInTheDocument();
  });
});
