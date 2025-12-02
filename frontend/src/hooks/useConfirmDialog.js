import { useState, useCallback } from 'react';

/**
 * Custom hook for managing confirmation dialog state.
 * Provides a simple API for opening/closing dialogs and handling confirmations.
 * 
 * @returns {object} Dialog state and control functions
 * 
 * @example
 * const { dialogProps, openDialog, closeDialog } = useConfirmDialog();
 * 
 * // Open dialog
 * openDialog({
 *   title: 'Delete Item',
 *   message: 'Are you sure you want to delete this item?',
 *   variant: 'danger',
 *   onConfirm: async () => {
 *     await deleteItem();
 *     closeDialog();
 *   },
 * });
 * 
 * // In render
 * <ConfirmDialog {...dialogProps} />
 */
export function useConfirmDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [config, setConfig] = useState({
    title: 'Confirm Action',
    message: 'Are you sure you want to proceed?',
    confirmLabel: 'Confirm',
    cancelLabel: 'Cancel',
    variant: 'warning',
    onConfirm: null,
    data: null, // Optional data to pass to onConfirm
  });

  const openDialog = useCallback((options = {}) => {
    setConfig((prev) => ({
      ...prev,
      ...options,
    }));
    setError(null);
    setIsOpen(true);
  }, []);

  const closeDialog = useCallback(() => {
    if (isLoading) return;
    setIsOpen(false);
    setError(null);
    // Reset config after animation completes
    setTimeout(() => {
      setConfig({
        title: 'Confirm Action',
        message: 'Are you sure you want to proceed?',
        confirmLabel: 'Confirm',
        cancelLabel: 'Cancel',
        variant: 'warning',
        onConfirm: null,
        data: null,
      });
    }, 200);
  }, [isLoading]);

  const handleConfirm = useCallback(async () => {
    if (!config.onConfirm) {
      closeDialog();
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await config.onConfirm(config.data);
      closeDialog();
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [config, closeDialog]);

  return {
    // Props to spread on ConfirmDialog
    dialogProps: {
      open: isOpen,
      onClose: closeDialog,
      onConfirm: handleConfirm,
      title: config.title,
      message: config.message,
      confirmLabel: config.confirmLabel,
      cancelLabel: config.cancelLabel,
      variant: config.variant,
      isLoading,
      error,
      disableBackdropClick: isLoading,
    },
    // Control functions
    openDialog,
    closeDialog,
    isOpen,
    isLoading,
  };
}

export default useConfirmDialog;

