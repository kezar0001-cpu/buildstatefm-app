import { useEffect, useMemo, useState, useCallback } from 'react';
import { Box, IconButton, Typography, Dialog, DialogContent } from '@mui/material';
import {
  ArrowBackIos,
  ArrowForwardIos,
  Fullscreen as FullscreenIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { buildPropertyPlaceholder, resolvePropertyImageUrl } from '../utils/propertyImages.js';

const normalizeImages = (images) => {
  if (!Array.isArray(images)) return [];
  return images
    .filter((image) => {
      // Handle both string URLs and image objects with imageUrl property
      if (typeof image === 'string') return image.trim().length > 0;
      return image?.imageUrl && typeof image.imageUrl === 'string' && image.imageUrl.trim().length > 0;
    })
    .map((image) => {
      // Normalize to object format
      if (typeof image === 'string') {
        return { imageUrl: image, caption: null };
      }
      return image;
    });
};

const defaultDotsSx = {
  display: 'flex',
  gap: 0.5,
};

const defaultDotSx = (isActive) => ({
  width: 10,
  height: 10,
  borderRadius: '50%',
  backgroundColor: isActive ? 'primary.main' : 'grey.300',
  cursor: 'pointer',
  transition: 'background-color 0.3s, transform 0.2s',
  '&:hover': {
    backgroundColor: isActive ? 'primary.dark' : 'grey.400',
    transform: 'scale(1.1)',
  },
});

const defaultArrowSx = {
  position: 'absolute',
  top: '50%',
  transform: 'translateY(-50%)',
  backgroundColor: 'rgba(255,255,255,0.85)',
  '&:hover': { backgroundColor: 'rgba(255,255,255,0.95)' },
  zIndex: 2,
};

const defaultImageSx = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  display: 'block',
};

const PropertyImageCarousel = ({
  images,
  fallbackText,
  height = 200,
  placeholderSize = '600x320',
  autoplayInterval = 4000,
  showDots = true,
  showArrows = true,
  showThumbnails = false,
  showFullscreenButton = false,
  showCounter = false,
  showCaption = false,
  borderRadius = 2,
  imageSx,
  containerSx,
}) => {
  const items = useMemo(() => normalizeImages(images), [images]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const [autoplayEnabled, setAutoplayEnabled] = useState(true);
  // Bug Fix: Track image loading errors to show fallback
  const [imageErrors, setImageErrors] = useState(new Set());

  // Bug Fix: Reset currentIndex, autoplay, and error tracking when images change
  useEffect(() => {
    setCurrentIndex(0);
    setAutoplayEnabled(true);
    setImageErrors(new Set());
  }, [items]);

  // Memoize handleStep to prevent recreating the function on every render
  // This fixes memory leak issues with keyboard event listeners
  const handleStep = useCallback((direction) => {
    setCurrentIndex((prev) => {
      if (items.length === 0) return 0;
      return (prev + direction + items.length) % items.length;
    });
  }, [items.length]);

  useEffect(() => {
    if (!autoplayInterval || items.length <= 1 || !autoplayEnabled || fullscreenOpen) return undefined;

    const intervalId = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % items.length);
    }, autoplayInterval);

    return () => clearInterval(intervalId);
  }, [items.length, autoplayInterval, autoplayEnabled, fullscreenOpen]);

  const handleDotClick = (index) => {
    setCurrentIndex(index);
  };

  const handleThumbnailClick = (index) => {
    setCurrentIndex(index);
    setAutoplayEnabled(false); // Pause autoplay when user manually selects
  };

  const handleOpenFullscreen = () => {
    setFullscreenOpen(true);
    setAutoplayEnabled(false);
  };

  const handleCloseFullscreen = () => {
    setFullscreenOpen(false);
  };

  // Keyboard navigation for fullscreen mode
  // Fixed: Now properly includes handleStep in dependency array (safe because it's memoized)
  useEffect(() => {
    if (!fullscreenOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        handleCloseFullscreen();
      } else if (event.key === 'ArrowLeft') {
        handleStep(-1);
      } else if (event.key === 'ArrowRight') {
        handleStep(1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [fullscreenOpen, handleStep]);

  const currentItem = items[currentIndex] || { imageUrl: null, caption: null };
  // Bug Fix: Use placeholder if current image has failed to load
  const hasError = imageErrors.has(currentIndex);
  const currentImage =
    items.length > 0 && !hasError
      ? resolvePropertyImageUrl(currentItem.imageUrl, fallbackText, placeholderSize)
      : buildPropertyPlaceholder(fallbackText, placeholderSize);

  // Bug Fix: Handle image loading errors
  const handleImageError = useCallback((index) => {
    setImageErrors(prev => new Set(prev).add(index));
  }, []);

  return (
    <>
      <Box
        sx={{
          position: 'relative',
          height,
          borderRadius,
          overflow: 'hidden',
          ...containerSx,
        }}
      >
        <Box
          component="img"
          src={currentImage}
          alt={currentItem.caption || fallbackText || 'Property image'}
          sx={{ ...defaultImageSx, ...imageSx }}
          onError={() => handleImageError(currentIndex)}
        />

        {/* Image Counter */}
        {showCounter && items.length > 0 && (
          <Box
            sx={{
              position: 'absolute',
              top: 8,
              right: 8,
              backgroundColor: 'rgba(0,0,0,0.6)',
              color: 'white',
              px: 1.5,
              py: 0.5,
              borderRadius: 1,
              zIndex: 2,
            }}
          >
            <Typography variant="caption">
              {currentIndex + 1} / {items.length}
            </Typography>
          </Box>
        )}

        {/* Fullscreen Button */}
        {showFullscreenButton && items.length > 0 && (
          <IconButton
            size="small"
            onClick={(event) => {
              event.stopPropagation();
              handleOpenFullscreen();
            }}
            sx={{
              position: 'absolute',
              top: 8,
              left: 8,
              backgroundColor: 'rgba(255,255,255,0.85)',
              '&:hover': { backgroundColor: 'rgba(255,255,255,0.95)' },
              zIndex: 2,
            }}
            aria-label="Fullscreen"
          >
            <FullscreenIcon fontSize="small" />
          </IconButton>
        )}

        {/* Caption */}
        {showCaption && currentItem.caption && (
          <Box
            sx={{
              position: 'absolute',
              bottom: showThumbnails ? 80 : showDots ? 40 : 8,
              left: 8,
              right: 8,
              backgroundColor: 'rgba(0,0,0,0.6)',
              color: 'white',
              px: 2,
              py: 1,
              borderRadius: 1,
              zIndex: 2,
            }}
          >
            <Typography variant="body2">{currentItem.caption}</Typography>
          </Box>
        )}

        {/* Navigation Arrows */}
        {showArrows && items.length > 1 && (
          <>
            <IconButton
              size="small"
              onClick={(event) => {
                event.stopPropagation();
                handleStep(-1);
              }}
              sx={{ ...defaultArrowSx, left: 8 }}
              aria-label="Previous image"
            >
              <ArrowBackIos fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              onClick={(event) => {
                event.stopPropagation();
                handleStep(1);
              }}
              sx={{ ...defaultArrowSx, right: 8 }}
              aria-label="Next image"
            >
              <ArrowForwardIos fontSize="small" />
            </IconButton>
          </>
        )}

        {/* Dots Navigation */}
        {showDots && items.length > 1 && !showThumbnails && (
          <Box
            sx={{
              position: 'absolute',
              bottom: 8,
              left: '50%',
              transform: 'translateX(-50%)',
              ...defaultDotsSx,
            }}
          >
            {items.map((_, index) => (
              <Box
                key={index}
                onClick={(event) => {
                  event.stopPropagation();
                  handleDotClick(index);
                }}
                sx={defaultDotSx(index === currentIndex)}
              />
            ))}
          </Box>
        )}

        {/* Thumbnail Strip */}
        {showThumbnails && items.length > 1 && (
          <Box
            sx={{
              position: 'absolute',
              bottom: 8,
              left: 8,
              right: 8,
              display: 'flex',
              gap: 1,
              overflowX: 'auto',
              backgroundColor: 'rgba(0,0,0,0.5)',
              p: 1,
              borderRadius: 1,
              '&::-webkit-scrollbar': {
                height: 4,
              },
              '&::-webkit-scrollbar-thumb': {
                backgroundColor: 'rgba(255,255,255,0.5)',
                borderRadius: 2,
              },
            }}
          >
            {items.map((item, index) => (
              <Box
                key={index}
                component="img"
                src={imageErrors.has(index) ? buildPropertyPlaceholder(fallbackText, '100x100') : resolvePropertyImageUrl(item.imageUrl, fallbackText, '100x100')}
                alt={item.caption || `Thumbnail ${index + 1}`}
                onClick={(event) => {
                  event.stopPropagation();
                  handleThumbnailClick(index);
                }}
                onError={() => handleImageError(index)}
                sx={{
                  width: 60,
                  height: 60,
                  objectFit: 'cover',
                  borderRadius: 1,
                  cursor: 'pointer',
                  border: index === currentIndex ? 2 : 1,
                  borderColor: index === currentIndex ? 'primary.main' : 'transparent',
                  opacity: index === currentIndex ? 1 : 0.6,
                  transition: 'all 0.2s',
                  '&:hover': {
                    opacity: 1,
                    transform: 'scale(1.05)',
                  },
                  flexShrink: 0,
                }}
              />
            ))}
          </Box>
        )}
      </Box>

      {/* Fullscreen Dialog */}
      <Dialog
        open={fullscreenOpen}
        onClose={handleCloseFullscreen}
        maxWidth={false}
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: 'rgba(0,0,0,0.95)',
            height: '100vh',
            m: 0,
            maxHeight: '100vh',
          },
        }}
      >
        <IconButton
          onClick={handleCloseFullscreen}
          sx={{
            position: 'absolute',
            top: 16,
            right: 16,
            color: 'white',
            backgroundColor: 'rgba(255,255,255,0.1)',
            '&:hover': { backgroundColor: 'rgba(255,255,255,0.2)' },
            zIndex: 10,
          }}
        >
          <CloseIcon />
        </IconButton>
        <DialogContent sx={{ p: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Box sx={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center' }}>
            <Box
              component="img"
              src={currentImage}
              alt={currentItem.caption || fallbackText || 'Property image'}
              sx={{
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: 'contain',
                margin: 'auto',
              }}
              onError={() => handleImageError(currentIndex)}
            />

            {/* Fullscreen Navigation */}
            {items.length > 1 && (
              <>
                <IconButton
                  onClick={() => handleStep(-1)}
                  sx={{
                    position: 'absolute',
                    left: 16,
                    color: 'white',
                    backgroundColor: 'rgba(255,255,255,0.1)',
                    '&:hover': { backgroundColor: 'rgba(255,255,255,0.2)' },
                  }}
                >
                  <ArrowBackIos />
                </IconButton>
                <IconButton
                  onClick={() => handleStep(1)}
                  sx={{
                    position: 'absolute',
                    right: 16,
                    color: 'white',
                    backgroundColor: 'rgba(255,255,255,0.1)',
                    '&:hover': { backgroundColor: 'rgba(255,255,255,0.2)' },
                  }}
                >
                  <ArrowForwardIos />
                </IconButton>
              </>
            )}

            {/* Fullscreen Counter */}
            <Box
              sx={{
                position: 'absolute',
                top: 16,
                left: 16,
                color: 'white',
                backgroundColor: 'rgba(0,0,0,0.5)',
                px: 2,
                py: 1,
                borderRadius: 1,
              }}
            >
              <Typography variant="body1">
                {currentIndex + 1} / {items.length}
              </Typography>
            </Box>

            {/* Fullscreen Caption */}
            {currentItem.caption && (
              <Box
                sx={{
                  position: 'absolute',
                  bottom: 16,
                  left: 16,
                  right: 16,
                  color: 'white',
                  backgroundColor: 'rgba(0,0,0,0.5)',
                  px: 3,
                  py: 2,
                  borderRadius: 1,
                  textAlign: 'center',
                }}
              >
                <Typography variant="body1">{currentItem.caption}</Typography>
              </Box>
            )}
          </Box>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PropertyImageCarousel;
