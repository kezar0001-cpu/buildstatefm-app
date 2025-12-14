import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import PropertyDetailPage from '../pages/PropertyDetailPage.jsx';
import { apiClient } from '../api/client';

const mockUseApiQuery = vi.fn();
const mockUseApiMutation = vi.fn();
const mockUseInfiniteQuery = vi.fn();
const mockNavigate = vi.fn();

vi.mock('../hooks/useApiQuery', () => ({
  default: (options) => mockUseApiQuery(options),
}));

vi.mock('../hooks/useApiMutation', () => ({
  default: (options) => mockUseApiMutation(options),
}));

vi.mock('../api/client', () => {
  const client = {
    get: vi.fn(),
  };

  return {
    __esModule: true,
    apiClient: client,
    default: client,
  };
});

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query');
  return {
    ...actual,
    useInfiniteQuery: (options) => mockUseInfiniteQuery(options),
    useQueryClient: () => ({
      invalidateQueries: vi.fn(),
      refetchQueries: vi.fn(),
    }),
  };
});

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('PropertyDetailPage unit rendering', () => {
  const createWrapper = () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    return ({ children }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();

    apiClient.get.mockImplementation((url) => {
      if (url === '/properties/property-1') {
        return Promise.resolve({
          data: {
            property: {
              id: 'property-1',
              name: 'Test Property',
              address: '123 Main St',
              city: 'Springfield',
              state: 'IL',
              zipCode: '12345',
              country: 'USA',
              status: 'ACTIVE',
              totalUnits: 1,
              propertyType: 'MULTI_FAMILY',
              description: 'A sample property',
              owners: [],
            },
          },
        });
      }

      return Promise.resolve({ data: {} });
    });

    mockUseApiMutation.mockReturnValue({
      mutateAsync: vi.fn(),
      isError: false,
      error: null,
      isPending: false,
    });

    mockUseApiQuery.mockImplementation(({ url }) => {
      if (url.includes('/activity')) {
        return {
          data: { activities: [] },
          isLoading: false,
          isError: false,
          error: null,
          refetch: vi.fn(),
        };
      }

      return {
        data: {
          property: {
            id: 'property-1',
            name: 'Test Property',
            address: '123 Main St',
            city: 'Springfield',
            state: 'IL',
            zipCode: '12345',
            country: 'USA',
            status: 'ACTIVE',
            totalUnits: 1,
            propertyType: 'MULTI_FAMILY',
            description: 'A sample property',
            owners: [],
          },
        },
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
      };
    });

    mockUseInfiniteQuery.mockReturnValue({
      data: {
        pages: [
          [
            {
              id: 'unit-1',
              unitNumber: '101',
              status: 'AVAILABLE',
              bedrooms: 1,
              bathrooms: 1,
              rentAmount: 1200,
              area: 550,
              tenants: [],
            },
          ],
        ],
      },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
      hasNextPage: false,
      fetchNextPage: vi.fn(),
      isFetchingNextPage: false,
    });
  });

  it('displays units when the API returns an array response', async () => {
    render(
      <MemoryRouter initialEntries={["/properties/property-1"]}>
        <Routes>
          <Route path="/properties/:id" element={<PropertyDetailPage />} />
        </Routes>
      </MemoryRouter>
      ,
      { wrapper: createWrapper() }
    );

    const unitsTab = await screen.findByRole('tab', { name: /Units \(1\)/i });
    fireEvent.click(unitsTab);

    expect(await screen.findByText(/Unit 101/i)).toBeInTheDocument();
  });

  it('calculates the next page offset correctly for paginated responses', () => {
    render(
      <MemoryRouter initialEntries={["/properties/property-1"]}>
        <Routes>
          <Route path="/properties/:id" element={<PropertyDetailPage />} />
        </Routes>
      </MemoryRouter>
      ,
      { wrapper: createWrapper() }
    );

    const queryOptions = mockUseInfiniteQuery.mock.calls[0][0];

    expect(queryOptions.getNextPageParam({ page: 1, hasMore: true })).toBe(50);
    expect(queryOptions.getNextPageParam({ page: 2, hasMore: true })).toBe(100);
  });

  it('invalidates the correct queries when deleting a unit', () => {
    render(
      <MemoryRouter initialEntries={["/properties/property-1"]}>
        <Routes>
          <Route path="/properties/:id" element={<PropertyDetailPage />} />
        </Routes>
      </MemoryRouter>
      ,
      { wrapper: createWrapper() }
    );

    const mutationOptions = mockUseApiMutation.mock.calls[0][0];

    expect(mutationOptions).toMatchObject({
      method: 'delete',
      invalidateKeys: [
        ['properties', 'property-1', 'units'],
        ['properties', 'property-1'],
        ['units', 'listByProperty', 'property-1'],
        ['units', 'list', 'property-1'],
      ],
    });
  });
});
