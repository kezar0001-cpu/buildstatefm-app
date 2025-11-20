import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import PropertyNotesSection from '../PropertyNotesSection.jsx';
import * as usePropertyNotesModule from '../../hooks/usePropertyNotes.js';
import * as authModule from '../../lib/auth.js';
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

vi.mock('../../lib/auth.js', () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('../../hooks/useNotification.js', () => ({
  default: () => ({
    showNotification: vi.fn(),
  }),
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

const createMockNote = (overrides = {}) => ({
  id: 'note-1',
  content: 'This is a test note',
  authorId: 'user-1',
  createdAt: '2024-01-15T10:00:00Z',
  updatedAt: '2024-01-15T10:00:00Z',
  author: {
    id: 'user-1',
    name: 'John Doe',
    role: 'PROPERTY_MANAGER',
  },
  ...overrides,
});

const mockUser = {
  id: 'user-1',
  email: 'john@example.com',
  role: 'PROPERTY_MANAGER',
};

describe('PropertyNotesSection', () => {
  let mockRefetch;
  let mockAddNote;
  let mockUpdateNote;
  let mockDeleteNote;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock the auth module
    authModule.getCurrentUser.mockReturnValue(mockUser);

    // Create mock functions
    mockRefetch = vi.fn();
    mockAddNote = vi.fn().mockResolvedValue({ data: { note: createMockNote() } });
    mockUpdateNote = vi.fn().mockResolvedValue({ data: { note: createMockNote() } });
    mockDeleteNote = vi.fn().mockResolvedValue({ data: { success: true } });

    // Mock the hooks module
    vi.spyOn(usePropertyNotesModule, 'usePropertyNotes').mockReturnValue({
      data: { data: [createMockNote()] },
      isLoading: false,
      isError: false,
      error: null,
      refetch: mockRefetch,
      isFetching: false,
    });

    vi.spyOn(usePropertyNotesModule, 'useAddPropertyNote').mockImplementation(
      (propertyId, onSuccess) => ({
        mutateAsync: async (variables) => {
          const result = await mockAddNote(variables);
          if (onSuccess) await onSuccess(result);
          return result;
        },
        isPending: false,
      })
    );

    vi.spyOn(usePropertyNotesModule, 'useUpdatePropertyNote').mockImplementation(
      (propertyId, onSuccess) => ({
        mutateAsync: async (variables) => {
          const result = await mockUpdateNote(variables);
          if (onSuccess) await onSuccess(result);
          return result;
        },
        isPending: false,
      })
    );

    vi.spyOn(usePropertyNotesModule, 'useDeletePropertyNote').mockImplementation(
      (propertyId, onSuccess) => ({
        mutateAsync: async (variables) => {
          const result = await mockDeleteNote(variables);
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

  it('renders property notes correctly', () => {
    render(<PropertyNotesSection propertyId="prop-1" canEdit={true} />, {
      wrapper: createWrapper(),
    });

    expect(screen.getByText('This is a test note')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
  });

  it('calls refetch after successfully adding a note', async () => {
    render(<PropertyNotesSection propertyId="prop-1" canEdit={true} />, {
      wrapper: createWrapper(),
    });

    // Find and fill the note input
    const noteInput = screen.getByPlaceholderText(
      /add a note about this property/i
    );
    fireEvent.change(noteInput, {
      target: { value: 'New test note' },
    });

    // Click the add button
    const addButton = screen.getByRole('button', { name: /add note/i });
    fireEvent.click(addButton);

    // Wait for the mutation to complete
    await waitFor(() => {
      expect(mockAddNote).toHaveBeenCalledWith({
        data: { content: 'New test note' },
      });
    });

    // Verify refetch was called after the successful mutation
    await waitFor(() => {
      expect(mockRefetch).toHaveBeenCalled();
    });
  });

  it('calls refetch after successfully updating a note', async () => {
    render(<PropertyNotesSection propertyId="prop-1" canEdit={true} />, {
      wrapper: createWrapper(),
    });

    // Find and click the edit button
    const editButton = screen.getByRole('button', { name: /edit note/i });
    fireEvent.click(editButton);

    // Update the note content
    const editInput = screen.getByDisplayValue('This is a test note');
    fireEvent.change(editInput, {
      target: { value: 'Updated test note' },
    });

    // Click the save button
    const saveButton = screen.getByRole('button', { name: /save/i });
    fireEvent.click(saveButton);

    // Wait for the mutation to complete
    await waitFor(() => {
      expect(mockUpdateNote).toHaveBeenCalled();
    });

    // Verify refetch was called after the successful mutation
    await waitFor(() => {
      expect(mockRefetch).toHaveBeenCalled();
    });
  });

  it('calls refetch after successfully deleting a note', async () => {
    render(<PropertyNotesSection propertyId="prop-1" canEdit={true} />, {
      wrapper: createWrapper(),
    });

    // Find and click the delete button
    const deleteButton = screen.getByRole('button', { name: /delete note/i });
    fireEvent.click(deleteButton);

    // Confirm deletion in the dialog
    const confirmButton = screen.getByRole('button', { name: /delete/i });
    fireEvent.click(confirmButton);

    // Wait for the mutation to complete
    await waitFor(() => {
      expect(mockDeleteNote).toHaveBeenCalled();
    });

    // Verify refetch was called after the successful mutation
    await waitFor(() => {
      expect(mockRefetch).toHaveBeenCalled();
    });
  });

  it('shows empty state when there are no notes', () => {
    vi.spyOn(usePropertyNotesModule, 'usePropertyNotes').mockReturnValue({
      data: { data: [] },
      isLoading: false,
      isError: false,
      error: null,
      refetch: mockRefetch,
      isFetching: false,
    });

    render(<PropertyNotesSection propertyId="prop-1" canEdit={true} />, {
      wrapper: createWrapper(),
    });

    expect(screen.getByText('No Notes Yet')).toBeInTheDocument();
  });

  it('shows loading state while fetching notes', () => {
    vi.spyOn(usePropertyNotesModule, 'usePropertyNotes').mockReturnValue({
      data: null,
      isLoading: true,
      isError: false,
      error: null,
      refetch: mockRefetch,
      isFetching: true,
    });

    render(<PropertyNotesSection propertyId="prop-1" canEdit={true} />, {
      wrapper: createWrapper(),
    });

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('shows error state when fetching notes fails', () => {
    vi.spyOn(usePropertyNotesModule, 'usePropertyNotes').mockReturnValue({
      data: null,
      isLoading: false,
      isError: true,
      error: { response: { data: { message: 'Failed to load notes' } } },
      refetch: mockRefetch,
      isFetching: false,
    });

    render(<PropertyNotesSection propertyId="prop-1" canEdit={true} />, {
      wrapper: createWrapper(),
    });

    expect(screen.getByText('Failed to load notes')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('does not show add note section when canEdit is false', () => {
    render(<PropertyNotesSection propertyId="prop-1" canEdit={false} />, {
      wrapper: createWrapper(),
    });

    expect(
      screen.queryByPlaceholderText(/add a note about this property/i)
    ).not.toBeInTheDocument();
  });

  it('does not show edit/delete buttons for notes from other users', () => {
    authModule.getCurrentUser.mockReturnValue({
      id: 'user-2',
      email: 'jane@example.com',
      role: 'PROPERTY_MANAGER',
    });

    render(<PropertyNotesSection propertyId="prop-1" canEdit={true} />, {
      wrapper: createWrapper(),
    });

    expect(screen.getByText('This is a test note')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /edit note/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /delete note/i })
    ).not.toBeInTheDocument();
  });
});
