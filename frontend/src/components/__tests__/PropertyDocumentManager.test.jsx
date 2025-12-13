import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import PropertyDocumentManager from '../PropertyDocumentManager.jsx';
import * as usePropertyDocumentsModule from '../../hooks/usePropertyDocuments.js';
import toast from 'react-hot-toast';

const toastMock = vi.hoisted(() => {
  const fn = vi.fn();
  fn.success = vi.fn();
  fn.error = vi.fn();
  return fn;
});

vi.mock('react-hot-toast', () => ({
  default: toastMock,
}));

vi.mock('../../hooks/useNotification.js', () => ({
  useNotification: () => ({
    showSuccess: vi.fn(),
    showError: vi.fn(),
  }),
}));

vi.mock('../../utils/fileUtils.js', () => ({
  downloadFile: vi.fn(),
  buildDocumentPreviewUrl: vi.fn((doc) => doc?.previewUrl || null),
  buildDocumentDownloadUrl: vi.fn((doc) => doc?.downloadUrl || null),
}));

vi.mock('../../utils/uploadPropertyDocuments.js', () => ({
  uploadPropertyDocument: vi.fn(async (file) => ({
    url: 'https://example.com/uploads/test.pdf',
    name: file?.name,
    size: file?.size,
    mimeType: file?.type,
  })),
}));

let queryClient;

const createWrapper = () => {
  queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

const createMockDocument = (overrides = {}) => ({
  id: 'doc-1',
  fileName: 'test-document.pdf',
  fileUrl: '/uploads/test-document.pdf',
  fileSize: 1024000,
  mimeType: 'application/pdf',
  category: 'LEASE',
  description: 'Test document description',
  accessLevel: 'PROPERTY_MANAGER',
  uploadedAt: '2024-01-15T10:00:00Z',
  uploader: {
    id: 'user-1',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
  },
  previewUrl: '/api/documents/doc-1/preview',
  downloadUrl: '/api/documents/doc-1/download',
  ...overrides,
});

describe('PropertyDocumentManager', () => {
  let mockRefetch;
  let mockAddDocument;
  let mockDeleteDocument;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock functions
    mockRefetch = vi.fn();
    mockAddDocument = vi.fn().mockResolvedValue({ data: { document: createMockDocument() } });
    mockDeleteDocument = vi.fn().mockResolvedValue({ data: { success: true } });

    // Mock the hooks module
    vi.spyOn(usePropertyDocumentsModule, 'usePropertyDocuments').mockReturnValue({
      data: { documents: [createMockDocument()] },
      isLoading: false,
      isError: false,
      error: null,
      refetch: mockRefetch,
    });

    vi.spyOn(usePropertyDocumentsModule, 'useAddPropertyDocument').mockImplementation(
      (propertyId, onSuccess) => ({
        mutateAsync: async (variables) => {
          const result = await mockAddDocument(variables);
          if (onSuccess) await onSuccess(result);
          return result;
        },
        isPending: false,
      })
    );

    vi.spyOn(usePropertyDocumentsModule, 'useDeletePropertyDocument').mockImplementation(
      (propertyId, onSuccess) => ({
        mutateAsync: async (variables) => {
          const result = await mockDeleteDocument(variables);
          if (onSuccess) await onSuccess(result);
          return result;
        },
        isPending: false,
      })
    );
  });

  afterEach(() => {
    queryClient?.clear();
    queryClient = null;
    vi.restoreAllMocks();
  });

  it('renders property documents correctly', () => {
    render(<PropertyDocumentManager propertyId="prop-1" canEdit={true} />, {
      wrapper: createWrapper(),
    });

    expect(screen.getByText('test-document.pdf')).toBeInTheDocument();
    expect(screen.getByText('Test document description')).toBeInTheDocument();
  });

  it('displays uploader name correctly', () => {
    render(<PropertyDocumentManager propertyId="prop-1" canEdit={true} />, {
      wrapper: createWrapper(),
    });

    expect(screen.getByText(/Uploaded by\s+John\b/i)).toBeInTheDocument();
  });

  it('displays "Unknown User" when uploader data is missing', () => {
    vi.spyOn(usePropertyDocumentsModule, 'usePropertyDocuments').mockReturnValue({
      data: {
        documents: [
          createMockDocument({
            uploader: null,
          }),
        ],
      },
      isLoading: false,
      isError: false,
      error: null,
      refetch: mockRefetch,
    });

    render(<PropertyDocumentManager propertyId="prop-1" canEdit={true} />, {
      wrapper: createWrapper(),
    });

    expect(screen.getByText(/Uploaded by\s+Unknown\b/i)).toBeInTheDocument();
  });

  it('displays "Unknown User" when uploader name fields are missing', () => {
    vi.spyOn(usePropertyDocumentsModule, 'usePropertyDocuments').mockReturnValue({
      data: {
        documents: [
          createMockDocument({
            uploader: {
              id: 'user-1',
              firstName: null,
              lastName: null,
            },
          }),
        ],
      },
      isLoading: false,
      isError: false,
      error: null,
      refetch: mockRefetch,
    });

    render(<PropertyDocumentManager propertyId="prop-1" canEdit={true} />, {
      wrapper: createWrapper(),
    });

    expect(screen.getByText(/Uploaded by\s+Unknown\b/i)).toBeInTheDocument();
  });

  it('calls refetch after successfully adding a document', async () => {
    render(<PropertyDocumentManager propertyId="prop-1" canEdit={true} />, {
      wrapper: createWrapper(),
    });

    // Open the upload dialog
    const addButton = screen.getByRole('button', { name: /add document/i });
    fireEvent.click(addButton);

    // Wait for dialog to open
    await waitFor(() => {
      expect(screen.getByText('Upload Document')).toBeInTheDocument();
    });

    // Create a mock file
    const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' });

    // Find the hidden file input inside the label button
    const fileInput = document.querySelector('input[type="file"]');
    expect(fileInput).toBeTruthy();

    // Simulate file selection
    fireEvent.change(fileInput, { target: { files: [file] } });

    // Wait for file to be processed
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /test\.pdf/i })).toBeInTheDocument();
    });

    // Click the upload button
    const uploadButton = screen.getByRole('button', { name: /upload/i });
    fireEvent.click(uploadButton);

    // Wait for the mutation to complete
    await waitFor(() => {
      expect(mockAddDocument).toHaveBeenCalled();
    });

    // Verify refetch was called after the successful mutation
    await waitFor(() => {
      expect(mockRefetch).toHaveBeenCalled();
    });
  });

  it('calls refetch after successfully deleting a document', async () => {
    render(<PropertyDocumentManager propertyId="prop-1" canEdit={true} />, {
      wrapper: createWrapper(),
    });

    // Find and click the delete button
    const deleteButtons = screen.getAllByRole('button').filter((btn) => {
      return btn.querySelector('[data-testid="DeleteIcon"]');
    });
    expect(deleteButtons.length).toBeGreaterThan(0);
    const deleteButton = deleteButtons[0];
    fireEvent.click(deleteButton);

    // Confirm deletion in the dialog
    await waitFor(() => {
      expect(screen.getByText(/Are you sure you want to delete/i)).toBeInTheDocument();
    });

    const confirmButton = screen.getByRole('button', { name: /delete/i });
    fireEvent.click(confirmButton);

    // Wait for the mutation to complete
    await waitFor(() => {
      expect(mockDeleteDocument).toHaveBeenCalled();
    });

    // Verify refetch was called after the successful mutation
    await waitFor(() => {
      expect(mockRefetch).toHaveBeenCalled();
    });
  });

  it('shows empty state when there are no documents', () => {
    vi.spyOn(usePropertyDocumentsModule, 'usePropertyDocuments').mockReturnValue({
      data: { documents: [] },
      isLoading: false,
      isError: false,
      error: null,
      refetch: mockRefetch,
    });

    render(<PropertyDocumentManager propertyId="prop-1" canEdit={true} />, {
      wrapper: createWrapper(),
    });

    expect(screen.getByText('No documents uploaded yet')).toBeInTheDocument();
  });

  it('shows loading state while fetching documents', () => {
    vi.spyOn(usePropertyDocumentsModule, 'usePropertyDocuments').mockReturnValue({
      data: null,
      isLoading: true,
      isError: false,
      error: null,
      refetch: mockRefetch,
    });

    render(<PropertyDocumentManager propertyId="prop-1" canEdit={true} />, {
      wrapper: createWrapper(),
    });

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('shows error state when fetching documents fails', () => {
    vi.spyOn(usePropertyDocumentsModule, 'usePropertyDocuments').mockReturnValue({
      data: null,
      isLoading: false,
      isError: true,
      error: { response: { data: { message: 'Failed to load documents' } } },
      refetch: mockRefetch,
    });

    render(<PropertyDocumentManager propertyId="prop-1" canEdit={true} />, {
      wrapper: createWrapper(),
    });

    expect(screen.getByText('Failed to load documents')).toBeInTheDocument();
  });

  it('does not show add document button when canEdit is false', () => {
    render(<PropertyDocumentManager propertyId="prop-1" canEdit={false} />, {
      wrapper: createWrapper(),
    });

    expect(
      screen.queryByRole('button', { name: /add document/i })
    ).not.toBeInTheDocument();
  });

  it('does not show delete button when canEdit is false', () => {
    render(<PropertyDocumentManager propertyId="prop-1" canEdit={false} />, {
      wrapper: createWrapper(),
    });

    expect(screen.queryByTitle('Delete')).not.toBeInTheDocument();
  });

  it('shows file size in human-readable format', () => {
    render(<PropertyDocumentManager propertyId="prop-1" canEdit={true} />, {
      wrapper: createWrapper(),
    });

    // 1024000 bytes = 1000 KB
    expect(screen.getByText(/1000 KB/i)).toBeInTheDocument();
  });

  it('validates file size before upload', async () => {
    render(<PropertyDocumentManager propertyId="prop-1" canEdit={true} />, {
      wrapper: createWrapper(),
    });

    // Open the upload dialog
    const addButton = screen.getByRole('button', { name: /add document/i });
    fireEvent.click(addButton);

    // Create a file that's too large (> 50MB)
    const largeFile = new File(['x'.repeat(51 * 1024 * 1024)], 'large.pdf', {
      type: 'application/pdf',
    });

    const fileInput = document.querySelector('input[type="file"]');
    expect(fileInput).toBeTruthy();
    fireEvent.change(fileInput, { target: { files: [largeFile] } });

    // Should show error message
    await waitFor(() => {
      expect(screen.getByText(/File too large/i)).toBeInTheDocument();
    });
  });

  it('validates file type before upload', async () => {
    render(<PropertyDocumentManager propertyId="prop-1" canEdit={true} />, {
      wrapper: createWrapper(),
    });

    // Open the upload dialog
    const addButton = screen.getByRole('button', { name: /add document/i });
    fireEvent.click(addButton);

    // Create an invalid file type
    const invalidFile = new File(['test'], 'test.exe', { type: 'application/x-msdownload' });

    const fileInput = document.querySelector('input[type="file"]');
    expect(fileInput).toBeTruthy();
    fireEvent.change(fileInput, { target: { files: [invalidFile] } });

    // Should show error message
    await waitFor(() => {
      expect(screen.getByText(/Invalid file type/i)).toBeInTheDocument();
    });
  });
});
