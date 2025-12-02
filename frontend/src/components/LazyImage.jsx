import React, { useState, useRef, useEffect } from 'react';
import { Box, Skeleton } from '@mui/material';
import { Image as ImageIcon } from '@mui/icons-material';

/**
 * A lazy loading image component that displays a placeholder
 * skeleton while the image loads.
 * 
 * @param {string} src - The image source URL
 * @param {string} alt - Alt text for accessibility
 * @param {number|string} height - Height of the image container
 * @param {number|string} width - Width of the image container (default: '100%')
 * @param {string} objectFit - CSS object-fit property (default: 'cover')
 * @param {number} borderRadius - Border radius in pixels (default: 0)
 * @param {function} onLoad - Callback when image loads
 * @param {function} onError - Callback when image fails to load
 * @param {object} sx - Additional MUI sx props
 */
const LazyImage = ({
  src,
  alt,
  height = 200,
  width = '100%',
  objectFit = 'cover',
  borderRadius = 0,
  onLoad,
  onError,
  sx = {},
  ...props
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const imgRef = useRef(null);
  const containerRef = useRef(null);

  // Use Intersection Observer for lazy loading
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: '100px', // Start loading 100px before the image enters viewport
        threshold: 0.01,
      }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const handleLoad = () => {
    setIsLoaded(true);
    onLoad?.();
  };

  const handleError = () => {
    setHasError(true);
    setIsLoaded(true);
    onError?.();
  };

  return (
    <Box
      ref={containerRef}
      sx={{
        position: 'relative',
        width,
        height,
        borderRadius: `${borderRadius}px`,
        overflow: 'hidden',
        backgroundColor: 'grey.100',
        ...sx,
      }}
      {...props}
    >
      {/* Skeleton placeholder */}
      {!isLoaded && (
        <Skeleton
          variant="rectangular"
          animation="wave"
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            borderRadius: `${borderRadius}px`,
          }}
        />
      )}

      {/* Error state placeholder */}
      {hasError && (
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
          }}
        >
          <ImageIcon sx={{ fontSize: 48, color: 'grey.400' }} />
        </Box>
      )}

      {/* Actual image - only load when in view */}
      {isInView && !hasError && (
        <Box
          component="img"
          ref={imgRef}
          src={src}
          alt={alt}
          onLoad={handleLoad}
          onError={handleError}
          sx={{
            width: '100%',
            height: '100%',
            objectFit,
            opacity: isLoaded ? 1 : 0,
            transition: 'opacity 0.3s ease-in-out',
          }}
        />
      )}
    </Box>
  );
};

export default LazyImage;

