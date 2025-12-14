import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

  it('dedupes units in the Select Unit dropdown when API returns duplicates', async () => {
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
                propertyId: 'property-1',
                property: { id: 'property-1', name: 'hadil' },
              },
              {
                id: 'unit-1',
                unitNumber: '686',
                status: 'OCCUPIED',
                propertyId: 'property-1',
                property: { id: 'property-1', name: 'hadil' },
              },
              {
                id: 'unit-2',
                unitNumber: '999',
                status: 'OCCUPIED',
                propertyId: 'property-1',
                property: { id: 'property-1', name: 'hadil' },
              },
            ],
          },
        };
      }

      if (url.startsWith('/inspections?unitId=')) {
        return { data: { items: [] } };
      }

      if (url.startsWith('/properties/')) {
        return {
          data: {
            success: true,
            property: {
              id: 'property-1',
              name: 'hadil',
              address: '123 Main St',
              city: 'Testville',
              postcode: '2000',
              images: [],
            },
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

    const user = userEvent.setup();

    // MUI Select renders options only after opening the menu.
    const unitSelect = await screen.findByRole('combobox', { name: /unit/i });
    await user.click(unitSelect);

    const listbox = await screen.findByRole('listbox');
    const options = within(listbox).getAllByRole('option');
    expect(options.length).toBe(2);
  });
});
