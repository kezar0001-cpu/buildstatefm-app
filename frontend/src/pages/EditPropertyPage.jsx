import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Stack,
  CircularProgress,
  Alert,
} from '@mui/material';
import { ArrowBack } from '@mui/icons-material';
import PropertyForm from '../components/PropertyForm';
import useApiQuery from '../hooks/useApiQuery';
import { queryKeys } from '../utils/queryKeys.js';
import Breadcrumbs from '../components/Breadcrumbs';

export default function EditPropertyPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useApiQuery({
    queryKey: queryKeys.properties.detail(id),
    url: `/properties/${id}`,
  });

  const property = data?.property || data;

  const handleSuccess = () => {
    navigate(`/properties/${id}`);
  };

  const handleCancel = () => {
    navigate(`/properties/${id}`);
  };

  if (isLoading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '60vh',
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (isError) {
    const is404 = error?.message?.toLowerCase().includes('not found') || error?.status === 404;
    
    return (
      <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1200, mx: 'auto' }}>
        <Alert severity="error" sx={{ mb: 3 }}>
          {is404 ? 'Property not found' : error?.message || 'Failed to load property'}
        </Alert>
        <Stack direction="row" spacing={2}>
          <Button variant="outlined" onClick={() => refetch()}>
            Retry
          </Button>
          <Button
            variant="contained"
            startIcon={<ArrowBack />}
            onClick={() => navigate('/properties')}
          >
            Back to Properties
          </Button>
        </Stack>
      </Box>
    );
  }

  if (!property) {
    return (
      <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1200, mx: 'auto' }}>
        <Alert severity="warning">Property data not available</Alert>
        <Button
          variant="contained"
          startIcon={<ArrowBack />}
          onClick={() => navigate('/properties')}
          sx={{ mt: 2 }}
        >
          Back to Properties
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1200, mx: 'auto' }}>
      <Stack spacing={3}>
        <Box>
          <Breadcrumbs
            labelOverrides={{
              [`/properties/${id}`]: property.name,
              [`/properties/${id}/edit`]: 'Edit',
            }}
          />

          <Stack
            direction={{ xs: 'column', md: 'row' }}
            justifyContent="space-between"
            alignItems={{ xs: 'flex-start', md: 'center' }}
            spacing={{ xs: 2, md: 0 }}
          >
            <Typography variant="h4" component="h1" fontWeight={700}>
              Edit Property
            </Typography>
            <Button
              variant="outlined"
              startIcon={<ArrowBack />}
              onClick={() => navigate(`/properties/${id}`)}
              fullWidth
              sx={{ maxWidth: { xs: '100%', md: 'auto' } }}
            >
              Back
            </Button>
          </Stack>
        </Box>
      </Stack>

      {/* PropertyForm as Dialog - always open on this page */}
      <PropertyForm
        key={property?.id || 'loading'}
        open={true}
        onClose={handleCancel}
        property={property}
        onSuccess={handleSuccess}
      />
    </Box>
  );
}
