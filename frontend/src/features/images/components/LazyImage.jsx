import React, { useState, useEffect, useRef, memo } from 'react';
import { Box, Skeleton } from '@mui/material';

/**
 * LazyImage component with progressive loading
 *
 * Features:
 * - Uses IntersectionObserver to load images only when they enter viewport
 * - Progressive loading: thumbnail/placeholder first, then full resolution on hover/click
 * - Skeleton placeholder during loading
 * - Smooth fade-in transition
 * - Support for both thumbnail and full-resolution URLs
 *
 * @param {Object} props
 * @param {string} props.src - Full resolution image URL
 * @param {string} props.thumbnail - Thumbnail URL (optional, will use src if not provided)
 * @param {string} props.alt - Alt text for image
 * @param {Object} props.sx - MUI sx prop for styling
 * @param {string} props.aspectRatio - CSS aspect ratio (default: '4/3')
 * @param {boolean} props.eager - Skip lazy loading and load immediately
 * @param {Function} props.onLoad - Callback when image loads
 * @param {Function} props.onError - Callback when image fails to load
 */
export const LazyImage = memo(function LazyImage({
  src,
  thumbnail,
  alt = 'Image',
  sx = {},
  aspectRatio = '4/3',
  eager = false,
  onLoad,
  onError,
}) {
  const [loadState, setLoadState] = useState('idle'); // idle, loading, thumbnail, loaded, error
  const [currentSrc, setCurrentSrc] = useState(null);
  const [shouldLoadFull, setShouldLoadFull] = useState(false);
  const imgRef = useRef(null);
  const observerRef = useRef(null);

  // Determine if we have a separate thumbnail
  const hasThumbnail = thumbnail && thumbnail !== src;
  const thumbnailUrl = hasThumbnail ? thumbnail : null;

  /**
   * Setup IntersectionObserver to detect when image enters viewport
   */
  useEffect(() => {
    // Skip observer if eager loading or no src
    if (eager || !src) {
      if (src) {
        setLoadState('loading');
        setCurrentSrc(hasThumbnail ? thumbnailUrl : src);
      }
      return;
    }

    // Create observer
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && loadState === 'idle') {
            // Image entered viewport, start loading thumbnail
            setLoadState('loading');
            setCurrentSrc(hasThumbnail ? thumbnailUrl : src);
          }
        });
      },
      {
        rootMargin: '50px', // Start loading 50px before entering viewport
        threshold: 0.01,
      }
    );

    // Observe the element
    if (imgRef.current) {
      observerRef.current.observe(imgRef.current);
    }

    // Cleanup
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [eager, src, thumbnailUrl, hasThumbnail, loadState]);

  /**
   * Load full resolution image after thumbnail loads or on hover
   */
  useEffect(() => {
    // Only load full res if we have a thumbnail and it's loaded
    if (hasThumbnail && loadState === 'thumbnail' && shouldLoadFull) {
      const img = new Image();
      img.src = src;
      img.onload = () => {
        setCurrentSrc(src);
        setLoadState('loaded');
        if (onLoad) onLoad();
      };
      img.onerror = () => {
        setLoadState('error');
        if (onError) onError();
      };
    }
  }, [hasThumbnail, loadState, shouldLoadFull, src, onLoad, onError]);

  /**
   * Handle image load event
   */
  const handleImageLoad = () => {
    if (hasThumbnail && currentSrc === thumbnailUrl) {
      // Thumbnail loaded successfully
      setLoadState('thumbnail');
      if (onLoad) onLoad();
    } else {
      // Full resolution loaded
      setLoadState('loaded');
      if (onLoad) onLoad();
    }
  };

  /**
   * Handle image error event
   */
  const handleImageError = () => {
    setLoadState('error');
    if (onError) onError();
  };

  /**
   * Handle hover to trigger full resolution load
   */
  const handleMouseEnter = () => {
    if (hasThumbnail && loadState === 'thumbnail' && !shouldLoadFull) {
      setShouldLoadFull(true);
    }
  };

  /**
   * Handle click to trigger full resolution load
   */
  const handleClick = () => {
    if (hasThumbnail && loadState === 'thumbnail' && !shouldLoadFull) {
      setShouldLoadFull(true);
    }
  };

  return (
    <Box
      ref={imgRef}
      sx={{
        position: 'relative',
        aspectRatio: aspectRatio,
        overflow: 'hidden',
        backgroundColor: 'grey.100',
        ...sx,
      }}
      onMouseEnter={handleMouseEnter}
      onClick={handleClick}
    >
      {/* Skeleton placeholder during initial load */}
      {(loadState === 'idle' || loadState === 'loading') && (
        <Skeleton
          variant="rectangular"
          animation="wave"
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
          }}
        />
      )}

      {/* Actual image */}
      {currentSrc && loadState !== 'error' && (
        <Box
          component="img"
          src={currentSrc}
          alt={alt}
          onLoad={handleImageLoad}
          onError={handleImageError}
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: loadState === 'loading' ? 0 : 1,
            transition: 'opacity 0.3s ease-in-out',
            // Add blur effect for thumbnail
            filter: hasThumbnail && loadState === 'thumbnail' && !shouldLoadFull
              ? 'blur(2px)'
              : 'none',
          }}
        />
      )}

      {/* Error state */}
      {loadState === 'error' && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'grey.200',
            color: 'text.secondary',
          }}
        >
          Failed to load image
        </Box>
      )}

      {/* Loading indicator for thumbnail -> full transition */}
      {hasThumbnail && shouldLoadFull && loadState === 'thumbnail' && (
        <Box
          sx={{
            position: 'absolute',
            bottom: 8,
            right: 8,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            color: 'white',
            padding: '4px 8px',
            borderRadius: 1,
            fontSize: '0.7rem',
          }}
        >
          Loading full resolution...
        </Box>
      )}
    </Box>
  );
});
