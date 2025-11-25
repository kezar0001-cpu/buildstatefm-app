import {
  Alert,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableContainer,
  Button,
  Chip,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import useApiQuery from '../hooks/useApiQuery.js';
import useApiMutation from '../hooks/useApiMutation.js';
import DataState from '../components/DataState.jsx';
import PageShell from '../components/PageShell.jsx';
import SectionCard from '../components/SectionCard.jsx';
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
    <PageShell
      title={t('recommendations.title')}
      subtitle="Review inspection follow-ups and convert them into jobs without leaving the workspace."
    >
      <SectionCard
        title="Recommendations"
        subtitle="Prioritise and promote important follow-up items"
      >
        {mutation.isError && (
          <Alert severity="error" sx={{ mx: 2, mt: 2 }}>
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
                      <Button
                        variant="contained"
                        size="small"
                        onClick={() => handleConvert(recommendation.id)}
                        disabled={mutation.isPending}
                      >
                        Convert to job
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </DataState>
      </SectionCard>
    </PageShell>
  );
}
