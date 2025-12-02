import React, { useState } from 'react';
import {
  Card,
  CardContent,
  CardActions,
  Button,
  Typography,
  Box,
  Alert,
  Chip,
  Stack,
} from '@mui/material';
import {
  CheckCircle as ApproveIcon,
  Cancel as RejectIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import toast from 'react-hot-toast';
import useApiMutation from '../hooks/useApiMutation';
import LoadingButton from './LoadingButton';
import { queryKeys } from '../utils/queryKeys';
import InspectionRejectionDialog from './InspectionRejectionDialog';

export default function InspectionApprovalCard({ inspection, currentUser }) {
  const [rejectionDialogOpen, setRejectionDialogOpen] = useState(false);
  const [error, setError] = useState('');

  const approveMutation = useApiMutation({
    method: 'POST',
    invalidateKeys: [
      queryKeys.inspections.list(),
      queryKeys.inspections.detail(inspection?.id),
    ],
  });

  const handleApprove = async () => {
    try {
      setError('');
      await approveMutation.mutateAsync({
        url: `/inspections/${inspection.id}/approve`,
        data: {},
      });
      toast.success('Inspection approved successfully!');
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Failed to approve inspection';
      setError(errorMsg);
      toast.error(errorMsg);
    }
  };

  const handleReject = () => {
    setRejectionDialogOpen(true);
  };

  // Don't show card if inspection is not pending approval
  if (inspection?.status !== 'PENDING_APPROVAL') {
    return null;
  }

  // Only show to property managers and admins
  if (currentUser?.role !== 'PROPERTY_MANAGER' && currentUser?.role !== 'ADMIN') {
    return null;
  }

  return (
    <>
      <Card
        sx={{
          bgcolor: 'warning.lighter',
          borderLeft: 4,
          borderColor: 'warning.main',
        }}
      >
        <CardContent>
          <Stack spacing={2}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <WarningIcon color="warning" />
              <Typography variant="h6" component="div">
                Approval Required
              </Typography>
              <Chip label="Pending Approval" color="warning" size="small" />
            </Box>

            <Typography variant="body2" color="text.secondary">
              This inspection has been completed by{' '}
              <strong>
                {inspection.completedBy?.firstName}{' '}
                {inspection.completedBy?.lastName}
              </strong>{' '}
              and is awaiting your approval.
            </Typography>

            {inspection.completedDate && (
              <Typography variant="caption" color="text.secondary">
                Completed on:{' '}
                {new Date(inspection.completedDate).toLocaleDateString()}{' '}
                {new Date(inspection.completedDate).toLocaleTimeString()}
              </Typography>
            )}

            {error && (
              <Alert severity="error" onClose={() => setError('')}>
                {error}
              </Alert>
            )}

            {inspection.rejectionReason && (
              <Alert severity="info" icon={<WarningIcon />}>
                <Typography variant="subtitle2" gutterBottom>
                  Previously Rejected
                </Typography>
                <Typography variant="body2">
                  Reason: {inspection.rejectionReason}
                </Typography>
                {inspection.rejectedBy && (
                  <Typography variant="caption" color="text.secondary">
                    Rejected by: {inspection.rejectedBy.firstName}{' '}
                    {inspection.rejectedBy.lastName} on{' '}
                    {new Date(inspection.rejectedAt).toLocaleDateString()}
                  </Typography>
                )}
              </Alert>
            )}
          </Stack>
        </CardContent>
        <CardActions sx={{ justifyContent: 'flex-end', gap: 1 }}>
          <Button
            startIcon={<RejectIcon />}
            color="error"
            onClick={handleReject}
            disabled={approveMutation.isPending}
          >
            Reject
          </Button>
          <LoadingButton
            startIcon={<ApproveIcon />}
            variant="contained"
            color="success"
            onClick={handleApprove}
            loading={approveMutation.isPending}
          >
            Approve
          </LoadingButton>
        </CardActions>
      </Card>

      <InspectionRejectionDialog
        open={rejectionDialogOpen}
        onClose={() => setRejectionDialogOpen(false)}
        inspection={inspection}
      />
    </>
  );
}
