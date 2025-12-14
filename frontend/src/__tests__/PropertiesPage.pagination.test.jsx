import { describe, beforeEach, it, expect, vi } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';

import PropertiesPage from '../pages/PropertiesPage.jsx';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key, i18n: { changeLanguage: () => Promise.resolve() } }),
}));

vi.mock('../components/PropertyOnboardingWizard.jsx', () => ({ default: () => null }));
vi.mock('../components/PropertyForm.jsx', () => ({ default: () => null }));
vi.mock('../components/PropertyOccupancyWidget.jsx', () => ({ default: () => null }));

const { mockedGet, mockedDelete, mockedRequest } = vi.hoisted(() => ({
  mockedGet: vi.fn(),
  mockedDelete: vi.fn(),
  mockedRequest: vi.fn(),
}));

vi.mock('../api/client', () => {
  const client = {
    get: mockedGet,
    delete: mockedDelete,
    request: mockedRequest,
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  };

  return { __esModule: true, default: client, apiClient: client };
});

const createMockProperty = (id, name) => ({
  id,
  name,
  address: `${id} Test Street`,
  city: 'Test City',
  state: 'TS',
  zipCode: '12345',
  country: 'Test Country',
  propertyType: 'Residential',
  status: 'ACTIVE',
  totalUnits: 10,
  managerId: 'manager-1',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-02T00:00:00.000Z',
  _count: {
    units: 10,
    jobs: 0,
    inspections: 0,
  },
});

describe('PropertiesPage pagination', () => {
  beforeEach(() => {
    mockedGet.mockReset();
    mockedDelete.mockReset();
    mockedRequest.mockReset();
    cleanup();
  });

  it('should calculate correct offset for second page using allPages.length', async () => {
    // First page (offset 0)
    const firstPageProperties = Array.from({ length: 50 }, (_, i) =>
      createMockProperty(`prop-${i}`, `Property ${i}`)
    );

    // Second page (offset 50)
    const secondPageProperties = Array.from({ length: 50 }, (_, i) =>
      createMockProperty(`prop-${i + 50}`, `Property ${i + 50}`)
    );

    // Mock first page response
    mockedGet.mockResolvedValueOnce({
      data: {
        items: firstPageProperties,
        total: 100,
        page: 1,
        hasMore: true,
      },
    });

    // Mock second page response
    mockedGet.mockResolvedValueOnce({
      data: {
        items: secondPageProperties,
        total: 100,
        page: 2,
        hasMore: false,
      },
    });

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <PropertiesPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Wait for first page to load
    await waitFor(() => {
      expect(screen.getByText('Property 0')).toBeInTheDocument();
    });

    // Verify first API call used offset 0
    expect(mockedGet).toHaveBeenCalledWith('/properties?limit=50&offset=0');

    // Click "Load More" button
    const loadMoreButton = screen.getByRole('button', { name: /load more/i });
    await userEvent.click(loadMoreButton);

    // Wait for second page to load
    await waitFor(() => {
      expect(screen.getByText('Property 50')).toBeInTheDocument();
    });

    // Verify second API call used offset 50 (calculated as allPages.length * 50 = 1 * 50)
    expect(mockedGet).toHaveBeenCalledWith('/properties?limit=50&offset=50');
  });

  it('should calculate correct offset for third page', async () => {
    const createPageData = (pageNum) => ({
      items: Array.from({ length: 50 }, (_, i) => {
        const id = (pageNum - 1) * 50 + i;
        return createMockProperty(`prop-${id}`, `Property ${id}`);
      }),
      total: 150,
      page: pageNum,
      hasMore: pageNum < 3,
    });

    // Mock three pages
    mockedGet.mockResolvedValueOnce({ data: createPageData(1) });
    mockedGet.mockResolvedValueOnce({ data: createPageData(2) });
    mockedGet.mockResolvedValueOnce({ data: createPageData(3) });

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <PropertiesPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Wait for first page
    await waitFor(() => {
      expect(screen.getByText('Property 0')).toBeInTheDocument();
    });

    // Load second page
    await userEvent.click(screen.getByRole('button', { name: /load more/i }));
    await waitFor(() => {
      expect(screen.getByText('Property 50')).toBeInTheDocument();
    });

    // Load third page
    await userEvent.click(screen.getByRole('button', { name: /load more/i }));
    await waitFor(() => {
      expect(screen.getByText('Property 100')).toBeInTheDocument();
    });

    // Verify all three API calls used correct offsets
    expect(mockedGet).toHaveBeenNthCalledWith(1, '/properties?limit=50&offset=0');
    expect(mockedGet).toHaveBeenNthCalledWith(2, '/properties?limit=50&offset=50');
    expect(mockedGet).toHaveBeenNthCalledWith(3, '/properties?limit=50&offset=100');
  });

  it('should not skip properties when paginating through large dataset', async () => {
    const createPageData = (pageNum) => ({
      items: Array.from({ length: 50 }, (_, i) => {
        const id = (pageNum - 1) * 50 + i;
        return createMockProperty(`prop-${id}`, `Property ${id}`);
      }),
      total: 200,
      page: pageNum,
      hasMore: pageNum < 4,
    });

    mockedGet.mockResolvedValueOnce({ data: createPageData(1) });
    mockedGet.mockResolvedValueOnce({ data: createPageData(2) });

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <PropertiesPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Wait for first page
    await waitFor(() => {
      expect(screen.getByText('Property 0')).toBeInTheDocument();
      expect(screen.getByText('Property 49')).toBeInTheDocument();
    });

    // Load second page
    await userEvent.click(screen.getByRole('button', { name: /load more/i }));

    // Wait for second page and verify no properties were skipped
    await waitFor(() => {
      // Properties from first page should still be visible
      expect(screen.getByText('Property 0')).toBeInTheDocument();
      expect(screen.getByText('Property 49')).toBeInTheDocument();

      // Properties from second page should now be visible
      expect(screen.getByText('Property 50')).toBeInTheDocument();
      expect(screen.getByText('Property 99')).toBeInTheDocument();
    });

    // Verify the offset calculation was correct
    expect(mockedGet).toHaveBeenNthCalledWith(2, '/properties?limit=50&offset=50');
  });

  it('should show filtered empty state when search returns no results', async () => {
    const initialResponse = {
      data: {
        items: [createMockProperty('prop-1', 'Property 1')],
        total: 1,
        page: 1,
        hasMore: false,
      },
    };

    const emptySearchResponse = {
      data: {
        items: [],
        total: 0,
        page: 1,
        hasMore: false,
      },
    };

    mockedGet.mockImplementation((url) => {
      if (typeof url === 'string' && url.startsWith('/properties?') && /[?&]search=/.test(url)) {
        return Promise.resolve(emptySearchResponse);
      }
      return Promise.resolve(initialResponse);
    });

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <PropertiesPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Wait for property to load
    await waitFor(() => {
      expect(screen.getByText('Property 1')).toBeInTheDocument();
    });

    // Search for non-existent property
    const searchInput = screen.getByPlaceholderText(/search properties/i);
    await userEvent.type(searchInput, 'NonExistent Property');

    // Wait for filtered empty state
    await waitFor(() => {
      expect(screen.getByText('No properties match your filters')).toBeInTheDocument();
    });

    // Verify "Add First Property" button is NOT shown for filtered results
    expect(screen.queryByText('Add First Property')).not.toBeInTheDocument();
  });

  it('should hide Load More button when no more pages available', async () => {
    mockedGet.mockResolvedValueOnce({
      data: {
        items: [createMockProperty('prop-1', 'Property 1')],
        total: 1,
        page: 1,
        hasMore: false,
      },
    });

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <PropertiesPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Wait for property to load
    await waitFor(() => {
      expect(screen.getByText('Property 1')).toBeInTheDocument();
    });

    // Verify Load More button is not present
    expect(screen.queryByRole('button', { name: /load more/i })).not.toBeInTheDocument();
  });
});
