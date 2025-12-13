import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
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
      expect(screen.getByText('Leaky Faucet in Kitchen')).toBeInTheDocument();
    });

    expect(screen.getByText('SUBMITTED')).toBeInTheDocument();
    expect(screen.getByText('PLUMBING')).toBeInTheDocument();
    expect(screen.getByText('HIGH')).toBeInTheDocument();
    expect(screen.getByText('Submitted')).toBeInTheDocument();
    expect(screen.getByText('Converted to Job')).toBeInTheDocument();
  });

  it('shows review history when available', async () => {
    const request = createRequest({
      status: 'APPROVED',
      reviewNotes: 'Approved - urgent repair needed',
      reviewedAt: '2024-10-28T15:15:00Z',
    });

    await renderModal({ request });

    await waitFor(() => {
      expect(screen.getByText('Review History')).toBeInTheDocument();
    });

    expect(screen.getByText('Approved - urgent repair needed')).toBeInTheDocument();
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
      expect(screen.getByText('Converted Jobs')).toBeInTheDocument();
    });

    expect(screen.getByText('Fix Kitchen Faucet Leak')).toBeInTheDocument();
    expect(screen.getByText('IN_PROGRESS')).toBeInTheDocument();
  });

  it('displays rejection alert when status is REJECTED', async () => {
    const request = createRequest({
      status: 'REJECTED',
      reviewNotes: 'Duplicate request',
    });

    await renderModal({ request });

    await waitFor(() => {
      expect(screen.getByText('Service Request Details')).toBeInTheDocument();
    });

    expect(
      screen.getByText('This request was rejected. Review notes are available below.')
    ).toBeInTheDocument();
  });

  it('requires review notes before approving', async () => {
    await renderModal();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));

    const confirmButton = await screen.findByRole('button', { name: 'Approve' });
    fireEvent.click(confirmButton);

    expect(apiClient.patch).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('Please enter review notes');
  });

  it('approves a request and invalidates related caches', async () => {
    await renderModal();

    apiClient.patch.mockResolvedValue({ data: { success: true } });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));

    const notesInput = await screen.findByLabelText('Review Notes');
    fireEvent.change(notesInput, { target: { value: 'Approved - urgent' } });

    const confirmButton = screen.getByRole('button', { name: 'Approve' });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(apiClient.patch).toHaveBeenCalledWith('/service-requests/sr-123', {
        status: 'APPROVED',
        reviewNotes: 'Approved - urgent',
      });
      expect(invalidateQueriesSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: queryKeys.serviceRequests.all() })
      );
      expect(invalidateQueriesSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: queryKeys.serviceRequests.detail('sr-123') })
      );
      expect(toast.success).toHaveBeenCalledWith('Request approved');
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  it('rejects a request and invalidates related caches', async () => {
    await renderModal();

    apiClient.patch.mockResolvedValue({ data: { success: true } });

    fireEvent.click(await screen.findByRole('button', { name: 'Reject' }));

    const notesInput = await screen.findByLabelText('Review Notes');
    fireEvent.change(notesInput, { target: { value: 'Not within scope' } });

    const confirmButton = screen.getByRole('button', { name: 'Reject' });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(apiClient.patch).toHaveBeenCalledWith('/service-requests/sr-123', {
        status: 'REJECTED',
        reviewNotes: 'Not within scope',
      });
      expect(invalidateQueriesSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: queryKeys.serviceRequests.all() })
      );
      expect(invalidateQueriesSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: queryKeys.serviceRequests.detail('sr-123') })
      );
      expect(toast.success).toHaveBeenCalledWith('Request rejected');
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  it('converts a request to a job and refreshes caches', async () => {
    const request = createRequest({ status: 'APPROVED' });
    await renderModal({ request });

    apiClient.post.mockResolvedValue({ data: { success: true } });

    const convertButton = await screen.findByRole('button', { name: 'Convert to Job' });
    fireEvent.click(convertButton);

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith('/service-requests/sr-123/convert-to-job');
      expect(invalidateQueriesSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: queryKeys.serviceRequests.all() })
      );
      expect(invalidateQueriesSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: queryKeys.serviceRequests.detail('sr-123') })
      );
      expect(invalidateQueriesSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: queryKeys.jobs.all() })
      );
      expect(toast.success).toHaveBeenCalledWith('Converted to job successfully');
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
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });
    expect(screen.getByText('Failed to fetch')).toBeInTheDocument();
  });

  it('shows empty state when request is missing', async () => {
    apiClient.get.mockResolvedValue({ data: { request: null } });

    render(
      <ServiceRequestDetailModal requestId="sr-123" open onClose={mockOnClose} />, 
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(screen.getByText('No data available')).toBeInTheDocument();
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
