import {
  Alert,
  Box,
  Container,
  Paper,
  Stack,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableContainer,
  Button,
  Chip,
  Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import useApiQuery from '../hooks/useApiQuery.js';
import useApiMutation from '../hooks/useApiMutation.js';
import DataState from '../components/DataState.jsx';
import GradientButton from '../components/GradientButton';
import { normaliseArray } from '../utils/error.js';
import { queryKeys } from '../utils/queryKeys.js';

export default function RecommendationsPage() {
  const { t } = useTranslation();
  const query = useApiQuery({ queryKey: queryKeys.recommendations.all(), url: '/recommendations' });
  const mutation = useApiMutation({
    url: '/recommendations/:id/convert',
    method: 'post',
    invalidateKeys: [queryKeys.recommendations.all(), queryKeys.jobs.all()],
  });

  const recommendations = normaliseArray(query.data);

  const handleConvert = async (recommendationId) => {
    try {
      await mutation.mutateAsync({ url: `/recommendations/${recommendationId}/convert`, method: 'post' });
    } catch (error) {
      // Handled via mutation state.
    }
  };

  return (
    <Container maxWidth="xl" sx={{ py: { xs: 3, md: 4 } }}>
      <Stack spacing={4}>
        {/* Page Header */}
        <Box>
          <Typography
            variant="h4"
            component="h1"
            sx={{
              fontWeight: 700,
              color: 'text.primary',
              mb: 1,
            }}
          >
            {t('recommendations.title')}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Review inspection follow-ups and convert them into jobs without leaving the workspace.
          </Typography>
        </Box>

        {/* Recommendations Section */}
        <Paper
          elevation={0}
          sx={{
            p: { xs: 2, md: 3 },
            borderRadius: 3,
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" fontWeight={600} gutterBottom>
              Recommendations
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Prioritise and promote important follow-up items
            </Typography>
          </Box>

          {mutation.isError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {mutation.error.message}
            </Alert>
          )}

          <DataState
            isLoading={query.isLoading}
            isError={query.isError}
            error={query.error}
            isEmpty={!query.isLoading && !query.isError && recommendations.length === 0}
            onRetry={query.refetch}
          >
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>ID</TableCell>
                  <TableCell>{t('reports.property')}</TableCell>
                  <TableCell>{t('recommendations.priority')}</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {recommendations.map((recommendation) => (
                  <TableRow key={recommendation.id}>
                    <TableCell>{recommendation.id}</TableCell>
                    <TableCell>{recommendation.propertyName || recommendation.propertyId}</TableCell>
                    <TableCell>
                      {recommendation.priority && (
                        <Chip
                          size="small"
                          label={recommendation.priority}
                          color={recommendation.priority === 'high' ? 'error' : 'default'}
                        />
                      )}
                    </TableCell>
                    <TableCell>{recommendation.description}</TableCell>
                    <TableCell align="right">
                      <GradientButton
                        size="small"
                        onClick={() => handleConvert(recommendation.id)}
                        disabled={mutation.isPending}
                      >
                        Convert to job
                      </GradientButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          </DataState>
        </Paper>
      </Stack>
    </Container>
  );
}
