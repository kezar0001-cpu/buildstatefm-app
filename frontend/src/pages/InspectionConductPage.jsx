import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Container, Box, Typography, IconButton, Stack } from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import DataState from '../components/DataState';
import InspectionConductForm from '../components/InspectionConductForm';
import { queryKeys } from '../utils/queryKeys';

const InspectionConductPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const {
    data: inspection,
    isLoading,
    error,
  } = useQuery({
    queryKey: queryKeys.inspections.detail(id),
    queryFn: async () => {
      const response = await apiClient.get(`/inspections/${id}`);
      return response.data;
    },
  });

  const handleComplete = () => {
    navigate(`/inspections/${id}`);
  };

  const handleCancel = () => {
    navigate(`/inspections/${id}`);
  };

  if (isLoading) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <DataState type="loading" message="Loading inspection..." />
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <DataState
          type="error"
          message="Failed to load inspection"
          onRetry={() => navigate(`/inspections/${id}`)}
        />
      </Container>
    );
  }

  if (!inspection) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <DataState
          type="empty"
          message="Inspection not found"
          action={{ label: 'Back to inspections', onClick: () => navigate('/inspections') }}
        />
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }}>
        <IconButton onClick={handleCancel}>
          <ArrowBackIcon />
        </IconButton>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h4" sx={{ mb: 0.5 }}>
            Conduct Inspection
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {inspection.title}
          </Typography>
        </Box>
      </Stack>

      <InspectionConductForm
        inspection={inspection}
        onComplete={handleComplete}
        onCancel={handleCancel}
      />
    </Container>
  );
};

export default InspectionConductPage;
