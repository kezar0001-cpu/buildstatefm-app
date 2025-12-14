import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import TenantDashboard from '../pages/TenantDashboard';
import { apiClient } from '../api/client';

vi.mock('../api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('TenantDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('dedupes unit info and shows empty state for service requests', async () => {
    apiClient.get.mockImplementation(async (url) => {
      if (url === '/tenants/my-units') {
        return {
          data: {
            success: true,
            units: [
              {
                id: 'unit-1',
                unitNumber: '686',
                status: 'OCCUPIED',
                bedrooms: 12,
                bathrooms: 12,
                propertyId: 'property-1',
              },
              {
                id: 'unit-1',
                unitNumber: '686',
                status: 'OCCUPIED',
                bedrooms: 12,
                bathrooms: 12,
                propertyId: 'property-1',
              },
            ],
          },
        };
      }

      if (url === '/service-requests?mine=true') {
        return {
          data: {
            success: true,
            items: [],
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
        <MemoryRouter initialEntries={['/tenant/dashboard']}>
          <Routes>
            <Route path="/tenant/dashboard" element={<TenantDashboard />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith('/tenants/my-units');
      expect(apiClient.get).toHaveBeenCalledWith('/service-requests?mine=true');
    });

    // Dedupe: the "Unit Number" label should only appear once.
    expect((await screen.findAllByText(/Unit Number/i)).length).toBe(1);

    // Service requests empty state should show the configured message.
    expect(
      await screen.findByText(/No service requests yet\. Click 'New Service Request' to submit one\./i)
    ).toBeTruthy();
  });
});
