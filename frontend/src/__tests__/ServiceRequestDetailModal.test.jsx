import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ServiceRequestDetailModal from '../components/ServiceRequestDetailModal.jsx';
import { apiClient } from '../api/client.js';
import toast from 'react-hot-toast';
import { queryKeys } from '../utils/queryKeys.js';

const toastMock = vi.hoisted(() => {
  const fn = vi.fn();
  fn.success = vi.fn();
  fn.error = vi.fn();
  return fn;
});

vi.mock('react-hot-toast', () => ({
  default: toastMock,
}));

vi.mock('../api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
  },
}));

vi.mock('../context/UserContext.jsx', () => ({
  useCurrentUser: () => ({
    user: { role: 'PROPERTY_MANAGER' },
  }),
}));

const createRequest = (overrides = {}) => ({
  id: 'sr-123',
  title: 'Leaky Faucet in Kitchen',
  description:
    'The kitchen faucet has been leaking for 3 days. Water is dripping constantly even when fully closed.',
  category: 'PLUMBING',
  priority: 'HIGH',
  status: 'SUBMITTED',
  photos: [
    'https://example.com/photo1.jpg',
    'https://example.com/photo2.jpg',
  ],
  reviewNotes: null,
  reviewedAt: null,
  createdAt: '2024-10-28T14:30:00Z',
  updatedAt: '2024-10-28T14:30:00Z',
  property: {
    id: 'prop-456',
    name: 'Sunset Apartments',
    address: '123 Main St',
    city: 'San Francisco',
    state: 'CA',
  },
  unit: {
    id: 'unit-789',
    unitNumber: '101',
  },
  requestedBy: {
    id: 'user-321',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@email.com',
  },
  jobs: [],
  ...overrides,
});

let queryClient;
let invalidateQueriesSpy;
let mockOnClose;

const createWrapper = () => {
  queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

  return ({ children }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('ServiceRequestDetailModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOnClose = vi.fn();
  });

  afterEach(() => {
    queryClient?.clear();
    queryClient = null;
    invalidateQueriesSpy = null;
  });

  const renderModal = async ({ request = createRequest(), open = true } = {}) => {
    apiClient.get.mockResolvedValue({ data: { request } });

    render(
      <ServiceRequestDetailModal requestId={request.id} open={open} onClose={mockOnClose} />, 
      { wrapper: createWrapper() }
    );

    if (open) {
      await waitFor(() => {
        expect(apiClient.get).toHaveBeenCalledWith(`/service-requests/${request.id}`);
      });
    }

    return request;
  };

  it('renders service request details with status stepper', async () => {
    await renderModal();

    await waitFor(() => {
      expect(screen.getByText(/Leaky Faucet in Kitchen/i)).toBeInTheDocument();
    });

    expect(screen.getAllByText(/SUBMITTED/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/PLUMBING/i)).toBeInTheDocument();
    expect(screen.getByText(/HIGH/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Converted to Job/i).length).toBeGreaterThan(0);
  });

  it('shows review history when available', async () => {
    const request = createRequest({
      status: 'APPROVED',
      reviewNotes: 'Approved - urgent repair needed',
      reviewedAt: '2024-10-28T15:15:00Z',
    });

    await renderModal({ request });

    await waitFor(() => {
      expect(screen.getByText(/Review History/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/Approved - urgent repair needed/i)).toBeInTheDocument();
  });

  it('shows converted jobs when present', async () => {
    const request = createRequest({
      status: 'CONVERTED_TO_JOB',
      jobs: [
        {
          id: 'job-999',
          title: 'Fix Kitchen Faucet Leak',
          status: 'IN_PROGRESS',
          priority: 'HIGH',
          createdAt: '2024-10-28T15:20:00Z',
        },
      ],
    });

    await renderModal({ request });

    await waitFor(() => {
      expect(screen.getAllByText(/CONVERTED TO JOB/i).length).toBeGreaterThan(0);
    });

    expect(screen.getByText(/Fix Kitchen Faucet Leak/i)).toBeInTheDocument();
    expect(screen.getByText(/IN PROGRESS/i)).toBeInTheDocument();
  });

  it('displays rejection alert when status is REJECTED', async () => {
    const request = createRequest({
      status: 'REJECTED',
      reviewNotes: 'Duplicate request',
    });

    await renderModal({ request });

    await waitFor(() => {
      expect(screen.getByText(/Service Request Details/i)).toBeInTheDocument();
    });

    expect(
      screen.getByText(/This request was rejected\./i)
    ).toBeInTheDocument();
  });

  it('requires review notes before approving', async () => {
    await renderModal();

    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Add Cost Estimate/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Add Cost Estimate/i }));

    expect(await screen.findByText(/Add Cost Estimate/i)).toBeInTheDocument();

    const submitEstimateButton = await screen.findByRole('button', { name: /Submit Estimate/i });
    await user.click(submitEstimateButton);

    expect(apiClient.post).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('Please enter a valid cost estimate');
  });

  it('adds a cost estimate and invalidates related caches', async () => {
    await renderModal();

    const user = userEvent.setup();

    apiClient.post.mockResolvedValue({ data: { success: true } });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Add Cost Estimate/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Add Cost Estimate/i }));

    expect(await screen.findByText(/Add Cost Estimate/i)).toBeInTheDocument();

    const estimateInput = await screen.findByLabelText(/Estimated Cost/i);
    expect(estimateInput).toBeInTheDocument();
    await user.type(estimateInput, '250');

    const submitEstimateButton = screen.getByRole('button', { name: /Submit Estimate/i });
    await user.click(submitEstimateButton);

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith('/service-requests/sr-123/estimate', {
        managerEstimatedCost: 250,
        costBreakdownNotes: '',
      });
      expect(invalidateQueriesSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: queryKeys.serviceRequests.all() })
      );
      expect(invalidateQueriesSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: queryKeys.serviceRequests.detail('sr-123') })
      );
      expect(toast.success).toHaveBeenCalledWith('Cost estimate added - awaiting owner approval');
    });
  });

  it('rejects a request and invalidates related caches', async () => {
    await renderModal();

    const user = userEvent.setup();

    apiClient.post.mockResolvedValue({ data: { success: true } });

    await user.click(await screen.findByRole('button', { name: /Reject/i }));

    expect(await screen.findByText(/Reject Service Request/i)).toBeInTheDocument();

    const reasonInput = await screen.findByLabelText(/Rejection Reason/i);
    expect(reasonInput).toBeInTheDocument();
    await user.type(reasonInput, 'Not within scope');

    const confirmButton = screen.getByRole('button', { name: /^Reject$/i });
    await user.click(confirmButton);

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith('/service-requests/sr-123/manager-reject', {
        rejectionReason: 'Not within scope',
        reviewNotes: undefined,
      });
      expect(invalidateQueriesSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: queryKeys.serviceRequests.all() })
      );
      expect(invalidateQueriesSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: queryKeys.serviceRequests.detail('sr-123') })
      );
      expect(toast.success).toHaveBeenCalledWith('Service request rejected');
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  it('converts a request to a job and refreshes caches', async () => {
    const user = userEvent.setup();
    const request = createRequest({ status: 'APPROVED_BY_OWNER' });
    await renderModal({ request });

    // The conversion dialog fetches technicians when opened
    apiClient.get.mockImplementation((url) => {
      if (url === '/users?role=TECHNICIAN') {
        return Promise.resolve({ data: { users: [] } });
      }
      return Promise.resolve({ data: { request } });
    });

    apiClient.post.mockResolvedValue({ data: { success: true } });

    const convertButton = await screen.findByRole('button', { name: 'Convert to Job' });
    await user.click(convertButton);

    // Confirm conversion inside the dialog
    expect(await screen.findByText(/Convert Service Request to Job/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Convert to Job/i }));

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith(
        '/service-requests/sr-123/convert-to-job',
        expect.any(Object)
      );
      expect(invalidateQueriesSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: queryKeys.serviceRequests.all() })
      );
      expect(invalidateQueriesSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: queryKeys.serviceRequests.detail('sr-123') })
      );
      expect(invalidateQueriesSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: queryKeys.jobs.all() })
      );
      expect(toast.success).toHaveBeenCalledWith('Service request converted to job successfully');
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  it('shows loading state while fetching data', async () => {
    apiClient.get.mockImplementation(
      () => new Promise(() => {})
    );

    render(
      <ServiceRequestDetailModal requestId="sr-123" open onClose={mockOnClose} />, 
      { wrapper: createWrapper() }
    );

    expect(await screen.findByRole('progressbar')).toBeInTheDocument();
  });

  it('shows error state when fetch fails', async () => {
    apiClient.get.mockRejectedValue(new Error('Failed to fetch'));

    render(
      <ServiceRequestDetailModal requestId="sr-123" open onClose={mockOnClose} />, 
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(screen.getByText(/Error/i)).toBeInTheDocument();
    });
    expect(
      screen.getByText(/Unable to connect to the server\./i)
    ).toBeInTheDocument();
  });

  it('shows empty state when request is missing', async () => {
    apiClient.get.mockResolvedValue({ data: { request: null } });

    render(
      <ServiceRequestDetailModal requestId="sr-123" open onClose={mockOnClose} />, 
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(screen.getByText(/No data available/i)).toBeInTheDocument();
    });
  });

  it('does not fetch data when modal is closed', async () => {
    await renderModal({ open: false });
    expect(apiClient.get).not.toHaveBeenCalled();
  });

  it('closes the modal when Close button is clicked', async () => {
    await renderModal();

    const closeButton = await screen.findByRole('button', { name: 'Close' });
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalled();
  });
});
