import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Container, Box, Typography, IconButton, Stack, useTheme, useMediaQuery } from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import DataState from '../components/DataState';
import InspectionConductForm from '../components/InspectionConductForm';
import { queryKeys } from '../utils/queryKeys';
import { useCurrentUser } from '../context/UserContext';

const InspectionConductPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { user } = useCurrentUser();
  const isTechnician = user?.role === 'TECHNICIAN';

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
    if (isTechnician) {
      navigate('/technician/dashboard');
    } else {
      navigate(`/inspections/${id}`);
    }
  };

  const handleCancel = () => {
    if (isTechnician) {
      navigate('/technician/dashboard');
    } else {
      navigate(`/inspections/${id}`);
    }
  };

  if (isLoading) {
    return (
      <Container 
        maxWidth={isTechnician && isMobile ? false : 'xl'} 
        sx={{ 
          py: isTechnician && isMobile ? 2 : 4,
          px: isTechnician && isMobile ? 1 : 3,
        }}
      >
        <DataState type="loading" message="Loading inspection..." />
      </Container>
    );
  }

  if (error) {
    return (
      <Container 
        maxWidth={isTechnician && isMobile ? false : 'xl'} 
        sx={{ 
          py: isTechnician && isMobile ? 2 : 4,
          px: isTechnician && isMobile ? 1 : 3,
        }}
      >
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
      <Container 
        maxWidth={isTechnician && isMobile ? false : 'xl'} 
        sx={{ 
          py: isTechnician && isMobile ? 2 : 4,
          px: isTechnician && isMobile ? 1 : 3,
        }}
      >
        <DataState
          type="empty"
          message="Inspection not found"
          action={{ 
            label: 'Back to inspections', 
            onClick: () => navigate(isTechnician ? '/technician/dashboard' : '/inspections') 
          }}
        />
      </Container>
    );
  }

  return (
    <Container 
      maxWidth={isTechnician && isMobile ? false : 'xl'} 
      sx={{ 
        py: isTechnician && isMobile ? 2 : 4,
        px: isTechnician && isMobile ? 1 : 3,
        pb: isTechnician && isMobile ? 10 : undefined, // Space for mobile bottom nav
      }}
    >
      <Stack 
        direction="row" 
        spacing={2} 
        alignItems="center" 
        sx={{ 
          mb: isTechnician && isMobile ? 2 : 3,
          position: isTechnician && isMobile ? 'sticky' : 'static',
          top: 0,
          bgcolor: isTechnician && isMobile ? 'background.paper' : 'transparent',
          zIndex: isTechnician && isMobile ? 10 : 'auto',
          py: isTechnician && isMobile ? 1 : 0,
          px: isTechnician && isMobile ? 1 : 0,
        }}
      >
        <IconButton 
          onClick={handleCancel}
          sx={{ 
            minWidth: 44, // Touch target size
            minHeight: 44,
          }}
        >
          <ArrowBackIcon />
        </IconButton>
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography 
            variant={isTechnician && isMobile ? 'h6' : 'h4'} 
            sx={{ 
              mb: 0.5,
              fontSize: isTechnician && isMobile ? '1.25rem' : undefined,
            }}
          >
            Conduct Inspection
          </Typography>
          <Typography 
            variant="body2" 
            color="text.secondary"
            sx={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {inspection.title}
          </Typography>
        </Box>
      </Stack>

      <InspectionConductForm
        inspection={inspection}
        onComplete={handleComplete}
        onCancel={handleCancel}
        isMobile={isTechnician && isMobile}
      />
    </Container>
  );
};

export default InspectionConductPage;
