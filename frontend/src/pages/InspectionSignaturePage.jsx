import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Button,
  Stack,
  Alert,
  Card,
  CardContent,
  Divider,
  IconButton,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  CheckCircle as CheckCircleIcon,
  Clear as ClearIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import useApiQuery from '../hooks/useApiQuery';
import useApiMutation from '../hooks/useApiMutation';
import DataState from '../components/DataState';
import Breadcrumbs from '../components/Breadcrumbs';
import { formatDateTime } from '../utils/date';
import { queryKeys } from '../utils/queryKeys';
import logger from '../utils/logger';

const SIGNATURE_CANVAS_WIDTH = 600;
const SIGNATURE_CANVAS_HEIGHT = 300;

export default function InspectionSignaturePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [signatureData, setSignatureData] = useState(null);

  // Fetch inspection details
  const inspectionQuery = useApiQuery({
    queryKey: queryKeys.inspections.detail(id),
    url: `/inspections/${id}`,
  });

  // Submit signature mutation
  const signatureMutation = useApiMutation({
    method: 'post',
    invalidateKeys: [queryKeys.inspections.detail(id)],
  });

  const inspection = inspectionQuery.data;

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Set canvas size
    const rect = canvas.getBoundingClientRect();
    canvas.width = SIGNATURE_CANVAS_WIDTH;
    canvas.height = SIGNATURE_CANVAS_HEIGHT;

    // Fill with white background
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  const getCanvasPoint = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  const startDrawing = (e) => {
    e.preventDefault();
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const point = getCanvasPoint(e);
    if (point) {
      ctx.beginPath();
      ctx.moveTo(point.x, point.y);
      setHasSignature(true);
    }
  };

  const draw = (e) => {
    e.preventDefault();
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const point = getCanvasPoint(e);
    if (point) {
      ctx.lineTo(point.x, point.y);
      ctx.stroke();
    }
  };

  const stopDrawing = (e) => {
    e.preventDefault();
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
    setSignatureData(null);
  };

  const handleSubmit = async () => {
    if (!hasSignature) {
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      // Convert canvas to blob
      canvas.toBlob(async (blob) => {
        if (!blob) {
          logger.error('Failed to convert signature to blob');
          return;
        }

        // Create form data
        const formData = new FormData();
        formData.append('signature', blob, 'signature.png');

        // Submit signature
        await signatureMutation.mutateAsync({
          url: `/inspections/${id}/signature`,
          data: formData,
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });

        // Navigate back to inspection detail
        navigate(`/inspections/${id}`);
      }, 'image/png');
    } catch (error) {
      logger.error('Failed to submit signature:', error);
    }
  };

  const handleBack = () => {
    navigate(`/inspections/${id}`);
  };

  // Check if this is a move-in or move-out inspection
  const requiresSignature = inspection?.type === 'MOVE_IN' || inspection?.type === 'MOVE_OUT';
  const alreadySigned = !!inspection?.tenantSignature;

  return (
    <Box sx={{ py: { xs: 2, md: 4 } }}>
      <DataState
        isLoading={inspectionQuery.isLoading}
        isError={inspectionQuery.isError}
        error={inspectionQuery.error}
        onRetry={inspectionQuery.refetch}
      >
        {inspection && (
          <Stack spacing={3}>
            <Breadcrumbs
              labelOverrides={{
                [`/inspections/${id}/sign`]: 'Sign Inspection',
              }}
            />

            {/* Header */}
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={{ xs: 2, md: 3 }}
              alignItems={{ xs: 'flex-start', md: 'center' }}
              justifyContent="space-between"
            >
              <Stack direction="row" spacing={2} alignItems="center">
                <IconButton
                  onClick={handleBack}
                  size="large"
                  sx={{ border: '1px solid', borderColor: 'divider' }}
                >
                  <ArrowBackIcon />
                </IconButton>
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 700 }}>
                    Sign Inspection
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {inspection.title}
                  </Typography>
                </Box>
              </Stack>
            </Stack>

            {/* Already Signed Alert */}
            {alreadySigned && (
              <Alert severity="success" icon={<CheckCircleIcon />}>
                This inspection has already been signed. You can view the signature on the inspection detail page.
              </Alert>
            )}

            {/* Not Eligible Alert */}
            {!requiresSignature && (
              <Alert severity="info">
                Signatures are only required for move-in and move-out inspections.
              </Alert>
            )}

            {/* Inspection Details */}
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                  Inspection Details
                </Typography>
                <Divider sx={{ my: 2 }} />
                <Stack spacing={1.5}>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Property
                    </Typography>
                    <Typography variant="body1">{inspection.property?.name || 'N/A'}</Typography>
                  </Box>
                  {inspection.unit && (
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Unit
                      </Typography>
                      <Typography variant="body1">Unit {inspection.unit.unitNumber}</Typography>
                    </Box>
                  )}
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Type
                    </Typography>
                    <Typography variant="body1">{inspection.type?.replace(/_/g, ' ')}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Scheduled Date
                    </Typography>
                    <Typography variant="body1">{formatDateTime(inspection.scheduledDate)}</Typography>
                  </Box>
                  {inspection.completedDate && (
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Completed Date
                      </Typography>
                      <Typography variant="body1">{formatDateTime(inspection.completedDate)}</Typography>
                    </Box>
                  )}
                </Stack>
              </CardContent>
            </Card>

            {/* Signature Canvas */}
            {requiresSignature && !alreadySigned && (
              <Paper sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                  Tenant Signature
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Please sign below to acknowledge the inspection. You can use your mouse or touch screen to draw your signature.
                </Typography>

                <Box
                  sx={{
                    border: '2px solid',
                    borderColor: 'divider',
                    borderRadius: 2,
                    bgcolor: '#fff',
                    overflow: 'hidden',
                    position: 'relative',
                    mb: 2,
                    maxWidth: '100%',
                  }}
                >
                  <canvas
                    ref={canvasRef}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                    style={{
                      display: 'block',
                      width: '100%',
                      height: 'auto',
                      cursor: 'crosshair',
                      touchAction: 'none',
                    }}
                  />
                  {!hasSignature && (
                    <Box
                      sx={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        pointerEvents: 'none',
                        textAlign: 'center',
                      }}
                    >
                      <EditIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                      <Typography variant="body2" color="text.disabled">
                        Sign here
                      </Typography>
                    </Box>
                  )}
                </Box>

                <Stack direction="row" spacing={2} justifyContent="space-between">
                  <Button
                    variant="outlined"
                    startIcon={<ClearIcon />}
                    onClick={clearSignature}
                    disabled={!hasSignature}
                  >
                    Clear
                  </Button>
                  <Button
                    variant="contained"
                    startIcon={<CheckCircleIcon />}
                    onClick={handleSubmit}
                    disabled={!hasSignature || signatureMutation.isPending}
                  >
                    {signatureMutation.isPending ? 'Submitting...' : 'Submit Signature'}
                  </Button>
                </Stack>

                {signatureMutation.isError && (
                  <Alert severity="error" sx={{ mt: 2 }}>
                    {signatureMutation.error?.message || 'Failed to submit signature. Please try again.'}
                  </Alert>
                )}
              </Paper>
            )}

            {/* Signature Required Notice */}
            {requiresSignature && !alreadySigned && (
              <Alert severity="info">
                By signing this inspection report, you acknowledge that you have reviewed the findings and understand the condition of the property/unit.
              </Alert>
            )}
          </Stack>
        )}
      </DataState>
    </Box>
  );
}
