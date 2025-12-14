import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  Grid,
  Stack,
  Button,
  Chip,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Alert,
  Paper,
} from '@mui/material';
import {
  Home as HomeIcon,
  Build as BuildIcon,
  Add as AddIcon,
  CheckCircle as CheckCircleIcon,
  Assignment as AssignmentIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import DataState from '../components/DataState';
import EmptyState from '../components/EmptyState';
import { format } from 'date-fns';
import { queryKeys } from '../utils/queryKeys.js';
import ensureArray from '../utils/ensureArray';
import Breadcrumbs from '../components/Breadcrumbs';
import PageShell from '../components/PageShell';
import GradientButton from '../components/GradientButton';

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

export default function TenantDashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'GENERAL',
    priority: 'MEDIUM',
  });
  const [submitError, setSubmitError] = useState('');

  // Fetch tenant's assigned unit information via tenant-specific endpoint
  const { data: units = [], isLoading: unitsLoading, error: unitsError, refetch: refetchUnits } = useQuery({
    queryKey: queryKeys.dashboard.tenantUnits(),
    queryFn: async () => {
      // Use the tenants endpoint which filters by current user's tenant assignments
      const response = await apiClient.get('/tenants/my-units');
      return ensureArray(response.data, ['items', 'data.items', 'units', 'data']);
    },
    retry: 1,
  });

  // Fetch tenant's service requests (API auto-filters by requestedById = current user)
  const { data: serviceRequests = [], isLoading: requestsLoading, error: requestsError, refetch: refetchRequests } = useQuery({
    queryKey: queryKeys.serviceRequests.tenant(),
    queryFn: async () => {
      const response = await apiClient.get('/service-requests?mine=true');
      return ensureArray(response.data, ['items', 'data.items', 'serviceRequests']);
    },
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

    // Assuming we have the property and unit IDs from the units data
    const unit = units[0];
    if (!unit) {
      setSubmitError('No unit information found');
      return;
    }

    submitMutation.mutate({
      ...formData,
      propertyId: unit.propertyId,
      unitId: unit.id,
    });
  };

  const pendingRequests = serviceRequests.filter(
    r => r.status === 'SUBMITTED' || r.status === 'UNDER_REVIEW'
  ).length;

  const approvedRequests = serviceRequests.filter(
    r => r.status === 'APPROVED' || r.status === 'CONVERTED_TO_JOB'
  ).length;

  const completedRequests = serviceRequests.filter(
    r => r.status === 'COMPLETED'
  ).length;

  const hasAssignedUnit = Array.isArray(units) && units.length > 0;

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 2, md: 4 } }}>
      <Breadcrumbs
        labelOverrides={{
          '/tenant/dashboard': 'Tenant Dashboard',
        }}
      />
      <PageShell
        title="Tenant Dashboard"
        subtitle="Manage your unit and service requests"
        actions={(
          <GradientButton
            startIcon={<AddIcon />}
            onClick={() => setDialogOpen(true)}
            disabled={!hasAssignedUnit || unitsLoading}
            size="large"
            sx={{ width: { xs: '100%', md: 'auto' } }}
          >
            New Service Request
          </GradientButton>
        )}
        contentSpacing={{ xs: 3, md: 3 }}
      >

      {!unitsLoading && !unitsError && !hasAssignedUnit && (
        <Alert severity="info" sx={{ mb: 3 }}>
          You don’t have a unit assigned yet. Once your property manager assigns you to a unit, you’ll be able to view your property details and inspection reports here.
        </Alert>
      )}

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={2}>
                <BuildIcon color="warning" sx={{ fontSize: 40 }} />
                <Box>
                  <Typography variant="h4">{pendingRequests}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Pending Requests
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={2}>
                <CheckCircleIcon color="info" sx={{ fontSize: 40 }} />
                <Box>
                  <Typography variant="h4">{approvedRequests}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Approved Requests
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={2}>
                <CheckCircleIcon color="success" sx={{ fontSize: 40 }} />
                <Box>
                  <Typography variant="h4">{completedRequests}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Completed
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Unit Information */}
      {!unitsLoading && !unitsError && !hasAssignedUnit && (
        <Card sx={{ mb: 4 }}>
          <CardContent>
            <EmptyState
              icon={HomeIcon}
              title="No unit assigned"
              description="You don’t have a unit assigned yet. Once assigned, your unit details and inspection information will appear here."
            />
          </CardContent>
        </Card>
      )}

      {hasAssignedUnit && (
        <Card sx={{ mb: 4 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Your Unit
            </Typography>
            <Divider sx={{ my: 2 }} />
            {units.map((unit) => (
              <Box key={unit.id}>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary">
                      Unit Number
                    </Typography>
                    <Typography variant="body1" gutterBottom>
                      {unit.unitNumber}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary">
                      Status
                    </Typography>
                    <Chip label={unit.status} color="primary" size="small" />
                  </Grid>
                  {unit.bedrooms && (
                    <Grid item xs={12} sm={6}>
                      <Typography variant="body2" color="text.secondary">
                        Bedrooms
                      </Typography>
                      <Typography variant="body1">{unit.bedrooms}</Typography>
                    </Grid>
                  )}
                  {unit.bathrooms && (
                    <Grid item xs={12} sm={6}>
                      <Typography variant="body2" color="text.secondary">
                        Bathrooms
                      </Typography>
                      <Typography variant="body1">{unit.bathrooms}</Typography>
                    </Grid>
                  )}
                </Grid>
              </Box>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Service Requests */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            My Service Requests
          </Typography>
          <Divider sx={{ my: 2 }} />
          
          <DataState
            data={serviceRequests}
            isLoading={requestsLoading}
            error={requestsError}
            emptyMessage="No service requests yet. Click 'New Service Request' to submit one."
          >
            <Stack spacing={2}>
              {serviceRequests.map((request) => (
                <Card key={request.id} variant="outlined">
                  <CardContent>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="h6" gutterBottom>
                          {request.title}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" paragraph>
                          {request.description}
                        </Typography>
                        <Stack direction="row" spacing={1}>
                          <Chip label={request.category} size="small" />
                          <Chip label={request.priority} size="small" color="warning" />
                          <Chip label={request.status} size="small" color="primary" />
                        </Stack>
                      </Box>
                      <Typography variant="caption" color="text.secondary">
                        {format(new Date(request.createdAt), 'MMM dd, yyyy')}
                      </Typography>
                    </Stack>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          </DataState>
        </CardContent>
      </Card>

      {/* New Service Request Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
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
                {category.replace('_', ' ')}
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
      </Dialog>
      </PageShell>
    </Container>
  );
}
