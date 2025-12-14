import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Box,
    Card,
    CardContent,
    Chip,
    Container,
    Divider,
    Grid,
    Stack,
    Typography,
    Button,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Alert,
    Paper,
    IconButton,
    useMediaQuery,
    useTheme,

} from '@mui/material';
import {
    Home as HomeIcon,
    Build as BuildIcon,
    Assignment as AssignmentIcon,
    KingBed as BedroomIcon,
    Bathtub as BathroomIcon,
    LocationOn as LocationIcon,
    CheckCircle as CheckCircleIcon,
    Schedule as ScheduleIcon,
    ChevronRight as ChevronRightIcon,
    Apartment as ApartmentIcon,
    Add as AddIcon,
    Close as CloseIcon,
    ArrowBackIos,
    ArrowForwardIos,

} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import DataState from '../components/DataState';
import PageShell from '../components/PageShell';
import Breadcrumbs from '../components/Breadcrumbs';
import GradientButton from '../components/GradientButton';
import ensureArray from '../utils/ensureArray';
import { queryKeys } from '../utils/queryKeys';
import { format } from 'date-fns';

const SERVICE_CATEGORIES = [
    'PLUMBING',
    'ELECTRICAL',
    'HVAC',
    'APPLIANCE',
    'STRUCTURAL',
    'PEST_CONTROL',
    'LANDSCAPING',
    'GENERAL',
    'OTHER',
];

const PRIORITY_OPTIONS = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

// Inspection Card Component
const InspectionCard = ({ inspection, onClick }) => {
    const getStatusColor = (status) => {
        switch (status?.toUpperCase()) {
            case 'COMPLETED':
                return 'success';
            case 'SCHEDULED':
                return 'info';
            case 'IN_PROGRESS':
                return 'warning';
            default:
                return 'default';
        }
    };

    return (
        <Card
            variant="outlined"
            sx={{
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                '&:hover': {
                    boxShadow: 4,
                    borderColor: 'primary.main',
                },
            }}
            onClick={onClick}
        >
            <CardContent>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }} justifyContent="space-between">
                    <Stack direction="row" spacing={2} alignItems="center" flex={1}>
                        <AssignmentIcon color="primary" />
                        <Box flex={1}>
                            <Typography variant="subtitle1" fontWeight={600}>
                                {inspection.title || 'Inspection'}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                {inspection.scheduledDate
                                    ? format(new Date(inspection.scheduledDate), 'EEEE, MMM dd, yyyy')
                                    : 'Date not scheduled'}
                            </Typography>
                        </Box>
                    </Stack>
                    <Stack direction="row" spacing={1} alignItems="center">
                        <Chip
                            label={inspection.status?.replace(/_/g, ' ') || 'N/A'}
                            size="small"
                            color={getStatusColor(inspection.status)}
                        />
                        <Button
                            variant="text"
                            size="small"
                            endIcon={<ChevronRightIcon />}
                            sx={{ textTransform: 'none' }}
                        >
                            View
                        </Button>
                    </Stack>
                </Stack>
            </CardContent>
        </Card>
    );
};

export default function TenantHomePage() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    // Service request dialog state
    const [dialogOpen, setDialogOpen] = useState(false);
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        category: 'GENERAL',
        priority: 'MEDIUM',
    });
    const [submitError, setSubmitError] = useState('');

    const theme = useTheme();
    // Use md breakpoint to switch between mobile stack and desktop grid
    const isDesktop = useMediaQuery(theme.breakpoints.up('md'));

    // Lightbox state
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const [lightboxIndex, setLightboxIndex] = useState(0);

    // Fetch tenant's assigned units
    const { data: units = [], isLoading: unitsLoading, error: unitsError, refetch: refetchUnits } = useQuery({
        queryKey: queryKeys.dashboard.tenantUnits(),
        queryFn: async () => {
            const response = await apiClient.get('/tenants/my-units');
            return ensureArray(response.data, ['items', 'data.items', 'units', 'data']);
        },
        retry: 1,
    });

    // Fetch tenant's service requests
    const { data: serviceRequests = [], isLoading: requestsLoading, error: requestsError } = useQuery({
        queryKey: queryKeys.serviceRequests.tenant(),
        queryFn: async () => {
            const response = await apiClient.get('/service-requests?mine=true');
            return ensureArray(response.data, ['items', 'data.items', 'serviceRequests']);
        },
    });

    const uniqueUnits = useMemo(
        () =>
            Array.isArray(units)
                ? Array.from(
                    new Map(
                        units
                            .filter(Boolean)
                            .map((unit) => [unit?.id || unit?.unitId || JSON.stringify(unit), unit])
                    ).values()
                )
                : [],
        [units]
    );

    const [selectedUnitId, setSelectedUnitId] = useState('');

    const resolvedSelectedUnitId = useMemo(() => {
        if (selectedUnitId && uniqueUnits.some((u) => u.id === selectedUnitId)) return selectedUnitId;
        return uniqueUnits[0]?.id || '';
    }, [selectedUnitId, uniqueUnits]);

    const selectedUnit = useMemo(
        () => uniqueUnits.find((u) => u.id === resolvedSelectedUnitId) || null,
        [uniqueUnits, resolvedSelectedUnitId]
    );

    const unitId = selectedUnit?.id;
    const propertyId = selectedUnit?.propertyId || selectedUnit?.property?.id || null;

    // Fetch property details with images
    const { data: propertyResponse, isLoading: propertyLoading } = useQuery({
        queryKey: queryKeys.properties.detail(propertyId || 'none'),
        queryFn: async () => {
            const response = await apiClient.get(`/properties/${propertyId}`);
            return response.data;
        },
        enabled: Boolean(propertyId),
        retry: 1,
    });

    const property = propertyResponse?.property ?? null;

    // Extract images from property - check multiple possible structures
    const extractedPropertyImages = useMemo(() => {
        if (!property) return [];

        // Check for propertyImages array (normalized form)
        if (Array.isArray(property.propertyImages) && property.propertyImages.length > 0) {
            return property.propertyImages.map(img => ({
                imageUrl: img.imageUrl || img.url,
                caption: img.caption || img.altText,
            }));
        }

        // Check for images array
        if (Array.isArray(property.images) && property.images.length > 0) {
            return property.images.map(img => {
                if (typeof img === 'string') return { imageUrl: img };
                return { imageUrl: img.imageUrl || img.url, caption: img.caption };
            });
        }

        // Check for single imageUrl
        if (property.imageUrl) {
            return [{ imageUrl: property.imageUrl }];
        }

        return [];
    }, [property]);

    // Combine unit images and property images
    const unitImages = useMemo(() => {
        if (!selectedUnit) return [];
        if (Array.isArray(selectedUnit.images) && selectedUnit.images.length > 0) {
            return selectedUnit.images.map(img => {
                if (typeof img === 'string') return { imageUrl: img };
                return { imageUrl: img.imageUrl || img.url, caption: img.caption };
            });
        }
        if (selectedUnit.imageUrl) {
            return [{ imageUrl: selectedUnit.imageUrl }];
        }
        return [];
    }, [selectedUnit]);

    const allImages = [...unitImages, ...extractedPropertyImages];

    // Fetch inspections for this unit
    const {
        data: inspections = [],
        isLoading: inspectionsLoading,
        error: inspectionsError,
        refetch: refetchInspections,
    } = useQuery({
        queryKey: queryKeys.inspections.byUnit(unitId),
        queryFn: async () => {
            const response = await apiClient.get(`/inspections?unitId=${unitId}`);
            return ensureArray(response.data, ['items', 'data.items', 'inspections', 'data']);
        },
        enabled: !!unitId,
        retry: 1,
    });

    // Submit service request mutation
    const submitMutation = useMutation({
        mutationFn: async (data) => {
            const response = await apiClient.post('/service-requests', data);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.serviceRequests.tenant() });
            setDialogOpen(false);
            setFormData({
                title: '',
                description: '',
                category: 'GENERAL',
                priority: 'MEDIUM',
            });
            setSubmitError('');
        },
        onError: (error) => {
            setSubmitError(error.response?.data?.message || 'Failed to submit service request');
        },
    });

    const handleSubmitRequest = () => {
        if (!formData.title || !formData.description) {
            setSubmitError('Please fill in all required fields');
            return;
        }

        const unit = selectedUnit;
        if (!unit) {
            setSubmitError('No unit information found');
            return;
        }

        submitMutation.mutate({
            ...formData,
            propertyId: unit.propertyId || unit.property?.id,
            unitId: unit.id,
        });
    };

    // Service request stats
    const pendingRequests = serviceRequests.filter(
        r => r.status === 'SUBMITTED' || r.status === 'UNDER_REVIEW'
    ).length;

    const inProgressRequests = serviceRequests.filter(
        r => r.status === 'APPROVED' || r.status === 'CONVERTED_TO_JOB' || r.status === 'IN_PROGRESS'
    ).length;

    const completedRequests = serviceRequests.filter(
        r => r.status === 'COMPLETED'
    ).length;

    const hasAssignedUnit = uniqueUnits.length > 0;

    // Build the full address
    const fullAddress = [
        property?.address,
        property?.city,
        property?.state,
        property?.postcode || property?.zipCode,
    ]
        .filter(Boolean)
        .filter(Boolean)
        .join(', ');

    // Lightbox handlers
    const handleOpenLightbox = (index) => {
        setLightboxIndex(index);
        setLightboxOpen(true);
    };

    const handleCloseLightbox = () => {
        setLightboxOpen(false);
    };

    const handleLightboxPrev = () => {
        setLightboxIndex((prev) => (prev - 1 + allImages.length) % allImages.length);
    };


    const handleLightboxNext = () => {
        setLightboxIndex((prev) => (prev + 1) % allImages.length);
    };

    // Keyboard navigation for lightbox
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
    }, [lightboxOpen, allImages.length]); // Re-bind if open state or image count changes

    return (
        <Container maxWidth="lg" sx={{ py: { xs: 2, md: 4 } }}>
            <Breadcrumbs
                labelOverrides={{
                    '/tenant/home': 'My Home',
                }}
            />
            <PageShell
                title="My Home"
                subtitle="View your home, service requests, and inspection reports"
                actions={
                    hasAssignedUnit && (
                        <GradientButton
                            startIcon={<AddIcon />}
                            onClick={() => setDialogOpen(true)}
                            size="large"
                            sx={{ width: { xs: '100%', md: 'auto' } }}
                        >
                            New Service Request
                        </GradientButton>
                    )
                }
                contentSpacing={{ xs: 3, md: 3 }}
            >
                {/* No unit assigned alert */}
                {!unitsLoading && !unitsError && !hasAssignedUnit && (
                    <Alert severity="info" sx={{ mb: 3 }}>
                        You don't have a unit assigned yet. Once your property manager assigns you to a unit, you'll be able to view your home details here.
                    </Alert>
                )}

                {/* Service Request Stats */}
                <Grid container spacing={2} sx={{ mb: 3 }}>
                    <Grid item xs={4}>
                        <Card>
                            <CardContent sx={{ py: { xs: 1.5, md: 2 }, px: { xs: 1.5, md: 2 } }}>
                                <Stack direction="row" alignItems="center" spacing={{ xs: 1, md: 2 }}>
                                    <BuildIcon color="warning" sx={{ fontSize: { xs: 28, md: 40 } }} />
                                    <Box>
                                        <Typography variant="h4" sx={{ fontSize: { xs: '1.5rem', md: '2rem' } }}>{pendingRequests}</Typography>
                                        <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.7rem', md: '0.875rem' } }}>
                                            Pending
                                        </Typography>
                                    </Box>
                                </Stack>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={4}>
                        <Card>
                            <CardContent sx={{ py: { xs: 1.5, md: 2 }, px: { xs: 1.5, md: 2 } }}>
                                <Stack direction="row" alignItems="center" spacing={{ xs: 1, md: 2 }}>
                                    <ScheduleIcon color="info" sx={{ fontSize: { xs: 28, md: 40 } }} />
                                    <Box>
                                        <Typography variant="h4" sx={{ fontSize: { xs: '1.5rem', md: '2rem' } }}>{inProgressRequests}</Typography>
                                        <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.7rem', md: '0.875rem' } }}>
                                            In Progress
                                        </Typography>
                                    </Box>
                                </Stack>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={4}>
                        <Card>
                            <CardContent sx={{ py: { xs: 1.5, md: 2 }, px: { xs: 1.5, md: 2 } }}>
                                <Stack direction="row" alignItems="center" spacing={{ xs: 1, md: 2 }}>
                                    <CheckCircleIcon color="success" sx={{ fontSize: { xs: 28, md: 40 } }} />
                                    <Box>
                                        <Typography variant="h4" sx={{ fontSize: { xs: '1.5rem', md: '2rem' } }}>{completedRequests}</Typography>
                                        <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.7rem', md: '0.875rem' } }}>
                                            Completed
                                        </Typography>
                                    </Box>
                                </Stack>
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>

                <DataState
                    isLoading={unitsLoading}
                    isError={!!unitsError}
                    error={unitsError}
                    isEmpty={!unitsLoading && !unitsError && !hasAssignedUnit}
                    emptyMessage="You don't have a home assigned yet. Contact your property manager."
                    onRetry={refetchUnits}
                >
                    {/* Unit Selector (if multiple units) */}
                    {uniqueUnits.length > 1 && (
                        <Card sx={{ mb: 3 }}>
                            <CardContent>
                                <FormControl fullWidth>
                                    <InputLabel id="tenant-unit-select-label">Select Home</InputLabel>
                                    <Select
                                        labelId="tenant-unit-select-label"
                                        label="Select Home"
                                        value={resolvedSelectedUnitId}
                                        onChange={(e) => setSelectedUnitId(e.target.value)}
                                    >
                                        {uniqueUnits.map((unit) => (
                                            <MenuItem key={unit.id} value={unit.id}>
                                                {unit.property?.name ? `${unit.property.name} — ` : ''}Unit {unit.unitNumber}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </CardContent>
                        </Card>
                    )}

                    {selectedUnit && (
                        <>
                            {/* Photo Gallery */}
                            <Card sx={{ mb: 3, overflow: 'hidden' }}>
                                {allImages.length > 0 ? (
                                    <Box
                                        sx={{
                                            display: 'grid',
                                            gridTemplateColumns: allImages.length === 1 ? '1fr' : { xs: '1fr', md: '2fr 1fr' },
                                            gap: 0.5,
                                            height: { xs: 300, md: 400 },
                                        }}
                                    >
                                        {/* Main Large Image */}
                                        <Paper
                                            sx={{
                                                position: 'relative',
                                                overflow: 'hidden',
                                                cursor: 'pointer',
                                                borderRadius: 0,
                                                height: '100%',
                                            }}
                                            onClick={() => handleOpenLightbox(0)}
                                            elevation={0}
                                        >
                                            <Box
                                                component="img"
                                                src={typeof allImages[0] === 'string' ? allImages[0] : allImages[0].imageUrl}
                                                alt={typeof allImages[0] === 'object' && allImages[0].caption ? allImages[0].caption : `Main image`}
                                                sx={{
                                                    width: '100%',
                                                    height: '100%',
                                                    objectFit: 'cover',
                                                    transition: 'transform 0.3s ease',
                                                    '&:hover': { transform: 'scale(1.02)' },
                                                }}
                                            />
                                            <Chip
                                                label="Primary"
                                                size="small"
                                                color="primary"
                                                sx={{ position: 'absolute', top: 12, left: 12, fontSize: '0.7rem' }}
                                            />
                                        </Paper>

                                        {/* Desktop: 2x2 Grid of Thumbnails */}
                                        {allImages.length > 1 && (
                                            <Box
                                                sx={{
                                                    display: { xs: 'none', md: 'grid' },
                                                    gridTemplateColumns: '1fr 1fr',
                                                    gridTemplateRows: '1fr 1fr',
                                                    gap: 0.5,
                                                    height: '100%',
                                                }}
                                            >
                                                {allImages.slice(1, 5).map((image, idx) => {
                                                    const imageUrl = typeof image === 'string' ? image : image.imageUrl;
                                                    const caption = typeof image === 'object' ? image.caption : null;
                                                    const actualIndex = idx + 1;

                                                    return (
                                                        <Paper
                                                            key={actualIndex}
                                                            sx={{
                                                                position: 'relative',
                                                                overflow: 'hidden',
                                                                cursor: 'pointer',
                                                                borderRadius: 0,
                                                            }}
                                                            onClick={() => handleOpenLightbox(actualIndex)}
                                                            elevation={0}
                                                        >
                                                            <Box
                                                                component="img"
                                                                src={imageUrl}
                                                                alt={caption || `Image ${actualIndex + 1} `}
                                                                sx={{
                                                                    width: '100%',
                                                                    height: '100%',
                                                                    objectFit: 'cover',
                                                                    '&:hover': { opacity: 0.9 },
                                                                }}
                                                            />
                                                            {/* Overlay for +N more images on the last block */}
                                                            {idx === 3 && allImages.length > 5 && (
                                                                <Box
                                                                    sx={{
                                                                        position: 'absolute',
                                                                        inset: 0,
                                                                        bgcolor: 'rgba(0,0,0,0.6)',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        justifyContent: 'center',
                                                                    }}
                                                                >
                                                                    <Typography variant="h5" color="white" fontWeight={700}>
                                                                        +{allImages.length - 5}
                                                                    </Typography>
                                                                </Box>
                                                            )}
                                                        </Paper>
                                                    );
                                                })}
                                            </Box>
                                        )}
                                    </Box>
                                ) : (
                                    <Paper
                                        sx={{
                                            height: { xs: 200, md: 300 },
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            bgcolor: 'grey.100',
                                        }}
                                        elevation={0}
                                    >
                                        <HomeIcon sx={{ fontSize: 80, color: 'grey.300' }} />
                                    </Paper>
                                )}

                                {/* Mobile: scrollable list if > 1 image */}
                                {allImages.length > 1 && (
                                    <Box
                                        sx={{
                                            display: { xs: 'flex', md: 'none' },
                                            gap: 1,
                                            overflowX: 'auto',
                                            p: 1,
                                            '&::-webkit-scrollbar': { height: 4 },
                                        }}
                                    >
                                        {allImages.slice(1).map((image, idx) => {
                                            const imageUrl = typeof image === 'string' ? image : image.imageUrl;
                                            return (
                                                <Box
                                                    key={idx}
                                                    component="img"
                                                    src={imageUrl}
                                                    sx={{
                                                        width: 80,
                                                        height: 80,
                                                        objectFit: 'cover',
                                                        borderRadius: 1,
                                                        flexShrink: 0
                                                    }}
                                                    onClick={() => handleOpenLightbox(idx + 1)}
                                                />
                                            );
                                        })}
                                    </Box>
                                )}
                            </Card>

                            {/* Lightbox Dialog */}
                            {lightboxOpen && (
                                <Dialog
                                    fullScreen
                                    open={lightboxOpen}
                                    onClose={handleCloseLightbox}
                                    PaperProps={{
                                        style: {
                                            backgroundColor: 'rgba(0,0,0,0.95)',
                                            boxShadow: 'none',
                                        },
                                    }}
                                >
                                    <DialogContent sx={{ position: 'relative', p: 0, overflow: 'hidden' }}>
                                        <IconButton
                                            onClick={handleCloseLightbox}
                                            sx={{
                                                position: 'absolute',
                                                top: 16,
                                                right: 16,
                                                color: 'white',
                                                bgcolor: 'rgba(255,255,255,0.1)',
                                                zIndex: 10,
                                                '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' }
                                            }}
                                        >
                                            <CloseIcon />
                                        </IconButton>

                                        {allImages.length > 1 && (
                                            <>
                                                <IconButton
                                                    onClick={(e) => { e.stopPropagation(); handleLightboxPrev(); }}
                                                    sx={{
                                                        position: 'absolute',
                                                        left: 16,
                                                        top: '50%',
                                                        transform: 'translateY(-50%)',
                                                        color: 'white',
                                                        bgcolor: 'rgba(255,255,255,0.1)',
                                                        zIndex: 10,
                                                        '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' }
                                                    }}
                                                >
                                                    <ArrowBackIos sx={{ ml: 0.5 }} />
                                                </IconButton>
                                                <IconButton
                                                    onClick={(e) => { e.stopPropagation(); handleLightboxNext(); }}
                                                    sx={{
                                                        position: 'absolute',
                                                        right: 16,
                                                        top: '50%',
                                                        transform: 'translateY(-50%)',
                                                        color: 'white',
                                                        bgcolor: 'rgba(255,255,255,0.1)',
                                                        zIndex: 10,
                                                        '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' }
                                                    }}
                                                >
                                                    <ArrowForwardIos />
                                                </IconButton>
                                            </>
                                        )}

                                        <Box
                                            sx={{
                                                width: '100%',
                                                height: '100%',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                p: 2
                                            }}
                                        >
                                            <Box
                                                component="img"
                                                src={typeof allImages[lightboxIndex] === 'string' ? allImages[lightboxIndex] : allImages[lightboxIndex]?.imageUrl}
                                                sx={{
                                                    maxWidth: '100%',
                                                    maxHeight: '90vh',
                                                    objectFit: 'contain'
                                                }}
                                            />
                                        </Box>

                                        <Box
                                            sx={{
                                                position: 'absolute',
                                                bottom: 0,
                                                left: 0,
                                                right: 0,
                                                p: 3,
                                                background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)',
                                                color: 'white',
                                                textAlign: 'center'
                                            }}
                                        >
                                            <Typography variant="body2" fontWeight={500}>
                                                {lightboxIndex + 1} / {allImages.length}
                                            </Typography>
                                            {typeof allImages[lightboxIndex] === 'object' && allImages[lightboxIndex]?.caption && (
                                                <Typography variant="body1" sx={{ mt: 1 }}>
                                                    {allImages[lightboxIndex].caption}
                                                </Typography>
                                            )}
                                        </Box>
                                    </DialogContent>
                                </Dialog>
                            )}

                            {/* Unit & Property Info */}
                            <Card sx={{ mb: 3 }}>
                                <CardContent>
                                    <Stack spacing={3}>
                                        {/* Header */}
                                        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
                                            <Box
                                                sx={{
                                                    background: 'linear-gradient(135deg, #b91c1c 0%, #f97316 100%)',
                                                    color: 'white',
                                                    borderRadius: 2,
                                                    p: 1.5,
                                                    display: 'flex',
                                                }}
                                            >
                                                <ApartmentIcon fontSize="large" />
                                            </Box>
                                            <Box flex={1}>
                                                <Typography variant="h5" fontWeight={700}>
                                                    Unit {selectedUnit.unitNumber}
                                                </Typography>
                                                <Typography variant="body2" color="text.secondary">
                                                    {property?.name || selectedUnit.property?.name || 'Property'}
                                                </Typography>
                                            </Box>
                                            <Chip
                                                label={selectedUnit.status || 'OCCUPIED'}
                                                color={selectedUnit.status === 'OCCUPIED' ? 'success' : 'default'}
                                                size="medium"
                                            />
                                        </Stack>

                                        <Divider />

                                        {/* Unit Details */}
                                        <Grid container spacing={3}>
                                            <Grid item xs={6} sm={3}>
                                                <Stack direction="row" spacing={1} alignItems="center">
                                                    <BedroomIcon color="action" fontSize="small" />
                                                    <Box>
                                                        <Typography variant="caption" color="text.secondary" display="block">
                                                            Bedrooms
                                                        </Typography>
                                                        <Typography variant="body1" fontWeight={600}>
                                                            {selectedUnit.bedrooms ?? 'N/A'}
                                                        </Typography>
                                                    </Box>
                                                </Stack>
                                            </Grid>
                                            <Grid item xs={6} sm={3}>
                                                <Stack direction="row" spacing={1} alignItems="center">
                                                    <BathroomIcon color="action" fontSize="small" />
                                                    <Box>
                                                        <Typography variant="caption" color="text.secondary" display="block">
                                                            Bathrooms
                                                        </Typography>
                                                        <Typography variant="body1" fontWeight={600}>
                                                            {selectedUnit.bathrooms ?? 'N/A'}
                                                        </Typography>
                                                    </Box>
                                                </Stack>
                                            </Grid>
                                            {selectedUnit.squareFeet && (
                                                <Grid item xs={6} sm={3}>
                                                    <Stack direction="row" spacing={1} alignItems="center">
                                                        <HomeIcon color="action" fontSize="small" />
                                                        <Box>
                                                            <Typography variant="caption" color="text.secondary" display="block">
                                                                Size
                                                            </Typography>
                                                            <Typography variant="body1" fontWeight={600}>
                                                                {selectedUnit.squareFeet} sq ft
                                                            </Typography>
                                                        </Box>
                                                    </Stack>
                                                </Grid>
                                            )}
                                            {selectedUnit.floor && (
                                                <Grid item xs={6} sm={3}>
                                                    <Box>
                                                        <Typography variant="caption" color="text.secondary" display="block">
                                                            Floor
                                                        </Typography>
                                                        <Typography variant="body1" fontWeight={600}>
                                                            {selectedUnit.floor}
                                                        </Typography>
                                                    </Box>
                                                </Grid>
                                            )}
                                        </Grid>

                                        {/* Address */}
                                        {fullAddress && (
                                            <>
                                                <Divider />
                                                <Stack direction="row" spacing={1.5} alignItems="flex-start">
                                                    <LocationIcon color="action" sx={{ mt: 0.25 }} />
                                                    <Box>
                                                        <Typography variant="caption" color="text.secondary" display="block">
                                                            Address
                                                        </Typography>
                                                        <Typography variant="body1">
                                                            {fullAddress}
                                                        </Typography>
                                                    </Box>
                                                </Stack>
                                            </>
                                        )}
                                    </Stack>
                                </CardContent>
                            </Card>

                            {/* Quick Actions */}
                            <Card sx={{ mb: 3 }}>
                                <CardContent>
                                    <Typography variant="h6" fontWeight={700} gutterBottom>
                                        Quick Actions
                                    </Typography>
                                    <Divider sx={{ mb: 2 }} />
                                    <Grid container spacing={2}>
                                        <Grid item xs={12} sm={6}>
                                            <Button
                                                variant="contained"
                                                fullWidth
                                                startIcon={<BuildIcon />}
                                                onClick={() => setDialogOpen(true)}
                                                sx={{
                                                    py: 1.5,
                                                    textTransform: 'none',
                                                    background: 'linear-gradient(135deg, #b91c1c 0%, #f97316 100%)',
                                                    '&:hover': {
                                                        background: 'linear-gradient(135deg, #991b1b 0%, #ea580c 100%)',
                                                    },
                                                }}
                                            >
                                                Request Maintenance
                                            </Button>
                                        </Grid>
                                        <Grid item xs={12} sm={6}>
                                            <Button
                                                variant="outlined"
                                                fullWidth
                                                startIcon={<AssignmentIcon />}
                                                onClick={() => navigate('/service-requests')}
                                                sx={{ py: 1.5, textTransform: 'none' }}
                                            >
                                                View My Requests
                                            </Button>
                                        </Grid>
                                    </Grid>
                                </CardContent>
                            </Card>

                            {/* Recent Service Requests */}
                            {serviceRequests.length > 0 && (
                                <Card sx={{ mb: 3 }}>
                                    <CardContent>
                                        <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                                            <Typography variant="h6" fontWeight={700}>
                                                Recent Service Requests
                                            </Typography>
                                            <Button
                                                size="small"
                                                onClick={() => navigate('/service-requests')}
                                                endIcon={<ChevronRightIcon />}
                                                sx={{ textTransform: 'none' }}
                                            >
                                                View All
                                            </Button>
                                        </Stack>
                                        <Divider sx={{ mb: 2 }} />
                                        <Stack spacing={2}>
                                            {serviceRequests.slice(0, 3).map((request) => (
                                                <Card key={request.id} variant="outlined">
                                                    <CardContent sx={{ py: 1.5 }}>
                                                        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                                                            <Box sx={{ flex: 1 }}>
                                                                <Typography variant="subtitle1" fontWeight={600}>
                                                                    {request.title}
                                                                </Typography>
                                                                <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                                                                    <Chip label={request.category?.replace(/_/g, ' ')} size="small" />
                                                                    <Chip label={request.status?.replace(/_/g, ' ')} size="small" color="primary" />
                                                                </Stack>
                                                            </Box>
                                                            <Typography variant="caption" color="text.secondary">
                                                                {format(new Date(request.createdAt), 'MMM dd')}
                                                            </Typography>
                                                        </Stack>
                                                    </CardContent>
                                                </Card>
                                            ))}
                                        </Stack>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Inspection Reports */}
                            <Card>
                                <CardContent>
                                    <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                                        <Stack direction="row" spacing={1.5} alignItems="center">
                                            <AssignmentIcon color="primary" />
                                            <Typography variant="h6" fontWeight={700}>
                                                Inspection Reports
                                            </Typography>
                                        </Stack>
                                        {inspections.length > 0 && (
                                            <Chip label={`${inspections.length} Total`} size="small" variant="outlined" />
                                        )}
                                    </Stack>

                                    <Divider sx={{ mb: 2 }} />

                                    <DataState
                                        isLoading={inspectionsLoading}
                                        isError={!!inspectionsError}
                                        error={inspectionsError}
                                        isEmpty={!inspectionsLoading && !inspectionsError && inspections.length === 0}
                                        emptyMessage="No inspections found for your home yet"
                                        onRetry={refetchInspections}
                                    >
                                        <Stack spacing={2}>
                                            {inspections.map((inspection) => (
                                                <InspectionCard
                                                    key={inspection.id}
                                                    inspection={inspection}
                                                    onClick={() => navigate(`/inspections/${inspection.id}/report`)}
                                                />
                                            ))}
                                        </Stack >
                                    </DataState >
                                </CardContent >
                            </Card >
                        </>
                    )}
                </DataState >

                {/* New Service Request Dialog */}
                < Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth >
                    <DialogTitle>New Service Request</DialogTitle>
                    <DialogContent>
                        {submitError && (
                            <Alert severity="error" sx={{ mb: 2 }}>
                                {submitError}
                            </Alert>
                        )}

                        <TextField
                            fullWidth
                            label="Title"
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            sx={{ mb: 2, mt: 1 }}
                            required
                            placeholder="e.g., Leaky faucet in bathroom"
                        />

                        <TextField
                            fullWidth
                            label="Description"
                            multiline
                            rows={4}
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            sx={{ mb: 2 }}
                            required
                            placeholder="Please describe the issue in detail..."
                        />

                        <TextField
                            fullWidth
                            select
                            label="Category"
                            value={formData.category}
                            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                            sx={{ mb: 2 }}
                        >
                            {SERVICE_CATEGORIES.map((category) => (
                                <MenuItem key={category} value={category}>
                                    {category.replace(/_/g, ' ')}
                                </MenuItem>
                            ))}
                        </TextField>

                        <TextField
                            fullWidth
                            select
                            label="Priority"
                            value={formData.priority}
                            onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                        >
                            {PRIORITY_OPTIONS.map((priority) => (
                                <MenuItem key={priority} value={priority}>
                                    {priority}
                                </MenuItem>
                            ))}
                        </TextField>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
                        <Button
                            variant="contained"
                            onClick={handleSubmitRequest}
                            disabled={submitMutation.isPending}
                        >
                            Submit Request
                        </Button>
                    </DialogActions>
                </Dialog >
            </PageShell >
        </Container >
    );
}
