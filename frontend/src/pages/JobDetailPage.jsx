import { useEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Container } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client.js';
import DataState from '../components/DataState.jsx';
import JobDetailModal from '../components/JobDetailModal.jsx';
import { useCurrentUser } from '../context/UserContext.jsx';
import { queryKeys } from '../utils/queryKeys.js';

const ALLOWED_ROLES = ['PROPERTY_MANAGER', 'OWNER', 'ADMIN', 'TECHNICIAN'];

export default function JobDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useCurrentUser();

  const fallbackPath = location.state?.from || '/jobs';

  // Redirect technicians to their dedicated view
  useEffect(() => {
    if (user?.role === 'TECHNICIAN') {
      navigate(`/technician/jobs/${id}`, { replace: true });
    }
  }, [id, navigate, user?.role]);

  // Prevent access for unsupported roles
  useEffect(() => {
    if (user && !ALLOWED_ROLES.includes(user.role)) {
      navigate('/dashboard', { replace: true });
    }
  }, [navigate, user]);

  const {
    data: job,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: queryKeys.jobs.detail(id),
    queryFn: async () => {
      const response = await apiClient.get(`/jobs/${id}`);
      return response.data;
    },
    enabled: user?.role !== 'TECHNICIAN',
  });

  const handleClose = () => {
    navigate(fallbackPath);
  };

  if (user?.role === 'TECHNICIAN' || (user && !ALLOWED_ROLES.includes(user.role))) {
    return null;
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <DataState
        data={job}
        isLoading={isLoading}
        isError={isError}
        error={error}
        isEmpty={!isLoading && !job}
      >
        {job && (
          <JobDetailModal
            job={job}
            open
            onClose={handleClose}
            returnPath={fallbackPath}
            variant="page"
          />
        )}
      </DataState>
    </Container>
  );
}
