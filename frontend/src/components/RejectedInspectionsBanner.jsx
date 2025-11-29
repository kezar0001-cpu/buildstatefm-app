import React, { useState } from 'react';
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Collapse,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Chip,
  Typography,
  Divider,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Refresh as RefreshIcon,
  Visibility as ViewIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import useApiQuery from '../hooks/useApiQuery';
import useApiMutation from '../hooks/useApiMutation';
import { queryKeys } from '../utils/queryKeys';

export default function RejectedInspectionsBanner({ currentUser }) {
  const [expanded, setExpanded] = useState(false);
  const navigate = useNavigate();

  // Fetch rejected inspections for current user
  const { data: inspectionsData, isLoading } = useApiQuery({
    queryKey: ['inspections', 'rejected', currentUser?.id],
    url: `/inspections?assignedToId=${currentUser?.id}&status=IN_PROGRESS&hasRejection=true`,
    enabled: !!currentUser?.id && currentUser?.role === 'TECHNICIAN',
  });

  const resubmitMutation = useApiMutation({
    method: 'POST',
    invalidateKeys: [queryKeys.inspections.list()],
  });

  const rejectedInspections = inspectionsData?.items || inspectionsData?.inspections || [];

  // Don't show banner if no rejected inspections or not a technician
  if (
    isLoading ||
    rejectedInspections.length === 0 ||
    currentUser?.role !== 'TECHNICIAN'
  ) {
    return null;
  }

  const handleResubmit = async (inspectionId) => {
    try {
      // Mark as ready for review again by completing it
      await resubmitMutation.mutateAsync({
        url: `/inspections/${inspectionId}/complete`,
        data: {},
      });
    } catch (err) {
      console.error('Failed to resubmit inspection:', err);
    }
  };

  const handleView = (inspectionId) => {
    navigate(`/inspections/${inspectionId}`);
  };

  return (
    <Alert
      severity="warning"
      sx={{ mb: 3 }}
      action={
        <IconButton
          aria-label="expand"
          size="small"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </IconButton>
      }
    >
      <AlertTitle>
        {rejectedInspections.length} Rejected Inspection
        {rejectedInspections.length > 1 ? 's' : ''} Require Attention
      </AlertTitle>
      <Typography variant="body2">
        The following inspections were rejected and need to be corrected and
        resubmitted.
      </Typography>

      <Collapse in={expanded} timeout="auto" unmountOnExit>
        <List sx={{ mt: 2 }}>
          {rejectedInspections.map((inspection, index) => (
            <React.Fragment key={inspection.id}>
              {index > 0 && <Divider />}
              <ListItem
                sx={{
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  bgcolor: 'background.paper',
                  borderRadius: 1,
                  my: 1,
                }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    width: '100%',
                    alignItems: 'flex-start',
                  }}
                >
                  <Box sx={{ flex: 1 }}>
                    <ListItemText
                      primary={
                        <Box
                          sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                        >
                          <Typography variant="subtitle1" fontWeight="bold">
                            {inspection.title}
                          </Typography>
                          <Chip
                            label={inspection.type}
                            size="small"
                            color="default"
                          />
                        </Box>
                      }
                      secondary={
                        <>
                          <Typography
                            component="span"
                            variant="body2"
                            color="text.secondary"
                          >
                            {inspection.property?.name} -{' '}
                            {inspection.unit?.unitNumber || 'Common Area'}
                          </Typography>
                          <br />
                          <Typography
                            component="span"
                            variant="caption"
                            color="text.secondary"
                          >
                            Rejected:{' '}
                            {new Date(
                              inspection.rejectedAt
                            ).toLocaleDateString()}
                          </Typography>
                        </>
                      }
                    />

                    {inspection.rejectionReason && (
                      <Alert severity="error" sx={{ mt: 1, py: 0.5 }}>
                        <Typography variant="body2" fontWeight="medium">
                          Rejection Reason:
                        </Typography>
                        <Typography variant="body2">
                          {inspection.rejectionReason}
                        </Typography>
                        {inspection.rejectedBy && (
                          <Typography variant="caption" color="text.secondary">
                            - {inspection.rejectedBy.firstName}{' '}
                            {inspection.rejectedBy.lastName}
                          </Typography>
                        )}
                      </Alert>
                    )}
                  </Box>

                  <Box
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 1,
                      ml: 2,
                    }}
                  >
                    <Button
                      size="small"
                      startIcon={<ViewIcon />}
                      onClick={() => handleView(inspection.id)}
                    >
                      View
                    </Button>
                    <Button
                      size="small"
                      variant="contained"
                      color="warning"
                      startIcon={<RefreshIcon />}
                      onClick={() => handleResubmit(inspection.id)}
                      disabled={resubmitMutation.isPending}
                    >
                      Resubmit
                    </Button>
                  </Box>
                </Box>
              </ListItem>
            </React.Fragment>
          ))}
        </List>
      </Collapse>
    </Alert>
  );
}
