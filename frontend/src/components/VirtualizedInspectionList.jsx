import React, { useEffect, useRef, useCallback } from 'react';
import { Virtuoso } from 'react-virtuoso';
import { Box, CircularProgress } from '@mui/material';

/**
 * VirtualizedInspectionList Component
 *
 * Efficiently renders large lists of inspections using react-virtuoso
 * Features:
 * - Virtual scrolling for 500+ items
 * - Scroll position restoration
 * - Infinite scrolling support
 * - Automatic loading of more items
 *
 * @param {Array} inspections - Array of inspection items to render
 * @param {Function} renderItem - Function to render each inspection item
 * @param {Function} onLoadMore - Callback to load more items
 * @param {boolean} hasMore - Whether there are more items to load
 * @param {boolean} isLoadingMore - Whether more items are currently being loaded
 * @param {string} scrollKey - Unique key for scroll position restoration
 */
export default function VirtualizedInspectionList({
  inspections,
  renderItem,
  onLoadMore,
  hasMore = false,
  isLoadingMore = false,
  scrollKey = 'inspection-list-scroll',
}) {
  const virtuosoRef = useRef(null);
  const scrollPositionKey = `${scrollKey}-position`;
  const isRestoringScroll = useRef(false);

  // Restore scroll position on mount
  useEffect(() => {
    if (virtuosoRef.current && !isRestoringScroll.current && inspections.length > 0) {
      const savedPosition = sessionStorage.getItem(scrollPositionKey);
      if (savedPosition) {
        const position = parseInt(savedPosition, 10);
        isRestoringScroll.current = true;
        // Small delay to ensure DOM is ready
        setTimeout(() => {
          virtuosoRef.current?.scrollToIndex({
            index: Math.min(position, inspections.length - 1),
            align: 'start',
            behavior: 'auto',
          });
          isRestoringScroll.current = false;
        }, 100);
      }
    }
  }, [scrollPositionKey, inspections.length]);

  // Save scroll position
  const handleRangeChanged = useCallback((range) => {
    if (!isRestoringScroll.current && range.startIndex !== undefined) {
      sessionStorage.setItem(scrollPositionKey, range.startIndex.toString());
    }
  }, [scrollPositionKey]);

  // Row renderer
  const itemContent = useCallback((_index, inspection) => {
    return (
      <Box sx={{ px: 0, py: 1 }}>
        {renderItem(inspection)}
      </Box>
    );
  }, [renderItem]);

  // Footer for loading more
  const Footer = useCallback(() => {
    if (!isLoadingMore) return null;

    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          py: 2,
        }}
      >
        <CircularProgress size={32} />
      </Box>
    );
  }, [isLoadingMore]);

  // End reached callback
  const endReached = useCallback(() => {
    if (hasMore && !isLoadingMore && onLoadMore) {
      onLoadMore();
    }
  }, [hasMore, isLoadingMore, onLoadMore]);

  return (
    <Box sx={{ width: '100%', height: '100%' }}>
      <Virtuoso
        ref={virtuosoRef}
        data={inspections}
        totalCount={inspections.length}
        itemContent={itemContent}
        endReached={endReached}
        overscan={200}
        rangeChanged={handleRangeChanged}
        components={{ Footer }}
        style={{ height: '800px' }}
      />
    </Box>
  );
}
