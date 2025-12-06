import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Button,
  Chip,
  Stack,
  Card,
  CardContent,
  IconButton,
  Tabs,
  Tab,
  Alert,
  Divider,
  List,
  ListItem,
  ListItemText,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableContainer,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import {
  ArrowBack as ArrowBackIcon,
  Edit as EditIcon,
  LocationOn as LocationIcon,
  Home as HomeIcon,
  CalendarToday as CalendarIcon,
  SquareFoot as AreaIcon,
  MoreVert as MoreVertIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  PersonAdd as PersonAddIcon,
  ArrowBackIos,
  ArrowForwardIos,
  Close as CloseIcon,
  KeyboardArrowDown as KeyboardArrowDownIcon,
  Email as EmailIcon,
} from '@mui/icons-material';
import { ListItemIcon } from '@mui/material';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '../api/client';
import useApiMutation from '../hooks/useApiMutation';
import DataState from '../components/DataState';
import { formatDateTime } from '../utils/date';
import Breadcrumbs from '../components/Breadcrumbs';
import PropertyForm from '../components/PropertyForm';
import UnitForm from '../components/UnitForm';
import PropertyDocumentManager from '../components/PropertyDocumentManager';
import PropertyNotesSection from '../components/PropertyNotesSection';
import InviteOwnerDialog from '../components/InviteOwnerDialog.jsx';
import AssignOwnerDialog from '../components/AssignOwnerDialog.jsx';
import BulkInspectionSchedulingDialog from '../components/BulkInspectionSchedulingDialog.jsx';
import PropertyImageCarousel from '../components/PropertyImageCarousel';
import { normaliseArray } from '../utils/error';
import {
  formatPropertyAddressLine,
  formatPropertyLocality,
} from '../utils/formatPropertyLocation';
import { CircularProgress } from '@mui/material';
import { queryKeys } from '../utils/queryKeys.js';
import ensureArray from '../utils/ensureArray';
import { getCurrentUser } from '../lib/auth';
import { resolvePropertyImageUrl } from '../utils/propertyImages.js';
import logger from '../utils/logger';
import InspectionForm from '../components/InspectionForm';

const UNITS_PAGE_SIZE = 50;

const PARKING_TYPE_LABELS = {
  NONE: 'No dedicated parking',
  STREET: 'Street Parking',
  DRIVEWAY: 'Driveway',
  GARAGE: 'Garage',
  COVERED: 'Covered Parking',
  UNCOVERED: 'Uncovered Parking',
};

const AMENITY_LABELS = {
  utilities: [
    { key: 'water', label: 'Water' },
    { key: 'gas', label: 'Gas' },
    { key: 'electricity', label: 'Electricity' },
    { key: 'internet', label: 'Internet' },
    { key: 'trash', label: 'Trash' },
    { key: 'sewer', label: 'Sewer' },
    { key: 'cable', label: 'Cable' },
  ],
  features: [
    { key: 'pool', label: 'Pool' },
    { key: 'gym', label: 'Fitness Center' },
    { key: 'laundry', label: 'Laundry' },
    { key: 'elevator', label: 'Elevator' },
    { key: 'doorman', label: 'Doorman' },
    { key: 'storage', label: 'Storage' },
    { key: 'balcony', label: 'Balcony' },
    { key: 'patio', label: 'Patio' },
    { key: 'yard', label: 'Yard' },
    { key: 'fireplace', label: 'Fireplace' },
    { key: 'airConditioning', label: 'Air Conditioning' },
    { key: 'heating', label: 'Heating' },
    { key: 'dishwasher', label: 'Dishwasher' },
    { key: 'microwave', label: 'Microwave' },
    { key: 'refrigerator', label: 'Refrigerator' },
    { key: 'washerDryer', label: 'Washer & Dryer' },
  ],
  security: [
    { key: 'gated', label: 'Gated Access' },
    { key: 'cameras', label: 'Security Cameras' },
    { key: 'alarm', label: 'Alarm System' },
    { key: 'accessControl', label: 'Access Control' },
    { key: 'securityGuard', label: 'Security Guard' },
    { key: 'intercom', label: 'Intercom' },
  ],
  accessibility: [
    { key: 'wheelchairAccessible', label: 'Wheelchair Accessible' },
    { key: 'accessibleElevator', label: 'Accessible Elevator' },
    { key: 'ramps', label: 'Ramps' },
    { key: 'wideHallways', label: 'Wide Hallways' },
    { key: 'accessibleBathroom', label: 'Accessible Bathroom' },
    { key: 'accessibleParking', label: 'Accessible Parking' },
  ],
};

export default function PropertyDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = getCurrentUser();
  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down('md'));

  const [currentTab, setCurrentTab] = useState(0);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [unitDialogOpen, setUnitDialogOpen] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [unitMenuAnchor, setUnitMenuAnchor] = useState(null);
  const [deleteUnitDialogOpen, setDeleteUnitDialogOpen] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const unitDialogOpenRef = useRef(unitDialogOpen);
  const deleteUnitDialogOpenRef = useRef(deleteUnitDialogOpen);
  const [ownerInviteDialogOpen, setOwnerInviteDialogOpen] = useState(false);
  const [assignOwnerDialogOpen, setAssignOwnerDialogOpen] = useState(false);
  const [ownerMenuAnchor, setOwnerMenuAnchor] = useState(null);
  const [bulkScheduleDialogOpen, setBulkScheduleDialogOpen] = useState(false);
  const [inspectionFormDialogOpen, setInspectionFormDialogOpen] = useState(false);

  useEffect(() => {
    unitDialogOpenRef.current = unitDialogOpen;
  }, [unitDialogOpen]);

  useEffect(() => {
    deleteUnitDialogOpenRef.current = deleteUnitDialogOpen;
  }, [deleteUnitDialogOpen]);

  // Fetch property details - Migrated to React Query
  const propertyQuery = useQuery({
    queryKey: queryKeys.properties.detail(id),
    queryFn: async () => {
      const response = await apiClient.get(`/properties/${id}`);
      return response.data;
    },
    enabled: !!id,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  // Fetch units for this property with infinite query
  const unitsQuery = useInfiniteQuery({
    queryKey: queryKeys.properties.units(id),
    queryFn: async ({ pageParam = 0 }) => {
      const response = await apiClient.get(`/units?propertyId=${id}&limit=${UNITS_PAGE_SIZE}&offset=${pageParam}`);
      const data = response.data;

      if (Array.isArray(data)) {
        return {
          items: data,
          hasMore: false,
          nextOffset: undefined,
        };
      }

      if (Array.isArray(data?.items)) {
        return {
          ...data,
          items: data.items,
        };
      }

      if (Array.isArray(data?.data)) {
        return {
          ...data,
          items: data.data,
        };
      }

      return data;
    },
    getNextPageParam: (lastPage) => {
      if (!lastPage) {
        return undefined;
      }

      if (Array.isArray(lastPage)) {
        return undefined;
      }

      if (typeof lastPage.nextOffset === 'number') {
        return lastPage.nextOffset;
      }

      if (lastPage.hasMore) {
        if (typeof lastPage.offset === 'number') {
          return lastPage.offset + UNITS_PAGE_SIZE;
        }

        if (typeof lastPage.page === 'number') {
          return lastPage.page * UNITS_PAGE_SIZE;
        }

        return UNITS_PAGE_SIZE;
      }

      return undefined;
    },
    initialPageParam: 0,
  });

  // Fetch activity for this property
  // Fix: Removed enabled condition to ensure activity loads on bookmarks and refreshes properly
  const activityQuery = useApiQuery({
    queryKey: queryKeys.properties.activity(id),
    url: `/properties/${id}/activity?limit=20`,
  });

  // Delete unit mutation
  const deleteUnitMutation = useApiMutation({
    method: 'delete',
    invalidateKeys: [
      queryKeys.properties.units(id),
      queryKeys.properties.detail(id),
      queryKeys.units.listByProperty(id),
      queryKeys.units.list(id),
    ],
  });

  const property = propertyQuery.data?.property ?? null;
  const canInviteOwners = user?.role === 'PROPERTY_MANAGER';
  const propertyStatus = property?.status ?? 'UNKNOWN';
  const propertyImages = Array.isArray(property?.images) ? property.images : [];

  // Bug Fix: Ensure carouselImages is always an array of objects, never strings
  // This prevents rendering issues in the carousel component
  const carouselImages = propertyImages.length
    ? propertyImages
    : property?.imageUrl
      ? [{
          id: 'primary',
          imageUrl: property.imageUrl,
          caption: null,
          isPrimary: true,
        }]
      : [];

  // Debug logging for image display
  if (property) {
    logger.debug('[PropertyDetail] Image display:', {
      propertyId: property.id,
      propertyImages: propertyImages.length,
      carouselImages: carouselImages.length,
      hasImageUrl: !!property.imageUrl,
      sampleUrls: carouselImages.slice(0, 3).map(img =>
        typeof img === 'string' ? img : img.imageUrl || 'no-url'
      ),
    });
  }

  const hasMultipleCarouselImages = carouselImages.length > 1;
  const propertyManager = property?.manager ?? null;
  const propertyManagerName = propertyManager
    ? [propertyManager.firstName, propertyManager.lastName].filter(Boolean).join(' ')
    : null;

  const amenities = property?.amenities ?? {};

  // Lightbox handlers
  const handleOpenLightbox = (index) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  const handleCloseLightbox = () => {
    setLightboxOpen(false);
  };

  // Bug Fix: Add safety checks to prevent edge cases when images array changes
  // Bug Fix: Memoize functions to prevent stale closures in keyboard event listeners
  const handleLightboxPrev = useCallback(() => {
    setLightboxIndex((prev) => {
      if (carouselImages.length === 0) return 0;
      return (prev - 1 + carouselImages.length) % carouselImages.length;
    });
  }, [carouselImages.length]);

  const handleLightboxNext = useCallback(() => {
    setLightboxIndex((prev) => {
      if (carouselImages.length === 0) return 0;
      return (prev + 1) % carouselImages.length;
    });
  }, [carouselImages.length]);

  // Keyboard navigation for lightbox
  // Bug Fix: Include memoized navigation functions in dependency array
  useEffect(() => {
    if (!lightboxOpen) return undefined;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        handleCloseLightbox();
      } else if (e.key === 'ArrowLeft') {
        handleLightboxPrev();
      } else if (e.key === 'ArrowRight') {
        handleLightboxNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxOpen, handleLightboxPrev, handleLightboxNext]);

  // Bug Fix: Close lightbox if current index becomes invalid when images change
  useEffect(() => {
    if (lightboxOpen && carouselImages.length > 0 && lightboxIndex >= carouselImages.length) {
      setLightboxIndex(Math.max(0, carouselImages.length - 1));
    } else if (lightboxOpen && carouselImages.length === 0) {
      handleCloseLightbox();
    }
  }, [lightboxOpen, lightboxIndex, carouselImages.length]);

  const parseNumericValue = (value) => {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : null;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const formatNumberValue = (value, options) => {
    const numeric = parseNumericValue(value);
    if (numeric === null) {
      return 'N/A';
    }
    return numeric.toLocaleString(undefined, options);
  };

  const formatCurrencyValue = (value) => {
    const numeric = parseNumericValue(value);
    if (numeric === null) {
      return 'N/A';
    }

    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(numeric);
  };

  const formatDateOnly = (value) => {
    if (!value) {
      return 'N/A';
    }

    try {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) {
        return 'N/A';
      }

      return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);
    } catch (error) {
      logger.error('Error formatting date:', error);
      return 'N/A';
    }
  };

  const formatStatusLabel = (status) => {
    if (!status) {
      return 'Unknown';
    }

    return status
      .toString()
      .toLowerCase()
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const getAmenityLabels = (sectionKey) => {
    const section = amenities?.[sectionKey] ?? {};
    return (AMENITY_LABELS[sectionKey] || [])
      .filter((item) => Boolean(section?.[item.key]))
      .map((item) => item.label);
  };

  const formatSquareFeet = (value) => {
    const formatted = formatNumberValue(value, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
    return formatted === 'N/A' ? 'N/A' : `${formatted} sq ft`;
  };

  // Bug Fix #1: Helper function to safely get and resolve image URL
  // Handles both string URLs and image objects, resolves relative paths
  const getImageUrl = useCallback((image, index = 0) => {
    if (!image) {
      logger.warn('[PropertyDetail] getImageUrl: No image provided at index', index);
      return '';
    }

    const rawUrl = typeof image === 'string' ? image : image.imageUrl;
    if (!rawUrl) {
      logger.warn('[PropertyDetail] getImageUrl: No URL found for image at index', index, image);
      return '';
    }

    const resolved = resolvePropertyImageUrl(rawUrl, property?.name);
    logger.debug(`[PropertyDetail] Resolved image ${index}:`, {
      raw: rawUrl.substring(0, 80),
      resolved: resolved.substring(0, 80),
    });
    return resolved;
  }, [property?.name]);

  // Bug Fix #2: Helper function to safely get image caption
  const getImageCaption = useCallback((image, index = 0) => {
    if (!image) return `Property image ${index + 1}`;
    if (typeof image === 'string') return `Property image ${index + 1}`;
    return image.caption || image.altText || `Property image ${index + 1}`;
  }, []);

  const utilitiesIncluded = getAmenityLabels('utilities');
  const featureHighlights = getAmenityLabels('features');
  const securityHighlights = getAmenityLabels('security');
  const accessibilityHighlights = getAmenityLabels('accessibility');

  const parkingDetails = amenities?.parking ?? {};
  const petDetails = amenities?.pets ?? {};
  const petDeposit = parseNumericValue(petDetails?.deposit);
  const petWeightLimit = parseNumericValue(petDetails?.weightLimit);
  const hasPetPolicy =
    typeof petDetails?.allowed === 'boolean' ||
    petDeposit !== null ||
    petWeightLimit !== null ||
    Boolean(petDetails?.restrictions) ||
    Boolean(petDetails?.catsAllowed) ||
    Boolean(petDetails?.dogsAllowed);

  const purchasePrice = parseNumericValue(property?.purchasePrice);
  const currentMarketValue = parseNumericValue(property?.currentMarketValue);
  const annualPropertyTax = parseNumericValue(property?.annualPropertyTax);
  const annualInsurance = parseNumericValue(property?.annualInsurance);
  const monthlyHOA = parseNumericValue(property?.monthlyHOA);

  const monthlyCarryingCost =
    annualPropertyTax !== null || annualInsurance !== null || monthlyHOA !== null
      ? (annualPropertyTax ?? 0) / 12 + (annualInsurance ?? 0) / 12 + (monthlyHOA ?? 0)
      : null;

  const annualCarryingCost =
    annualPropertyTax !== null || annualInsurance !== null || monthlyHOA !== null
      ? (annualPropertyTax ?? 0) + (annualInsurance ?? 0) + (monthlyHOA ?? 0) * 12
      : null;

  const equityGain =
    purchasePrice !== null && currentMarketValue !== null
      ? currentMarketValue - purchasePrice
      : null;

  const equityGainPercentage =
    equityGain !== null && purchasePrice && purchasePrice !== 0
      ? (equityGain / purchasePrice) * 100
      : null;

  const equityGainColor =
    equityGain === null
      ? 'text.primary'
      : equityGain > 0
      ? 'success.main'
      : equityGain < 0
      ? 'error.main'
      : 'text.primary';

  // Check if current user can edit this property
  // Property managers can edit properties and add notes
  // Note: For notes specifically, any property manager can add notes (not just the assigned manager)
  const canEdit = user?.role === 'PROPERTY_MANAGER' && property?.managerId === user?.id;
  const canAddNotes = user?.role === 'PROPERTY_MANAGER'; // Any property manager can add notes

  const activities = ensureArray(activityQuery.data, ['activities', 'data.activities', 'items']);

  // Flatten all pages into a single array
  const units = unitsQuery.data?.pages?.flatMap((page) => {
    if (Array.isArray(page)) {
      return page;
    }

    if (Array.isArray(page?.items)) {
      return page.items;
    }

    if (Array.isArray(page?.data?.items)) {
      return page.data.items;
    }

    if (Array.isArray(page?.data)) {
      return page.data;
    }

    return [];
  }) || [];

  // Fix: Reset all state when property ID changes to prevent race conditions
  useEffect(() => {
    setCurrentTab(0);
    setEditDialogOpen(false);
    setUnitDialogOpen(false);
    setSelectedUnit(null);
    setUnitMenuAnchor(null);
    setDeleteUnitDialogOpen(false);
  }, [id]);

  const handleBack = () => {
    navigate('/properties');
  };

  const handleEditProperty = () => {
    setEditDialogOpen(true);
  };

  const handleAddUnit = () => {
    setSelectedUnit(null);
    setUnitDialogOpen(true);
  };

  const handleUnitMenuOpen = (event, unit) => {
    event.stopPropagation();
    setUnitMenuAnchor(event.currentTarget);
    setSelectedUnit(unit);
  };

  const handleUnitMenuClose = () => {
    setUnitMenuAnchor(null);
    // Clear selected unit after a short delay only if no dialogs are open
    setTimeout(() => {
      if (!unitDialogOpenRef.current && !deleteUnitDialogOpenRef.current) {
        setSelectedUnit(null);
      }
    }, 100);
  };

  const handleEditUnit = () => {
    setUnitDialogOpen(true);
    handleUnitMenuClose();
  };

  const handleDeleteUnit = () => {
    setDeleteUnitDialogOpen(true);
    handleUnitMenuClose();
  };

  const confirmDeleteUnit = async () => {
    if (!selectedUnit) return;

    try {
      await deleteUnitMutation.mutateAsync({
        url: `/units/${selectedUnit.id}`,
      });
      // Only close dialog and clear state on success
      setDeleteUnitDialogOpen(false);
      setSelectedUnit(null);
      // Manually refetch to ensure data consistency
      unitsQuery.refetch();
      propertyQuery.refetch();
    } catch (error) {
      // Keep dialog open on error so user can retry
      // Error message shown via mutation state
      logger.error('Failed to delete unit:', error);
    }
  };

  // Memoize expensive functions to prevent unnecessary re-renders
  const getStatusColor = useCallback((status) => {
    const colors = {
      // Property statuses
      ACTIVE: 'success',
      INACTIVE: 'default',
      UNDER_MAINTENANCE: 'warning',
      UNDER_MAJOR_MAINTENANCE: 'error',
      // Unit statuses
      AVAILABLE: 'success',
      OCCUPIED: 'info',
      MAINTENANCE: 'warning',
      VACANT: 'default',
      // Job statuses
      OPEN: 'warning',
      ASSIGNED: 'info',
      IN_PROGRESS: 'warning',
      COMPLETED: 'success',
      CANCELLED: 'error',
      // Inspection statuses
      SCHEDULED: 'info',
      // Service request statuses
      SUBMITTED: 'warning',
      UNDER_REVIEW: 'info',
      APPROVED: 'success',
      REJECTED: 'error',
      CONVERTED_TO_JOB: 'success',
    };
    return colors[status] || 'default';
  }, []);

  const getPriorityColor = useCallback((priority) => {
    const colors = {
      LOW: 'default',
      MEDIUM: 'info',
      HIGH: 'warning',
      URGENT: 'error',
    };
    return colors[priority] || 'default';
  }, []);

  return (
    <Box sx={{ py: { xs: 2, md: 4 } }}>
      <DataState
        isLoading={propertyQuery.isLoading}
        isError={propertyQuery.isError}
        error={propertyQuery.error}
        onRetry={propertyQuery.refetch}
      >
        {property && (
          <Stack spacing={3}>
            <Breadcrumbs
              labelOverrides={{
                [`/properties/${id}`]: property?.name || 'Property Details',
              }}
            />
            {/* Header with Back Button */}
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={{ xs: 2, md: 3 }}
              alignItems={{ xs: 'flex-start', md: 'center' }}
              justifyContent="space-between"
            >
              <Stack direction="row" spacing={2} alignItems="center" sx={{ width: { xs: '100%', md: 'auto' } }}>
                <IconButton 
                  onClick={handleBack} 
                  size="large" 
                  sx={{ border: '1px solid', borderColor: 'divider' }}
                  aria-label="Go back to properties list"
                >
                  <ArrowBackIcon />
                </IconButton>
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 700 }}>
                    {property.name}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap', mt: 0.5 }}>
                    <LocationIcon fontSize="small" color="action" />
                    <Typography variant="body2" color="text.secondary">
                      {formatPropertyAddressLine(property)}
                    </Typography>
                  </Box>
                </Box>
              </Stack>
              <Stack direction="row" spacing={1} sx={{ width: { xs: '100%', md: 'auto' } }}>
                <Button
                  variant="contained"
                  startIcon={<CalendarIcon />}
                  onClick={() => setInspectionFormDialogOpen(true)}
                  fullWidth
                  sx={{ maxWidth: { xs: '100%', md: 'auto' } }}
                  aria-label="Schedule inspection for this property"
                >
                  Schedule Inspection
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<PersonAddIcon />}
                  onClick={() => navigate('/team')}
                  fullWidth
                  sx={{ maxWidth: { xs: '100%', md: 'auto' } }}
                  aria-label="Manage team members for this property"
                >
                  Manage Team
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<EditIcon />}
                  onClick={handleEditProperty}
                  fullWidth
                  sx={{ maxWidth: { xs: '100%', md: 'auto' } }}
                >
                  Edit Property
                </Button>
              </Stack>
            </Stack>

            {/* Property Image Gallery - Modern Split Layout */}
            {carouselImages.length > 0 ? (
              <Box>
                {/* Desktop: Split layout (large left + 2x2 grid right) */}
                {/* Mobile: Stacked layout */}
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: carouselImages.length === 1
                      ? '1fr'
                      : { xs: '1fr', md: '2fr 1fr' },
                    gap: 1,
                    borderRadius: 3,
                    overflow: 'hidden',
                  }}
                >
                  {/* Main Large Image */}
                  <Paper
                    sx={{
                      position: 'relative',
                      paddingTop: { xs: '56.25%', md: '66.67%' }, // 16:9 mobile, 3:2 desktop
                      overflow: 'hidden',
                      cursor: 'pointer',
                      borderRadius: { xs: 3, md: 0 },
                      transition: 'transform 0.3s ease',
                      '&:hover': {
                        transform: 'scale(1.01)',
                        '& img': {
                          filter: 'brightness(1.05)',
                        },
                      },
                    }}
                    onClick={() => handleOpenLightbox(0)}
                    elevation={0}
                  >
                    <Box
                      component="img"
                      src={getImageUrl(carouselImages[0], 0)}
                      alt={getImageCaption(carouselImages[0], 0)}
                      onError={(e) => {
                        // Bug Fix #3: Fallback for broken images
                        e.target.style.display = 'none';
                        logger.warn('Failed to load property image:', carouselImages[0]);
                      }}
                      sx={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        transition: 'filter 0.3s ease',
                      }}
                    />
                    <Chip
                      label="Primary"
                      size="small"
                      color="primary"
                      sx={{
                        position: 'absolute',
                        top: 12,
                        left: 12,
                        zIndex: 2,
                        fontSize: '0.7rem',
                        fontWeight: 600,
                      }}
                    />
                  </Paper>

                  {/* 2x2 Grid of Thumbnails (desktop only) */}
                  {carouselImages.length > 1 && (
                    <Box
                      sx={{
                        display: { xs: 'none', md: 'grid' },
                        gridTemplateColumns: '1fr 1fr',
                        gridTemplateRows: '1fr 1fr',
                        gap: 1,
                      }}
                    >
                      {/* Bug Fix #4: Simplified grid logic - show up to 3 thumbnails */}
                      {carouselImages.slice(1, Math.min(carouselImages.length, 5)).map((image, idx) => {
                        const actualIndex = idx + 1;

                        return (
                          <Paper
                            key={image?.id || actualIndex}
                            sx={{
                              position: 'relative',
                              overflow: 'hidden',
                              cursor: 'pointer',
                              borderRadius: 0,
                              transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                              '&:hover': {
                                transform: 'scale(1.05)',
                                boxShadow: 4,
                                zIndex: 1,
                                '& img': {
                                  filter: 'brightness(1.1)',
                                },
                              },
                            }}
                            onClick={() => handleOpenLightbox(actualIndex)}
                            elevation={0}
                          >
                            <Box
                              component="img"
                              src={getImageUrl(image, actualIndex)}
                              alt={getImageCaption(image, actualIndex)}
                              onError={(e) => {
                                e.target.style.display = 'none';
                              }}
                              sx={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                                transition: 'filter 0.2s ease',
                              }}
                            />
                          </Paper>
                        );
                      })}

                      {/* "+N more" tile - shown in 4th position if there are more than 5 images */}
                      {carouselImages.length > 5 && (
                        <Paper
                          sx={{
                            position: 'relative',
                            overflow: 'hidden',
                            cursor: 'pointer',
                            borderRadius: 0,
                            bgcolor: 'rgba(0,0,0,0.75)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'background-color 0.2s ease',
                            '&:hover': {
                              bgcolor: 'rgba(0,0,0,0.85)',
                            },
                            // Bug Fix #5: Use resolved URL for background image
                            ...(carouselImages[4] && {
                              backgroundImage: `url(${getImageUrl(carouselImages[4], 4)})`,
                              backgroundSize: 'cover',
                              backgroundPosition: 'center',
                              '&::before': {
                                content: '""',
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                backgroundColor: 'rgba(0,0,0,0.6)',
                                zIndex: 1,
                              },
                            }),
                          }}
                          onClick={() => handleOpenLightbox(4)}
                          elevation={0}
                        >
                          <Typography
                            variant="h5"
                            sx={{
                              color: 'white',
                              fontWeight: 700,
                              zIndex: 2,
                              position: 'relative',
                            }}
                          >
                            +{carouselImages.length - 5}
                          </Typography>
                        </Paper>
                      )}
                    </Box>
                  )}
                </Box>

                {/* Mobile: Horizontal scroll gallery for additional images */}
                {carouselImages.length > 1 && (
                  <Box
                    sx={{
                      display: { xs: 'flex', md: 'none' },
                      gap: 1,
                      overflowX: 'auto',
                      mt: 1,
                      pb: 1,
                      '&::-webkit-scrollbar': {
                        height: 6,
                      },
                      '&::-webkit-scrollbar-thumb': {
                        backgroundColor: 'rgba(0,0,0,0.2)',
                        borderRadius: 3,
                      },
                    }}
                  >
                    {carouselImages.slice(1).map((image, idx) => {
                      const actualIndex = idx + 1;

                      return (
                        <Paper
                          key={image?.id || actualIndex}
                          sx={{
                            position: 'relative',
                            minWidth: 100,
                            height: 80,
                            overflow: 'hidden',
                            cursor: 'pointer',
                            borderRadius: 2,
                            '&:hover': {
                              boxShadow: 3,
                            },
                          }}
                          onClick={() => handleOpenLightbox(actualIndex)}
                        >
                          <Box
                            component="img"
                            src={getImageUrl(image, actualIndex)}
                            alt={getImageCaption(image, actualIndex)}
                            onError={(e) => {
                              e.target.style.display = 'none';
                            }}
                            sx={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover',
                            }}
                          />
                        </Paper>
                      );
                    })}
                  </Box>
                )}
              </Box>
            ) : (
              <Paper
                sx={{
                  height: { xs: 220, sm: 320, md: 420 },
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: 'grey.100',
                  borderRadius: 3,
                  color: 'grey.400',
                }}
              >
                <HomeIcon sx={{ fontSize: { xs: 72, md: 120 } }} />
              </Paper>
            )}

            {/* Quick Stats */}
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={4}>
                <Card>
                  <CardContent>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Status
                    </Typography>
                    <Chip
                      label={propertyStatus.replace(/_/g, ' ')}
                      color={getStatusColor(propertyStatus)}
                      size="small"
                    />
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <Card>
                  <CardContent>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Property Type
                    </Typography>
                    <Typography variant="h6">
                      {property.propertyType || 'N/A'}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <Card>
                  <CardContent>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Year Built
                    </Typography>
                    <Typography variant="h6">
                      {property.yearBuilt || 'N/A'}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            {/* Tabs */}
            <Paper>
              <Tabs
                value={currentTab}
                onChange={(e, v) => setCurrentTab(v)}
                variant="scrollable"
                allowScrollButtons="auto"
                scrollButtons
                sx={{ '& .MuiTab-root': { textTransform: 'none' } }}
              >
                <Tab label="Overview" />
                <Tab label={`Units (${units.length})`} />
                <Tab label="Owners" />
                <Tab label="Documents" />
                <Tab label="Notes" />
                <Tab label="Activity" />
              </Tabs>
            </Paper>

            {/* Tab Content */}
            {currentTab === 0 && (
              <Paper sx={{ p: { xs: 2, md: 3 } }}>
                <Stack spacing={3}>
                  <Box>
                    <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                      Property Details
                    </Typography>
                    <Divider sx={{ mb: 2 }} />
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={6} lg={4}>
                        <Typography variant="body2" color="text.secondary">
                          Address
                        </Typography>
                        <Typography variant="body1">{property.address || 'N/A'}</Typography>
                      </Grid>
                      <Grid item xs={12} md={6} lg={4}>
                        <Typography variant="body2" color="text.secondary">
                          Locality
                        </Typography>
                        <Typography variant="body1">
                          {formatPropertyLocality(property) || 'N/A'}
                        </Typography>
                      </Grid>
                      <Grid item xs={12} md={6} lg={4}>
                        <Typography variant="body2" color="text.secondary">
                          Country
                        </Typography>
                        <Typography variant="body1">{property.country || 'N/A'}</Typography>
                      </Grid>
                      <Grid item xs={12} md={6} lg={4}>
                        <Typography variant="body2" color="text.secondary">
                          Status
                        </Typography>
                        <Chip
                          label={formatStatusLabel(propertyStatus)}
                          color={getStatusColor(propertyStatus)}
                          size="small"
                          sx={{ mt: 0.5 }}
                        />
                      </Grid>
                      <Grid item xs={12} md={6} lg={4}>
                        <Typography variant="body2" color="text.secondary">
                          Property Type
                        </Typography>
                        <Typography variant="body1">{property.propertyType || 'N/A'}</Typography>
                      </Grid>
                      <Grid item xs={12} md={6} lg={4}>
                        <Typography variant="body2" color="text.secondary">
                          Year Built
                        </Typography>
                        <Typography variant="body1">{formatNumberValue(property.yearBuilt)}</Typography>
                      </Grid>
                      <Grid item xs={12} md={6} lg={4}>
                        <Typography variant="body2" color="text.secondary">
                          Total Area
                        </Typography>
                        <Typography variant="body1">{formatSquareFeet(property.totalArea)}</Typography>
                      </Grid>
                      <Grid item xs={12} md={6} lg={4}>
                        <Typography variant="body2" color="text.secondary">
                          Lot Size
                        </Typography>
                        <Typography variant="body1">{formatSquareFeet(property.lotSize)}</Typography>
                      </Grid>
                      <Grid item xs={12} md={6} lg={4}>
                        <Typography variant="body2" color="text.secondary">
                          Building Size
                        </Typography>
                        <Typography variant="body1">{formatSquareFeet(property.buildingSize)}</Typography>
                      </Grid>
                      <Grid item xs={12} md={6} lg={4}>
                        <Typography variant="body2" color="text.secondary">
                          Number of Floors
                        </Typography>
                        <Typography variant="body1">{formatNumberValue(property.numberOfFloors)}</Typography>
                      </Grid>
                      <Grid item xs={12} md={6} lg={4}>
                        <Typography variant="body2" color="text.secondary">
                          Construction Type
                        </Typography>
                        <Typography variant="body1">{property.constructionType || 'N/A'}</Typography>
                      </Grid>
                      <Grid item xs={12} md={6} lg={4}>
                        <Typography variant="body2" color="text.secondary">
                          Heating System
                        </Typography>
                        <Typography variant="body1">{property.heatingSystem || 'N/A'}</Typography>
                      </Grid>
                      <Grid item xs={12} md={6} lg={4}>
                        <Typography variant="body2" color="text.secondary">
                          Cooling System
                        </Typography>
                        <Typography variant="body1">{property.coolingSystem || 'N/A'}</Typography>
                      </Grid>
                      <Grid item xs={12}>
                        <Typography variant="body2" color="text.secondary">
                          Description
                        </Typography>
                        <Typography variant="body1">
                          {property.description || 'No description provided'}
                        </Typography>
                      </Grid>
                    </Grid>
                  </Box>

                  <Box>
                    <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                      Property Manager
                    </Typography>
                    <Divider sx={{ mb: 2 }} />
                    {propertyManager ? (
                      <Grid container spacing={2}>
                        <Grid item xs={12} sm={6} md={4}>
                          <Typography variant="body2" color="text.secondary">
                            Name
                          </Typography>
                          <Typography variant="body1">{propertyManagerName}</Typography>
                        </Grid>
                        <Grid item xs={12} sm={6} md={4}>
                          <Typography variant="body2" color="text.secondary">
                            Email
                          </Typography>
                          <Typography variant="body1">{propertyManager.email}</Typography>
                        </Grid>
                        {propertyManager.phone && (
                          <Grid item xs={12} sm={6} md={4}>
                            <Typography variant="body2" color="text.secondary">
                              Phone
                            </Typography>
                            <Typography variant="body1">{propertyManager.phone}</Typography>
                          </Grid>
                        )}
                      </Grid>
                    ) : (
                      <Typography variant="body1">No manager assigned</Typography>
                    )}
                  </Box>

                  <Box>
                    <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                      Amenities & Features
                    </Typography>
                    <Divider sx={{ mb: 2 }} />
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={6}>
                        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                          Parking
                        </Typography>
                        {parkingDetails?.available ? (
                          <Stack spacing={1.5}>
                            <Box>
                              <Typography variant="body2" color="text.secondary">
                                Type
                              </Typography>
                              <Typography variant="body1">
                                {PARKING_TYPE_LABELS[parkingDetails.type] || 'Parking available'}
                              </Typography>
                            </Box>
                            <Box>
                              <Typography variant="body2" color="text.secondary">
                                Spaces
                              </Typography>
                              <Typography variant="body1">{formatNumberValue(parkingDetails.spaces)}</Typography>
                            </Box>
                            <Box>
                              <Typography variant="body2" color="text.secondary">
                                Covered
                              </Typography>
                              <Typography variant="body1">{parkingDetails.covered ? 'Yes' : 'No'}</Typography>
                            </Box>
                          </Stack>
                        ) : parkingDetails?.available === false ? (
                          <Typography variant="body2" color="text.secondary">
                            Parking is not available
                          </Typography>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            No parking details provided
                          </Typography>
                        )}
                      </Grid>

                      <Grid item xs={12} md={6}>
                        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                          Pet Policy
                        </Typography>
                        {petDetails?.allowed ? (
                          <Stack spacing={1.5}>
                            {petDeposit !== null && (
                              <Box>
                                <Typography variant="body2" color="text.secondary">
                                  Pet Deposit
                                </Typography>
                                <Typography variant="body1">{formatCurrencyValue(petDeposit)}</Typography>
                              </Box>
                            )}
                            {petWeightLimit !== null && (
                              <Box>
                                <Typography variant="body2" color="text.secondary">
                                  Weight Limit
                                </Typography>
                                <Typography variant="body1">{`${formatNumberValue(petWeightLimit)} lbs`}</Typography>
                              </Box>
                            )}
                            {petDetails?.restrictions && (
                              <Box>
                                <Typography variant="body2" color="text.secondary">
                                  Restrictions
                                </Typography>
                                <Typography variant="body1">{petDetails.restrictions}</Typography>
                              </Box>
                            )}
                            {(petDetails?.catsAllowed || petDetails?.dogsAllowed) && (
                              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                {petDetails?.catsAllowed && <Chip label="Cats allowed" size="small" variant="outlined" />}
                                {petDetails?.dogsAllowed && <Chip label="Dogs allowed" size="small" variant="outlined" />}
                              </Stack>
                            )}
                          </Stack>
                        ) : hasPetPolicy ? (
                          <Typography variant="body2" color="text.secondary">
                            Pets are not allowed
                          </Typography>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            No pet policy details
                          </Typography>
                        )}
                      </Grid>

                      <Grid item xs={12} md={6}>
                        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                          Utilities Included
                        </Typography>
                        {utilitiesIncluded.length ? (
                          <Stack direction="row" flexWrap="wrap" gap={1} useFlexGap>
                            {utilitiesIncluded.map((label) => (
                              <Chip key={`utility-${label}`} label={label} size="small" color="primary" variant="outlined" />
                            ))}
                          </Stack>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            No utilities included
                          </Typography>
                        )}
                      </Grid>

                      <Grid item xs={12} md={6}>
                        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                          Property Features
                        </Typography>
                        {featureHighlights.length ? (
                          <Stack direction="row" flexWrap="wrap" gap={1} useFlexGap>
                            {featureHighlights.map((label) => (
                              <Chip key={`feature-${label}`} label={label} size="small" color="success" variant="outlined" />
                            ))}
                          </Stack>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            No additional features listed
                          </Typography>
                        )}
                      </Grid>

                      <Grid item xs={12} md={6}>
                        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                          Security
                        </Typography>
                        {securityHighlights.length ? (
                          <Stack direction="row" flexWrap="wrap" gap={1} useFlexGap>
                            {securityHighlights.map((label) => (
                              <Chip key={`security-${label}`} label={label} size="small" color="warning" variant="outlined" />
                            ))}
                          </Stack>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            No security features recorded
                          </Typography>
                        )}
                      </Grid>

                      <Grid item xs={12} md={6}>
                        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                          Accessibility
                        </Typography>
                        {accessibilityHighlights.length ? (
                          <Stack direction="row" flexWrap="wrap" gap={1} useFlexGap>
                            {accessibilityHighlights.map((label) => (
                              <Chip key={`accessibility-${label}`} label={label} size="small" variant="outlined" />
                            ))}
                          </Stack>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            No accessibility information provided
                          </Typography>
                        )}
                      </Grid>
                    </Grid>
                  </Box>

                  <Box>
                    <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                      Financial Information
                    </Typography>
                    <Divider sx={{ mb: 2 }} />
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6} md={4}>
                        <Typography variant="body2" color="text.secondary">
                          Purchase Price
                        </Typography>
                        <Typography variant="body1">{formatCurrencyValue(purchasePrice)}</Typography>
                      </Grid>
                      <Grid item xs={12} sm={6} md={4}>
                        <Typography variant="body2" color="text.secondary">
                          Purchase Date
                        </Typography>
                        <Typography variant="body1">{formatDateOnly(property?.purchaseDate)}</Typography>
                      </Grid>
                      <Grid item xs={12} sm={6} md={4}>
                        <Typography variant="body2" color="text.secondary">
                          Current Market Value
                        </Typography>
                        <Typography variant="body1">{formatCurrencyValue(currentMarketValue)}</Typography>
                      </Grid>
                      <Grid item xs={12} sm={6} md={4}>
                        <Typography variant="body2" color="text.secondary">
                          Annual Property Tax
                        </Typography>
                        <Typography variant="body1">{formatCurrencyValue(annualPropertyTax)}</Typography>
                      </Grid>
                      <Grid item xs={12} sm={6} md={4}>
                        <Typography variant="body2" color="text.secondary">
                          Annual Insurance
                        </Typography>
                        <Typography variant="body1">{formatCurrencyValue(annualInsurance)}</Typography>
                      </Grid>
                      <Grid item xs={12} sm={6} md={4}>
                        <Typography variant="body2" color="text.secondary">
                          Monthly HOA Fees
                        </Typography>
                        <Typography variant="body1">
                          {monthlyHOA !== null
                            ? `${formatCurrencyValue(monthlyHOA)} / month`
                            : 'N/A'}
                        </Typography>
                      </Grid>
                    </Grid>

                    {(monthlyCarryingCost !== null || annualCarryingCost !== null) && (
                      <Box
                        sx={{
                          mt: 3,
                          p: 2,
                          borderRadius: 2,
                          border: '1px solid',
                          borderColor: 'divider',
                          bgcolor: 'background.default',
                        }}
                      >
                        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                          Carrying Cost Summary
                        </Typography>
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} useFlexGap>
                          {monthlyCarryingCost !== null && (
                            <Box>
                              <Typography variant="body2" color="text.secondary">
                                Estimated Monthly Cost
                              </Typography>
                              <Typography variant="h6" color="primary.main">
                                {formatCurrencyValue(monthlyCarryingCost)}
                              </Typography>
                            </Box>
                          )}
                          {annualCarryingCost !== null && (
                            <Box>
                              <Typography variant="body2" color="text.secondary">
                                Estimated Annual Cost
                              </Typography>
                              <Typography variant="h6" color="primary.main">
                                {formatCurrencyValue(annualCarryingCost)}
                              </Typography>
                            </Box>
                          )}
                        </Stack>
                      </Box>
                    )}

                    {equityGain !== null && (
                      <Box
                        sx={{
                          mt: 3,
                          p: 2,
                          borderRadius: 2,
                          border: '1px solid',
                          borderColor: 'divider',
                          bgcolor: 'background.paper',
                        }}
                      >
                        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                          Equity Summary
                        </Typography>
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} useFlexGap>
                          <Box>
                            <Typography variant="body2" color="text.secondary">
                              Estimated Equity Gain/Loss
                            </Typography>
                            <Typography variant="h6" sx={{ color: equityGainColor }}>
                              {formatCurrencyValue(equityGain)}
                            </Typography>
                          </Box>
                          {equityGainPercentage !== null && (
                            <Box>
                              <Typography variant="body2" color="text.secondary">
                                Percentage Change
                              </Typography>
                              <Typography variant="h6" sx={{ color: equityGainColor }}>
                                {`${equityGainPercentage.toFixed(2)}%`}
                              </Typography>
                            </Box>
                          )}
                        </Stack>
                      </Box>
                    )}
                  </Box>
                </Stack>
              </Paper>
            )}

            {currentTab === 1 && (
              <Paper sx={{ p: { xs: 2, md: 3 } }}>
                <Stack
                  direction={{ xs: 'column', md: 'row' }}
                  spacing={{ xs: 2, md: 1 }}
                  alignItems={{ xs: 'flex-start', md: 'center' }}
                  justifyContent="space-between"
                  sx={{ mb: 3 }}
                >
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    Units
                  </Typography>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ width: { xs: '100%', md: 'auto' } }}>
                    <Button
                      variant="outlined"
                      startIcon={<CalendarIcon />}
                      onClick={() => setBulkScheduleDialogOpen(true)}
                      disabled={units.length === 0}
                      fullWidth={isSmallScreen}
                    >
                      Bulk Schedule Inspections
                    </Button>
                    <Button
                      variant="contained"
                      startIcon={<AddIcon />}
                      onClick={handleAddUnit}
                      fullWidth={isSmallScreen}
                    >
                      Add Unit
                    </Button>
                  </Stack>
                </Stack>

                {deleteUnitMutation.isError && (
                  <Alert severity="error" sx={{ mb: 2 }}>
                    {deleteUnitMutation.error?.message || 'Failed to delete unit'}
                  </Alert>
                )}

                <DataState
                  isLoading={unitsQuery.isLoading}
                  isError={unitsQuery.isError}
                  error={unitsQuery.error}
                  isEmpty={units.length === 0}
                  emptyMessage="No units yet. Add your first unit to get started!"
                  onRetry={() => unitsQuery.refetch()}
                >
                  <Stack spacing={3}>
                    <Grid container spacing={2.5}>
                      {units.map((unit) => {
                        // Process unit images similar to property images
                        const unitImages = (() => {
                          if (Array.isArray(unit.images) && unit.images.length > 0) {
                            return unit.images.map(img => img.imageUrl || img.url);
                          }
                          if (unit.imageUrl) {
                            return [unit.imageUrl];
                          }
                          return [];
                        })();

                        const hasMultipleUnitImages = unitImages.length > 1;

                        return (
                        <Grid item xs={12} sm={6} md={4} key={unit.id}>
                          <Card
                            sx={{
                              height: '100%',
                              display: 'flex',
                              flexDirection: 'column',
                              cursor: 'pointer',
                              transition: 'transform 0.2s, box-shadow 0.2s',
                              '&:hover': {
                                transform: 'translateY(-4px)',
                                boxShadow: 4,
                              },
                              '&:focus': {
                                outline: '2px solid',
                                outlineColor: 'primary.main',
                                outlineOffset: '2px',
                              },
                            }}
                            onClick={() => navigate(`/units/${unit.id}`)}
                            onKeyPress={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                navigate(`/units/${unit.id}`);
                              }
                            }}
                            tabIndex={0}
                            role="button"
                            aria-label={`View details for unit ${unit.id}`}
                          >
                            {/* Unit Image Carousel */}
                            {unitImages.length > 0 && (
                              <PropertyImageCarousel
                                images={unitImages}
                                fallbackText={`Unit ${unit.unitNumber}`}
                                height={{ xs: 180, sm: 200 }}
                                showDots={hasMultipleUnitImages}
                                showArrows={hasMultipleUnitImages}
                                showCounter={hasMultipleUnitImages}
                                containerSx={{
                                  borderBottom: '1px solid',
                                  borderColor: 'divider',
                                }}
                              />
                            )}

                            <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                              <Box
                                sx={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  gap: 1,
                                }}
                              >
                                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                  Unit {unit.unitNumber}
                                </Typography>
                                <IconButton
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleUnitMenuOpen(e, unit);
                                  }}
                                >
                                  <MoreVertIcon />
                                </IconButton>
                              </Box>

                              <Stack spacing={1}>
                                <Chip
                                  label={unit.status?.replace(/_/g, ' ')}
                                  color={getStatusColor(unit.status)}
                                  size="small"
                                />

                                {unit.bedrooms != null && unit.bathrooms != null && (
                                  <Typography variant="body2" color="text.secondary">
                                    {unit.bedrooms} bed • {unit.bathrooms} bath
                                  </Typography>
                                )}

                                {unit.area != null && (
                                  <Typography variant="body2" color="text.secondary">
                                    {unit.area} sq ft
                                  </Typography>
                                )}

                                {unit.rentAmount != null && (
                                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                    ${unit.rentAmount.toLocaleString()}/mo
                                  </Typography>
                                )}

                                {unit.tenants?.[0]?.tenant && (
                                  <Box>
                                    <Typography variant="caption" color="text.secondary">
                                      Tenant
                                    </Typography>
                                    <Typography variant="body2">
                                      {unit.tenants[0].tenant.firstName} {unit.tenants[0].tenant.lastName}
                                    </Typography>
                                  </Box>
                                )}
                              </Stack>
                            </CardContent>
                          </Card>
                        </Grid>
                        );
                      })}
                    </Grid>

                    {/* Load More Button */}
                    {unitsQuery.hasNextPage && (
                      <Box sx={{ display: 'flex', justifyContent: 'center', pt: 2 }}>
                        <Button
                          variant="outlined"
                          size="large"
                          onClick={() => unitsQuery.fetchNextPage()}
                          disabled={unitsQuery.isFetchingNextPage}
                          startIcon={unitsQuery.isFetchingNextPage ? <CircularProgress size={20} /> : null}
                        >
                          {unitsQuery.isFetchingNextPage ? 'Loading...' : 'Load More'}
                        </Button>
                      </Box>
                    )}
                  </Stack>
                </DataState>
              </Paper>
            )}

            {currentTab === 2 && (
              <Paper sx={{ p: { xs: 2, md: 3 } }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    Property Owners
                  </Typography>
                  <Box>
                    <Button
                      variant="outlined"
                      startIcon={<PersonAddIcon />}
                      endIcon={<KeyboardArrowDownIcon />}
                      disabled={!canInviteOwners || !property}
                      onClick={(e) => setOwnerMenuAnchor(e.currentTarget)}
                    >
                      Add Owner
                    </Button>
                    <Menu
                      anchorEl={ownerMenuAnchor}
                      open={Boolean(ownerMenuAnchor)}
                      onClose={() => setOwnerMenuAnchor(null)}
                    >
                      <MenuItem
                        onClick={() => {
                          setOwnerMenuAnchor(null);
                          setAssignOwnerDialogOpen(true);
                        }}
                      >
                        <ListItemIcon>
                          <PersonAddIcon fontSize="small" />
                        </ListItemIcon>
                        <ListItemText primary="Assign Existing Owner" />
                      </MenuItem>
                      <MenuItem
                        onClick={() => {
                          setOwnerMenuAnchor(null);
                          setOwnerInviteDialogOpen(true);
                        }}
                      >
                        <ListItemIcon>
                          <EmailIcon fontSize="small" />
                        </ListItemIcon>
                        <ListItemText primary="Invite New Owner" />
                      </MenuItem>
                    </Menu>
                  </Box>
                </Box>

                {property.owners && property.owners.length > 0 ? (
                  <Box sx={{ overflowX: 'auto' }}>
                    <Table sx={{ minWidth: { xs: 500, md: 'auto' } }}>
                      <TableHead>
                        <TableRow>
                          <TableCell>Name</TableCell>
                          <TableCell>Email</TableCell>
                          <TableCell>Ownership %</TableCell>
                          <TableCell>Since</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {property.owners.map((po) => (
                          <TableRow key={po.id}>
                            <TableCell>
                              <Typography variant="body2" sx={{ whiteSpace: 'nowrap' }}>
                                {po.owner.firstName} {po.owner.lastName}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" sx={{ whiteSpace: 'nowrap' }}>
                                {po.owner.email}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2">
                                {po.ownershipPercentage}%
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" sx={{ whiteSpace: 'nowrap' }}>
                                {formatDateOnly(po.startDate)}
                              </Typography>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Box>
                ) : (
                  <Typography color="text.secondary">
                    No owners assigned yet
                  </Typography>
                )}
              </Paper>
            )}

            {/* Documents Tab */}
            {currentTab === 3 && (
              <Paper sx={{ p: { xs: 2, md: 3 } }}>
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                  Property Documents
                </Typography>
                <Divider sx={{ mb: 3 }} />
                <PropertyDocumentManager propertyId={id} canEdit={canEdit} />
              </Paper>
            )}

            {/* Notes Tab */}
            {currentTab === 4 && (
              <Paper sx={{ p: { xs: 2, md: 3 } }}>
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                  Property Notes
                </Typography>
                <Divider sx={{ mb: 3 }} />
                <PropertyNotesSection propertyId={id} canEdit={canAddNotes} />
              </Paper>
            )}

            {/* Activity Tab */}
            {currentTab === 5 && (
              <Paper sx={{ p: { xs: 2, md: 3 } }}>
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                  Recent Activity
                </Typography>
                <Divider sx={{ mb: 2 }} />
                
                <DataState
                  isLoading={activityQuery.isLoading}
                  isError={activityQuery.isError}
                  error={activityQuery.error}
                  isEmpty={activities.length === 0}
                  emptyMessage="No recent activity for this property"
                  onRetry={activityQuery.refetch}
                >
                  <List>
                    {activities.map((activity, index) => (
                      <ListItem
                        key={`${activity.type}-${activity.id}-${activity.date}-${index}`}
                        divider={index < activities.length - 1}
                        sx={{ px: 0 }}
                      >
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="body1" sx={{ fontWeight: 500 }}>
                                {activity.title}
                              </Typography>
                              {activity.status && (
                                <Chip
                                  label={activity.status.replace(/_/g, ' ')}
                                  size="small"
                                  color={getStatusColor(activity.status)}
                                />
                              )}
                              {activity.priority && (
                                <Chip
                                  label={activity.priority}
                                  size="small"
                                  color={getPriorityColor(activity.priority)}
                                />
                              )}
                            </Box>
                          }
                          secondary={
                            <Box>
                              <Typography variant="body2" color="text.secondary">
                                {activity.description}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {formatDateTime(activity.date)} • {activity.type.replace(/_/g, ' ')}
                              </Typography>
                            </Box>
                          }
                        />
                      </ListItem>
                    ))}
                  </List>
                </DataState>
              </Paper>
            )}
          </Stack>
        )}
      </DataState>

      {/* Unit Menu */}
      <Menu
        anchorEl={unitMenuAnchor}
        open={Boolean(unitMenuAnchor)}
        onClose={handleUnitMenuClose}
      >
        <MenuItem onClick={handleEditUnit}>
          <EditIcon fontSize="small" sx={{ mr: 1 }} />
          Edit
        </MenuItem>
        <MenuItem onClick={handleDeleteUnit} sx={{ color: 'error.main' }}>
          <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
          Delete
        </MenuItem>
      </Menu>

      {/* Edit Property Dialog */}
      <PropertyForm
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        property={property}
        onSuccess={() => {
          setEditDialogOpen(false);
          propertyQuery.refetch();
          // Also refetch units in case totalUnits or other related data changed
          unitsQuery.refetch();
        }}
      />

      {/* Unit Form Dialog */}
      <UnitForm
        key={selectedUnit?.id || 'new-unit'}
        open={unitDialogOpen}
        onClose={() => {
          setUnitDialogOpen(false);
          // Delay clearing selectedUnit to prevent flash of wrong data during close animation
          setTimeout(() => setSelectedUnit(null), 200);
        }}
        propertyId={id}
        unit={selectedUnit}
        onSuccess={() => {
          setUnitDialogOpen(false);
          setTimeout(() => setSelectedUnit(null), 200);
          unitsQuery.refetch();
          // Also refetch property to update unit count
          propertyQuery.refetch();
        }}
      />

      {/* Delete Unit Dialog */}
      <Dialog
        open={deleteUnitDialogOpen}
        onClose={() => {
          setDeleteUnitDialogOpen(false);
          setTimeout(() => setSelectedUnit(null), 200);
        }}
      >
        <DialogTitle>Delete Unit</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete Unit {selectedUnit?.unitNumber}?
            This action cannot be undone.
          </Typography>
          {selectedUnit?.tenants && selectedUnit.tenants.length > 0 && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              This unit has active tenant(s). Please remove tenants before deleting.
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setDeleteUnitDialogOpen(false);
              setTimeout(() => setSelectedUnit(null), 200);
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={confirmDeleteUnit}
            color="error"
            variant="contained"
            disabled={
              deleteUnitMutation.isPending || 
              (selectedUnit?.tenants && selectedUnit.tenants.length > 0)
            }
          >
            {deleteUnitMutation.isPending ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      <InviteOwnerDialog
        open={ownerInviteDialogOpen}
        onClose={() => setOwnerInviteDialogOpen(false)}
        property={property}
        onInvitesSent={(result) => {
          if (result?.successes) {
            propertyQuery.refetch();
          }
        }}
      />

      <AssignOwnerDialog
        open={assignOwnerDialogOpen}
        onClose={() => setAssignOwnerDialogOpen(false)}
        propertyId={id}
      />

      <BulkInspectionSchedulingDialog
        open={bulkScheduleDialogOpen}
        onClose={(success) => {
          setBulkScheduleDialogOpen(false);
          if (success) {
            // Optionally refetch data or show success message
            unitsQuery.refetch();
          }
        }}
        units={units}
        propertyId={id}
      />

      {/* Schedule Inspection Dialog */}
      <Dialog
        open={inspectionFormDialogOpen}
        onClose={() => setInspectionFormDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <InspectionForm
          onSuccess={() => {
            setInspectionFormDialogOpen(false);
            queryClient.invalidateQueries({ queryKey: queryKeys.inspections.list() });
            queryClient.invalidateQueries({ queryKey: queryKeys.properties.activity(id) });
          }}
          onCancel={() => setInspectionFormDialogOpen(false)}
          initialValues={{
            propertyId: id,
          }}
        />
      </Dialog>

      {/* Image Lightbox Dialog */}
      <Dialog
        open={lightboxOpen}
        onClose={handleCloseLightbox}
        maxWidth={false}
        PaperProps={{
          sx: {
            backgroundColor: 'rgba(0, 0, 0, 0.95)',
            boxShadow: 'none',
            margin: 0,
            maxWidth: '100vw',
            maxHeight: '100vh',
            borderRadius: 0,
          },
        }}
        sx={{
          '& .MuiBackdrop-root': {
            backgroundColor: 'rgba(0, 0, 0, 0.95)',
          },
        }}
      >
        <DialogContent
          sx={{
            position: 'relative',
            padding: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            overflow: 'hidden',
          }}
        >
          {/* Close Button */}
          <IconButton
            onClick={handleCloseLightbox}
            sx={{
              position: 'absolute',
              top: 16,
              right: 16,
              color: 'white',
              backgroundColor: 'rgba(255,255,255,0.1)',
              zIndex: 3,
              '&:hover': {
                backgroundColor: 'rgba(255,255,255,0.2)',
              },
            }}
          >
            <CloseIcon />
          </IconButton>

          {/* Previous Arrow */}
          {carouselImages.length > 1 && (
            <IconButton
              onClick={(e) => {
                e.stopPropagation();
                handleLightboxPrev();
              }}
              sx={{
                position: 'absolute',
                left: 16,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'white',
                backgroundColor: 'rgba(255,255,255,0.1)',
                zIndex: 3,
                '&:hover': {
                  backgroundColor: 'rgba(255,255,255,0.2)',
                },
              }}
            >
              <ArrowBackIos sx={{ ml: 0.5 }} />
            </IconButton>
          )}

          {/* Next Arrow */}
          {carouselImages.length > 1 && (
            <IconButton
              onClick={(e) => {
                e.stopPropagation();
                handleLightboxNext();
              }}
              sx={{
                position: 'absolute',
                right: 16,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'white',
                backgroundColor: 'rgba(255,255,255,0.1)',
                zIndex: 3,
                '&:hover': {
                  backgroundColor: 'rgba(255,255,255,0.2)',
                },
              }}
            >
              <ArrowForwardIos />
            </IconButton>
          )}

          {/* Image */}
          <Box
            sx={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: { xs: 2, md: 4 },
            }}
          >
            {/* Bug Fix #6: Null-safe lightbox image with proper URL resolution */}
            {carouselImages[lightboxIndex] ? (
              <Box
                component="img"
                src={getImageUrl(carouselImages[lightboxIndex], lightboxIndex)}
                alt={getImageCaption(carouselImages[lightboxIndex], lightboxIndex)}
                onError={(e) => {
                  logger.error('Failed to load lightbox image:', carouselImages[lightboxIndex]);
                  e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%23ddd" width="200" height="200"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%23999"%3EImage unavailable%3C/text%3E%3C/svg%3E';
                }}
                sx={{
                  maxWidth: '100%',
                  maxHeight: '90vh',
                  objectFit: 'contain',
                  transition: 'opacity 0.3s ease',
                }}
              />
            ) : (
              <Typography color="white">Image not available</Typography>
            )}
          </Box>

          {/* Image Counter and Caption */}
          <Box
            sx={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0) 100%)',
              padding: 3,
              zIndex: 2,
            }}
          >
            <Typography
              variant="body2"
              sx={{
                color: 'white',
                textAlign: 'center',
                fontWeight: 500,
              }}
            >
              {lightboxIndex + 1} / {carouselImages.length}
            </Typography>
            {/* Bug Fix #7: Show caption if available */}
            {carouselImages[lightboxIndex] && typeof carouselImages[lightboxIndex] === 'object' && (carouselImages[lightboxIndex]?.caption || carouselImages[lightboxIndex]?.altText) && (
              <Typography
                variant="body1"
                sx={{
                  color: 'white',
                  textAlign: 'center',
                  mt: 1,
                }}
              >
                {carouselImages[lightboxIndex].caption || carouselImages[lightboxIndex].altText}
              </Typography>
            )}
          </Box>
        </DialogContent>
      </Dialog>
    </Box>
  );
}
