import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  IconButton,
  Chip,
  Stack,
  Grid,
  Card,
  CardMedia,
  CardContent,
  TextField,
  InputAdornment,
  ToggleButtonGroup,
  ToggleButton,
  Tooltip,
  Paper,
} from '@mui/material';
import {
  Close as CloseIcon,
  Download as DownloadIcon,
  Search as SearchIcon,
  FilterList as FilterListIcon,
  Room as RoomIcon,
  BugReport as IssueIcon,
  AttachFile as AttachmentIcon,
  ViewModule as GridViewIcon,
  ViewList as ListViewIcon,
  Fullscreen as FullscreenIcon,
} from '@mui/icons-material';
import Lightbox from 'yet-another-react-lightbox';
import Zoom from 'yet-another-react-lightbox/plugins/zoom';
import 'yet-another-react-lightbox/styles.css';

/**
 * Unified Photo Gallery Modal for Inspections
 * Displays all photos across rooms, issues, and attachments
 *
 * @param {Boolean} open - Whether the modal is open
 * @param {Function} onClose - Handler for closing the modal
 * @param {Object} inspection - The inspection object
 * @param {Array} roomPhotos - Photos from inspection rooms
 * @param {Array} issuePhotos - Photos from inspection issues
 * @param {Array} attachments - General inspection attachments
 */
export const InspectionPhotoGalleryModal = ({
  open,
  onClose,
  inspection,
  roomPhotos = [],
  issuePhotos = [],
  attachments = [],
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [viewMode, setViewMode] = useState('grid');
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // Combine all photos with metadata and deduplicate so the same
  // underlying photo (by id/url) is not shown twice when linked
  // to both a room and an issue
  const allPhotos = useMemo(() => {
    const photos = [];

    // Add room photos first
    roomPhotos.forEach((photo) => {
      photos.push({
        ...photo,
        category: 'room',
        categoryLabel: 'Room',
        categoryColor: 'primary',
        categoryIcon: <RoomIcon />,
        title: photo.roomName || photo.caption || 'Room Photo',
        description: photo.caption || photo.roomName,
      });
    });

    // Add issue photos (these should win when the same photo exists
    // as both a room and issue photo)
    issuePhotos.forEach((photo) => {
      photos.push({
        ...photo,
        category: 'issue',
        categoryLabel: 'Issue',
        categoryColor: 'error',
        categoryIcon: <IssueIcon />,
        title: photo.issueTitle || photo.caption || 'Issue Photo',
        description: photo.caption || photo.issueDescription,
      });
    });

    // Add general attachments
    attachments.forEach((photo) => {
      photos.push({
        ...photo,
        category: 'attachment',
        categoryLabel: 'Attachment',
        categoryColor: 'default',
        categoryIcon: <AttachmentIcon />,
        title: photo.caption || photo.filename || 'Attachment',
        description: photo.caption,
      });
    });

    // Deduplicate by id or URL, preferring the last occurrence
    // (so issue-specific metadata overrides room-only metadata)
    const deduped = [];
    const seen = new Set();

    for (let i = photos.length - 1; i >= 0; i -= 1) {
      const photo = photos[i];
      const key = photo.id || photo.url || photo.imageUrl;

      if (key && !seen.has(key)) {
        seen.add(key);
        deduped.unshift(photo);
      } else if (!key) {
        // If we somehow lack a stable key, keep the photo once
        // based on object identity/index
        deduped.unshift(photo);
      }
    }

    return deduped;
  }, [roomPhotos, issuePhotos, attachments]);

  // Filter photos
  const filteredPhotos = useMemo(() => {
    let filtered = allPhotos;

    // Filter by category
    if (categoryFilter !== 'ALL') {
      filtered = filtered.filter((photo) => photo.category === categoryFilter.toLowerCase());
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (photo) =>
          photo.title?.toLowerCase().includes(query) ||
          photo.description?.toLowerCase().includes(query) ||
          photo.caption?.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [allPhotos, categoryFilter, searchQuery]);

  // Get category counts based on the deduplicated list
  const categoryCounts = useMemo(() => {
    const counts = {
      ALL: allPhotos.length,
      ROOM: 0,
      ISSUE: 0,
      ATTACHMENT: 0,
    };

    allPhotos.forEach((photo) => {
      if (photo.category === 'room') counts.ROOM += 1;
      else if (photo.category === 'issue') counts.ISSUE += 1;
      else if (photo.category === 'attachment') counts.ATTACHMENT += 1;
    });

    return counts;
  }, [allPhotos]);

  // Prepare lightbox slides
  const lightboxSlides = useMemo(() => {
    return filteredPhotos.map((photo) => ({
      src: photo.url || photo.imageUrl,
      alt: photo.title,
      description: photo.description,
    }));
  }, [filteredPhotos]);

  // Handle photo click
  const handlePhotoClick = (index) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  // Handle bulk download
  const handleBulkDownload = async () => {
    for (const photo of filteredPhotos) {
      const url = photo.url || photo.imageUrl;
      if (!url) continue;

      try {
        const response = await fetch(url);
        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = photo.filename || photo.title || `photo-${photo.id}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(downloadUrl);
      } catch (error) {
        console.error('Failed to download photo:', error);
      }
    }
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box>
              <Typography variant="h6">Photo Gallery</Typography>
              <Typography variant="caption" color="text.secondary">
                {inspection?.title || 'Inspection Photos'}
              </Typography>
            </Box>
            <IconButton onClick={onClose} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent dividers>
          <Stack spacing={2}>
            {/* Filters and Actions */}
            <Paper sx={{ p: 2 }}>
              <Grid container spacing={2} alignItems="center">
                {/* Search */}
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="Search photos..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon fontSize="small" />
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>

                {/* Category Filter */}
                <Grid item xs={12} md={5}>
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    {['ALL', 'ROOM', 'ISSUE', 'ATTACHMENT'].map((category) => (
                      <Chip
                        key={category}
                        label={`${category} (${categoryCounts[category]})`}
                        onClick={() => setCategoryFilter(category)}
                        color={categoryFilter === category ? 'primary' : 'default'}
                        variant={categoryFilter === category ? 'filled' : 'outlined'}
                        size="small"
                      />
                    ))}
                  </Stack>
                </Grid>

                {/* View Mode and Actions */}
                <Grid item xs={12} md={3}>
                  <Stack direction="row" spacing={1} justifyContent="flex-end">
                    <ToggleButtonGroup
                      value={viewMode}
                      exclusive
                      onChange={(e, newMode) => newMode && setViewMode(newMode)}
                      size="small"
                    >
                      <ToggleButton value="grid">
                        <Tooltip title="Grid View">
                          <GridViewIcon fontSize="small" />
                        </Tooltip>
                      </ToggleButton>
                      <ToggleButton value="list">
                        <Tooltip title="List View">
                          <ListViewIcon fontSize="small" />
                        </Tooltip>
                      </ToggleButton>
                    </ToggleButtonGroup>

                    <Tooltip title="Download All Filtered Photos">
                      <IconButton
                        size="small"
                        onClick={handleBulkDownload}
                        disabled={filteredPhotos.length === 0}
                      >
                        <DownloadIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </Grid>
              </Grid>
            </Paper>

            {/* Photo Grid/List */}
            {filteredPhotos.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 8 }}>
                <Typography variant="body1" color="text.secondary">
                  No photos found
                </Typography>
              </Box>
            ) : viewMode === 'grid' ? (
              <Grid container spacing={2}>
                {filteredPhotos.map((photo, index) => (
                  <Grid item xs={12} sm={6} md={4} lg={3} key={photo.id || index}>
                    <Card
                      sx={{
                        cursor: 'pointer',
                        transition: 'transform 0.2s, box-shadow 0.2s',
                        '&:hover': {
                          transform: 'translateY(-4px)',
                          boxShadow: 4,
                        },
                      }}
                      onClick={() => handlePhotoClick(index)}
                    >
                      <CardMedia
                        component="img"
                        height="200"
                        image={photo.url || photo.imageUrl}
                        alt={photo.title}
                        sx={{ objectFit: 'cover' }}
                      />
                      <CardContent sx={{ p: 1.5 }}>
                        <Stack spacing={0.5}>
                          <Chip
                            icon={photo.categoryIcon}
                            label={photo.categoryLabel}
                            size="small"
                            color={photo.categoryColor}
                            sx={{ width: 'fit-content' }}
                          />
                          <Typography variant="body2" fontWeight={600} noWrap>
                            {photo.title}
                          </Typography>
                          {photo.description && (
                            <Typography variant="caption" color="text.secondary" noWrap>
                              {photo.description}
                            </Typography>
                          )}
                        </Stack>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            ) : (
              <Stack spacing={1}>
                {filteredPhotos.map((photo, index) => (
                  <Paper
                    key={photo.id || index}
                    sx={{
                      p: 2,
                      cursor: 'pointer',
                      '&:hover': { bgcolor: 'action.hover' },
                    }}
                    onClick={() => handlePhotoClick(index)}
                  >
                    <Grid container spacing={2} alignItems="center">
                      <Grid item xs={3} sm={2}>
                        <CardMedia
                          component="img"
                          height="80"
                          image={photo.url || photo.imageUrl}
                          alt={photo.title}
                          sx={{ borderRadius: 1, objectFit: 'cover' }}
                        />
                      </Grid>
                      <Grid item xs={9} sm={10}>
                        <Stack spacing={0.5}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Chip
                              icon={photo.categoryIcon}
                              label={photo.categoryLabel}
                              size="small"
                              color={photo.categoryColor}
                            />
                            <Typography variant="body1" fontWeight={600}>
                              {photo.title}
                            </Typography>
                          </Box>
                          {photo.description && (
                            <Typography variant="body2" color="text.secondary">
                              {photo.description}
                            </Typography>
                          )}
                        </Stack>
                      </Grid>
                    </Grid>
                  </Paper>
                ))}
              </Stack>
            )}
          </Stack>
        </DialogContent>

        <DialogActions>
          <Typography variant="body2" color="text.secondary" sx={{ mr: 'auto' }}>
            Showing {filteredPhotos.length} of {allPhotos.length} photos
          </Typography>
          <Button onClick={onClose}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Lightbox */}
      <Lightbox
        open={lightboxOpen}
        close={() => setLightboxOpen(false)}
        slides={lightboxSlides}
        index={lightboxIndex}
        plugins={[Zoom]}
      />
    </>
  );
};
