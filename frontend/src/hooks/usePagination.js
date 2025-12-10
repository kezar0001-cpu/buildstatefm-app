import { useState, useCallback } from 'react';

/**
 * Custom hook for managing pagination state
 * 
 * @param {Object} options
 * @param {number} options.initialPage - Initial page number (default: 1)
 * @param {number} options.initialPageSize - Initial page size (default: 10)
 * @param {number} options.totalItems - Total number of items
 * @returns {Object} Pagination state and handlers
 */
export function usePagination({
  initialPage = 1,
  initialPageSize = 10,
  totalItems = 0,
} = {}) {
  const [page, setPage] = useState(initialPage);
  const [pageSize, setPageSize] = useState(initialPageSize);

  // Calculate total pages
  const totalPages = Math.ceil(totalItems / pageSize);

  // Go to specific page
  const goToPage = useCallback((newPage) => {
    const validPage = Math.max(1, Math.min(newPage, totalPages || 1));
    setPage(validPage);
  }, [totalPages]);

  // Go to next page
  const nextPage = useCallback(() => {
    if (page < totalPages) {
      setPage((prev) => prev + 1);
    }
  }, [page, totalPages]);

  // Go to previous page
  const prevPage = useCallback(() => {
    if (page > 1) {
      setPage((prev) => prev - 1);
    }
  }, [page]);

  // Go to first page
  const firstPage = useCallback(() => {
    setPage(1);
  }, []);

  // Go to last page
  const lastPage = useCallback(() => {
    setPage(totalPages || 1);
  }, [totalPages]);

  // Change page size
  const changePageSize = useCallback((newPageSize) => {
    setPageSize(newPageSize);
    setPage(1); // Reset to first page when changing page size
  }, []);

  // Reset pagination
  const reset = useCallback(() => {
    setPage(initialPage);
    setPageSize(initialPageSize);
  }, [initialPage, initialPageSize]);

  // Calculate start and end indices for current page
  const startIndex = (page - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);

  // Check if there are more pages
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;

  return {
    // State
    page,
    pageSize,
    totalPages,
    totalItems,
    startIndex,
    endIndex,
    hasNextPage,
    hasPrevPage,

    // Actions
    goToPage,
    nextPage,
    prevPage,
    firstPage,
    lastPage,
    changePageSize,
    reset,
  };
}

/**
 * Common page size options
 */
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

/**
 * Get display text for pagination info
 * 
 * @param {number} startIndex - Start index (0-based)
 * @param {number} endIndex - End index
 * @param {number} totalItems - Total items
 * @returns {string} Display text
 */
export function getPaginationText(startIndex, endIndex, totalItems) {
  if (totalItems === 0) {
    return 'No items';
  }
  return `${startIndex + 1}-${endIndex} of ${totalItems}`;
}
