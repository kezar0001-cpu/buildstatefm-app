import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import TenantUnitPage from '../pages/TenantUnitPage';
import { apiClient } from '../api/client';

vi.mock('../api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('TenantUnitPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows an empty state when tenant has no assigned unit', async () => {
    apiClient.get.mockImplementation(async (url) => {
      if (url === '/tenants/my-units') {
        return {
          data: {
            success: true,
            units: [],
          },
        };
      }

      if (url.startsWith('/properties/')) {
        return {
          data: {
            success: true,
            property: null,
          },
        };
      }

      throw new Error(`Unexpected GET: ${url}`);
    });

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/tenant/unit']}>
          <Routes>
            <Route path="/tenant/unit" element={<TenantUnitPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith('/tenants/my-units');
    });

    expect(await screen.findByText(/unit assigned yet/i)).toBeTruthy();
  });
});
